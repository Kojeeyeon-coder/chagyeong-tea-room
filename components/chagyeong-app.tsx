"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Armchair, Coffee, CupSoda, Leaf, Moon, Rabbit as RabbitIcon, Sparkles, Sun, Users } from "lucide-react";
import { TEAS, TEAWARE, RITUAL_COPY } from "@/lib/catalog";
import { getTimeOfDay, type TimeOfDay } from "@/lib/time-of-day";
import { SEAT_POSITIONS } from "@/lib/navigation";
import { useTeaRoom } from "@/hooks/use-tea-room";
import { TeaRoomScene } from "./tea-room-scene";

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch { return false; }
}

export function ChagyeongApp() {
  const teaRoom = useTeaRoom();
  const [notice, setNotice] = useState("바닥을 누르면 토끼가 그곳으로 걸어가요");
  const [webgl, setWebgl] = useState(true);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("day");
  const [teaPanelOpen, setTeaPanelOpen] = useState(false);
  const [seatRequest, setSeatRequest] = useState<{ seatId: string; nonce: number } | null>(null);
  const ritualTimers = useRef<number[]>([]);

  useEffect(() => {
    setWebgl(hasWebGL());
    const forced = new URLSearchParams(window.location.search).get("time");
    const update = () => setTimeOfDay(getTimeOfDay(new Date(), forced));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => ritualTimers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice((current) => current === text ? "천천히 둘러보세요" : current), 3_200);
  }, []);

  const selectedTea = useMemo(() => TEAS.find((tea) => tea.id === teaRoom.local.tea), [teaRoom.local.tea]);

  const selectTea = (teaId: (typeof TEAS)[number]["id"]) => {
    const tea = TEAS.find((item) => item.id === teaId)!;
    teaRoom.updateLocal({ tea: tea.id, teaware: tea.recommended, ritual: "idle", state: "sitting", actionStartedAt: Date.now() }, true);
  };

  const clearRitualTimers = useCallback(() => {
    ritualTimers.current.forEach((timer) => window.clearTimeout(timer));
    ritualTimers.current = [];
  }, []);

  const requestNearestSeat = () => {
    if (teaRoom.local.seatId) {
      clearRitualTimers();
      setTeaPanelOpen(false);
      void teaRoom.leaveSeat();
      return;
    }
    const available = SEAT_POSITIONS
      .filter((seat) => !teaRoom.room.occupiedSeats[seat.id])
      .sort((a, b) => Math.hypot(a.x - teaRoom.local.position.x, a.z - teaRoom.local.position.z) - Math.hypot(b.x - teaRoom.local.position.x, b.z - teaRoom.local.position.z));
    if (!available[0]) {
      showNotice("지금은 빈 자리가 없어요");
      return;
    }
    setSeatRequest({ seatId: available[0].id, nonce: Date.now() });
    showNotice("가까운 빈 자리로 걸어갈게요");
  };

  const startBrewing = useCallback(() => {
    if (!teaRoom.local.seatId) {
      showNotice("먼저 하단의 자리에 앉기를 눌러 주세요");
      return;
    }
    if (!selectedTea || !teaRoom.local.teaware) {
      setTeaPanelOpen(true);
      showNotice("차와 다구를 먼저 골라 주세요");
      return;
    }
    if (["preparing", "brewing", "serving", "sipping"].includes(teaRoom.local.ritual)) return;
    clearRitualTimers();
    setTeaPanelOpen(false);
    const setStage = (ritual: "preparing" | "brewing" | "serving", message: string) => {
      teaRoom.updateLocal({ ritual, state: "brewing", actionStartedAt: Date.now() }, true);
      showNotice(message);
    };
    setStage("preparing", RITUAL_COPY.preparing);
    ritualTimers.current.push(window.setTimeout(() => setStage("brewing", RITUAL_COPY.brewing), 1_500));
    ritualTimers.current.push(window.setTimeout(() => setStage("serving", "차가 잔에 담겼어요. 이제 차 마시기를 눌러 보세요"), 4_000));
  }, [clearRitualTimers, selectedTea, showNotice, teaRoom.local.ritual, teaRoom.local.seatId, teaRoom.local.teaware, teaRoom.updateLocal]);

  const drinkTea = useCallback(() => {
    if (teaRoom.local.ritual !== "serving") {
      showNotice(teaRoom.local.seatId ? "차가 다 우러날 때까지 잠시 기다려 주세요" : "먼저 자리에 앉아 차를 우려 주세요");
      return;
    }
    clearRitualTimers();
    teaRoom.updateLocal({ ritual: "sipping", state: "drinking", actionStartedAt: Date.now() }, true);
    showNotice(RITUAL_COPY.sipping);
    ritualTimers.current.push(window.setTimeout(() => {
      teaRoom.updateLocal({ ritual: "complete", state: "sitting", actionStartedAt: Date.now() }, true);
      showNotice(RITUAL_COPY.complete);
    }, 2_000));
  }, [clearRitualTimers, showNotice, teaRoom.local.ritual, teaRoom.local.seatId, teaRoom.updateLocal]);

  if (!webgl) return (
    <main className="fallback-screen"><div className="fallback-card"><Leaf size={30} /><p className="eyebrow">차경 茶境</p><h1>이 브라우저에서는 3D 다실을 열 수 없어요</h1><p>WebGL을 지원하는 최신 Chrome, Edge, Safari에서 다시 방문해 주세요.</p></div></main>
  );

  if (!teaRoom.identity) return (
    <main className="entry-screen">
      <div className="entry-glow" />
      <section className="entry-card" aria-live="polite">
        <div className="brand-seal"><Leaf size={24} /></div>
        <p className="eyebrow">차경 茶境</p>
        <h1>{teaRoom.connection === "full" ? "오늘의 다실은 북적여요" : "차 한 잔의 여백으로"}</h1>
        <p>{teaRoom.message}</p>
        {teaRoom.connection === "entering" && <span className="loading-leaf" aria-label="불러오는 중">◆</span>}
        {(teaRoom.connection === "full" || teaRoom.connection === "error") && <button className="primary-button" onClick={teaRoom.retry}>다시 문 두드리기</button>}
      </section>
    </main>
  );

  const timeLabel = timeOfDay === "day" ? "맑은 낮" : timeOfDay === "dusk" ? "저무는 빛" : "고요한 밤";
  const TimeIcon = timeOfDay === "night" ? Moon : Sun;
  const peopleCount = Math.max(1, teaRoom.room.people.length);
  const identity = teaRoom.identity;

  return (
    <main className={`chagyeong-shell time-${timeOfDay}`}>
      <section className="scene" aria-label="차경 3D 다실">
        <TeaRoomScene identity={identity} local={teaRoom.local} room={teaRoom.room} timeOfDay={timeOfDay} seatRequest={seatRequest} onMove={teaRoom.updateLocal} onClaimSeat={teaRoom.claimSeat} onNotice={showNotice} />
      </section>

      <header className="topbar">
        <div className="brand-lockup"><span className="mini-seal"><Leaf size={15} /></span><div><strong>차경</strong><small>茶境</small></div></div>
        <div className="room-pills">
          <span><Users size={15} /> {peopleCount} / 20</span>
          <span><TimeIcon size={15} /> {timeLabel}</span>
          <span className={`connection-dot connection-${teaRoom.connection}`}>{teaRoom.connection === "online" ? "함께 머무는 중" : "다시 연결하는 중"}</span>
        </div>
      </header>

      <aside className="identity-card">
        <RabbitIcon size={17} />
        <div><small>오늘의 토끼</small><strong>{identity.displayName}</strong></div>
      </aside>

      {teaRoom.room.people.length > 1 && (
        <aside className="visitor-card" aria-label="함께 머무는 토끼">
          <small>함께 머무는 토끼</small>
          {teaRoom.room.people.filter((person) => person.sessionId !== identity.sessionId).slice(0, 4).map((person) => (
            <span key={person.sessionId}><i />{person.displayName}</span>
          ))}
        </aside>
      )}

      <div className="notice" aria-live="polite">{notice}</div>

      <nav className="action-dock" aria-label="토끼 행동">
        <button onClick={teaRoom.greet} disabled={teaRoom.connection !== "online"}><Sparkles size={19} /><span>인사하기</span></button>
        <button className={teaRoom.local.seatId ? "active" : ""} onClick={requestNearestSeat} disabled={teaRoom.connection !== "online"}><Armchair size={19} /><span>{teaRoom.local.seatId ? "일어나기" : "자리에 앉기"}</span></button>
        <button className={teaPanelOpen || teaRoom.local.state === "brewing" ? "active" : ""} onClick={() => {
          if (!teaRoom.local.tea || !teaRoom.local.teaware) setTeaPanelOpen(true);
          else void startBrewing();
        }} disabled={!teaRoom.local.seatId || ["preparing", "brewing", "serving", "sipping"].includes(teaRoom.local.ritual)}><Coffee size={19} /><span>{["preparing", "brewing"].includes(teaRoom.local.ritual) ? "우리는 중" : teaRoom.local.ritual === "complete" ? "한 잔 더" : "차 우리기"}</span></button>
        <button className={teaRoom.local.state === "drinking" ? "active" : ""} onClick={drinkTea} disabled={teaRoom.local.ritual !== "serving"}><CupSoda size={19} /><span>차 마시기</span></button>
      </nav>

      {teaRoom.local.seatId && teaPanelOpen && (
        <aside className="tea-panel" aria-label="차와 다구 선택">
          <div className="panel-heading"><div><p className="eyebrow">오늘의 찻상</p><h2>차와 다구를 골라 주세요</h2></div><button className="panel-close" onClick={() => setTeaPanelOpen(false)} aria-label="차 선택 닫기">×</button></div>
          <div className="tea-grid" role="list" aria-label="차 종류">
            {TEAS.map((tea) => <button key={tea.id} className={teaRoom.local.tea === tea.id ? "selected" : ""} onClick={() => selectTea(tea.id)} disabled={teaRoom.local.ritual !== "idle" && teaRoom.local.ritual !== "complete"} style={{ "--tea-color": tea.color } as React.CSSProperties}><span>{tea.hanja}</span><strong>{tea.name}</strong></button>)}
          </div>
          {selectedTea && <p className="tea-note"><i style={{ background: selectedTea.color }} />{selectedTea.note}</p>}
          <label className="field-label" htmlFor="teaware">다구</label>
          <div className="teaware-list" id="teaware">
            {TEAWARE.map((ware) => <button key={ware.id} className={teaRoom.local.teaware === ware.id ? "selected" : ""} onClick={() => teaRoom.updateLocal({ teaware: ware.id, ritual: "idle" }, true)} disabled={teaRoom.local.ritual !== "idle" && teaRoom.local.ritual !== "complete"}><strong>{ware.name}</strong><small>{ware.note}</small></button>)}
          </div>
          <div className="ritual-status"><span className={`ritual-orb ritual-${teaRoom.local.ritual}`} /><div><small>지금</small><strong>{RITUAL_COPY[teaRoom.local.ritual]}</strong></div></div>
          <button className="primary-button ritual-button" onClick={startBrewing} disabled={!selectedTea || !teaRoom.local.teaware}>선택 완료 · 차 우리기</button>
        </aside>
      )}
    </main>
  );
}
