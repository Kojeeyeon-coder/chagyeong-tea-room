"use client";

import { OrbitControls, Sparkles } from "@react-three/drei";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { LocalPresence, PresenceSnapshot, RabbitIdentity, RoomSnapshot } from "@/lib/chagyeong-types";
import type { TimeOfDay } from "@/lib/time-of-day";
import { LIGHTING } from "@/lib/time-of-day";
import { findPath, SEAT_POSITIONS, TABLE_POSITIONS } from "@/lib/navigation";
import { Rabbit } from "./rabbit";
import { TeaService } from "./teaware";

type SceneProps = {
  identity: RabbitIdentity;
  local: LocalPresence;
  room: RoomSnapshot;
  timeOfDay: TimeOfDay;
  onMove: (patch: Partial<LocalPresence>) => void;
  onClaimSeat: (seatId: string) => Promise<{ ok: boolean; message: string }>;
  onNotice: (message: string) => void;
};

const CAMERA_SETTINGS = { position: [10, 11, 14] as [number, number, number], fov: 42, near: 0.1, far: 80 };
const PERFORMANCE_SETTINGS = { min: 0.55 };
const GL_SETTINGS = { antialias: true, powerPreference: "high-performance" as const };

function Lighting({ mode }: { mode: TimeOfDay }) {
  const { scene } = useThree();
  const setting = LIGHTING[mode];
  useEffect(() => {
    scene.background = new THREE.Color(setting.background);
    scene.fog = new THREE.Fog(setting.fog, 18, 38);
  }, [scene, setting]);
  return (
    <>
      <ambientLight intensity={setting.ambient} />
      <directionalLight castShadow position={[-7, 14, 8]} intensity={setting.sun} color={setting.sunColor} shadow-mapSize={[1024, 1024]} />
      {mode === "night" && <pointLight position={[0, 3.2, 1]} intensity={22} distance={13} color="#f1a867" />}
    </>
  );
}

function CameraRig({ target }: { target: React.RefObject<THREE.Group | null> }) {
  const controls = useRef<any>(null);
  useFrame((_, delta) => {
    if (!controls.current || !target.current) return;
    const desired = target.current.position.clone();
    desired.y = 0.75;
    controls.current.target.lerp(desired, 1 - Math.exp(-delta * 5));
    controls.current.update();
  });
  return <OrbitControls ref={controls} makeDefault enablePan={false} minDistance={7} maxDistance={18} minPolarAngle={0.55} maxPolarAngle={1.18} rotateSpeed={0.55} zoomSpeed={0.7} />;
}

function Player({ identity, local, pathRef, positionRef, groupRef, queuedSeatRef, onMove, onArriveSeat }: {
  identity: RabbitIdentity;
  local: LocalPresence;
  pathRef: React.MutableRefObject<Array<{ x: number; z: number }>>;
  positionRef: React.MutableRefObject<{ x: number; z: number }>;
  groupRef: React.RefObject<THREE.Group | null>;
  queuedSeatRef: React.MutableRefObject<string | null>;
  onMove: (patch: Partial<LocalPresence>) => void;
  onArriveSeat: (seatId: string) => void;
}) {
  const [renderPosition, setRenderPosition] = useState(local.position);
  const [rotation, setRotation] = useState(local.rotation);
  const lastPublish = useRef(0);
  const claiming = useRef(false);

  useEffect(() => {
    if (!local.seatId) return;
    const seat = SEAT_POSITIONS.find((item) => item.id === local.seatId);
    if (!seat) return;
    pathRef.current = [];
    queuedSeatRef.current = null;
    positionRef.current = { x: seat.x, z: seat.z };
    setRenderPosition(positionRef.current);
    setRotation(seat.rotation);
    onMove({ position: positionRef.current, rotation: seat.rotation });
  }, [local.seatId, onMove, pathRef, positionRef, queuedSeatRef]);

  useFrame((_, delta) => {
    if (local.seatId || !pathRef.current.length) return;
    const next = pathRef.current[0];
    const current = positionRef.current;
    const dx = next.x - current.x, dz = next.z - current.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.08) {
      pathRef.current.shift();
      if (!pathRef.current.length && queuedSeatRef.current && !claiming.current) {
        claiming.current = true;
        const seat = queuedSeatRef.current;
        queuedSeatRef.current = null;
        onArriveSeat(seat);
        window.setTimeout(() => { claiming.current = false; }, 900);
      }
      return;
    }
    const step = Math.min(distance, delta * 2.8);
    current.x += dx / distance * step;
    current.z += dz / distance * step;
    const nextRotation = Math.atan2(dx, dz);
    positionRef.current = current;
    setRenderPosition({ ...current });
    setRotation(nextRotation);
    const now = performance.now();
    if (now - lastPublish.current > 220) {
      lastPublish.current = now;
      onMove({ position: { ...current }, rotation: nextRotation, state: "walking" });
    }
  });

  return <Rabbit groupRef={groupRef} local variant={identity.variant} name={identity.displayName} state={local.state} position={renderPosition} rotation={rotation} />;
}

