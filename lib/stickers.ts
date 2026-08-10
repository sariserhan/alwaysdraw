export type StickerCategory = "retro" | "badges" | "emojis" | "symbols";

export interface StickerItem {
  id: string;
  name: string;
  emoji: string;
  category: StickerCategory;
}

export const STICKER_CATALOG: StickerItem[] = [
  { id: "crown", name: "Royal Crown", emoji: "👑", category: "badges" },
  { id: "skull", name: "Pirate Skull", emoji: "💀", category: "badges" },
  { id: "fire", name: "Hot Fire", emoji: "🔥", category: "emojis" },
  { id: "rocket", name: "Space Rocket", emoji: "🚀", category: "emojis" },
  { id: "diamond", name: "Shining Gem", emoji: "💎", category: "badges" },
  { id: "heart", name: "Pixel Heart", emoji: "❤️", category: "emojis" },
  { id: "star", name: "Gold Star", emoji: "⭐", category: "emojis" },
  { id: "ghost", name: "Pixel Ghost", emoji: "👻", category: "retro" },
  { id: "alien", name: "Space Invader", emoji: "👾", category: "retro" },
  { id: "robot", name: "Cyber Bot", emoji: "🤖", category: "retro" },
  { id: "pizza", name: "Pizza Slice", emoji: "🍕", category: "symbols" },
  { id: "zap", name: "High Voltage", emoji: "⚡", category: "symbols" },
];
