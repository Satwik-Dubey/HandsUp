/**
 * Insight worker: smart alerts and live AI insights for every live session.
 *
 * Every 5 seconds the alert rules from the design run over the saved 5-second windows.
 * Rules decide *when* to alert, instantly and for free. Once a minute, if anything changed,
 * one Groq call names the question groups and writes a short insight with a suggested
 * next step. Without a Groq key the rule-written alerts still work.
 */
import { and, clusters, desc, eq, getDb, gte, insights, metrics5s, questions, sessions, sql } from "@handsup/db";
import { createRedis } from "@handsup/server";
import {
  AI,
  mean,
  median,
  rk,
  stripPersonalDetails,
  toInsightView,
  type AlertRule,
  type ClusterView,
  type InsightPayload,
  type InsightSeverity,
  type InsightView,
  type SegmentView,
  type TeacherChannelMessage,
} from "@handsup/shared";
import { groqJson } from "./ai/llm";
import { env } from "./env";
import { loadClusters } from "./nlp";

const db = getDb(env.databaseUrl);
const redis = createRedis(env.redisUrl, "insights");
const MIN = 60_000;

async function publish(sid: string, msg: TeacherChannelMessage) {
  await redis.publish(rk.teacherChannel(sid), JSON.stringify(msg));
}

/** True the first time in `ms`; false while the cooldown runs. */
async function cooldown(sid: string, key: string, ms: number = AI.ruleCooldownMs): Promise<boolean> {
  return (await redis.set(rk.ruleCooldown(sid, key), "1", "PX", ms, "NX")) === "OK";
}

export async function saveInsight(
  sid: string,
  kind: InsightView["kind"],
  severity: InsightSeverity,
  message: string,
  payload: InsightPayload,
): Promise<InsightView> {
  const [row] = await db.insert(insights).values({ sessionId: sid, kind, severity, message, payload }).returning();
  const view = toInsightView(row!);
  await publish(sid, { type: "insight", data: view });
  return view;
}

