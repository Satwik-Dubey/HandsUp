/**
 * Demo students: lets a teacher try HandsUp alone ("Add demo students" on the dashboard,
 * or "Run a demo lecture" during first-time setup).
 *
 * The web app publishes { type: "demo:start" } on the control channel; this worker connects
 * that many fake phones to the gateway. They follow a short script so the demo shows every
 * feature: a calm start, a confused stretch with a hot question, then recovery.
 * They leave after LIMITS.demoMinutes or when the class ends.
 */
import { createRedis } from "@handsup/server";
import { LIMITS, REACTIONS, rk, type ControlMessage, type JoinAck, type PollView, type PublicQuestion, type Reaction } from "@handsup/shared";
import { io, type Socket } from "socket.io-client";
import { env } from "./env";

const sub = createRedis(env.redisUrl, "demo:sub");
const lock = createRedis(env.redisUrl, "demo");
const running = new Map<string, Socket[]>();

type Mood = Record<Reaction, number>;
const CALM: Mood = { gotIt: 8, tooFast: 1, tooSlow: 0.5, example: 0.5, confused: 0.5 };
const LOST: Mood = { gotIt: 1, tooFast: 3, tooSlow: 0, example: 3, confused: 8 };
const BACK: Mood = { gotIt: 9, tooFast: 0.5, tooSlow: 0.5, example: 1, confused: 0.5 };

/** Minutes 0–2 calm, 2–4.5 lost, then recovering. */
function moodAt(elapsedMs: number): Mood {
  const m = elapsedMs / 60_000;
  return m < 2 ? CALM : m < 4.5 ? LOST : BACK;
}

const QUESTIONS_CALM = ["Slides link please", "Will this be on the midterm?", "Is paging on the midterm?", "Can you share the slides after class?"];
const QUESTIONS_LOST = [
  "What's the difference between a TLB and a page table?",
  "How is the TLB different from the page table?",
  "TLB vs page table, what's the difference?",
  "Is the TLB just a cache for the page table?",
  "Why do we need a TLB if we have a page table?",
  "Can you redo the address translation example?",
  "Could you go through the address example again?",
  "What happens on a TLB miss?",
];

function pick(w: Mood): Reaction {
  const total = REACTIONS.reduce((a, r) => a + w[r], 0);
  let x = Math.random() * total;
  for (const r of REACTIONS) if ((x -= w[r]) <= 0) return r;
  return "gotIt";
}

function startDemo(sessionId: string, code: string, count: number) {
  if (running.has(sessionId)) return;
  const sockets: Socket[] = [];
  running.set(sessionId, sockets);
  let liveSince: number | null = null;
  const url = `${env.gatewayUrl}/s`;
  console.log(`[demo] ${count} demo students joining ${code}`);

  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      if (!running.has(sessionId)) return;
      const s = io(url, { transports: ["websocket"], forceNew: true, reconnectionAttempts: 3 });
      sockets.push(s);
      let seq = -1;
      let status = "draft";
      let top: PublicQuestion[] = [];
      s.on("connect", () => {
        s.emit("join", { code, deviceId: `demo-${sessionId.slice(0, 8)}-${i}-device` }, (ack: JoinAck) => {
          if (!ack.ok) return void s.disconnect();
          seq = ack.lastSeq;
          status = ack.session.status;
          if (status === "live") liveSince ??= Date.now();
          s.emit("rate", { seq: ++seq, value: 3 + Math.floor(Math.random() * 3) }, () => {});
        });
      });
      s.on("session:status", (e: { status: string }) => {
        status = e.status;
        if (status === "live") liveSince ??= Date.now();
      });
      s.on("session:ended", () => stopDemo(sessionId));
      s.on("questions:top", (q: PublicQuestion[]) => (top = q));
      s.on("poll:open", ({ poll }: { poll: PollView }) => {
        if (Math.random() < 0.1) return;
        setTimeout(() => {
          const n = poll.options.length;
          const choice =
            poll.kind === "rating" ? 3 + Math.floor(Math.random() * 3) : poll.kind === "multi" ? [Math.floor(Math.random() * n)] : Math.floor(Math.random() ** 1.8 * n);
          s.emit("vote", { pollId: poll.id, choice }, () => {});
        }, 1500 + Math.random() * 8000);
      });
      const loop = () => {
        if (!running.has(sessionId)) return;
        if (status === "live" && s.connected && liveSince) {
          const elapsed = Date.now() - liveSince;
          const mood = moodAt(elapsed);
          const lost = mood === LOST;
          // Some students go quiet while lost, which shows up as an engagement drop.
          if (!(lost && i % 3 === 0)) {
            const counts: Partial<Record<Reaction, number>> = {};
            const r = pick(mood);
            counts[r] = 1 + (Math.random() < 0.3 ? 1 : 0);
            s.emit("react", { seq: ++seq, counts }, () => {});
          }
          const askChance = lost ? 0.08 : 0.015;
          if (Math.random() < askChance) {
            const pool = lost ? QUESTIONS_LOST : QUESTIONS_CALM;
            const text = pool[Math.floor(Math.random() ** 1.5 * pool.length)]!;
            s.emit("ask", { clientId: `demo-${i}-${Date.now()}`, text }, () => {});
          } else if (top.length && Math.random() < 0.12) {
            const q = top[Math.floor(Math.random() ** 2 * top.length)]!;
            s.emit("upvote", { questionId: q.id }, () => {});
          }
        }
        setTimeout(loop, 3000 + Math.random() * 9000);
      };
      setTimeout(loop, Math.random() * 3000);
      const hb = setInterval(() => {
        if (!running.has(sessionId)) clearInterval(hb);
        else if (s.connected) s.emit("hb", { t: Date.now() });
      }, LIMITS.heartbeatMs);
    }, i * 80);
  }
  setTimeout(() => stopDemo(sessionId), LIMITS.demoMinutes * 60_000);
}

function stopDemo(sessionId: string) {
  const sockets = running.get(sessionId);
  if (!sockets) return;
  running.delete(sessionId);
  for (const s of sockets) s.disconnect();
  console.log(`[demo] demo students left ${sessionId.slice(0, 8)}`);
}

export async function startDemoHost() {
  await sub.subscribe(rk.controlChannel);
  sub.on("message", async (_ch, raw) => {
    let msg: ControlMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type === "demo:start") {
      // With several worker copies, only one hosts the demo.
      if ((await lock.set(`lock:demo:${msg.sessionId}`, env.consumerName, "PX", LIMITS.demoMinutes * 60_000, "NX")) !== "OK") return;
      startDemo(msg.sessionId, msg.code, Math.min(Math.max(1, msg.count), 60));
    } else if (msg.type === "session:status" && msg.status === "ended") {
      stopDemo(msg.sessionId);
    }
  });
}

export async function stopDemoHost() {
  for (const sid of running.keys()) stopDemo(sid);
  await Promise.allSettled([sub.quit(), lock.quit()]);
}
