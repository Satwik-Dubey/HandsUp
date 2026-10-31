/**
 * k6 load test: 1,000 phones in one lecture (design: "Load-test target").
 *
 *   k6 run -e GATEWAY=ws://localhost:4000 -e CODE=K7Q2MX loadtest/students.js
 *
 * Each virtual student opens a WebSocket, speaks the Socket.IO protocol by hand
 * (k6 has no Socket.IO client), joins the class, then taps a reaction every ~10 s,
 * sends heartbeats and sometimes asks a question, like a real phone.
 * Press "Go live" on the dashboard before or during the run; taps only count when live.
 *
 * Pass criteria: 99% of joins succeed, and 95% of taps are acknowledged within 500 ms.
 * Watch the teacher dashboard while it runs: the counters should keep up (target lag < 1.5 s).
 */
import ws from "k6/ws";
import { check } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const GATEWAY = __ENV.GATEWAY || "ws://localhost:4000";
const CODE = __ENV.CODE;
const STUDENTS = Number(__ENV.STUDENTS || 1000);
const MINUTES = Number(__ENV.MINUTES || 5);

if (!CODE) throw new Error("Pass the class code: -e CODE=K7Q2MX");

export const options = {
  scenarios: {
    lecture: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: STUDENTS }, // everyone scans the QR in the first minute
        { duration: `${MINUTES}m`, target: STUDENTS },
        { duration: "20s", target: 0 },
      ],
      gracefulRampDown: "20s",
    },
  },
  thresholds: {
    join_ok: ["rate>0.99"],
    react_ack_ms: ["p(95)<500"],
  },
};

const joinOk = new Rate("join_ok");
const reactAck = new Trend("react_ack_ms", true);
const reactRejected = new Counter("react_rejected");
const REACTIONS = ["gotIt", "gotIt", "gotIt", "confused", "tooFast", "tooSlow", "example"];
const NS = "/s";

export default function () {
  const deviceId = `k6-${__VU}-${Math.random().toString(36).slice(2, 12)}`;
  const url = `${GATEWAY}/socket.io/?EIO=4&transport=websocket`;

  const res = ws.connect(url, {}, (socket) => {
    let ackId = 0;
    const pending = {}; // ack id → { at, kind }
    let seq = -1;
    let joined = false;

    const emit = (event, payload, kind) => {
      const id = ackId++;
      pending[id] = { at: Date.now(), kind };
      socket.send(`42${NS},${id}${JSON.stringify([event, payload])}`);
    };

    socket.on("message", (msg) => {
      if (msg === "2") return socket.send("3"); // Engine.IO ping → pong
      if (msg.startsWith("0")) return socket.send(`40${NS},`); // open → connect to namespace
      if (msg.startsWith(`40${NS},`)) return emit("join", { code: CODE, deviceId }, "join");
      if (msg.startsWith(`43${NS},`)) {
        const body = msg.slice(NS.length + 3);
        const m = body.match(/^(\d+)(.*)$/);
        if (!m) return;
        const p = pending[m[1]];
        delete pending[m[1]];
        if (!p) return;
        const [ack] = JSON.parse(m[2]);
        if (p.kind === "join") {
          joined = Boolean(ack && ack.ok);
          joinOk.add(joined);
          if (joined) seq = ack.lastSeq;
        } else if (p.kind === "react") {
          reactAck.add(Date.now() - p.at);
          if (!ack.ok) reactRejected.add(1);
        }
      }
      // Broadcasts (presence, questions:top, poll:open …) are ignored.
    });

    // Tap every 6–14 s, like a busy student.
    socket.setInterval(() => {
      if (!joined) return;
      const r = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
      emit("react", { seq: ++seq, counts: { [r]: 1 } }, "react");
      if (Math.random() < 0.01) emit("ask", { clientId: `${deviceId}-${Date.now()}`, text: "Can you go over the TLB example again?" }, "ask");
    }, 6000 + Math.random() * 8000);

    socket.setInterval(() => joined && socket.send(`42${NS}${JSON.stringify(["hb", { t: Date.now() }])}`), 15000);

    socket.setTimeout(() => socket.close(), (MINUTES * 60 + 60) * 1000);
  });

  check(res, { "socket opened": (r) => r && r.status === 101 });
}
