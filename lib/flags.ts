const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const REGIONAL_INDICATOR_OFFSET = 0x1f1e6 - 65; // 'A'.charCodeAt(0) === 65

/** ISO 3166-1 alpha-2 code -> flag emoji, via the Unicode regional-indicator
 * trick (each letter A-Z maps to its own regional-indicator symbol; a pair
 * of them renders as that country's flag). Falls back to a white flag for
 * unknown/invalid codes rather than showing garbled text. */
export function countryCodeToFlag(code: string | undefined): string {
  if (!code || !COUNTRY_CODE_PATTERN.test(code)) return "🏳️";
  return [...code].map((c) => String.fromCodePoint(c.charCodeAt(0) + REGIONAL_INDICATOR_OFFSET)).join("");
}
