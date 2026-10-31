import type { Reaction, SessionTemplate } from "@handsup/shared";
import {
  CircleHelp,
  FlaskConical,
  GraduationCap,
  Hand,
  type LucideIcon,
  MessagesSquare,
  Mic,
  NotebookPen,
  Rabbit,
  Snail,
  ThumbsUp,
} from "lucide-react";

/** Theme colors an icon badge can sit on. Dark ink on the light ones, white on the deep ones. */
export type Tone = "lime" | "sky" | "violet" | "pink" | "sun" | "coral" | "forest" | "ink" | "card";

const TONE: Record<Tone, string> = {
  lime: "bg-lime text-[#121212]",
  sky: "bg-sky text-[#121212]",
  violet: "bg-violet text-white",
  pink: "bg-pink text-[#121212]",
  sun: "bg-sun text-[#121212]",
  coral: "bg-coral text-white",
  forest: "bg-forest text-white",
  ink: "bg-ink text-on-ink",
  card: "bg-card text-ink shadow-soft",
};

const SIZE = {
  xs: { box: "h-6 w-6", icon: 14 },
  sm: { box: "h-8 w-8", icon: 17 },
  md: { box: "h-11 w-11", icon: 22 },
  lg: { box: "h-14 w-14", icon: 28 },
  xl: { box: "h-20 w-20", icon: 40 },
} as const;

/** A Lucide icon inside a colored circle: the app's one icon style. */
export function IconBadge({ icon: Icon, tone = "card", size = "md", className = "" }: { icon: LucideIcon; tone?: Tone; size?: keyof typeof SIZE; className?: string }) {
  const s = SIZE[size];
  return (
    <span aria-hidden className={`inline-flex flex-none items-center justify-center rounded-full ${s.box} ${TONE[tone]} ${className}`}>
      <Icon size={s.icon} strokeWidth={2.25} />
    </span>
  );
}

/** Inline icon that sits on a line of text. */
export function Ico({ icon: Icon, size = 18, className = "" }: { icon: LucideIcon; size?: number; className?: string }) {
  return <Icon aria-hidden size={size} strokeWidth={2.25} className={`inline-block flex-none align-[-0.15em] ${className}`} />;
}

export const REACTION_ICON: Record<Reaction, { icon: LucideIcon; tone: Tone }> = {
  gotIt: { icon: ThumbsUp, tone: "lime" },
  tooFast: { icon: Rabbit, tone: "sky" },
  tooSlow: { icon: Snail, tone: "violet" },
  example: { icon: Hand, tone: "pink" },
  confused: { icon: CircleHelp, tone: "sun" },
};

export const TEMPLATE_ICON: Record<SessionTemplate, LucideIcon> = {
  lecture: GraduationCap,
  lab: FlaskConical,
  tutorial: MessagesSquare,
  review: NotebookPen,
  seminar: Mic,
};
