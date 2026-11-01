export const RABBIT_VARIANTS = ["snow", "ink", "mist", "chestnut", "cream", "dapple"] as const;
export type RabbitVariant = (typeof RABBIT_VARIANTS)[number];

export const RABBIT_STATES = ["walking", "sitting", "brewing", "drinking", "greeting", "requesting", "pouring"] as const;
export type RabbitState = (typeof RABBIT_STATES)[number];

export const TEA_KINDS = ["green", "white", "yellow", "oolong", "black", "dark", "matcha"] as const;
export type TeaKind = (typeof TEA_KINDS)[number];

export const TEAWARE_KINDS = ["gaiwan", "yixing", "koreanTeapot", "matchaSet"] as const;
export type TeawareKind = (typeof TEAWARE_KINDS)[number];

export const RITUAL_STATES = ["idle", "preparing", "brewing", "serving", "sipping", "complete"] as const;
export type TeaRitualState = (typeof RITUAL_STATES)[number];

export type Vec2 = { x: number; z: number };

export const ROOM_IDS = ["chagyeong", "soyo", "dajeong", "cheongyeon", "wolbaek"] as const;
export type RoomId = (typeof ROOM_IDS)[number];
export const ROOM_NAMES: Record<RoomId, string> = {
  chagyeong: "차경", soyo: "소요", dajeong: "다정", cheongyeon: "청연", wolbaek: "월백",
};

export type RabbitIdentity = {
  sessionId: string;
  token: string;
  displayName: string;
  variant: RabbitVariant;
  roomId: RoomId;
};

export type PresenceSnapshot = {
  sessionId: string;
  displayName: string;
  variant: RabbitVariant;
  roomId: RoomId;
  position: Vec2;
  rotation: number;
  state: RabbitState;
  seatId: string | null;
  tea: TeaKind | null;
  teaware: TeawareKind | null;
  ritual: TeaRitualState;
  actionStartedAt: number | null;
  updatedAt: number;
};

export type RoomSnapshot = {
  people: PresenceSnapshot[];
  occupiedSeats: Record<string, string>;
  tableHosts: Record<string, string>;
  serverTime: number;
};

export type LocalPresence = Omit<PresenceSnapshot, "sessionId" | "displayName" | "variant" | "roomId" | "updatedAt">;
