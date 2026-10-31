/**
 * NLP worker (fast path, per question): sentiment, embedding, then grouping.
 *
 * A new question joins the most similar existing group if it's close enough.
 * Otherwise it's compared with other ungrouped questions from the last 10 minutes,
 * and a new group forms as soon as two of them say the same thing
 * (a light version of density clustering, which suits a live room).
 */
import { and, clusters, desc, eq, getDb, gte, inArray, isNull, loadClusters as loadClustersQuery, questions, sql } from "@handsup/db";
import { createRedis } from "@handsup/server";
import { AI, cosine, normalize, rk, type TeacherChannelMessage } from "@handsup/shared";
import { embed, loadLocalModels, sentiment, similarityThreshold } from "./ai/local";
import { env } from "./env";

const GROUP = "nlp";
const db = getDb(env.databaseUrl);
const redis = createRedis(env.redisUrl, "nlp");
const reader = createRedis(env.redisUrl, "nlp:reader");

async function publish(sid: string, msg: TeacherChannelMessage) {
  await redis.publish(rk.teacherChannel(sid), JSON.stringify(msg));
}

export const loadClusters = (sid: string) => loadClustersQuery(db, sid);

function mean(vectors: number[][]): number[] {
  const out = new Array<number>(vectors[0]!.length).fill(0);
  for (const v of vectors) for (let i = 0; i < v.length; i++) out[i]! += v[i]!;
  return normalize(out);
}

async function processQuestion(sid: string, qid: string) {
  const q = await db.query.questions.findFirst({ where: eq(questions.id, qid), columns: { id: true, body: true, embedding: true, sessionId: true } });
  if (!q || q.embedding) return; // deleted, or already done (stream replay)

  const [vec, mood] = await Promise.all([embed(q.body), sentiment(q.body)]);
  const threshold = similarityThreshold();

  // 1. Join the closest existing group.
  const groups = await db.select({ id: clusters.id, centroid: clusters.centroid, size: clusters.size }).from(clusters).where(eq(clusters.sessionId, sid));
  let best: { id: string; sim: number; centroid: number[]; size: number } | null = null;
  for (const g of groups) {
    if (!g.centroid) continue;
    const sim = cosine(vec, g.centroid);
    if (sim >= threshold && (!best || sim > best.sim)) best = { id: g.id, sim, centroid: g.centroid, size: g.size };
  }

  let clusterId: string | null = null;
  if (best) {
    clusterId = best.id;
    const centroid = normalize(best.centroid.map((x, i) => x * best!.size + vec[i]!));
    await db.update(clusters).set({ centroid, size: sql`${clusters.size} + 1`, updatedAt: new Date() }).where(eq(clusters.id, best.id));
  } else {
    // 2. Otherwise look for ungrouped look-alikes from the last 10 minutes.
    const recent = await db
      .select({ id: questions.id, embedding: questions.embedding })
      .from(questions)
      .where(
        and(
          eq(questions.sessionId, sid),
          isNull(questions.clusterId),
          gte(questions.createdAt, new Date(Date.now() - AI.clusterLookbackMs)),
          sql`${questions.embedding} is not null`,
          sql`${questions.id} <> ${qid}`,
        ),
      )
      .orderBy(desc(questions.createdAt))
      .limit(300);
    const similar = recent.filter((r) => r.embedding && cosine(vec, r.embedding) >= threshold);
    if (similar.length) {
      const members = [vec, ...similar.map((r) => r.embedding!)];
      const [c] = await db
        .insert(clusters)
        .values({ sessionId: sid, size: members.length, centroid: mean(members), representativeId: similar[similar.length - 1]!.id })
        .returning({ id: clusters.id });
      clusterId = c!.id;
      await db.update(questions).set({ clusterId }).where(inArray(questions.id, similar.map((r) => r.id)));
    }
  }

  await db.update(questions).set({ embedding: vec, sentiment: mood, clusterId }).where(eq(questions.id, qid));
  if (clusterId) {
    await publish(sid, { type: "clusters", data: await loadClusters(sid) });
    await publish(sid, { type: "questions:changed" });
  }
}

async function ensureGroup() {
  try {
    await redis.xgroup("CREATE", rk.questionsStream, GROUP, "$", "MKSTREAM");
  } catch (e) {
    if (!String((e as Error).message).includes("BUSYGROUP")) throw e;
  }
}

async function consumeLoop() {
  for (;;) {
    try {
      const res = (await reader.xreadgroup("GROUP", GROUP, env.consumerName, "COUNT", 50, "BLOCK", 2000, "STREAMS", rk.questionsStream, ">")) as
        | [string, [string, string[]][]][]
        | null;
      if (!res) continue;
      for (const [, entries] of res) {
        for (const [id, fields] of entries) {
          const f: Record<string, string> = {};
          for (let i = 0; i < fields.length; i += 2) f[fields[i]!] = fields[i + 1]!;
          if (f.sid && f.qid) {
            try {
              await processQuestion(f.sid, f.qid);
            } catch (e) {
              console.error("[nlp] question failed:", (e as Error).message);
            }
          }
          await redis.xack(rk.questionsStream, GROUP, id);
        }
      }
    } catch (e) {
      console.error("[nlp] read failed:", (e as Error).message);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

export async function startNlp() {
  await ensureGroup();
  void loadLocalModels(); // warm up in the background; questions wait for it
  void consumeLoop();
  console.log("[nlp] grouping questions as they arrive");
}

export async function stopNlp() {
  await Promise.allSettled([redis.quit(), reader.quit()]);
}
