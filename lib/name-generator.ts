const FIRST = ["다", "온", "윤", "해", "소", "청", "유", "담", "설", "은", "연", "솔", "하", "서", "예", "가"];
const LAST = ["원", "결", "림", "월", "담", "연", "헌", "백", "울", "람", "온", "재", "화", "빈", "아", "로"];

export const POETIC_NAME_COUNT = FIRST.length * LAST.length;

export function choosePoeticName(used: Set<string>, random = Math.random) {
  const candidates = FIRST.flatMap((first) => LAST.map((last) => `${first}${last}`));
  const available = candidates.filter((candidate) => !used.has(candidate));
  return available[Math.floor(random() * available.length)] ?? `다우${used.size + 1}`;
}
