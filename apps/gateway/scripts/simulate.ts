/**
 * Fake a class: N phones join a session and tap reactions, so you can watch the
 * dashboard move without a room full of students.
 *
 *   pnpm simulate K7Q2MX          # 30 students
 *   pnpm simulate K7Q2MX 200      # 200 students
 *   pnpm simulate K7Q2MX 50 confused   # a confused class
 *
 * The session must exist; students wait until you press Go live, then start tapping.
 * They also ask and upvote questions now and then, and vote when you launch a poll.
 */
import { REACTIONS, type JoinAck, type PollView, type PublicQuestion, type Reaction } from "@handsup/shared";
import { io } from "socket.io-client";

const [code, nArg = "30", mood = "mixed"] = process.argv.slice(2);
if (!code) {
  console.log("Usage: pnpm simulate <JOIN_CODE> [students=30] [mixed|happy|confused|fast]");
  process.exit(1);
}
const N = Number(nArg);
const url = (process.env.SIM_GATEWAY_URL ?? `http://localhost:${process.env.GATEWAY_PORT ?? 4000}`) + "/s";

const WEIGHTS: Record<string, Record<Reaction, number>> = {
  mixed: { gotIt: 7, tooFast: 1.5, tooSlow: 1, example: 1, confused: 1 },
  happy: { gotIt: 10, tooFast: 1, tooSlow: 1, example: 1, confused: 0.5 },
  confused: { gotIt: 1, tooFast: 3, tooSlow: 0.5, example: 3, confused: 8 },
  fast: { gotIt: 2, tooFast: 8, tooSlow: 0, example: 2, confused: 3 },
};
const w = WEIGHTS[mood] ?? WEIGHTS.mixed!;
const total = REACTIONS.reduce((a, r) => a + w[r], 0);
function pick(): Reaction {
  let x = Math.random() * total;
  for (const r of REACTIONS) if ((x -= w[r]) <= 0) return r;
  return "gotIt";
}

const SAMPLE_QUESTIONS = [
  "What's the difference between a TLB and a page table?",
  "Will paging be on the midterm?",
  "Can you redo the address translation example?",
  "Slides link please",
  "Why is the page size always a power of two?",
  "What causes thrashing?",
  "Is the TLB per process or shared?",
  "Can you explain the dirty bit again?",
  "How is the TLB different from the page table?",
  "TLB vs page table, what's the difference?",
  "Is paging on the midterm?",
  "Could you go through the address translation example again?",
];

let live = 0;
let asked = 0;
let votes = 0;
let taps = 0;
let limited = 0;
for (let i = 0; i < N; i++) {
  setTimeout(() => {
    const s = io(url, { transports: ["websocket"], forceNew: true });
    let seq = -1;
    let status = "draft";
    s.on("connect", () => {
      s.emit("join", { code, deviceId: `sim-${code}-${i}-device` }, (ack: JoinAck) => {
        if (!ack.ok) {
          console.error(`student ${i}: ${ack.error}`);
          s.disconnect();
          return;
        }
        seq = ack.lastSeq;
        status = ack.session.status;
        if (i === 0) console.log(`Joined "${ack.session.title}" (${ack.session.status}). Press Go live to start the taps.`);
        s.emit("rate", { seq: ++seq, value: 2 + Math.floor(Math.random() * 4) }, () => {});
      });
    });
    s.on("session:status", (e: { status: string }) => (status = e.status));
    let top: PublicQuestion[] = [];
    s.on("questions:top", (q: PublicQuestion[]) => (top = q));
    s.on("poll:open", ({ poll }: { poll: PollView }) => {
      if (Math.random() < 0.1) return; // not everyone votes
      setTimeout(() => {
        const n = poll.options.length;
        const choice = poll.kind === "rating" ? 1 + Math.min(4, Math.floor(Math.random() * 3 + Math.random() * 3)) : poll.kind === "multi" ? [Math.floor(Math.random() * n)] : Math.floor(Math.random() ** 1.6 * n);
        s.emit("vote", { pollId: poll.id, choice }, (a: { ok: boolean }) => a.ok && votes++);
      }, 1000 + Math.random() * 6000);
    });
    s.on("session:ended", () => {
      status = "ended";
      s.disconnect();
    });
    // Each fake student taps every 2–12 s, sometimes several times in one batch.
    const loop = () => {
      if (status === "live" && s.connected) {
        const counts: Partial<Record<Reaction, number>> = {};
        const n = 1 + Math.floor(Math.random() * 3);
        for (let k = 0; k < n; k++) {
          const r = pick();
          counts[r] = (counts[r] ?? 0) + 1;
        }
        s.emit("react", { seq: ++seq, counts }, (ack: { ok: boolean; reason?: string }) => {
          if (ack.ok) taps += n;
          else if (ack.reason === "rate_limited") limited++;
        });
        // Now and then: ask a question, or upvote one that's already there (popular ones get more votes).
        if (Math.random() < 0.03) {
          const text = SAMPLE_QUESTIONS[Math.floor(Math.random() ** 2 * SAMPLE_QUESTIONS.length)]!;
          s.emit("ask", { clientId: `sim-${i}-${Date.now()}`, text }, (a: { ok: boolean }) => a.ok && asked++);
        } else if (top.length && Math.random() < 0.15) {
          const q = top[Math.floor(Math.random() ** 2 * top.length)]!;
          s.emit("upvote", { questionId: q.id }, () => {});
        }
      }
      setTimeout(loop, 2000 + Math.random() * 10000);
    };
    setTimeout(loop, Math.random() * 3000);
    setInterval(() => s.connected && s.emit("hb", { t: Date.now() }), 15000);
    live++;
  }, i * 20);
}

setInterval(
  () => console.log(`${live} students connected · ${taps} taps · ${asked} questions · ${votes} poll votes${limited ? ` · ${limited} rate-limited` : ""}`),
  5000,
);
process.on("SIGINT", () => process.exit(0));