function LowTable({ position }: { position: { x: number; z: number } }) {
  return (
    <group position={[position.x, 0, position.z]}>
      <mesh castShadow receiveShadow position={[0, 0.48, 0]}><boxGeometry args={[2.15, 0.16, 1.25]} /><meshStandardMaterial color="#aa8564" roughness={0.88} /></mesh>
      {[[-0.82, 0.22, -0.38], [0.82, 0.22, -0.38], [-0.82, 0.22, 0.38], [0.82, 0.22, 0.38]].map((p, index) => (
        <mesh key={index} castShadow position={p as [number, number, number]}><boxGeometry args={[0.13, 0.45, 0.13]} /><meshStandardMaterial color="#8b6b52" /></mesh>
      ))}
    </group>
  );
}

function TeaRoom({ mode }: { mode: TimeOfDay }) {
  const candlePositions = [[-8.2, -5.1], [8.2, -5.1], [-8.2, 6.1], [8.2, 6.1]];
  return (
    <group>
      <mesh receiveShadow position={[0, -0.08, 0]}><boxGeometry args={[19, 0.18, 13]} /><meshStandardMaterial color="#ede8dc" roughness={0.96} /></mesh>
      <mesh receiveShadow position={[0, -0.06, 10]}><boxGeometry args={[19, 0.14, 7]} /><meshStandardMaterial color="#cbd5c1" roughness={1} /></mesh>
      <mesh castShadow receiveShadow position={[0, 1.8, -6.4]}><boxGeometry args={[19, 3.8, 0.22]} /><meshStandardMaterial color="#f2eee4" /></mesh>
      <mesh castShadow receiveShadow position={[-9.4, 1.8, 0]}><boxGeometry args={[0.22, 3.8, 13]} /><meshStandardMaterial color="#f2eee4" /></mesh>
      <mesh castShadow receiveShadow position={[9.4, 1.8, 0]}><boxGeometry args={[0.22, 3.8, 13]} /><meshStandardMaterial color="#f2eee4" /></mesh>
      <mesh position={[0, 2, -6.55]}><boxGeometry args={[6, 2.15, 0.12]} /><meshStandardMaterial color="#d7dfd3" /></mesh>
      {TABLE_POSITIONS.map((position, index) => <LowTable key={index} position={position} />)}
      <mesh receiveShadow position={[4.8, 0.02, 10.4]}><cylinderGeometry args={[3.1, 3.5, 0.12, 24]} /><meshStandardMaterial color="#75918a" roughness={0.4} /></mesh>
      {[[-6.8, 8.3], [-4.5, 10.8], [-1.8, 8.9], [0, 11.7]].map(([x, z], index) => (
        <mesh key={index} castShadow position={[x, 0.12, z]} scale={[1.2, 0.32, 0.85]}><dodecahedronGeometry args={[0.72, 0]} /><meshStandardMaterial color="#aaa99f" roughness={1} /></mesh>
      ))}
      {[[-7.8, 9.8], [-7, 12], [8.2, 8.1]].map(([x, z], index) => (
        <group key={index} position={[x, 0, z]}>
          {[0, 0.22, 0.44].map((offset) => <mesh key={offset} castShadow position={[offset, 1.35 + offset, 0]}><cylinderGeometry args={[0.07, 0.1, 2.7, 8]} /><meshStandardMaterial color="#6f8e6c" /></mesh>)}
        </group>
      ))}
      {candlePositions.map(([x, z], index) => (
        <group key={index} position={[x, 0.3, z]}>
          <mesh castShadow><cylinderGeometry args={[0.08, 0.1, 0.5, 10]} /><meshStandardMaterial color="#eee4cf" /></mesh>
          {mode === "night" && <><mesh position={[0, 0.34, 0]}><sphereGeometry args={[0.07, 8, 8]} /><meshBasicMaterial color="#ffc06a" /></mesh><pointLight position={[0, 0.38, 0]} intensity={3.8} distance={3.4} color="#ffb261" /></>}
        </group>
      ))}
      {mode === "night" && <Sparkles count={28} scale={[18, 5, 18]} size={1.4} speed={0.12} color="#e8cf9b" />}
    </group>
  );
}

