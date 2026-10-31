"use client";

import { Check } from "lucide-react";
import { COURSE_COLORS } from "@handsup/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { COLOR_CLASS, initials } from "@/lib/utils";
import { createFirstCourse, finishSetup, saveProfile, startDemoLecture } from "./actions";

const STEPS = ["About you", "First course", "Try it"];

function currentTerm() {
  const d = new Date();
  const m = d.getMonth();
  return `${m < 5 ? "Spring" : m < 7 ? "Summer" : "Fall"} ${d.getFullYear()}`;
}

export function Setup({ defaults }: { defaults: { displayName: string; fullName: string; institution: string; image: string | null } }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(defaults.displayName);
  const [institution, setInstitution] = useState(defaults.institution);
  const [course, setCourse] = useState({ name: "", term: currentTerm(), color: "coral" as string });
  const [courseId, setCourseId] = useState<string | null>(null);

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      try {
        await fn();
      } catch {
        setError("Something went wrong. Try again.");
      }
    });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <ol className="flex flex-1 flex-wrap gap-2" aria-label="Setup steps">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${i < step ? "bg-forest text-white" : i === step ? "bg-ink text-on-ink" : "bg-card text-muted"}`}
              aria-current={i === step ? "step" : undefined}
            >
              {i < step ? <Check size={14} strokeWidth={3} className="mr-1 inline-block align-[-0.1em]" aria-label="Done" /> : `${i + 1} `}
              {s}
            </li>
          ))}
        </ol>
        <button
          className="text-sm text-muted hover:text-ink"
          onClick={() =>
            run(async () => {
              await finishSetup();
              router.push("/courses");
            })
          }
        >
          Skip setup
        </button>
      </div>

      {step === 0 && (
        <section className="card flex flex-col gap-5 p-7">
          <p className="eyebrow">Step 1 of 3</p>
          <h1 className="poster text-5xl">About you</h1>
          <div className="flex items-center gap-3 rounded-2xl bg-paper p-3">
            {defaults.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={defaults.image} alt="" className="h-12 w-12 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <span className="badge h-12 w-12 bg-violet">{initials(defaults.fullName)}</span>
            )}
            <span className="text-muted">{defaults.fullName}</span>
          </div>
          <div>
            <label className="label" htmlFor="dn">
              Name students see
            </label>
            <input id="dn" className="field" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Prof. Sharma" maxLength={80} />
          </div>
          <div>
            <label className="label" htmlFor="inst">
              I teach at (optional)
            </label>
            <input id="inst" className="field" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="IIT Delhi" maxLength={120} />
          </div>
          {error && <p className="text-coral">{error}</p>}
          <button
            className="pill self-start py-3"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const r = await saveProfile({ displayName, institution });
                if (!r.ok) return setError(r.error);
                setStep(1);
              })
            }
          >
            Next · First course →
          </button>
        </section>
      )}

      {step === 1 && (
        <section className="card flex flex-col gap-5 p-7">
          <p className="eyebrow">Step 2 of 3</p>
          <h1 className="poster text-5xl">Name your first course</h1>
          <p className="font-light text-text2">Lectures live inside a course, so you can compare them over the term. You can add more later.</p>
          <div>
            <label className="label" htmlFor="cn">
              Course name
            </label>
            <input
              id="cn"
              className="field"
              value={course.name}
              onChange={(e) => setCourse({ ...course, name: e.target.value })}
              placeholder="CS 310 · Operating Systems"
              maxLength={120}
              autoFocus
            />
          </div>
          <div>
            <label className="label" htmlFor="term">
              Term
            </label>
            <input id="term" className="field" value={course.term} onChange={(e) => setCourse({ ...course, term: e.target.value })} maxLength={40} />
          </div>
          <fieldset>
            <legend className="label">Color</legend>
            <div className="flex flex-wrap gap-2">
              {COURSE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={course.color === c}
                  onClick={() => setCourse({ ...course, color: c })}
                  className={`h-9 w-9 rounded-full ring-offset-2 ring-offset-card ${COLOR_CLASS[c]} ${course.color === c ? "ring-2 ring-ink" : ""}`}
                />
              ))}
            </div>
          </fieldset>
          {error && <p className="text-coral">{error}</p>}
          <div className="flex gap-3">
            <button className="pill-ghost" onClick={() => setStep(0)}>
              ← Back
            </button>
            <button
              className="pill py-3"
              disabled={pending || course.name.trim().length < 2}
              onClick={() =>
                run(async () => {
                  if (courseId) return setStep(2);
                  const r = await createFirstCourse(course);
                  if (!r.ok) return setError(r.error);
                  setCourseId(r.courseId);
                  setStep(2);
                })
              }
            >
              Create course →
            </button>
          </div>
        </section>
      )}

      {step === 2 && courseId && (
        <section className="card flex flex-col gap-5 p-7">
          <p className="eyebrow">Step 3 of 3</p>
          <h1 className="poster text-5xl">Try it on yourself</h1>
          <p className="text-lg font-light text-text2">
            We open a demo lecture with 25 demo students. Scan the QR with your own phone too, tap a few buttons, and watch your dashboard react. In a few
            minutes the demo class gets confused, so you&apos;ll see an alert and grouped questions. End the class to see the report.
          </p>
          {error && <p className="text-coral">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              className="pill-coral py-3 text-lg"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const id = await startDemoLecture(courseId);
                  if (!id) return setError("Couldn't start the demo. Try again.");
                  router.push(`/sessions/${id}/live`);
                })
              }
            >
              {pending ? "Opening…" : "Open the demo lecture →"}
            </button>
            <button
              className="pill-ghost py-3"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  await finishSetup();
                  router.push(`/courses/${courseId}`);
                })
              }
            >
              Skip, go to my course
            </button>
          </div>
          <p className="text-sm text-muted">After setup you land on your course, with “＋ New lecture” ready. Next time you sign in, setup is skipped.</p>
        </section>
      )}
    </div>
  );
}
