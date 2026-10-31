export type TimeOfDay = "day" | "dusk" | "night";

export function getTimeOfDay(date = new Date(), forced?: string | null): TimeOfDay {
  if (forced === "day" || forced === "dusk" || forced === "night") return forced;
  const hour = date.getHours();
  if (hour >= 7 && hour < 17) return "day";
  if (hour >= 17 && hour < 19) return "dusk";
  return "night";
}

export const LIGHTING = {
  day: { background: "#dfe9df", ambient: 1.35, sun: 2.2, sunColor: "#fff4d7", fog: "#dfe9df" },
  dusk: { background: "#cbbeb4", ambient: 0.9, sun: 1.45, sunColor: "#f2b58a", fog: "#cbbeb4" },
  night: { background: "#243330", ambient: 0.42, sun: 0.45, sunColor: "#aab6c9", fog: "#243330" },
} as const;
