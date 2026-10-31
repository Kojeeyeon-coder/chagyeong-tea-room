"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Leaf, LogOut, Moon, Rabbit as RabbitIcon, Rotate3D, Sparkles, Sun, Users } from "lucide-react";
import { TEAS, TEAWARE, RITUAL_COPY } from "@/lib/catalog";
import type { TeaRitualState } from "@/lib/chagyeong-types";
import { getTimeOfDay, type TimeOfDay } from "@/lib/time-of-day";
import { useTeaRoom } from "@/hooks/use-tea-room";
import { TeaRoomScene } from "./tea-room-scene";

const NEXT_RITUAL: Record<TeaRitualState, TeaRitualState> = {
  idle: "preparing", preparing: "brewing", brewing: "serving", serving: "sipping", sipping: "complete", complete: "idle",
};

const RITUAL_ACTION: Record<TeaRitualState, string> = {
  idle: "차 우리기 시작", preparing: "물을 천천히 붓기", brewing: "차를 잔에 따르기", serving: "찻잔 들어 보기", sipping: "한 모금 마시기", complete: "한 잔 더 우리기",
};

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

  useEffect(() => {
    setWebgl(hasWebGL());
    const forced = new URLSearchParams(window.location.search).get("time");
    const update = () => setTimeOfDay(getTimeOfDay(new Date(), forced));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice((current) => current === text ? "천천히 둘러보세요" : current), 3_200);
  }, []);

  const selectedTea = useMemo(() => TEAS.find((tea) => tea.id === teaRoom.local.tea), [teaRoom.local.tea]);

  const selectTea = (teaId: (typeof TEAS)[number]["id"]) => {
    const tea = TEAS.find((item) => item.id === teaId)!;
    teaRoom.updateLocal({ tea: tea.id, teaware: tea.recommended, ritual: "idle", state: "sitting", actionStartedAt: Date.now() }, true);
  };

  const advanceRitual = () => {
    const tea = selectedTea ?? TEAS[0];
    const current = teaRoom.local.ritual;
    const next = NEXT_RITUAL[current];
    const state = next === "sipping" ? "drinking" : next === "complete" || next === "idle" ? "sitting" : "brewing";
    teaRoom.updateLocal({
      tea: tea.id,
      teaware: teaRoom.local.teaware ?? tea.recommended,
      ritual: next,
      state,
      actionStartedAt: Date.now(),
    }, true);
    showNotice(RITUAL_COPY[next]);
  };

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
        <TeaRoomScene identity={identity} local={teaRoom.local} room={teaRoom.room} timeOfDay={timeOfDay} onMove={teaRoom.updateLocal} onClaimSeat={teaRoom.claimSeat} onNotice={showNotice} />
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
        <button onClick={teaRoom.greet} disabled={teaRoom.connection !== "online"}><Sparkles size={18} /><span>꾸벅 인사</span></button>
        {teaRoom.local.seatId && <button onClick={() => void teaRoom.leaveSeat()}><LogOut size={18} /><span>자리에서 일어나기</span></button>}
        <span className="control-hint"><Rotate3D size={17} /> 바닥 클릭 · 드래그 회전 · 휠 확대</span>
      </nav>

      {teaRoom.local.seatId && (
        <aside className="tea-panel" aria-label="차와 다구 선택">
          <div className="panel-heading"><div><p className="eyebrow">오늘의 찻상</p><h2>어떤 차를 우릴까요?</h2></div><span className="seat-label">{teaRoom.local.seatId.replace("seat-", "자리 ")}</span></div>
          <div className="tea-grid" role="list" aria-label="차 종류">
            {TEAS.map((tea) => <button key={tea.id} className={teaRoom.local.tea === tea.id ? "selected" : ""} onClick={() => selectTea(tea.id)} disabled={teaRoom.local.ritual !== "idle" && teaRoom.local.ritual !== "complete"} style={{ "--tea-color": tea.color } as React.CSSProperties}><span>{tea.hanja}</span><strong>{tea.name}</strong></button>)}
          </div>
          {selectedTea && <p className="tea-note"><i style={{ background: selectedTea.color }} />{selectedTea.note}</p>}
          <label className="field-label" htmlFor="teaware">다구</label>
          <div className="teaware-list" id="teaware">
            {TEAWARE.map((ware) => <button key={ware.id} className={teaRoom.local.teaware === ware.id ? "selected" : ""} onClick={() => teaRoom.updateLocal({ teaware: ware.id, ritual: "idle" }, true)} disabled={teaRoom.local.ritual !== "idle" && teaRoom.local.ritual !== "complete"}><strong>{ware.name}</strong><small>{ware.note}</small></button>)}
          </div>
          <div className="ritual-status"><span className={`ritual-orb ritual-${teaRoom.local.ritual}`} /><div><small>지금</small><strong>{RITUAL_COPY[teaRoom.local.ritual]}</strong></div></div>
          <button className="primary-button ritual-button" onClick={advanceRitual}>{RITUAL_ACTION[teaRoom.local.ritual]}</button>
        </aside>
      )}
    </main>
  );
}
