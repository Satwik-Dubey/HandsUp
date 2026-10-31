import { ManageMenu } from "@/components/ManageMenu";
import { Ico, TEMPLATE_ICON } from "@/components/icons";
import { and, asc, count, desc, eq, ne, polls as pollsTable, sessions as sessionsTable } from "@handsup/db";
import { TEMPLATE_META, type SessionTemplate } from "@handsup/shared";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PresentQr } from "@/components/PresentQr";
import { QrCode } from "@/components/QrCode";
import { db } from "@/lib/db";
import { requireOwnedSession } from "@/lib/teacher";
import { appUrl, formatDate } from "@/lib/utils";
import { copyPolls, deleteSession, renameSession, startSession } from "../../actions";
import { CopyButton } from "./CopyButton";
import { PreparedPolls } from "./PreparedPolls";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { session, course } = await requireOwnedSession((await params).id);
  const joinUrl = `${appUrl()}/j/${session.joinCode}`;
  const meta = TEMPLATE_META[session.template as SessionTemplate] ?? TEMPLATE_META.lecture;
  const goLive = startSession.bind(null, session.id);
  const polls = await db.query.polls.findMany({ where: eq(pollsTable.sessionId, session.id), orderBy: [asc(pollsTable.position), asc(pollsTable.createdAt)] });
  const prepared = polls.map((p) => ({ id: p.id, question: p.question, kind: p.kind, options: p.options, ran: Boolean(p.openedAt) }));
  // Other lectures in this course that have polls, newest first, for "Copy polls from…".
  const pollSources =
    session.status === "ended"
      ? []
      : await db
          .select({ id: sessionsTable.id, title: sessionsTable.title, n: count(pollsTable.id) })
          .from(sessionsTable)
          .innerJoin(pollsTable, eq(pollsTable.sessionId, sessionsTable.id))
          .where(and(eq(sessionsTable.courseId, course.id), ne(sessionsTable.id, session.id)))
          .groupBy(sessionsTable.id)
          .orderBy(desc(sessionsTable.createdAt))
          .limit(20);

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/courses/${course.id}`} className="text-muted hover:text-ink">
        ← {course.name}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-muted">
            <Ico icon={TEMPLATE_ICON[session.template as SessionTemplate] ?? TEMPLATE_ICON.lecture} size={17} /> {meta.label}
            {session.startsAt ? ` · ${formatDate(session.startsAt)}` : ""}
          </p>
          <h1 className="poster text-5xl sm:text-6xl">{session.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {session.status === "draft" && (
            <form
              action={async () => {
                "use server";
                await goLive();
                redirect(`/sessions/${session.id}/live`);
              }}
            >
              <button className="pill-coral py-3 text-lg">Go live →</button>
            </form>
          )}
          {session.status === "live" && (
            <Link href={`/sessions/${session.id}/live`} className="pill-coral py-3 text-lg">
              Open live dashboard →
            </Link>
          )}
          {session.status !== "live" && (
            <ManageMenu
              what="lecture"
              name={session.title}
              rename={renameSession.bind(null, session.id)}
              remove={deleteSession.bind(null, session.id)}
              deleteWarning={session.status === "ended" ? "Its report and everything students sent are deleted too." : "Its prepared polls are deleted too."}
              afterDelete={`/courses/${course.id}`}
            />
          )}
        </div>
      </div>

      {session.status === "ended" ? (
        <div className="card flex flex-col gap-2 p-8">
          <p className="text-2xl font-semibold">This lecture has ended.</p>
          <p className="font-light text-text2">The after-class report has the AI summary, key moments and the most-asked questions.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href={`/sessions/${session.id}/report`} className="pill-coral">
              View report →
            </Link>
            <Link href={`/sessions/${session.id}/live`} className="pill-ghost">
              See final counts
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="card flex flex-col items-center gap-4 self-start p-8 text-center">
            <span className="eyebrow">Join code</span>
            <QrCode value={joinUrl} size={220} />
            <p className="poster text-6xl tracking-[0.15em]">{session.joinCode}</p>
            <p className="break-all text-muted">{joinUrl.replace(/^https?:\/\//, "")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <PresentQr joinUrl={joinUrl} code={session.joinCode} title={session.title} />
              <CopyButton text={joinUrl} />
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <div className="card flex flex-col gap-4 p-8">
              <h2 className="text-2xl font-semibold">Before class</h2>
              <ol className="flex list-decimal flex-col gap-3 pl-5 font-light text-text2">
                <li>Put the QR code on your first slide, or use “Present full screen”.</li>
                <li>Students who scan early land in a waiting room. It switches on by itself when you go live.</li>
                <li>
                  Press <b className="font-semibold text-ink">Go live</b> when class starts, and keep the live dashboard open on a second screen or your phone.
                </li>
              </ol>
              <p className="rounded-2xl bg-paper px-4 py-3 text-sm text-muted">
                Testing on your own phone? It must be on the same Wi-Fi, and <code>NEXT_PUBLIC_APP_URL</code> must point at your computer&apos;s address (see
                the README).
              </p>
            </div>
            <PreparedPolls
              sessionId={session.id}
              polls={prepared}
              editable
              sources={pollSources}
              copy={async (fromId: string) => {
                "use server";
                return copyPolls(session.id, fromId);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
