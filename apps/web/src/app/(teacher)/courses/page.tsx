import { Library, Plus } from "lucide-react";
import { count, courses, desc, eq, sessions, teachers } from "@handsup/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/teacher";
import { colorClass, initials } from "@/lib/utils";
import { NewCourseForm } from "./NewCourseForm";

export const metadata = { title: "Courses" };

export default async function CoursesPage() {
  const t = await requireTeacher();
  const rows = await db
    .select({ course: courses, lectures: count(sessions.id) })
    .from(courses)
    .leftJoin(sessions, eq(sessions.courseId, courses.id))
    .where(eq(courses.teacherId, t.id))
    .groupBy(courses.id)
    .orderBy(desc(courses.createdAt));

  if (!t.onboardedAt) {
    // First sign-in goes through setup. Teachers who already have courses (from before setup existed) skip it.
    if (!rows.length) redirect("/welcome");
    await db.update(teachers).set({ onboardedAt: new Date() }).where(eq(teachers.id, t.id));
  }

  if (!rows.length) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <span className="eyebrow">Welcome{t.name ? `, ${t.name.split(" ")[0]}` : ""}</span>
        <h1 className="poster text-6xl">Name your first course</h1>
        <p className="font-light text-text2">Lectures live inside a course, so you can compare them over the term. You can add more later.</p>
        <NewCourseForm />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="poster text-6xl">Courses</h1>
        <a href="#new-course" className="pill-ghost">
          <Plus size={18} strokeWidth={2.5} aria-hidden /> New course
        </a>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ course, lectures }) => (
          <Link key={course.id} href={`/courses/${course.id}`} className="card flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-float">
            <span className={`badge h-14 w-14 text-lg ${colorClass(course.color)}`}>{initials(course.name) || <Library size={24} strokeWidth={2.25} />}</span>
            <div className="min-w-0">
              <p className="truncate text-xl font-semibold">{course.name}</p>
              <p className="text-sm text-muted">
                {course.term ? `${course.term} · ` : ""}
                {lectures} {lectures === 1 ? "lecture" : "lectures"}
              </p>
            </div>
          </Link>
        ))}
      </div>
      <section id="new-course" className="card flex max-w-xl flex-col gap-4 p-6">
        <h2 className="text-2xl font-semibold">New course</h2>
        <NewCourseForm />
      </section>
    </div>
  );
}
