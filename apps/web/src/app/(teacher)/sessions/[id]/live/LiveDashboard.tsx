"use client";

import { CountUp } from "@/components/motion/CountUp";
import { Bell, BellOff, FlaskConical, Keyboard, Undo2, Users } from "lucide-react";
import { IconBadge, REACTION_ICON } from "@/components/icons";
import {
  NAMESPACE,
  REACTIONS,
  REACTION_META,
  type SegmentView,
  type TeacherAck,
  type TeacherClientToServer,
  type TeacherServerToClient,
} from "@handsup/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { io, type Socket } from "socket.io-client";
import { PresentQr } from "@/components/PresentQr";
import { gatewayUrl } from "@/lib/gateway";
import { useLive, type TimelinePoint } from "@/stores/live";
import { addDemoStudents, endSession, setReviewFirst, startSession } from "../../../actions";
import { playChime, unlockSound } from "./alertSound";
import { InsightsPanel } from "./InsightsPanel";
import { ShortcutsHelp, useShortcuts } from "./Shortcuts";
import { PollsPanel, type DashboardPoll } from "./PollsPanel";
import { QuestionsPanel, type QuestionsTab } from "./QuestionsPanel";
import { Timeline, TimelineLegend } from "@/components/Timeline";

export type { DashboardPoll };
type Status = "draft" | "live" | "ended";
type TeacherSocket = Socket<TeacherServerToClient, TeacherClientToServer>;

