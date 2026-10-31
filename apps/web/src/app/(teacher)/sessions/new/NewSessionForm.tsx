"use client";

import { RETENTION_CHOICES, SESSION_TEMPLATES, TEMPLATE_META, type Reaction } from "@handsup/shared";
import { BarChart3, Star, Trophy, type LucideIcon } from "lucide-react";
import { Ico, IconBadge, REACTION_ICON, TEMPLATE_ICON, type Tone } from "@/components/icons";
import { useActionState, useEffect, useState } from "react";
import { createSession } from "../../actions";

const r = (k: Reaction) => [REACTION_ICON[k].icon, REACTION_ICON[k].tone] as const;
const INPUTS: { key: string; label: string; icons: (readonly [LucideIcon, Tone])[] }[] = [
  { key: "react", label: "React", icons: [r("gotIt"), r("tooFast"), r("tooSlow"), r("example")] },
  { key: "confused", label: "Tap “I'm confused”", icons: [r("confused")] },
  { key: "rating", label: "Rate clarity 1–5", icons: [[Star, "pink"]] },
  { key: "questions", label: "Ask & upvote questions", icons: [[Trophy, "sun"]] },
  { key: "pollResults", label: "See poll results", icons: [[BarChart3, "sky"]] },
];

export function NewSessionForm({ courseId, suggestedTitle }: { courseId: string; suggestedTitle: string }) {
  const [state, action, pending] = useActionState(createSession, undefined);
  const [tz, setTz] = useState(0);
  useEffect(() => setTz(new Date().getTimezoneOffset()), []);

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="tzOffset" value={tz} />

      <div className="flex flex-col gap-6">
        <fieldset className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          <legend className="label">Template</legend>
          {SESSION_TEMPLATES.map((t, i) => (
            <label key={t} className="cursor-pointer">
              <input type="radio" name="template" value={t} defaultChecked={i === 0} className="peer sr-only" />
              <span className="card flex flex-col items-center gap-1 p-4 text-center transition peer-checked:bg-ink peer-checked:text-on-ink peer-focus-visible:ring-2 peer-focus-visible:ring-coral">
                <IconBadge icon={TEMPLATE_ICON[t]} tone="sun" size="md" />
                <span className="font-medium">{TEMPLATE_META[t].label}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="card flex flex-col gap-4 p-6">
          <h2 className="text-xl font-semibold">Basics</h2>
          <div>
            <label className="label" htmlFor="title">
              Title
            </label>
            <input id="title" name="title" className="field" defaultValue={suggestedTitle} required minLength={2} maxLength={160} />
          </div>
          <div>
            <label className="label" htmlFor="startsAt">
              Starts (optional)
            </label>
            <input id="startsAt" name="startsAt" type="datetime-local" className="field" />
          </div>
          <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-muted"><Ico icon={BarChart3} size={16} className="mr-1.5" />
            You can add polls on the next screen.</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="card flex flex-col gap-1 p-6">
          <h2 className="mb-2 text-xl font-semibold">Students can</h2>
          {INPUTS.map((i) => (
            <label key={i.key} className="flex cursor-pointer items-center justify-between gap-3 border-b border-line py-3 last:border-0">
              <span className="flex flex-wrap items-center gap-2">
                {i.label}
                <span className="flex gap-1">
                  {i.icons.map(([icon, tone], j) => (
                    <IconBadge key={j} icon={icon} tone={tone} size="xs" />
                  ))}
                </span>
              </span>
              <Switch name={`input_${i.key}`} defaultChecked />
            </label>
          ))}
        </div>

        <div className="card flex flex-col gap-3 p-6">
          <h2 className="text-xl font-semibold">Safety & privacy</h2>
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span>Review questions before they appear</span>
            <Switch name="reviewQuestionsFirst" />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>Keep data for</span>
            <select name="retentionDays" defaultValue={30} className="field w-auto py-2">
              {RETENTION_CHOICES.map((d) => (
                <option key={d} value={d}>
                  {d === 365 ? "1 year" : `${d} days`}
                </option>
              ))}
            </select>
          </label>
        </div>

        {state?.error && <p className="text-coral">{state.error}</p>}
        <button className="pill-coral py-4 text-lg" disabled={pending}>
          {pending ? "Creating…" : "Create lecture and get QR →"}
        </button>
      </div>
    </form>
  );
}

function Switch({ name, defaultChecked }: { name: string; defaultChecked?: boolean }) {
  return (
    <span className="relative inline-flex flex-none">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="h-7 w-12 rounded-full bg-line transition peer-checked:bg-forest peer-focus-visible:ring-2 peer-focus-visible:ring-coral" />
      <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
    </span>
  );
}
