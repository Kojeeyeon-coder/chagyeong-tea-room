import type { TeaKind, TeawareKind } from "./chagyeong-types";

export const TEAS: Array<{ id: TeaKind; name: string; hanja: string; note: string; color: string; recommended: TeawareKind }> = [
  { id: "green", name: "녹차", hanja: "綠茶", note: "맑고 어린 잎의 향", color: "#a8b875", recommended: "koreanTeapot" },
  { id: "white", name: "백차", hanja: "白茶", note: "부드럽고 은은한 단맛", color: "#ddd1a5", recommended: "gaiwan" },
  { id: "yellow", name: "황차", hanja: "黃茶", note: "둥글고 포근한 향", color: "#c7a75d", recommended: "gaiwan" },
  { id: "oolong", name: "청차", hanja: "靑茶", note: "꽃과 과실의 깊은 향", color: "#ad7f51", recommended: "yixing" },
  { id: "black", name: "홍차", hanja: "紅茶", note: "따뜻하고 선명한 향", color: "#8d4f3f", recommended: "koreanTeapot" },
  { id: "dark", name: "흑차", hanja: "黑茶", note: "오래 익은 나무와 흙의 향", color: "#60483d", recommended: "yixing" },
  { id: "matcha", name: "말차", hanja: "抹茶", note: "짙고 싱그러운 거품", color: "#7f9863", recommended: "matchaSet" },
];

export const TEAWARE: Array<{ id: TeawareKind; name: string; note: string }> = [
  { id: "gaiwan", name: "백자 개완", note: "뚜껑으로 잎을 가만히 모아요" },
  { id: "yixing", name: "자사호", note: "작은 호를 기울여 깊게 우려요" },
  { id: "koreanTeapot", name: "한국식 다관", note: "숙우와 함께 차분히 나눠요" },
  { id: "matchaSet", name: "말차 다구", note: "차선으로 부드럽게 격불해요" },
];

export const RITUAL_COPY = {
  idle: "차와 다구를 골라 주세요",
  preparing: "다구를 따뜻하게 데우는 중",
  brewing: "차가 천천히 우러나는 중",
  serving: "작은 잔에 차를 따르는 중",
  sipping: "두 앞발로 찻잔을 들어요",
  complete: "한 잔의 쉼이 완성되었어요",
} as const;
