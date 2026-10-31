/**
 * Small text helpers used by the workers (offline grouping fallback) and the
 * dashboard (trending words). Pure functions, safe in the browser.
 */

export const STOPWORDS = new Set(
  `a about above after again against all am an and any are aren't as at be because been before being below between both but by
can can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has hasn't
have haven't having he her here hers herself him himself his how i i'm if in into is isn't it it's its itself just let's me more
most my myself no nor not of off on once only or other ought our ours ourselves out over own same she should shouldn't so some
such than that that's the their theirs them themselves then there there's these they this those through to too under until up
very was wasn't we were weren't what what's when where which while who whom why with won't would wouldn't you your yours
yourself yourselves please pls plz sir maam ma'am miss prof professor again also really still get got go going explain explained
mean means meant one thing things like know dont doesnt cant wont im ok okay hi hey thanks thank us will shall may might much many
whats hows whys difference between question questions happen happens happened work works working use used using
does make makes need needs want wants different same`.split(/\s+/),
);

/** Lowercase words with stopwords and very short words removed, lightly stemmed. */
export function keywords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9'+#-]*/g) ?? [])
    .map((w) => w.replace(/'s$/, "").replace(/^'+|'+$/g, ""))
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map(stem);
}

function stem(w: string): string {
  if (w.length > 5 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("es") && /(ch|sh|x|ss)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) return w.slice(0, -1);
  return w;
}

/** The most common keywords across texts (each text counts a word once). */
export function trendingWords(texts: string[], limit = 8): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const t of texts) for (const w of new Set(keywords(t))) counts.set(w, (counts.get(w) ?? 0) + 1);
  return [...counts]
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word, count]) => ({ word: originalSpelling(word, texts), count }));
}

/** Removes emails, phone numbers, links and @handles before text is sent to an AI service. */
export function stripPersonalDetails(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/https?:\/\/\S+/g, "[link]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[number]")
    .replace(/@\w{2,}/g, "@[name]");
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export function normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((a, x) => a + x * x, 0));
  return n ? v.map((x) => x / n) : v;
}

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** First words of a question, used as a group's name until the AI names it. */
export function shortLabel(text: string): string {
  const t = text.replace(/\s+/g, " ").replace(/[?!.]+$/, "").trim();
  return t.length > 42 ? `${t.slice(0, 40).replace(/\s+\S*$/, "")}…` : t;
}

/**
 * A short topic name for a group of similar questions, from the keywords most of them share,
 * e.g. ["What's a TLB vs page table?", "TLB vs page table difference"] → "TLB · page table".
 * Falls back to the first words of the top question.
 */
export function keywordLabel(texts: string[]): string {
  if (!texts.length) return "";
  const counts = new Map<string, number>();
  for (const t of texts) for (const w of new Set(keywords(t))) counts.set(w, (counts.get(w) ?? 0) + 1);
  const need = Math.max(2, Math.ceil(texts.length * 0.5));
  const shared = [...counts].filter(([, c]) => c >= need).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => w);
  if (!shared.length) return shortLabel(texts[0]!);
  // Keep the order words appear in the top question, and their original spelling (e.g. "TLB").
  const original = (w: string) => originalSpelling(w, texts);
  const first = texts[0]!.toLowerCase();
  shared.sort((a, b) => (first.indexOf(a) + 1 || 999) - (first.indexOf(b) + 1 || 999));
  // Words that sit next to each other in the top question stay together: "page table", not "page · table".
  const parts: string[] = [];
  shared.forEach((w, i) => {
    const prev = shared[i - 1];
    if (prev && new RegExp(`\\b${esc(prev)}\\w*\\s+${esc(w)}`, "i").test(texts[0]!)) parts[parts.length - 1] += ` ${original(w)}`;
    else parts.push(original(w));
  });
  return parts.join(" · ");
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** How a (lowercased, stemmed) keyword was actually written, e.g. "tlb" → "TLB". */
function originalSpelling(w: string, texts: string[]): string {
  for (const t of texts) {
    const m = t.match(new RegExp(`\\b(${esc(w)}\\w*)`, "i"));
    if (m) return m[1]!;
  }
  return w;
}
