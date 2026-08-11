// Lightweight blocklist-based filter for public-facing free text (usernames,
// comments, bookmark titles). Not exhaustive and not evasion-proof — a
// determined bad actor can always get around any filter, blocklist or ML —
// this exists to stop casual/lazy abuse, not to be airtight moderation.
// ponytail: normalized-substring blocklist, upgrade to a real detection
// library (e.g. obscenity) if evasion or false negatives become a real
// problem in practice.
const BLOCKLIST = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "asshole",
  "dick",
  "pussy",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "whore",
  "slut",
  "rape",
  "molest",
  "nazi",
  "kike",
  "chink",
  "spic",
  "wetback",
  "tranny",
];

const LEETSPEAK_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  "$": "s",
};

function normalize(text: string): string {
  let out = text.toLowerCase();
  for (const [digit, letter] of Object.entries(LEETSPEAK_MAP)) {
    out = out.split(digit).join(letter);
  }
  // Strip everything but letters so spacing/punctuation tricks (f.u.c.k,
  // f u c k) don't slip past a plain substring check.
  return out.replace(/[^a-z]/g, "");
}

export function containsProfanity(text: string): boolean {
  const normalized = normalize(text);
  return BLOCKLIST.some((word) => normalized.includes(word));
}
