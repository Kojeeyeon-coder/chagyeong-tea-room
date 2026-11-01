"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LocalPresence, RabbitIdentity, RoomSnapshot } from "@/lib/chagyeong-types";

type SessionResponse = RabbitIdentity & { spawn: { x: number; z: number } };
type ConnectionState = "entering" | "online" | "reconnecting" | "full" | "error";

const EMPTY_ROOM: RoomSnapshot = { people: [], occupiedSeats: {}, tableHosts: {}, serverTime: 0 };

export function useTeaRoom() {
  const [identity, setIdentity] = useState<RabbitIdentity | null>(null);
  const [room, setRoom] = useState<RoomSnapshot>(EMPTY_ROOM);
  const [connection, setConnection] = useState<ConnectionState>("entering");
  const [message, setMessage] = useState("다실의 문을 여는 중");
  const [local, setLocalState] = useState<LocalPresence>({
    position: { x: 0, z: 4.8 }, rotation: 0, state: "walking", seatId: null,
    tea: null, teaware: null, ritual: "idle", actionStartedAt: null,
  });
  const identityRef = useRef(identity);
  const localRef = useRef(local);
  const greetTimer = useRef<number | null>(null);
  identityRef.current = identity;
  localRef.current = local;

  const sendPresence = useCallback(async (presence = localRef.current) => {
    const active = identityRef.current;
    if (!active || !navigator.onLine) return false;
    try {
      const response = await fetch("/api/presence", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: active.sessionId, token: active.token, ...presence }),
      });
      if (!response.ok) throw new Error("presence");
      setConnection("online");
      return true;
    } catch {
      setConnection("reconnecting");
      return false;
    }
  }, []);

  const updateLocal = useCallback((patch: Partial<LocalPresence>, urgent = false) => {
    const next = { ...localRef.current, ...patch };
    localRef.current = next;
    setLocalState(next);
    if (urgent) void sendPresence(next);
  }, [sendPresence]);

  const fetchRoom = useCallback(async () => {
    const active = identityRef.current;
    if (!active) return;
    try {
      const response = await fetch(`/api/presence?room=${encodeURIComponent(active.roomId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("room");
      setRoom(await response.json() as RoomSnapshot);
      setConnection("online");
    } catch {
      setConnection("reconnecting");
    }
  }, []);

  const enter = useCallback(async () => {
    setConnection("entering");
    setMessage("토끼와 이름을 고르는 중");
    try {
      const response = await fetch("/api/session", { method: "POST" });
      if (response.status === 409) {
        setConnection("full");
        setMessage("다실이 잠시 가득 찼어요");
        return;
      }
      if (!response.ok) throw new Error("session");
      const session = await response.json() as SessionResponse;
      const nextIdentity: RabbitIdentity = {
        sessionId: session.sessionId, token: session.token, displayName: session.displayName,
        variant: session.variant, roomId: session.roomId,
      };
      setIdentity(nextIdentity);
      identityRef.current = nextIdentity;
      const nextLocal: LocalPresence = { ...localRef.current, position: session.spawn, rotation: Math.PI };
      localRef.current = nextLocal;
      setLocalState(nextLocal);
      sessionStorage.setItem("chagyeong-rabbit", JSON.stringify(nextIdentity));
      setConnection("online");
      setMessage("차경에 들어왔어요");
      await fetchRoom();
    } catch {
      setConnection("error");
      setMessage("다실에 들어가지 못했어요");
    }
  }, [fetchRoom]);

  useEffect(() => { void enter(); }, [enter]);
  useEffect(() => {
    if (!identity) return;
    const presenceTimer = window.setInterval(() => void sendPresence(), 1_000);
    const roomTimer = window.setInterval(() => void fetchRoom(), 1_500);
    const online = () => { setConnection("reconnecting"); void sendPresence(); void fetchRoom(); };
    const offline = () => setConnection("reconnecting");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.clearInterval(presenceTimer);
      window.clearInterval(roomTimer);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [identity, fetchRoom, sendPresence]);

  const claimSeat = useCallback(async (seatId: string) => {
    const active = identityRef.current;
    if (!active || connection !== "online") return { ok: false, message: "연결을 확인하고 다시 시도해 주세요" };
    const response = await fetch(`/api/seats/${seatId}/claim`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: active.sessionId, token: active.token }),
    });
    if (!response.ok) return { ok: false, message: response.status === 409 ? "다른 토끼가 먼저 앉았어요" : "자리에 앉지 못했어요" };
    updateLocal({ seatId, state: "sitting", ritual: "idle", actionStartedAt: Date.now() }, true);
    await fetchRoom();
    return { ok: true, message: "찻상에 앉았어요" };
  }, [connection, fetchRoom, updateLocal]);

  const leaveSeat = useCallback(async () => {
    const active = identityRef.current;
    const seatId = localRef.current.seatId;
    if (!active || !seatId) return;
    updateLocal({ seatId: null, state: "walking", ritual: "idle", actionStartedAt: Date.now() }, true);
    await fetch(`/api/seats/${seatId}/claim`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: active.sessionId, token: active.token }),
    }).catch(() => null);
    await fetchRoom();
  }, [fetchRoom, updateLocal]);

  const greet = useCallback(() => {
    if (greetTimer.current) window.clearTimeout(greetTimer.current);
    updateLocal({ state: "greeting", actionStartedAt: Date.now() }, true);
    greetTimer.current = window.setTimeout(() => {
      const nextState = localRef.current.seatId ? "sitting" : "walking";
      updateLocal({ state: nextState, actionStartedAt: null }, true);
      greetTimer.current = null;
    }, 1_600);
  }, [updateLocal]);

  useEffect(() => () => { if (greetTimer.current) window.clearTimeout(greetTimer.current); }, []);

  return { identity, room, connection, message, local, updateLocal, claimSeat, leaveSeat, greet, retry: enter };
}
