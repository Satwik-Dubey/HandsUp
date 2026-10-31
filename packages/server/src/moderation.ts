import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

const matcher = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });

/** True if the text contains profanity (handles common tricks like l33t-speak and spacing). */
export function isProfane(text: string): boolean {
  return matcher.hasMatch(text);
}

/** Collapses whitespace and strips control characters from a student's question. */
export function cleanQuestion(text: string): string {
  return text
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
