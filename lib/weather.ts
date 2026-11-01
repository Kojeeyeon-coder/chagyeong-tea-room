export type TeaRoomWeather = "clear" | "rain" | "snow";

export function getTeaRoomWeather(date = new Date(), forced?: string | null): TeaRoomWeather {
  if (forced === "rain" || forced === "snow" || forced === "clear") return forced;
  const dayKey = Number(`${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`);
  const chance = (dayKey * 37 + 11) % 100;
  const winter = date.getMonth() === 11 || date.getMonth() <= 1;
  if (winter && chance < 24) return "snow";
  if (chance < 28) return "rain";
  return "clear";
}

export function weatherFromWmoCode(code: number): TeaRoomWeather {
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return "rain";
  return "clear";
}
