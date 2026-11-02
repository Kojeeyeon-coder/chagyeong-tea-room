const COLORS = [
  "하얀", "다홍", "노란", "연분홍", "분홍", "자주", "보랏빛", "푸른",
  "하늘빛", "남빛", "연둣빛", "초록", "살구빛", "주홍", "은빛", "달빛",
];

const FLOWERS = [
  "동백", "장미", "수선", "매화", "난초", "목련", "작약", "모란",
  "국화", "제비꽃", "붓꽃", "연꽃", "해당화", "금낭화", "초롱꽃", "능소화",
];

export const POETIC_NAME_COUNT = COLORS.length * FLOWERS.length;

export function choosePoeticName(used: Set<string>, random = Math.random) {
  const candidates = COLORS.flatMap((color) => FLOWERS.map((flower) => `${color} ${flower}`));
  const available = candidates.filter((candidate) => !used.has(candidate));
  return available[Math.floor(random() * available.length)] ?? `달빛 꽃잎${used.size + 1}`;
}