interface Win {
  bucket: number;
  active: number;
  engaged: number;
  confusedRatio: number;
  understanding: number | null;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

async function runRules(sid: string, wins: Win[], segment: SegmentView | null, groups: ClusterView[]) {
  const now = Date.now();
  const latest = wins[wins.length - 1]!;
  const active = latest.active;
  if (active < AI.minActiveForAlerts) return;
  const on = segment ? ` on ${segment.label}` : "";
  const fire = async (rule: AlertRule, severity: InsightSeverity, message: string, extra: InsightPayload = {}, key: string = rule, cool?: number) => {
    if (!(await cooldown(sid, key, cool))) return;
    await saveInsight(sid, "alert", severity, message, { rule, segmentLabel: segment?.label ?? null, ...extra });
    console.log(`[insights] ${sid.slice(0, 8)} ${rule}: ${message}`);
  };

  // Engagement drop: active share over the last 3 min is ≥ 30% below the 10-min median.
  const spanMs = latest.bucket - wins[0]!.bucket;
  if (spanMs >= 5 * MIN) {
    const recent = wins.filter((w) => w.bucket > latest.bucket - 3 * MIN).map((w) => w.engaged);
    const med = median(wins.map((w) => w.engaged));
    const avg = mean(recent);
    if (med >= 0.15 && avg <= med * 0.7) {
      await fire("engagement_drop", "warn", `Engagement dropped ${Math.round((1 - avg / med) * 100)}% in the last 3 minutes.`, {
        action: "Run a quick poll",
        actionKind: "poll",
      });
    }
  }

  // Confusion spike: confused share over 30 s is > 2.5× the session baseline and > 5% of active.
  const [base] = await db
    .select({ median: sql<number>`coalesce(percentile_cont(0.5) within group (order by ${metrics5s.confusedRatio}), 0)` })
    .from(metrics5s)
    .where(eq(metrics5s.sessionId, sid));
  const last30 = mean(wins.slice(-6).map((w) => w.confusedRatio));
  if (last30 > 0.05 && last30 > 2.5 * Math.max(Number(base?.median ?? 0), 0.02)) {
    const n = Math.max(1, Math.round(last30 * active));
    await fire("confusion_spike", "alert", `Confusion spike${on}: ${plural(n, "student")} tapped confused in the last minute.`, {
      action: segment ? `Recap ${segment.label}` : "Recap the last point",
      actionKind: null,
    });
  }

  // Hot question: a group grows by ≥ 15 in 2 min, or passes 10% of the class.
  if (groups.length) {
    const growth = await db
      .select({ clusterId: questions.clusterId, n: sql<number>`count(*)::int` })
      .from(questions)
      .where(and(eq(questions.sessionId, sid), gte(questions.createdAt, new Date(now - 2 * MIN)), sql`${questions.clusterId} is not null`))
      .groupBy(questions.clusterId);
    const grew = new Map(growth.map((g) => [g.clusterId, g.n]));
    // Only the two biggest groups can alert, and each at most every 10 minutes, so the panel doesn't flood.
    for (const g of groups.slice(0, 2)) {
      if ((grew.get(g.id) ?? 0) >= 15 || g.people >= Math.max(5, Math.ceil(active * 0.1))) {
        await fire(
          "hot_question",
          "alert",
          `${plural(g.people, "student is", "students are")} asking about “${g.label}”.`,
          { action: `Answer: ${g.label}`, actionKind: "question", clusterId: g.id },
          `hot:${g.id}`,
          10 * MIN,
        );
      }
    }
  }

  // Pace problem: too fast or too slow taps from > 15% of active students in 1 min.
  const [fast, slow] = await Promise.all([
    redis.zcount(rk.reactors(sid, "tooFast"), now - MIN, "+inf"),
    redis.zcount(rk.reactors(sid, "tooSlow"), now - MIN, "+inf"),
  ]);
  if (fast / active > 0.15 && fast >= slow) {
    await fire("pace", "warn", `${plural(fast, "student says", "students say")} you're going too fast.`, { action: "Slow down and check in", actionKind: null });
  } else if (slow / active > 0.15) {
    await fire("pace", "info", `${plural(slow, "student says", "students say")} the pace is too slow.`, { action: "Speed up a little", actionKind: null });
  }

  // Understanding drop: the score falls > 20 points within 2 min.
  const scores = wins.filter((w) => w.bucket > latest.bucket - 2 * MIN && w.understanding !== null).map((w) => w.understanding!);
  if (scores.length >= 4 && latest.understanding !== null) {
    const drop = Math.max(...scores) - latest.understanding;
    if (drop > 20) {
      await fire("understanding_drop", "warn", `Understanding fell ${Math.round(drop)} points in 2 minutes${on}.`, {
        action: "Check in with a quick poll",
        actionKind: "poll",
      });
    }
  }
}

// ---------- once a minute: Groq names groups and writes an insight ----------

const lastLlm = new Map<string, { at: number; fingerprint: string }>();

interface LlmReply {
  clusters?: { id?: string; label?: string }[];
  insight?: string;
  action?: string;
}

const SYSTEM = `You help a university teacher during a live lecture. Students react anonymously (Got it, Confused, Too fast, Too slow, Example please) and ask questions.
Reply with JSON only: {"clusters":[{"id":"<id>","label":"<2-5 word topic>"}],"insight":"<one sentence, max 25 words, or empty>","action":"<one short next step, max 8 words, or empty>"}
Rules: name every cluster you are given, using the students' own terms (e.g. "TLB vs page table"). The insight must be specific and based only on the data given (numbers, slide, topic); never invent facts. Leave insight empty if nothing is notable. Plain text, no emoji.`;

async function runLlm(sid: string, title: string, wins: Win[], segment: SegmentView | null, groups: ClusterView[]) {
  const now = Date.now();
  const [{ n: qCount } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(questions)
    .where(eq(questions.sessionId, sid));
  const recentAlerts = await db
    .select({ message: insights.message, at: insights.at })
    .from(insights)
    .where(and(eq(insights.sessionId, sid), eq(insights.kind, "alert"), gte(insights.at, new Date(now - 5 * MIN))))
    .orderBy(desc(insights.at))
    .limit(3);

  // Skip when nothing changed, so a quiet room costs nothing.
  const fingerprint = [qCount, groups.map((g) => `${g.id}:${g.size}`).join(","), recentAlerts.length, segment?.id ?? ""].join("|");
  const prev = lastLlm.get(sid);
  if (prev && (now - prev.at < AI.llmIntervalMs || prev.fingerprint === fingerprint)) return;
  lastLlm.set(sid, { at: now, fingerprint });

  const samples = await Promise.all(
    groups.slice(0, 6).map(async (g) => {
      const rows = await db
        .select({ body: questions.body })
        .from(questions)
        .where(and(eq(questions.clusterId, g.id), sql`${questions.status} <> 'hidden'`))
        .orderBy(desc(questions.upvotes))
        .limit(5);
      return { id: g.id, students: g.people, questions: rows.map((r) => stripPersonalDetails(r.body)) };
    }),
  );
  const minutes: string[] = [];
  for (let m = 4; m >= 0; m--) {
    const ws = wins.filter((w) => w.bucket > now - (m + 1) * MIN && w.bucket <= now - m * MIN);
    if (!ws.length) continue;
    const u = ws.map((w) => w.understanding).filter((x): x is number => x !== null);
    minutes.push(
      `-${m}m: active ${Math.round(mean(ws.map((w) => w.active)))}, understanding ${u.length ? Math.round(mean(u)) : "n/a"}, confused ${pct(mean(ws.map((w) => w.confusedRatio)))}, engaged ${pct(mean(ws.map((w) => w.engaged)))}`,
    );
  }
  const user = [
    `Lecture: ${stripPersonalDetails(title)}`,
    `Current slide/section: ${segment?.label ?? "unknown"}`,
    `Last 5 minutes:\n${minutes.join("\n") || "no data"}`,
    `Recent alerts: ${recentAlerts.map((a) => a.message).join(" | ") || "none"}`,
    `Question clusters: ${JSON.stringify(samples)}`,
  ].join("\n\n");

  const reply = await groqJson<LlmReply>(SYSTEM, user);
  if (!reply) return;

  let relabeled = false;
  for (const c of reply.clusters ?? []) {
    const label = c.label?.trim().replace(/^["“]|["”]$/g, "").slice(0, 48);
    if (c.id && label && groups.some((g) => g.id === c.id)) {
      await db.update(clusters).set({ label }).where(eq(clusters.id, c.id));
      relabeled = true;
    }
  }
  if (relabeled) await publish(sid, { type: "clusters", data: await loadClusters(sid) });

  const text = reply.insight?.trim();
  if (text && text.length > 10 && (await cooldown(sid, "llm", 3 * MIN))) {
    const action = reply.action?.trim().slice(0, 60) || null;
    await saveInsight(sid, "suggestion", "info", text.slice(0, 240), {
      action,
      actionKind: action && /poll/i.test(action) ? "poll" : null,
      segmentLabel: segment?.label ?? null,
    });
  }
}

// ---------- loop ----------

async function tick() {
  const live = await db.select({ id: sessions.id, title: sessions.title }).from(sessions).where(eq(sessions.status, "live"));
  for (const sid of lastLlm.keys()) if (!live.some((s) => s.id === sid)) lastLlm.delete(sid);
  await Promise.all(
    live.map(async ({ id: sid, title }) => {
      // With several worker copies running, only one evaluates each session per tick.
      if ((await redis.set(`lock:insights:${sid}`, env.consumerName, "PX", 4500, "NX")) !== "OK") return;
      try {
        const rows = await db
          .select({
            bucket: metrics5s.bucket,
            active: metrics5s.active,
            engaged: metrics5s.engaged,
            confusedRatio: metrics5s.confusedRatio,
            understanding: metrics5s.understanding,
          })
          .from(metrics5s)
          .where(and(eq(metrics5s.sessionId, sid), gte(metrics5s.bucket, new Date(Date.now() - 10 * MIN))))
          .orderBy(metrics5s.bucket);
        if (rows.length < 6) return;
        const wins: Win[] = rows.map((r) => ({ ...r, bucket: r.bucket.getTime() }));
        const segRaw = await redis.get(rk.segment(sid));
        const segment = segRaw ? (JSON.parse(segRaw) as SegmentView) : null;
        const groups = await loadClusters(sid);
        await runRules(sid, wins, segment, groups);
        await runLlm(sid, title, wins, segment, groups);
      } catch (e) {
        console.error("[insights]", sid, (e as Error).message);
      }
    }),
  );
}

let running = false;
export function startInsights() {
  setInterval(() => {
    if (running) return;
    running = true;
    tick()
      .catch((e) => console.error("[insights]", (e as Error).message))
      .finally(() => (running = false));
  }, 5000);
  console.log(`[insights] smart alerts on${env.groqApiKey ? `, live AI insights with Groq (${env.groqModel})` : " (add GROQ_API_KEY for AI-written insights)"}`);
}

export async function stopInsights() {
  await redis.quit().catch(() => {});
}

