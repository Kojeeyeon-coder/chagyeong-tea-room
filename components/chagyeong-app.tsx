"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Armchair, BellRing, CloudRain, Coffee, CupSoda, Leaf, Moon, Rabbit as RabbitIcon, Snowflake, Sparkles, Sun, Users, Volume2, VolumeX } from "lucide-react";
import { TEAS, TEAWARE, RITUAL_COPY } from "@/lib/catalog";
import { getTimeOfDay, type TimeOfDay } from "@/lib/time-of-day";
import { SEAT_POSITIONS } from "@/lib/navigation";
import { ROOM_NAMES } from "@/lib/chagyeong-types";
import { getTeaRoomWeather, weatherFromWmoCode, type TeaRoomWeather } from "@/lib/weather";
import { useTeaRoom } from "@/hooks/use-tea-room";
import { useAmbientSound, useWindChime } from "@/hooks/use-ambient-sound";
import { TeaRoomScene } from "./tea-room-scene";

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch { return false; }
}

function getPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 7_000, maximumAge: 30 * 60_000 }));
}

async function getLocalWeather() {
  const position = await getPosition();
  const latitude = position.coords.latitude.toFixed(3);
  const longitude = position.coords.longitude.toFixed(3);
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=weather_code`, { cache: "no-store" });
  if (!response.ok) throw new Error("weather");
  const data = await response.json() as { current?: { weather_code?: number } };
  if (typeof data.current?.weather_code !== "number") throw new Error("weather");
  return weatherFromWmoCode(data.current.weather_code);
}

export function ChagyeongApp() {
  const teaRoom = useTeaRoom();
  const [weather, setWeather] = useState<TeaRoomWeather>("clear");
  const [weatherLocal, setWeatherLocal] = useState(false);
  const ambient = useAmbientSound(weather);
  const chime = useWindChime();
  const [notice, setNotice] = useState("바닥을 누르면 토끼가 그곳으로 걸어가요");
  const [webgl, setWebgl] = useState(true);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("day");
  const [teaPanelOpen, setTeaPanelOpen] = useState(false);
  const [seatPanelOpen, setSeatPanelOpen] = useState(false);
  const [namePanelOpen, setNamePanelOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [pourReady, setPourReady] = useState(false);
  const [seatRequest, setSeatRequest] = useState<{ seatId: string; nonce: number } | null>(null);
  const ritualTimers = useRef<number[]>([]);
  const socialTimer = useRef<number | null>(null);

  useEffect(() => {
    setWebgl(hasWebGL());
    const forced = new URLSearchParams(window.location.search).get("time");
    const forcedWeather = new URLSearchParams(window.location.search).get("weather");
    const update = () => setTimeOfDay(getTimeOfDay(new Date(), forced));
    setWeather(getTeaRoomWeather(new Date(), forcedWeather));
    if (!forcedWeather && "geolocation" in navigator) {
      void getLocalWeather().then((next) => { setWeather(next); setWeatherLocal(true); }).catch(() => setWeatherLocal(false));
    }
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => {
    ritualTimers.current.forEach((timer) => window.clearTimeout(timer));
    if (socialTimer.current) window.clearTimeout(socialTimer.current);
  }, []);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice((current) => current === text ? "천천히 둘러보세요" : current), 3_200);
  }, []);

  const selectedTea = useMemo(() => TEAS.find((tea) => tea.id === teaRoom.local.tea), [teaRoom.local.tea]);

  const saveName = async (event: React.FormEvent) => {
    event.preventDefault();
    const displayName = nameDraft.trim();
    const result = await teaRoom.rename(displayName);
    showNotice(result.message);
    if (result.ok) setNamePanelOpen(false);
  };

  const selectTea = (teaId: (typeof TEAS)[number]["id"]) => {
    const tea = TEAS.find((item) => item.id === teaId)!;
    setPourReady(false);
    teaRoom.updateLocal({ tea: tea.id, teaware: tea.recommended, ritual: "idle", state: "sitting", actionStartedAt: Date.now() }, true);
  };

  const clearRitualTimers = useCallback(() => {
    ritualTimers.current.forEach((timer) => window.clearTimeout(timer));
    ritualTimers.current = [];
  }, []);

  const requestSeatByKind = (kind: "solo" | "shared") => {
    if (teaRoom.local.seatId) {
      clearRitualTimers();
      setTeaPanelOpen(false);
      setSeatPanelOpen(false);
      void teaRoom.leaveSeat();
      return;
    }
    const occupiedTables = new Set(teaRoom.room.people.flatMap((person) => {
      const seat = SEAT_POSITIONS.find((item) => item.id === person.seatId);
      return seat ? [seat.table] : [];
    }));
    const available = SEAT_POSITIONS
      .filter((seat) => !teaRoom.room.occupiedSeats[seat.id])
      .filter((seat) => kind === "solo" ? !occupiedTables.has(seat.table) && seat.id.endsWith("1") : occupiedTables.has(seat.table))
      .sort((a, b) => {
        if (kind === "shared") {
          const aCompany = teaRoom.room.people.some((person) => SEAT_POSITIONS.find((seat) => seat.id === person.seatId)?.table === a.table) ? 1 : 0;
          const bCompany = teaRoom.room.people.some((person) => SEAT_POSITIONS.find((seat) => seat.id === person.seatId)?.table === b.table) ? 1 : 0;
          if (aCompany !== bCompany) return bCompany - aCompany;
        }
        return Math.hypot(a.x - teaRoom.local.position.x, a.z - teaRoom.local.position.z) - Math.hypot(b.x - teaRoom.local.position.x, b.z - teaRoom.local.position.z);
      });
    const fallback = kind === "shared" ? SEAT_POSITIONS
      .filter((seat) => !teaRoom.room.occupiedSeats[seat.id])
      .sort((a, b) => Math.hypot(a.x - teaRoom.local.position.x, a.z - teaRoom.local.position.z) - Math.hypot(b.x - teaRoom.local.position.x, b.z - teaRoom.local.position.z))[0] : null;
    const chosen = available[0] ?? fallback;
    if (!chosen) {
      showNotice(kind === "solo" ? "지금은 비어 있는 찻상이 없어요" : "지금은 빈 자리가 없어요");
      return;
    }
    setSeatRequest({ seatId: chosen.id, nonce: Date.now() });
    setSeatPanelOpen(false);
    showNotice(kind === "solo" ? "비어 있는 팔각상으로 걸어갈게요" : "함께 마실 찻상으로 걸어갈게요");
  };

  const currentSeat = teaRoom.local.seatId ? SEAT_POSITIONS.find((seat) => seat.id === teaRoom.local.seatId) : null;
  const tablemates = currentSeat?.kind === "shared" ? teaRoom.room.people.filter((person) => {
    if (person.sessionId === teaRoom.identity?.sessionId || !person.seatId) return false;
    return SEAT_POSITIONS.find((seat) => seat.id === person.seatId)?.table === currentSeat.table;
  }) : [];
  const requestedTea = tablemates.some((person) => person.state === "requesting");
  const isSharedGuest = currentSeat?.kind === "shared" && teaRoom.room.tableHosts[String(currentSeat.table)] !== teaRoom.identity?.sessionId;
  const sharedPourReady = isSharedGuest && tablemates.some((person) => person.state === "pouring");
  const socialAction = (state: "requesting" | "pouring") => {
    if (!currentSeat || currentSeat.kind !== "shared" || !tablemates.length) {
      showNotice("같은 찻상에 다른 토끼가 앉으면 할 수 있어요");
      return;
    }
    if (state === "pouring" && !requestedTea) {
      showNotice("차를 기다리는 토끼가 아직 없어요");
      return;
    }
    if (socialTimer.current) window.clearTimeout(socialTimer.current);
    teaRoom.updateLocal({ state, actionStartedAt: Date.now() }, true);
    showNotice(state === "requesting" ? "찻잔을 살며시 내밀었어요" : "숙우에서 잔으로 차를 나누어요");
    socialTimer.current = window.setTimeout(() => teaRoom.updateLocal({ state: "sitting", actionStartedAt: Date.now() }, true), 4_000);
  };

  const drinkSharedTea = () => {
    if (!sharedPourReady) {
      showNotice("팽주가 차를 따라 주면 마실 수 있어요");
      return;
    }
    teaRoom.updateLocal({ state: "drinking", ritual: "sipping", actionStartedAt: Date.now() }, true);
    showNotice("새 찻잔을 두 손으로 들어요");
    ritualTimers.current.push(window.setTimeout(() => teaRoom.updateLocal({ state: "sitting", ritual: "complete", actionStartedAt: Date.now() }, true), 3_200));
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
    setPourReady(false);
    setTeaPanelOpen(false);
    const setStage = (ritual: "preparing" | "brewing" | "serving", message: string) => {
      teaRoom.updateLocal({ ritual, state: "brewing", actionStartedAt: Date.now() }, true);
      showNotice(message);
    };
    const isMatcha = teaRoom.local.teaware === "matchaSet" || selectedTea.id === "matcha";
    setStage("preparing", isMatcha ? "다완과 차선을 가지런히 준비해요" : RITUAL_COPY.preparing);
    ritualTimers.current.push(window.setTimeout(() => setStage("brewing", isMatcha ? "연두빛 거품이 오르도록 차선을 빠르게 움직여요" : RITUAL_COPY.brewing), 1_700));
    ritualTimers.current.push(window.setTimeout(() => {
      setStage("serving", isMatcha ? "말차가 고르게 풀렸어요. 다완을 들어 보세요" : "다관에서 숙우를 거쳐 찻잔에 담고 있어요");
      if (isMatcha) {
        setPourReady(true);
      } else {
        ritualTimers.current.push(window.setTimeout(() => {
          setPourReady(true);
          showNotice("숙우에서 찻잔까지 차분히 따랐어요");
        }, 3_000));
      }
    }, 5_200));
  }, [clearRitualTimers, selectedTea, showNotice, teaRoom.local.ritual, teaRoom.local.seatId, teaRoom.local.teaware, teaRoom.updateLocal]);

  const drinkTea = useCallback(() => {
    if (teaRoom.local.ritual !== "serving" || !pourReady) {
      showNotice(teaRoom.local.seatId ? "차가 다 우러날 때까지 잠시 기다려 주세요" : "먼저 자리에 앉아 차를 우려 주세요");
      return;
    }
    clearRitualTimers();
    teaRoom.updateLocal({ ritual: "sipping", state: "drinking", actionStartedAt: Date.now() }, true);
    showNotice(teaRoom.local.teaware === "matchaSet" ? "두 앞발로 다완을 천천히 들어요" : RITUAL_COPY.sipping);
    ritualTimers.current.push(window.setTimeout(() => {
      teaRoom.updateLocal({ ritual: "complete", state: "sitting", actionStartedAt: Date.now() }, true);
      showNotice(RITUAL_COPY.complete);
    }, 3_200));
  }, [clearRitualTimers, pourReady, showNotice, teaRoom.local.ritual, teaRoom.local.seatId, teaRoom.local.teaware, teaRoom.updateLocal]);

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
        <TeaRoomScene identity={identity} local={teaRoom.local} room={teaRoom.room} timeOfDay={timeOfDay} weather={weather} seatRequest={seatRequest} onMove={teaRoom.updateLocal} onClaimSeat={teaRoom.claimSeat} onNotice={showNotice} />
      </section>

      <header className="topbar">
        <div className="brand-lockup"><span className="mini-seal"><Leaf size={15} /></span><div><strong>차경</strong><small>茶境</small></div></div>
        <div className="room-actions">
          <div className="room-pills">
            <span><Leaf size={14} /> {ROOM_NAMES[identity.roomId]}</span>
            <span><Users size={15} /> {peopleCount} / 20</span>
            <span><TimeIcon size={15} /> {timeLabel}</span>
            <span title={weatherLocal ? "현재 위치의 날씨" : "위치 권한이 없으면 차경의 날씨를 보여줘요"}>{weather === "rain" ? <CloudRain size={15} /> : weather === "snow" ? <Snowflake size={15} /> : <Sun size={15} />} {weather === "rain" ? "정원에 비" : weather === "snow" ? "정원에 눈" : weatherLocal ? "맑은 정원" : "차경의 날씨"}</span>
            <span className={`connection-dot connection-${teaRoom.connection}`}>{teaRoom.connection === "online" ? "함께 머무는 중" : "다시 연결하는 중"}</span>
          </div>
          <button className={`sound-toggle ${ambient.enabled ? "active" : ""}`} onClick={ambient.toggle} aria-pressed={ambient.enabled} aria-label={ambient.enabled ? "고요한 배경음 끄기" : "고요한 배경음 켜기"}>
            {ambient.enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}<span>{ambient.enabled ? "소리 켬" : "소리 끔"}</span>
          </button>
          <button className={`sound-toggle ${chime.enabled ? "active" : ""}`} onClick={chime.toggle} aria-pressed={chime.enabled} aria-label={chime.enabled ? "풍경 소리 끄기" : "풍경 소리 켜기"}>
            <BellRing size={16} /><span>{chime.enabled ? "풍경 켬" : "풍경 끔"}</span>
          </button>
        </div>
      </header>

      <button className="identity-card" onClick={() => { setNameDraft(identity.displayName); setNamePanelOpen((open) => !open); }} aria-expanded={namePanelOpen}>
        <RabbitIcon size={17} />
        <div><small>오늘의 토끼 · 이름 바꾸기</small><strong>{identity.displayName}</strong></div>
      </button>
      {namePanelOpen && <form className="name-panel" onSubmit={saveName}>
        <label htmlFor="rabbit-name">오늘 머무를 이름</label>
        <div><input id="rabbit-name" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} maxLength={10} autoFocus /><button type="submit">정하기</button></div>
        <small>그대로 두면 차경이 지어 준 이름을 써요.</small>
      </form>}
      <div id="local-rabbit-name" className="rabbit-name is-local screen-rabbit-name"><span>잎</span>{identity.displayName}</div>

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
        <button onClick={teaRoom.greet}><Sparkles size={19} /><span>인사하기</span></button>
        <button className={teaRoom.local.seatId ? "active" : ""} onClick={() => teaRoom.local.seatId ? requestSeatByKind(currentSeat?.kind ?? "solo") : setSeatPanelOpen((open) => !open)} disabled={!teaRoom.local.seatId && teaRoom.connection !== "online"}><Armchair size={19} /><span>{teaRoom.local.seatId ? "일어나기" : "자리에 앉기"}</span></button>
        <button className={teaPanelOpen || teaRoom.local.state === "brewing" || teaRoom.local.state === "requesting" ? "active" : ""} onClick={() => {
          if (isSharedGuest) socialAction("requesting");
          else if (teaRoom.local.ritual === "complete") setTeaPanelOpen(true);
          else if (!teaRoom.local.tea || !teaRoom.local.teaware) setTeaPanelOpen(true);
          else void startBrewing();
        }} disabled={!teaRoom.local.seatId || (!isSharedGuest && ["preparing", "brewing", "serving", "sipping"].includes(teaRoom.local.ritual))}><Coffee size={19} /><span>{isSharedGuest ? "차 요청하기" : ["preparing", "brewing"].includes(teaRoom.local.ritual) ? "우리는 중" : teaRoom.local.ritual === "complete" ? "한 잔 더" : "차 우리기"}</span></button>
        <button className={teaRoom.local.state === "drinking" ? "active" : ""} onClick={isSharedGuest ? drinkSharedTea : drinkTea} disabled={isSharedGuest ? !sharedPourReady : teaRoom.local.ritual !== "serving" || !pourReady}><CupSoda size={19} /><span>차 마시기</span></button>
      </nav>

      {!teaRoom.local.seatId && seatPanelOpen && (
        <aside className="seat-choice" aria-label="자리 선택">
          <p className="eyebrow">어디에 머물까요</p>
          <div><button onClick={() => requestSeatByKind("solo")}><strong>혼자 앉기</strong><small>비어 있는 팔각상</small></button><button onClick={() => requestSeatByKind("shared")}><strong>합석하기</strong><small>함께 쓰는 팔각상</small></button></div>
        </aside>
      )}

      {currentSeat?.kind === "shared" && (
        <aside className="shared-actions" aria-label="합석 행동">
          <span>{tablemates.length ? `${tablemates.length + 1}마리가 함께 머무는 중` : "누군가 오기를 기다리는 중"}</span>
          <button onClick={() => socialAction("requesting")} disabled={!tablemates.length || teaRoom.local.state === "brewing"}>차 요청하기</button>
          <button onClick={() => socialAction("pouring")} disabled={!requestedTea || teaRoom.local.state === "brewing"}>차 따라주기</button>
        </aside>
      )}

      {teaRoom.local.seatId && teaPanelOpen && (
        <aside className="tea-panel" aria-label="차와 다구 선택">
          <div className="panel-heading"><div><p className="eyebrow">오늘의 찻상</p><h2>{teaRoom.local.ritual === "complete" ? "다음 차를 골라 주세요" : "차와 다구를 골라 주세요"}</h2></div><button className="panel-close" onClick={() => setTeaPanelOpen(false)} aria-label="차 선택 닫기">×</button></div>
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
