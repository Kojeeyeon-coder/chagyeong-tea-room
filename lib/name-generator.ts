const ADJECTIVES = [
  "고요한", "포근한", "느긋한", "수줍은", "말랑한", "은은한", "잔잔한", "맑은",
  "다정한", "나른한", "차분한", "소담한", "가벼운", "반가운", "여린", "느린",
];
const NOUNS = [
  "찻잎", "달빛", "구름", "연꽃", "찻잔", "새벽", "솔바람", "물결",
  "동백", "이슬", "대숲", "노을", "백자", "꽃비", "산그늘", "여백",
];

export const POETIC_NAME_COUNT = ADJECTIVES.length * NOUNS.length;

export function choosePoeticName(used: Set<string>, random = Math.random) {
  const candidates = ADJECTIVES.flatMap((adjective) => NOUNS.map((noun) => `${adjective} ${noun}`));
  const available = candidates.filter((candidate) => !used.has(candidate));
  return available[Math.floor(random() * available.length)] ?? `느긋한 찻잎 ${used.size + 1}`;
}
