/** Read queries shared by the gateway, the workers and the web app. */
import { sql } from "drizzle-orm";
import { keywordLabel, type ClusterView } from "@handsup/shared";
import type { Db } from "./index";

/** Groups of similar questions in a session, as the dashboard shows them, most asked first. */
export async function loadClusters(db: Db, sid: string, limit = 20): Promise<ClusterView[]> {
  const rows = await db.execute<{ id: string; label: string | null; size: number; people: number; bodies: string[]; updated_at: Date | string }>(sql`
    select c.id, c.label, c.updated_at,
      count(q.id)::int as size,
      -- distinct students who asked or upvoted a question in the group
      (select count(*)::int from (
         select q2.student_id from questions q2 where q2.cluster_id = c.id and q2.status <> 'hidden' and q2.student_id is not null
         union
         select v.student_id from question_votes v join questions q3 on q3.id = v.question_id where q3.cluster_id = c.id and q3.status <> 'hidden'
       ) u) as people,
      (array_agg(q.body order by q.upvotes desc, q.created_at))[1:8] as bodies
    from clusters c
    join questions q on q.cluster_id = c.id and q.status <> 'hidden'
    where c.session_id = ${sid}
    group by c.id
    having count(q.id) > 1
    order by people desc, size desc
    limit ${limit}`);
  return rows.map((r) => ({
    id: r.id,
    label: r.label ?? keywordLabel(r.bodies ?? []),
    size: r.size,
    people: r.people || r.size,
    sample: r.bodies?.[0] ?? "",
    updatedAt: new Date(r.updated_at).getTime(),
  }));
}
