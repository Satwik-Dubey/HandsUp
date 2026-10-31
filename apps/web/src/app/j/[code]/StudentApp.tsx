"use client";

import { ConfettiBurst } from "@/components/motion/ConfettiBurst";
import {
  LIMITS,
  NAMESPACE,
  type AskAck,
  type JoinAck,
  type JoinInfo,
  type PollChoice,
  type PollResults,
  type PollView,
  type PublicQuestion,
  type Reaction,
  type ReactAck,
  type SegmentView,
  type StudentClientToServer,
  type StudentServerToClient,
  type UpvoteAck,
  type VoteAck,
} from "@handsup/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { BarChart3, Check, CircleHelp, Flame, Hourglass, Lock, PartyPopper, SearchX, Star, ThumbsUp, Trophy, Users, type LucideIcon } from "lucide-react";
import { Confetti } from "@/components/Confetti";
import { Ico, IconBadge } from "@/components/icons";
import { Wordmark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { gatewayUrl } from "@/lib/gateway";
import { PollTab } from "./PollTab";
import { QuestionsTab } from "./QuestionsTab";
import { ReactTab } from "./ReactTab";
import { store } from "./store";

type Phase = "intro" | "connecting" | "waiting" | "live" | "ended";
type Tab = "react" | "poll" | "questions";
type Outgoing = { event: "react"; msg: { seq: number; counts: Partial<Record<Reaction, number>> } } | { event: "rate"; msg: { seq: number; value: number } };
type Stats = { taps: number; rated: number | null; asked: number; polls: string[] };
type StudentSocket = Socket<StudentServerToClient, StudentClientToServer>;

function deviceId(): string {
  let id = store.get("handsup:device");
  if (!id) {
    id = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    store.set("handsup:device", id);
  }
  return id;
}

function newId() {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export function StudentApp({ info }: { info: JoinInfo }) {
  const code = info.code;
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(() => (info.status === "ended" ? "ended" : "intro"));
  const [tab, setTab] = useState<Tab>("react");
  const [session, setSession] = useState({ title: info.title, courseName: info.courseName, teacherName: info.teacherName, inputs: info.inputs });
  const [active, setActive] = useState(0);
  const [online, setOnline] = useState(true);
  const [rating, setRating] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ taps: 0, rated: null, asked: 0, polls: [] });
  const [joinError, setJoinError] = useState<string | null>(null);
  const [segment, setSegment] = useState<SegmentView | null>(null);
  const [answeredNote, setAnsweredNote] = useState<string | null>(null);
  // Questions
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [upvoted, setUpvoted] = useState<Set<string>>(new Set());
  // Polls
  const [poll, setPoll] = useState<PollView | null>(null);
  const [myChoice, setMyChoice] = useState<PollChoice | null>(null);
  const [results, setResults] = useState<PollResults | null>(null);
  const [pollUnseen, setPollUnseen] = useState(false);

  const socketRef = useRef<StudentSocket | null>(null);
  const seqRef = useRef(-1);
  const outbox = useRef<Outgoing[]>([]);
  const tabRef = useRef<Tab>("react");
  tabRef.current = tab;

  // Restore this phone's earlier state for this class.
  useEffect(() => {
    seqRef.current = Number(store.get(`handsup:seq:${code}`) ?? -1);
    const s = store.get(`handsup:stats:${code}`);
    if (s) setStats((prev) => ({ ...prev, ...JSON.parse(s) }));
    // A phone that already joined this class skips the intro and rejoins straight away.
    if (info.status !== "ended" && store.get(`handsup:resume:${code}`)) connect();
    return () => {
      socketRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tell the student when the teacher marks one of their questions answered (once per question).
  const answeredSeen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const done = questions.filter((q) => mine.has(q.id) && q.status === "answered").map((q) => q.id);
    if (answeredSeen.current === null) {
      answeredSeen.current = new Set(done); // already answered before this page loaded: no note
      return;
    }
    const fresh = done.filter((id) => !answeredSeen.current!.has(id));
    if (!fresh.length) return;
    fresh.forEach((id) => answeredSeen.current!.add(id));
    if (phase === "live") {
      setAnsweredNote(questions.find((q) => q.id === fresh[0])?.text ?? "");
      navigator.vibrate?.([20, 60, 20]);
    }
  }, [questions, mine, phase]);

  // Once the class is over this phone has nothing left to send: close the socket and forget the seat.
  useEffect(() => {
    if (phase !== "ended") return;
    socketRef.current?.disconnect();
    socketRef.current = null;
    store.remove(`handsup:resume:${code}`);
  }, [phase, code]);

  function leave() {
    if (!window.confirm("Leave this class? You can rejoin any time with the same code.")) return;
    socketRef.current?.disconnect();
    socketRef.current = null;
    store.remove(`handsup:resume:${code}`);
    router.push("/");
  }

  const showToast = useCallback((t: string) => {
    setToast(t);
    setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 2400);
  }, []);

  const bumpStats = useCallback(
    (fn: (s: Stats) => Stats) => {
      setStats((prev) => {
        const next = fn(prev);
        store.set(`handsup:stats:${code}`, JSON.stringify(next));
        return next;
      });
    },
    [code],
  );

  function nextSeq() {
    seqRef.current += 1;
    store.set(`handsup:seq:${code}`, String(seqRef.current));
    return seqRef.current;
  }

  function onAck(item: Outgoing, ack: ReactAck) {
    outbox.current = outbox.current.filter((o) => o !== item);
    if (ack.reason === "rate_limited") showToast("Whoa, slow down a little");
    if (ack.reason === "not_live") showToast("Class isn't live right now");
  }

  function send(item: Outgoing) {
    const s = socketRef.current;
    if (!s?.connected) return; // stays in the outbox; resent after rejoining
    if (item.event === "react") s.timeout(5000).emit("react", item.msg, (err, ack) => !err && onAck(item, ack));
    else s.timeout(5000).emit("rate", item.msg, (err, ack) => !err && onAck(item, ack));
  }

  function openPoll(p: PollView) {
    setPoll(p);
    if (tabRef.current !== "poll") {
      setTab("poll"); // the poll card slides in by itself
      setPollUnseen(false);
    }
  }

  function connect() {
    if (socketRef.current) return;
    setPhase((p) => (p === "intro" ? "connecting" : p));
    const s: StudentSocket = io(`${gatewayUrl()}${NAMESPACE.student}`, { transports: ["websocket", "polling"], reconnectionDelayMax: 4000 });
    socketRef.current = s;

    s.on("connect", () => {
      setOnline(true);
      s.timeout(8000).emit(
        "join",
        { code, deviceId: deviceId(), resumeToken: store.get(`handsup:resume:${code}`) ?? undefined },
        (err: Error | null, ack: JoinAck) => {
          if (err) return; // reconnect will retry
          if (!ack.ok) {
            if (ack.error === "ended") setPhase("ended");
            else setJoinError(ack.error);
            s.disconnect();
            return;
          }
          store.set(`handsup:resume:${code}`, ack.resumeToken);
          seqRef.current = Math.max(seqRef.current, ack.lastSeq);
          setSession({ title: ack.session.title, courseName: ack.session.courseName, teacherName: ack.session.teacherName, inputs: ack.session.inputs });
          setActive(ack.active);
          if (ack.myRating) setRating(ack.myRating);
          setQuestions(ack.questions);
          setMine(new Set(ack.myQuestionIds));
          setUpvoted(new Set(ack.myUpvoteIds));
          setSegment(ack.segment);
          setMyChoice(ack.myPollChoice);
          setResults(ack.pollResults);
          if (ack.activePoll) openPoll(ack.activePoll);
          setPhase(ack.session.status === "live" ? "live" : ack.session.status === "ended" ? "ended" : "waiting");
          // Anything that didn't get an ack before the drop goes again with its original seq.
          for (const item of outbox.current) send(item);
        },
      );
    });
    s.on("disconnect", () => setOnline(false));
    s.on("connect_error", () => setOnline(false));
    s.on("presence", (e) => setActive(e.active));
    s.on("session:status", (e) => setPhase(e.status === "live" ? "live" : e.status === "ended" ? "ended" : "waiting"));
    s.on("session:ended", () => setPhase("ended"));
    s.on("segment", (seg) => setSegment(seg));
    s.on("questions:top", (q) => setQuestions(q));
    s.on("poll:open", ({ poll: p }) => {
      setMyChoice(null);
      setResults(null);
      openPoll(p);
      navigator.vibrate?.([30, 40, 30]);
    });
    s.on("poll:results", (r) => setResults((cur) => (r.pollId === (cur?.pollId ?? r.pollId) ? r : cur)));
    s.on("poll:close", ({ pollId, results: r }) => {
      setPoll((p) => (p && p.id === pollId ? { ...p, closedAt: Date.now() } : p));
      if (r) setResults(r);
    });
  }

  // Heartbeats keep this phone counted as "here".
  useEffect(() => {
    const beat = () => socketRef.current?.connected && socketRef.current.emit("hb", { t: Date.now() });
    const iv = setInterval(beat, LIMITS.heartbeatMs);
    const onVis = () => document.visibilityState === "visible" && beat();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // ---- actions passed to the tabs ----

  function sendReactions(counts: Partial<Record<Reaction, number>>) {
    const item: Outgoing = { event: "react", msg: { seq: nextSeq(), counts } };
    outbox.current.push(item);
    send(item);
  }

  function rate(value: number) {
    setRating(value);
    const item: Outgoing = { event: "rate", msg: { seq: nextSeq(), value } };
    outbox.current.push(item);
    send(item);
    bumpStats((s) => ({ ...s, rated: value }));
  }

  function ask(text: string): Promise<boolean> {
    return new Promise((resolve) => {
      const s = socketRef.current;
      if (!s?.connected) {
        showToast("You're offline. Try again in a moment.");
        return resolve(false);
      }
      s.timeout(8000).emit("ask", { clientId: newId(), text }, (err: Error | null, ack: AskAck) => {
        if (err) {
          showToast("Couldn't send. Try again.");
          return resolve(false);
        }
        if (!ack.ok) {
          showToast(
            ack.reason === "profanity"
              ? "Please keep it classroom-friendly"
              : ack.reason === "rate_limited"
                ? "Wait a little before asking again"
                : ack.reason === "disabled"
                  ? "Questions are turned off for this class"
                  : "Couldn't send that question",
          );
          return resolve(false);
        }
        setMine((m) => new Set(m).add(ack.id));
        bumpStats((st) => ({ ...st, asked: st.asked + 1 }));
        showToast(ack.status === "pending" ? "Sent. Your teacher will review it first." : "Question sent");
        resolve(true);
      });
    });
  }

  function upvote(id: string) {
    const was = upvoted.has(id);
    // Optimistic: flip now, correct when the server answers.
    setUpvoted((u) => {
      const n = new Set(u);
      if (was) n.delete(id);
      else n.add(id);
      return n;
    });
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, votes: Math.max(0, q.votes + (was ? -1 : 1)) } : q)));
    socketRef.current?.timeout(5000).emit("upvote", { questionId: id }, (err: Error | null, ack: UpvoteAck) => {
      if (err || !ack.ok) return;
      setUpvoted((u) => {
        const n = new Set(u);
        if (ack.voted) n.add(id);
        else n.delete(id);
        return n;
      });
      setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, votes: ack.votes } : q)));
    });
  }

  function vote(choice: PollChoice) {
    if (!poll) return;
    const prev = myChoice;
    setMyChoice(choice);
    socketRef.current?.timeout(5000).emit("vote", { pollId: poll.id, choice }, (err: Error | null, ack: VoteAck) => {
      if (err || !ack.ok) {
        setMyChoice(prev);
        showToast(!err && !ack.ok && ack.reason === "closed" ? "This poll has closed" : "Vote didn't go through. Try again.");
        return;
      }
      bumpStats((s) => (s.polls.includes(poll.id) ? s : { ...s, polls: [...s.polls, poll.id] }));
    });
  }

  // ---- screens ----

  if (joinError) {
    return (
      <Shell>
        <div className="card flex flex-col gap-3 p-6 text-center">
          <IconBadge icon={SearchX} tone="sun" size="xl" className="self-center" />
          <p className="text-xl font-semibold">{joinError === "too_many_attempts" ? "Too many tries. Wait a minute and try again." : "We couldn't join this class."}</p>
          <Link href="/join" className="pill">
            Enter a code
          </Link>
          <Link href="/" className="text-sm text-muted underline">
            Back to home
          </Link>
        </div>
      </Shell>
    );
  }

  if (phase === "intro" || phase === "connecting") {
    return (
      <Shell>
        <div className="relative overflow-hidden rounded-4xl bg-coral p-6 text-white">
          <Confetti />
          <div className="relative flex flex-col gap-4">
            <span className="self-start rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">{info.status === "live" ? "● LIVE" : "⏳ Starts soon"}</span>
            <h1 className="poster text-6xl">HandsUp</h1>
            <p className="font-light text-white/90">
              You&apos;re joining <b className="font-semibold">{session.courseName}</b> · {session.title}. React, vote and ask without anyone knowing it&apos;s you.
            </p>
          </div>
        </div>
        <div className="card flex items-center justify-center py-5 text-4xl font-semibold tracking-[0.3em]">{code}</div>
        <button className="pill py-4 text-lg" onClick={connect} disabled={phase === "connecting"}>
          {phase === "connecting" ? "Joining…" : "Join anonymously →"}
        </button>
        <p className="text-center text-sm text-muted">No account, no name, no email. Your teacher sees totals, never who.</p>
        <Link href="/" className="text-center text-sm text-muted underline">
          ← Back to home
        </Link>
      </Shell>
    );
  }

  if (phase === "ended") {
    const answered = questions.filter((q) => mine.has(q.id) && q.status === "answered");
    return (
      <Shell>
        {/* only celebrate a class this phone took part in, not a stale link to an old one */}
        {info.status !== "ended" && <ConfettiBurst />}
        <div className="flex animate-fade-up flex-col items-center gap-3 pt-6 text-center">
          <IconBadge icon={PartyPopper} tone="coral" size="xl" className="animate-boing" />
          <h1 className="poster text-6xl">Class ended</h1>
          <p className="text-muted">
            {session.courseName} · {session.title}
          </p>
          <p className="text-xl font-light text-text2">Thanks for speaking up!</p>
        </div>
        {(stats.taps > 0 || stats.rated || stats.asked > 0 || stats.polls.length > 0) && (
          <div className="card flex flex-col gap-2 p-5">
            <span className="eyebrow">Today you</span>
            <ul className="grid grid-cols-2 gap-2">
              {(
                [
                  stats.taps ? [ThumbsUp, "lime", `Reacted ${stats.taps} ${stats.taps === 1 ? "time" : "times"}`] : null,
                  stats.asked ? [CircleHelp, "sun", `Asked ${stats.asked} ${stats.asked === 1 ? "question" : "questions"}`] : null,
                  stats.polls.length ? [BarChart3, "sky", `Voted in ${stats.polls.length} ${stats.polls.length === 1 ? "poll" : "polls"}`] : null,
                  stats.rated ? [Star, "pink", `Rated clarity ${stats.rated}/5`] : null,
                ].filter(Boolean) as [LucideIcon, "lime" | "sun" | "sky" | "pink", string][]
              ).map(([icon, tone, text]) => (
                <li key={text} className="flex items-center gap-2 rounded-2xl bg-paper p-2 text-sm font-medium">
                  <IconBadge icon={icon} tone={tone} size="sm" />
                  {text}
                </li>
              ))}
            </ul>
            {answered.map((q) => (
              <p key={q.id} className="rounded-2xl bg-paper px-3 py-2 text-sm">
                <Ico icon={Check} size={16} className="mr-1 text-forest" />
                Your question was answered <span className="text-muted">“{q.text}”</span>
              </p>
            ))}
            <p className="text-xs text-muted">These stats live only on your phone.</p>
          </div>
        )}
        <div className="flex flex-col gap-3">
          <Link href="/" className="pill py-4 text-lg">
            ← Back to home
          </Link>
          <Link href="/join" className="pill-ghost py-4 text-lg">
            Join another class
          </Link>
        </div>
        <p className="text-center text-sm text-muted">You can close this tab now.</p>
      </Shell>
    );
  }

  const header = (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm text-muted">{session.courseName}</p>
        <p className="truncate text-xl font-semibold">{session.title}</p>
      </div>
      <div className="flex flex-none items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 font-semibold shadow-soft">
          <Ico icon={Users} size={16} /> {active}
        </span>
        <button className="rounded-full px-3 py-1.5 text-sm text-muted hover:text-coral" onClick={leave}>
          Leave
        </button>
      </div>
    </div>
  );

  if (phase === "waiting") {
    return (
      <Shell inClass>
        {header}
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <IconBadge icon={Hourglass} tone="sun" size="xl" />
          <h1 className="poster text-5xl">You&apos;re in.</h1>
          <p className="text-xl">Class hasn&apos;t started yet.</p>
          <p className="max-w-xs font-light text-text2">Keep this tab open. It switches on by itself when your teacher goes live.</p>
        </div>
        <p className="text-center text-muted">
          <Ico icon={Users} size={16} /> {active} {active === 1 ? "student" : "students"} waiting
        </p>
        {!online && <Offline />}
      </Shell>
    );
  }

  const { inputs } = session;
  const tabs: { id: Tab; icon: LucideIcon; label: string; show: boolean; dot?: boolean }[] = [
    { id: "react", icon: Flame, label: "React", show: inputs.react || inputs.confused || inputs.rating },
    { id: "poll", icon: BarChart3, label: "Poll", show: true, dot: pollUnseen },
    { id: "questions", icon: Trophy, label: "Questions", show: inputs.questions },
  ];

  return (
    <Shell padBottom inClass>
      {header}
      {segment && tab === "react" && <span className="self-start rounded-full bg-card px-3 py-1 text-sm shadow-soft">{segment.label}</span>}

      {/* keyed by tab so each switch fades the new screen in */}
      <div key={tab} className="flex animate-fade-up flex-col gap-5">
        {tab === "react" && <ReactTab inputs={inputs} rating={rating} onReactions={sendReactions} onRate={rate} onTap={() => bumpStats((s) => ({ ...s, taps: s.taps + 1 }))} />}
        {tab === "poll" && <PollTab poll={poll} myChoice={myChoice} results={results} showResults={inputs.pollResults} onVote={vote} />}
        {tab === "questions" && <QuestionsTab questions={questions} mine={mine} upvoted={upvoted} onAsk={ask} onUpvote={upvote} />}
      </div>

      <p className="pt-2 text-center text-xs text-muted">
        <Ico icon={Lock} size={12} className="mr-1" />
        Anonymous. Your teacher sees totals, never who.
      </p>
      {!online && <Offline />}
      {answeredNote !== null && (
        <div role="status" className="fixed inset-x-0 top-3 z-40 mx-auto flex w-[calc(100%-2.5rem)] max-w-sm animate-slide-up items-center gap-3 rounded-3xl bg-forest p-3 pr-4 text-white shadow-float">
          <IconBadge icon={Check} tone="card" size="md" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Your question was answered</p>
            {answeredNote && <p className="truncate text-sm text-white/80">“{answeredNote}”</p>}
          </div>
          <button className="text-sm font-semibold underline" onClick={() => setAnsweredNote(null)}>
            OK
          </button>
        </div>
      )}
      {toast && (
        <div role="status" className="fixed inset-x-0 bottom-24 z-30 mx-auto w-fit max-w-[90vw] rounded-full bg-ink px-5 py-2.5 text-center text-on-ink shadow-float">
          {toast}
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-4 z-20 mx-auto flex w-[calc(100%-2.5rem)] max-w-sm items-center justify-between rounded-full bg-card p-1.5 shadow-float" aria-label="Sections">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                if (t.id === "poll") setPollUnseen(false);
              }}
              aria-current={tab === t.id ? "page" : undefined}
              className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 font-semibold transition ${
                tab === t.id ? "bg-ink text-on-ink" : "text-muted"
              }`}
            >
              <Ico icon={t.icon} size={18} />
              <span className={tab === t.id ? "" : "sr-only sm:not-sr-only"}>{t.label}</span>
              {t.dot && <span className="absolute right-4 top-2 h-2 w-2 rounded-full bg-coral" />}
            </button>
          ))}
      </nav>
    </Shell>
  );
}

function Offline() {
  return (
    <div className="fixed inset-x-0 top-3 z-30 mx-auto w-fit rounded-full bg-coral px-4 py-1.5 text-sm font-semibold text-white shadow-float" role="status">
      Reconnecting… your taps are saved
    </div>
  );
}

function Shell({ children, padBottom = false, inClass = false }: { children: React.ReactNode; padBottom?: boolean; inClass?: boolean }) {
  const logo = <Wordmark size={24} />;
  return (
    <main id="main" tabIndex={-1} className={`mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-5 pt-5 ${padBottom ? "pb-28" : "pb-10"}`}>
      <div className="flex items-center justify-between">
        {inClass ? (
          <span className="text-lg font-semibold">{logo}</span>
        ) : (
          <Link href="/" className="text-lg font-semibold">
            {logo}
          </Link>
        )}
        <ThemeToggle />
      </div>
      {children}
    </main>
  );
}