function Seat({ seat, occupied, onClick }: { seat: (typeof SEAT_POSITIONS)[number]; occupied: boolean; onClick: () => void }) {
  return (
    <group position={[seat.x, 0, seat.z]} rotation={[0, seat.rotation, 0]}>
      <mesh castShadow position={[0, 0.12, 0]} onClick={(event) => { event.stopPropagation(); onClick(); }}>
        <cylinderGeometry args={[0.58, 0.62, 0.2, 20]} />
        <meshStandardMaterial color={occupied ? "#a79c8b" : "#b8c9ad"} roughness={0.95} emissive={occupied ? "#000000" : "#52664b"} emissiveIntensity={occupied ? 0 : 0.08} />
      </mesh>
      {!occupied && <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.68, 0.75, 24]} /><meshBasicMaterial color="#f3d6a0" transparent opacity={0.72} /></mesh>}
    </group>
  );
}

function RemoteTeaServices({ people }: { people: PresenceSnapshot[] }) {
  const services = useMemo(() => people.filter((person) => person.seatId && person.teaware), [people]);
  return <>{services.map((person) => {
    const seat = SEAT_POSITIONS.find((candidate) => candidate.id === person.seatId);
    if (!seat || !person.teaware) return null;
    const table = TABLE_POSITIONS[seat.table];
    return <group key={person.sessionId} position={[table.x + (seat.id.endsWith("1") ? -0.35 : 0.35), 0.58, table.z]}><TeaService kind={person.teaware} ritual={person.ritual} /></group>;
  })}</>;
}

function World(props: SceneProps) {
  const pathRef = useRef<Array<{ x: number; z: number }>>([]);
  const queuedSeatRef = useRef<string | null>(null);
  const localPositionRef = useRef({ ...props.local.position });
  const playerRef = useRef<THREE.Group>(null);

  const requestSeat = (seatId: string) => {
    const seat = SEAT_POSITIONS.find((candidate) => candidate.id === seatId);
    if (!seat || props.room.occupiedSeats[seatId]) {
      props.onNotice("이미 다른 토끼가 머무는 자리예요");
      return;
    }
    if (props.local.seatId) {
      props.onNotice("먼저 지금 자리에서 일어나 주세요");
      return;
    }
    const distance = Math.hypot(localPositionRef.current.x - seat.x, localPositionRef.current.z - seat.z);
    if (distance < 0.7) {
      void props.onClaimSeat(seatId).then((result) => props.onNotice(result.message));
      return;
    }
    queuedSeatRef.current = seatId;
    pathRef.current = findPath(localPositionRef.current, { x: seat.x, z: seat.z });
    props.onNotice("빈 자리로 천천히 가는 중이에요");
  };

  const handleFloor = (event: ThreeEvent<PointerEvent>) => {
    if (event.delta > 7 || props.local.seatId) return;
    event.stopPropagation();
    queuedSeatRef.current = null;
    const target = { x: event.point.x, z: event.point.z };
    const path = findPath(localPositionRef.current, target);
    if (!path.length) props.onNotice("그곳으로는 걸어갈 수 없어요");
    else pathRef.current = path;
  };

  return (
    <>
      <Lighting mode={props.timeOfDay} />
      <TeaRoom mode={props.timeOfDay} />
      <mesh position={[0, 0.01, 3.5]} rotation={[-Math.PI / 2, 0, 0]} onPointerUp={handleFloor}>
        <planeGeometry args={[19, 20]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {SEAT_POSITIONS.map((seat) => <Seat key={seat.id} seat={seat} occupied={Boolean(props.room.occupiedSeats[seat.id])} onClick={() => requestSeat(seat.id)} />)}
      <Player identity={props.identity} local={props.local} pathRef={pathRef} positionRef={localPositionRef} groupRef={playerRef} queuedSeatRef={queuedSeatRef} onMove={props.onMove} onArriveSeat={(seatId) => void props.onClaimSeat(seatId).then((result) => props.onNotice(result.message))} />
      {props.room.people.filter((person) => person.sessionId !== props.identity.sessionId).map((person) => (
        <Rabbit key={person.sessionId} variant={person.variant} name={person.displayName} state={person.state} position={person.position} rotation={person.rotation} />
      ))}
      <RemoteTeaServices people={props.room.people} />
      <CameraRig target={playerRef} />
    </>
  );
}

export function TeaRoomScene(props: SceneProps) {
  return (
    <Canvas shadows dpr={[0.85, 1.5]} camera={CAMERA_SETTINGS} performance={PERFORMANCE_SETTINGS} gl={GL_SETTINGS}>
      <World {...props} />
    </Canvas>
  );
}
