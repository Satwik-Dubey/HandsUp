/** Letters and digits that can't be confused with each other (no O/0, I/1/L). */
export const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_LENGTH = 6;

export function normalizeJoinCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, JOIN_CODE_LENGTH);
}

export function isValidJoinCode(code: string): boolean {
  if (code.length !== JOIN_CODE_LENGTH) return false;
  for (const ch of code) if (!JOIN_CODE_ALPHABET.includes(ch)) return false;
  return true;
}

export function randomJoinCode(random: (n: number) => number = (n) => Math.floor(Math.random() * n)): string {
  let out = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) out += JOIN_CODE_ALPHABET[random(JOIN_CODE_ALPHABET.length)];
  return out;
}
