export interface Palette {
  id: string;
  name: string;
  colors: string[];
}

export const PALETTE_PRESETS: Palette[] = [
  {
    id: "industrial",
    name: "Industrial Steel",
    colors: ["#17181a", "#f5f1e6", "#8c3b2b", "#e0b13a", "#4a6b5d", "#8c8d90"],
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk 2077",
    colors: ["#0f051d", "#ff0055", "#00f0ff", "#ffe600", "#7000ff", "#00ff66"],
  },
  {
    id: "neontokyo",
    name: "Neon Tokyo",
    colors: ["#120e23", "#ff2a74", "#00e5ff", "#b000ff", "#ffb800", "#00ff9f"],
  },
  {
    id: "pastelsunset",
    name: "Pastel Sunset",
    colors: ["#2c223b", "#ff9a9e", "#fecfef", "#a1c4fd", "#c2e9fb", "#ffecd2"],
  },
  {
    id: "retrogameboy",
    name: "Retro GameBoy",
    colors: ["#0f380f", "#306230", "#8bac0f", "#9bbc0f", "#e0f8d0", "#041004"],
  },
  {
    id: "monochrome",
    name: "Monochrome Slate",
    colors: ["#0d0e10", "#23252a", "#474a52", "#7d8290", "#c2c7d4", "#f0f2f6"],
  },
];
