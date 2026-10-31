"use client";

import { COURSE_COLORS } from "@handsup/shared";
import { useActionState } from "react";
import { COLOR_CLASS } from "@/lib/utils";
import { createCourse } from "../actions";

function currentTerm() {
  const d = new Date();
  const m = d.getMonth();
  return `${m < 5 ? "Spring" : m < 7 ? "Summer" : "Fall"} ${d.getFullYear()}`;
}

export function NewCourseForm() {
  const [state, action, pending] = useActionState(createCourse, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="name">
          Course name
        </label>
        <input id="name" name="name" className="field" placeholder="CS 310 · Operating Systems" required minLength={2} maxLength={120} />
      </div>
      <div>
        <label className="label" htmlFor="term">
          Term
        </label>
        <input id="term" name="term" className="field" defaultValue={currentTerm()} maxLength={40} />
      </div>
      <fieldset>
        <legend className="label">Color</legend>
        <div className="flex flex-wrap gap-2">
          {COURSE_COLORS.map((c, i) => (
            <label key={c} className="cursor-pointer">
              <input type="radio" name="color" value={c} defaultChecked={i === 0} className="peer sr-only" />
              <span className={`block h-9 w-9 rounded-full ring-offset-2 ring-offset-card peer-checked:ring-2 peer-checked:ring-ink ${COLOR_CLASS[c]}`} title={c} />
            </label>
          ))}
        </div>
      </fieldset>
      {state?.error && <p className="text-coral">{state.error}</p>}
      <button className="pill self-start py-3" disabled={pending}>
        {pending ? "Creating…" : "Create course →"}
      </button>
    </form>
  );
}
