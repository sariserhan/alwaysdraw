/** Convert ISO 3166-1 alpha-2 country code to flag emoji */
export function getCountryFlagEmoji(countryCode?: string): string {
  if (!countryCode || countryCode.length !== 2) return "🌐";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export const POPULAR_COUNTRIES = [
  { code: "US", name: "🇺🇸 United States" },
  { code: "DE", name: "🇩🇪 Germany" },
  { code: "JP", name: "🇯🇵 Japan" },
  { code: "FR", name: "🇫🇷 France" },
  { code: "GB", name: "🇬🇧 United Kingdom" },
  { code: "BR", name: "🇧🇷 Brazil" },
  { code: "CA", name: "🇨🇦 Canada" },
  { code: "AU", name: "🇦🇺 Australia" },
  { code: "ES", name: "🇪🇸 Spain" },
  { code: "IT", name: "🇮🇹 Italy" },
  { code: "KR", name: "🇰🇷 South Korea" },
  { code: "IN", name: "🇮🇳 India" },
  { code: "TR", name: "🇹🇷 Turkey" },
];