export function LiveDashboard({
  session,
  course,
  joinUrl,
  polls,
  presenter = false,
}: {
  session: { id: string; title: string; code: string; status: Status; startedAt: string | null; endedAt: string | null; reviewQuestionsFirst: boolean };
  course: { id: string; name: string };
  joinUrl: string;
  polls: DashboardPoll[];
  /** Compact second-screen view. */
  presenter?: boolean;
}) {
  const router = useRouter();
  const live = useLive();
  const { tick, timeline, segments, segment, questions, activePoll, results, connected, error, clusters, insights } = live;
  const [qTab, setQTab] = useState<QuestionsTab>("top");
  const [focus, setFocus] = useState<string | null>(null);
  const [addingPoll, setAddingPoll] = useState(false);
  const [qrSignal, setQrSignal] = useState(0);
  const [showKeys, setShowKeys] = useState(false);
  // Alert sound: off by default, remembered on this computer.
  const [soundOn, setSoundOn] = useState(false);
  const soundRef = useRef(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("handsup:sound") === "on") setSoundOn(true);
    } catch {}
  }, []);
  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);
  const toggleSound = () => {
    const next = !soundOn;
    if (next) {
      unlockSound();
      playChime(false); // a preview, so the teacher hears what it sounds like
    }
    setSoundOn(next);
    try {
      localStorage.setItem("handsup:sound", next ? "on" : "off");
    } catch {}
  };
  const [reviewOn, setReviewOn] = useState(session.reviewQuestionsFirst);
  const questionsRef = useRef<HTMLDivElement>(null);
  const pollsRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>(session.status);
  const [startedAt, setStartedAt] = useState(session.startedAt);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const socketRef = useRef<TeacherSocket | null>(null);
  const launchAfterCreate = useRef<string | null>(null);

  const loadHistory = useCallback(async () => {
    const res = await fetch(`/api/sessions/${session.id}/metrics?step=5s`, { cache: "no-store" });
    if (!res.ok) return;
    const j = (await res.json()) as { windows: TimelinePoint[]; segments: SegmentView[] };
    useLive.getState().loadHistory(j.windows, j.segments);
  }, [session.id]);

  useEffect(() => {
    const s = useLive.getState();
    s.reset();
    void loadHistory();
    const socket: TeacherSocket = io(`${gatewayUrl()}${NAMESPACE.teacher}`, {
      transports: ["websocket", "polling"],
      // A fresh token on every (re)connect.
      auth: (cb) => {
        fetch(`/api/sessions/${session.id}/realtime-token`, { cache: "no-store" })
          .then((r) => r.json())
          .then((j) => cb({ token: j.token }))
          .catch(() => cb({}));
      },
    });
    socketRef.current = socket;
    socket.on("connect", () => {
      s.setConnected(true);
      void loadHistory(); // fill any gap from the time we were disconnected
    });
    socket.on("disconnect", () => s.setConnected(false));
    socket.on("connect_error", (e) =>
      s.setConnected(
        false,
        e.message === "unauthorized" ? "Sign-in expired. Reload the page." : "Can't reach the live server. Is the gateway running on port 4000?",
      ),
    );
    socket.on("tick", (t) => {
      s.pushTick(t);
      setStatus(t.status);
    });
    socket.on("window", (w) => s.pushWindow(w));
    socket.on("segment", (seg) => s.setSegment(seg));
    socket.on("questions", (q) => s.setQuestions(q));
    socket.on("question:new", (q) => s.addQuestion(q));
    socket.on("poll:open", ({ poll }) => s.setActivePoll(poll));
    socket.on("poll:results", (r) => s.setResults(r));
    socket.on("poll:close", ({ pollId, results: r }) => {
      if (useLive.getState().activePoll?.id === pollId) s.setActivePoll(null);
      if (r) s.setResults(r);
    });
    socket.on("clusters", (c) => s.setClusters(c));
    socket.on("insights", (i) => s.setInsights(i));
    socket.on("insight:new", (i) => {
      s.addInsight(i);
      if (soundRef.current && i.severity !== "info") playChime(i.severity === "alert");
    });
    socket.on("insight:ack", ({ id }) => s.ackInsight(id));
    socket.on("session:status", (e) => {
      setStatus(e.status);
      socket.emit("tick:now");
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session.id, loadHistory]);

  // "Answered" and "Hide" can be taken back for a few seconds.
  const [undo, setUndo] = useState<{ id: string; label: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionAction = (a: "question:answer" | "question:hide" | "question:approve" | "question:reopen" | "student:mute", id: string) => {
    send(a, { id });
    if (a !== "question:answer" && a !== "question:hide") return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({ id, label: a === "question:answer" ? "Marked as answered" : "Question hidden" });
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
  };

  const showToast = (t: string) => {
    setToast(t);
    setTimeout(() => setToast((c) => (c === t ? null : c)), 2500);
  };

  /** Sends a teacher command and reports failures. */
  const send = useCallback(<E extends keyof TeacherClientToServer>(event: E, payload: Parameters<TeacherClientToServer[E]>[0]) => {
    const socket = socketRef.current;
    if (!socket?.connected) return showToast("Not connected to the live server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket.timeout(5000) as any).emit(event, payload, (err: Error | null, ack: TeacherAck) => {
      if (err) showToast("The live server didn't answer. Try again.");
      else if (!ack.ok) showToast(`Couldn't do that (${ack.reason})`);
    });
  }, []);

  // A quick poll created during class launches as soon as the page has it.
  useEffect(() => {
    const id = launchAfterCreate.current;
    if (id && polls.some((p) => p.id === id)) {
      launchAfterCreate.current = null;
      send("poll:launch", { pollId: id });
    }
  }, [polls, send]);

  const goLive = () =>
    startTransition(async () => {
      await startSession(session.id);
      setStatus("live");
      setStartedAt((s) => s ?? new Date().toISOString());
      router.refresh();
    });
  const end = () => {
    if (!window.confirm("End the class for everyone? Students will see a thank-you card, and you’ll go to the report.")) return;
    startTransition(async () => {
      await endSession(session.id);
      setStatus("ended");
      // The report is what a teacher wants next; it shows "preparing" until the worker has written it.
      router.push(`/sessions/${session.id}/report`);
    });
  };

  const demo = () =>
    startTransition(async () => {
      const r = await addDemoStudents(session.id);
      showToast(r.ok ? "Demo students are joining. They start reacting once you're live." : r.error);
    });
  const toggleReview = (on: boolean) => {
    setReviewOn(on);
    startTransition(() => setReviewFirst(session.id, on));
  };
  const openQuickPoll = () => {
    setAddingPoll(true);
    pollsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const showGroup = (clusterId: string | null) => {
    setFocus(clusterId);
    if (!clusterId) setQTab("groups");
    questionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const shortcuts = useMemo(
    () => ({
      n: () => status === "live" && send("segment:mark", {}),
      p: () => status !== "ended" && openQuickPoll(),
      q: () => setQrSignal((n) => n + 1),
      "?": () => setShowKeys((v) => !v),
      escape: () => setShowKeys(false),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, send],
  );
  useShortcuts(shortcuts);

  const t = tick;
  const understanding = t?.understanding ?? null;
  const uColor = understanding === null ? "text-muted" : understanding >= 70 ? "text-forest" : understanding >= 50 ? "text-[#B8860B]" : "text-coral";
  const startedMs = startedAt ? new Date(startedAt).getTime() : null;

  if (presenter) {
    const topQ = questions.questions.filter((q) => q.status === "open").sort((a, b) => b.votes - a.votes)[0];
    return (
      <div className="fixed inset-0 z-50 flex flex-col gap-4 overflow-y-auto bg-paper p-4 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="poster min-w-0 flex-1 truncate text-3xl sm:text-4xl">{session.title}</h1>
          <StatusPill status={status} startedAt={startedAt} />
          {status === "live" && (
            <button className="pill" onClick={() => send("segment:mark", {})}>
              {segment ? `${segment.label} · ` : ""}Next slide ▸
            </button>
          )}
          <Link href={`/sessions/${session.id}/live`} className="pill-ghost">
            Full dashboard
          </Link>
        </div>
        {!connected && <p className="rounded-2xl bg-coral/15 px-4 py-3 text-coral">{error ?? "Connecting…"}</p>}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi badge="bg-sky" label="Students here" num={t?.active ?? 0} sub={`${t?.joined ?? 0} joined`} />
          <Kpi badge="bg-lime" label="Engaged now" num={t?.engaged === undefined ? null : t.engaged * 100} unit="%" sub="last minute" />
          <Kpi badge="bg-violet" label="Understanding" num={understanding} valueClass={uColor} sub="out of 100" />
          <Kpi badge="bg-coral" label="Confused" num={t?.confusedRatio === undefined ? null : t.confusedRatio * 100} unit="%" sub={segment?.label ?? "last minute"} />
        </div>
        <InsightsPanel
          compact
          insights={insights}
          startedAt={startedMs}
          onDismiss={(id) => {
            useLive.getState().ackInsight(id);
            send("insight:ack", { id });
          }}
          onPoll={() => window.open(`/sessions/${session.id}/live`, "_blank")}
          onShowQuestion={() => window.open(`/sessions/${session.id}/live`, "_blank")}
        />
        {topQ && (
          <div className="card flex items-center gap-4 p-5">
            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-sun text-xl font-semibold text-[#121212]">{topQ.votes}</span>
            <p className="text-lg">
              <span className="text-sm text-muted">Top question · </span>
              {topQ.text}
            </p>
          </div>
        )}
        {toast && <div className="fixed inset-x-0 bottom-6 mx-auto w-fit rounded-full bg-ink px-5 py-2.5 text-on-ink">{toast}</div>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 basis-full xl:basis-0">
          <Link href={`/courses/${course.id}`} className="text-muted hover:text-ink">
            ← {course.name}
          </Link>
          <h1 className="poster text-4xl sm:text-5xl">{session.title}</h1>
        </div>
        <StatusPill status={status} startedAt={startedAt} />
        <span className="flex items-center gap-1.5 rounded-full bg-card px-4 py-2 font-semibold shadow-soft">
          <Users size={17} strokeWidth={2.25} aria-hidden /> {t?.active ?? 0}
        </span>
        <PresentQr joinUrl={joinUrl} code={session.code} title={session.title} active={t?.active} label="Show QR" openSignal={qrSignal} />
        <button
          className="flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-soft"
          onClick={toggleSound}
          aria-pressed={soundOn}
          aria-label={soundOn ? "Alert sound on. Turn off" : "Alert sound off. Turn on"}
          title={soundOn ? "Alert sound on" : "Alert sound off"}
        >
          {soundOn ? <Bell size={18} strokeWidth={2.25} /> : <BellOff size={18} strokeWidth={2.25} className="text-muted" />}
        </button>
        <button className="flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-soft" onClick={() => setShowKeys(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">
          <Keyboard size={18} strokeWidth={2.25} />
        </button>
        <Link href={`/sessions/${session.id}/present`} target="_blank" className="pill-ghost" title="Compact view for a second screen">
          Presenter
        </Link>
        {status !== "ended" && (
          <button className="pill-ghost" onClick={demo} disabled={pending} title="Fill the room with demo students to try things out">
            <FlaskConical size={17} strokeWidth={2.25} aria-hidden /> Demo students
          </button>
        )}
        {status === "draft" && (
          <button className="pill-coral" onClick={goLive} disabled={pending}>
            Go live →
          </button>
        )}
        {status === "live" && (
          <button className="pill" onClick={end} disabled={pending}>
            End class
          </button>
        )}
        {status === "ended" && (
          <Link href={`/sessions/${session.id}/report`} className="pill-coral">
            View report →
          </Link>
        )}
      </div>

      {!connected && (
        <p role="status" className="rounded-2xl bg-coral/15 px-4 py-3 text-coral">
          {error ?? "Connecting to the live server…"}
        </p>
      )}
      {status === "draft" && (
        <p className="rounded-2xl bg-sun/25 px-4 py-3">
          ⏳ Not live yet. Students can join with <b>{session.code}</b> and wait; their buttons switch on when you press Go live.
        </p>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi badge="bg-sky" label="Students here" num={t?.active ?? 0} sub={`${t?.joined ?? 0} joined in total`} />
        <Kpi badge="bg-lime" label="Engaged now" num={t?.engaged === undefined ? null : t.engaged * 100} unit="%" sub="reacted in the last minute" />
        <Kpi
          badge="bg-violet"
          label="Understanding"
          num={understanding}
          valueClass={uColor}
          sub={understanding === null ? "waiting for reactions" : "out of 100, last minute"}
        />
        <Kpi
          badge="bg-coral"
          label="Confused"
          num={t?.confusedRatio === undefined ? null : t.confusedRatio * 100} unit="%"
          valueClass={(t?.confusedRatio ?? 0) > 0.15 ? "text-coral" : undefined}
          sub={segment ? `of students · ${segment.label}` : "of students, last minute"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="card flex flex-col gap-3 self-start p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">Understanding timeline</h2>
            {status === "live" && (
              <button className="pill-ghost pill-sm" onClick={() => send("segment:mark", {})} title="Mark a slide change on the timeline">
                {segment ? `${segment.label} · ` : ""}Next slide ▸
              </button>
            )}
          </div>
          <Timeline points={timeline} segments={segments} startedAt={startedMs} />
          <TimelineLegend />
        </section>

        <InsightsPanel
          insights={insights}
          startedAt={startedMs}
          onDismiss={(id) => {
            useLive.getState().ackInsight(id);
            send("insight:ack", { id });
          }}
          onPoll={openQuickPoll}
          onShowQuestion={showGroup}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div ref={questionsRef} className="scroll-mt-6">
          <QuestionsPanel
            data={questions}
            clusters={clusters}
            reviewOn={reviewOn}
            onToggleReview={toggleReview}
            onAction={questionAction}
            tab={qTab}
            setTab={setQTab}
            focus={focus}
            setFocus={setFocus}
          />
        </div>
        <div className="flex flex-col gap-6">
          <section className="card flex flex-col gap-4 p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-semibold">Reactions</h2>
              <span className="text-sm text-muted">last minute · {t?.reactionsPerMin ?? 0} taps</span>
            </div>
            <ReactionBars counts={t?.lastMinute} />
            <div className="flex items-center justify-between rounded-2xl bg-paper px-4 py-3">
              <span className="text-muted">Clarity rating</span>
              <span className="text-lg font-semibold">{t?.avgRating ? `${t.avgRating.toFixed(1)}/5` : "–"}</span>
              <span className="text-sm text-muted">{t?.ratingCount ?? 0} votes</span>
            </div>
            <div>
              <p className="mb-2 text-sm text-muted">Since the start</p>
              <div className="grid grid-cols-5 gap-2 text-center">
                {REACTIONS.map((r) => (
                  <div key={r} className="rounded-2xl bg-paper py-2">
                    <IconBadge icon={REACTION_ICON[r].icon} tone={REACTION_ICON[r].tone} size="xs" className="mx-auto" />
                    <div className="font-semibold">{t?.totals[r] ?? 0}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <div ref={pollsRef}>
            <PollsPanel
              adding={addingPoll}
              setAdding={setAddingPoll}
              sessionId={session.id}
              polls={polls}
              active={activePoll}
              results={results}
              live={status === "live"}
              onLaunch={(pollId) => send("poll:launch", { pollId })}
              onClose={(pollId) => send("poll:close", { pollId })}
              onCreated={(id) => {
                if (status === "live") launchAfterCreate.current = id;
                router.refresh();
              }}
            />
          </div>
        </div>
      </div>

      {toast && (
        <div role="status" className="fixed inset-x-0 bottom-6 z-40 mx-auto w-fit rounded-full bg-ink px-5 py-2.5 text-on-ink shadow-float">
          {toast}
        </div>
      )}
      {showKeys && <ShortcutsHelp onClose={() => setShowKeys(false)} />}
      {undo && !toast && (
        <div role="status" className="fixed inset-x-0 bottom-6 z-40 mx-auto flex w-fit items-center gap-4 rounded-full bg-ink py-2 pl-5 pr-2 text-on-ink shadow-float">
          {undo.label}
          <button
            className="flex items-center gap-1.5 rounded-full bg-on-ink/15 px-4 py-1.5 font-semibold"
            onClick={() => {
              send("question:reopen", { id: undo.id });
              setUndo(null);
            }}
          >
            <Undo2 size={16} strokeWidth={2.5} aria-hidden /> Undo
          </button>
        </div>
      )}
    </div>
  );
}

function Kpi({ badge, label, num, unit = "", sub, valueClass }: { badge: string; label: string; num: number | null; unit?: string; sub: string; valueClass?: string }) {
  return (
    <div className="card flex flex-col gap-1 p-5">
      <div className="flex items-center gap-2">
        <span className={`h-3 w-3 rounded-full ${badge}`} aria-hidden />
        <span className="text-sm text-muted">{label}</span>
      </div>
      <span className={`poster text-5xl tabular-nums transition-colors duration-500 sm:text-6xl ${valueClass ?? ""}`}>
        <CountUp value={num} format={(n) => `${Math.round(n)}${unit}`} />
      </span>
      <span className="text-xs text-muted">{sub}</span>
    </div>
  );
}

function ReactionBars({ counts }: { counts?: Record<string, number> }) {
  const max = Math.max(1, ...REACTIONS.map((r) => counts?.[r] ?? 0));
  const COLORS: Record<string, string> = { gotIt: "bg-lime", tooFast: "bg-sky", tooSlow: "bg-violet", example: "bg-pink", confused: "bg-sun" };
  return (
    <ul className="flex flex-col gap-2.5">
      {REACTIONS.map((r) => {
        const n = counts?.[r] ?? 0;
        return (
          <li key={r} className="flex items-center gap-3">
            <IconBadge icon={REACTION_ICON[r].icon} tone={REACTION_ICON[r].tone} size="sm" />
            <span className="w-28 text-sm">{REACTION_META[r].label}</span>
            <span className="h-3 flex-1 overflow-hidden rounded-full bg-paper">
              <span className={`block h-full rounded-full transition-all duration-500 ${COLORS[r]}`} style={{ width: `${(n / max) * 100}%` }} />
            </span>
            <span className="w-10 text-right font-semibold tabular-nums">{n}</span>
          </li>
        );
      })}
    </ul>
  );
}

function StatusPill({ status, startedAt }: { status: Status; startedAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status !== "live") return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [status]);

  if (status === "live") {
    const secs = startedAt ? Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000)) : 0;
    const mm = String(Math.floor(secs / 60)).padStart(2, "0");
    const ss = String(secs % 60).padStart(2, "0");
    return (
      // The clock differs by a second between server and browser render; that's expected.
      <span className="rounded-full bg-coral px-4 py-2 font-semibold text-white" suppressHydrationWarning>
        ● LIVE {mm}:{ss}
      </span>
    );
  }
  if (status === "ended") return <span className="rounded-full bg-card px-4 py-2 text-muted shadow-soft">Ended</span>;
  return <span className="rounded-full bg-sun/40 px-4 py-2 font-semibold">Not live</span>;
}
