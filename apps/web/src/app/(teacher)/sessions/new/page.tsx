import { count, eq, sessions } from "@handsup/db";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireCourse } from "@/lib/teacher";
import { NewSessionForm } from "./NewSessionForm";

export const metadata = { title: "New lecture" };

export default async function NewSessionPage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const { course } = await requireCourse((await searchParams).course ?? "");
  const [{ n }] = await db.select({ n: count() }).from(sessions).where(eq(sessions.courseId, course.id));

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/courses/${course.id}`} className="text-muted hover:text-ink">
        ← {course.name}
      </Link>
      <h1 className="poster text-6xl">New lecture</h1>
      <NewSessionForm courseId={course.id} suggestedTitle={`Lecture ${n + 1}`} />
    </div>
  );
}
