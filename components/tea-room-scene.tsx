"use client";

import { OrbitControls, Sparkles } from "@react-three/drei";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { LocalPresence, PresenceSnapshot, RabbitIdentity, RoomSnapshot } from "@/lib/chagyeong-types";
import type { TimeOfDay } from "@/lib/time-of-day";
import { LIGHTING } from "@/lib/time-of-day";
import { findPath, SEAT_POSITIONS, TABLE_POSITIONS } from "@/lib/navigation";
import { TEAS } from "@/lib/catalog";
import { Rabbit } from "./rabbit";
import { TeaService } from "./teaware";

type SceneProps = {
  identity: RabbitIdentity;
  local: LocalPresence;
  room: RoomSnapshot;
  timeOfDay: TimeOfDay;
  seatRequest: { seatId: string; nonce: number } | null;
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

function CameraRig({ target, focus, moving, seatId }: { target: React.RefObject<THREE.Group | null>; focus: boolean; moving: boolean; seatId: string | null }) {
  const controls = useRef<any>(null);
  const aligned = useRef(false);
  const activeSeat = seatId ? SEAT_POSITIONS.find((seat) => seat.id === seatId) : null;
  const soloFocus = activeSeat?.kind === "solo" && focus;
  useFrame(({ camera }, delta) => {
    if (!controls.current || !target.current) return;
    const desired = target.current.position.clone();
    desired.y = focus ? 1 : 0.75;
    controls.current.target.lerp(desired, 1 - Math.exp(-delta * 5));
    if (!aligned.current || focus || moving) {
      const distance = focus ? 4.9 : 6.2;
      const forward = new THREE.Vector3(Math.sin(target.current.rotation.y), 0, Math.cos(target.current.rotation.y));
      const cameraTarget = soloFocus
        ? desired.clone().add(forward.multiplyScalar(1.4))
        : desired.clone().add(forward.multiplyScalar(focus ? distance : -distance));
      cameraTarget.y += soloFocus ? 1.65 : focus ? 2.55 : 5.15;
      camera.position.lerp(cameraTarget, 1 - Math.exp(-delta * (focus ? 3.2 : 2.2)));
      aligned.current = true;
    }
    controls.current.update();
  });
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} enablePan={false} minDistance={soloFocus ? 1.8 : focus ? 4 : 6} maxDistance={18} minPolarAngle={0.45} maxPolarAngle={1.2} rotateSpeed={0.55} zoomSpeed={0.7} />;
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

  const teaColor = TEAS.find((tea) => tea.id === local.tea)?.color;
  return <Rabbit groupRef={groupRef} local variant={identity.variant} name={identity.displayName} state={local.state} ritual={local.ritual} teaware={local.teaware} teaColor={teaColor} position={renderPosition} rotation={rotation} />;
}

function LowTable({ position }: { position: (typeof TABLE_POSITIONS)[number] }) {
  if (position.kind === "solo") return (
    <group position={[position.x, 0, position.z]}>
      <mesh castShadow receiveShadow position={[0, 0.62, 0]}><boxGeometry args={[0.9, 0.13, 1.35]} /><meshStandardMaterial color="#9e7658" roughness={0.86} /></mesh>
      <mesh castShadow position={[0, 0.3, 0]}><boxGeometry args={[0.14, 0.6, 0.88]} /><meshStandardMaterial color="#7e5d46" /></mesh>
    </group>
  );
  return (
    <group position={[position.x, 0, position.z]}>
      <mesh castShadow receiveShadow position={[0, 0.48, 0]}><boxGeometry args={[2.85, 0.16, 1.65]} /><meshStandardMaterial color="#aa8564" roughness={0.88} /></mesh>
      {[[-1.12, 0.22, -0.55], [1.12, 0.22, -0.55], [-1.12, 0.22, 0.55], [1.12, 0.22, 0.55]].map((p, index) => (
        <mesh key={index} castShadow position={p as [number, number, number]}><boxGeometry args={[0.13, 0.45, 0.13]} /><meshStandardMaterial color="#8b6b52" /></mesh>
      ))}
    </group>
  );
}

function ShojiPanel({ x }: { x: number }) {
  return (
    <group position={[x, 1.95, -6.27]}>
      <mesh><boxGeometry args={[2.5, 2.75, 0.08]} /><meshStandardMaterial color="#e8e5d9" emissive="#d8ddd2" emissiveIntensity={0.08} /></mesh>
      {[-1.25, 0, 1.25].map((offset) => <mesh key={`v-${offset}`} position={[offset, 0, 0.06]}><boxGeometry args={[0.08, 2.9, 0.08]} /><meshStandardMaterial color="#8f745b" /></mesh>)}
      {[-1.35, -0.45, 0.45, 1.35].map((offset) => <mesh key={`h-${offset}`} position={[0, offset, 0.06]}><boxGeometry args={[2.58, 0.06, 0.08]} /><meshStandardMaterial color="#9a7d61" /></mesh>)}
    </group>
  );
}

function Hearth() {
  const steam = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!steam.current) return;
    const t = clock.elapsedTime;
    steam.current.position.y = 1.68 + (t * 0.18) % 0.42;
    steam.current.rotation.y = Math.sin(t * 1.4) * 0.28;
    steam.current.scale.setScalar(0.82 + ((t * 0.18) % 0.42) * 0.35);
  });
  return (
    <group position={[0, 0, -5.15]}>
      <mesh castShadow position={[0, 0.28, 0]}><cylinderGeometry args={[0.52, 0.62, 0.48, 12]} /><meshStandardMaterial color="#51453c" roughness={0.95} /></mesh>
      <mesh position={[0, 0.52, 0]}><cylinderGeometry args={[0.38, 0.42, 0.08, 12]} /><meshStandardMaterial color="#b65f38" emissive="#d96b3d" emissiveIntensity={0.75} /></mesh>
      <mesh castShadow position={[0, 0.9, 0]} scale={[1.08, 0.85, 1]}><sphereGeometry args={[0.42, 14, 10]} /><meshStandardMaterial color="#303735" roughness={0.7} /></mesh>
      <mesh castShadow position={[0, 1.22, 0]}><cylinderGeometry args={[0.18, 0.24, 0.12, 12]} /><meshStandardMaterial color="#353b38" /></mesh>
      <mesh castShadow position={[0.42, 0.93, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.12, 0.5, 10]} /><meshStandardMaterial color="#353b38" /></mesh>
      <mesh position={[0, 1.05, -0.05]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.48, 0.035, 8, 18, Math.PI]} /><meshStandardMaterial color="#493c34" /></mesh>
      <group ref={steam} position={[0, 1.68, 0]}>
        {[[0, 0, 0], [0.08, 0.22, 0], [-0.04, 0.44, 0]].map((p, index) => <mesh key={index} position={p as [number, number, number]} scale={1 - index * 0.16}><sphereGeometry args={[0.1, 8, 6]} /><meshBasicMaterial color="#f3eee3" transparent opacity={0.2} /></mesh>)}
      </group>
      <pointLight position={[0, 0.75, 0]} intensity={2.4} distance={3.2} color="#e88a50" />
    </group>
  );
}

function RoomDecor() {
  return (
    <group>
      {TABLE_POSITIONS.filter((table) => table.kind === "shared").map((table, index) => <mesh key={`mat-${index}`} receiveShadow position={[table.x, 0.025, table.z]}><boxGeometry args={[4.15, 0.05, 2.85]} /><meshStandardMaterial color={index % 2 ? "#d8d4bc" : "#ded8c5"} roughness={1} /></mesh>)}
      {[-7.7, -5.1, -2.5, 0.1, 2.7, 5.3, 7.9].map((x) => <mesh key={`beam-${x}`} castShadow position={[x, 3.55, -6.08]}><boxGeometry args={[0.13, 0.28, 0.34]} /><meshStandardMaterial color="#8d6c50" /></mesh>)}
      <mesh castShadow position={[0, 3.55, -6.08]}><boxGeometry args={[18.6, 0.18, 0.34]} /><meshStandardMaterial color="#8d6c50" /></mesh>
      {[-5.2, -2.6, 0, 2.6, 5.2].map((x) => <ShojiPanel key={x} x={x} />)}
      <group position={[-7.45, 1.82, -6.1]}>
        <mesh><boxGeometry args={[1.55, 2.45, 0.08]} /><meshStandardMaterial color="#d9d2bf" /></mesh>
        <mesh position={[0, 0.15, 0.06]}><boxGeometry args={[0.84, 1.5, 0.025]} /><meshStandardMaterial color="#f3efe4" /></mesh>
        <mesh position={[0, 0.18, 0.08]} rotation={[0, 0, -0.28]}><boxGeometry args={[0.035, 0.78, 0.02]} /><meshStandardMaterial color="#536652" /></mesh>
        <mesh position={[0.19, 0.02, 0.09]} rotation={[0, 0, 0.65]}><boxGeometry args={[0.025, 0.42, 0.02]} /><meshStandardMaterial color="#6f8068" /></mesh>
      </group>
      <group position={[6.8, 0.72, -5.95]}>
        {[0, 0.82, 1.64].map((y) => <mesh key={y} castShadow position={[0, y, 0]}><boxGeometry args={[3.25, 0.1, 0.42]} /><meshStandardMaterial color="#8e6d52" /></mesh>)}
        {[-1.45, 1.45].map((x) => <mesh key={x} castShadow position={[x, 0.82, 0]}><boxGeometry args={[0.1, 1.74, 0.42]} /><meshStandardMaterial color="#7f614a" /></mesh>)}
        {[[-0.9, 0.21], [0, 0.21], [0.92, 1.03], [-0.55, 1.03]].map(([x, y], index) => <mesh key={index} castShadow position={[x, y, -0.28]}><cylinderGeometry args={[0.14 + index * 0.015, 0.11, 0.26, 12]} /><meshStandardMaterial color={index % 2 ? "#c4b39a" : "#eee8dc"} /></mesh>)}
      </group>
      {[[-4.5, -1.6], [4.4, 1.4]].map(([x, z], index) => <group key={index} position={[x, 3.1, z]}>
        <mesh><cylinderGeometry args={[0.34, 0.5, 0.72, 10]} /><meshStandardMaterial color="#efe6cf" emissive="#efc98b" emissiveIntensity={0.18} /></mesh>
        <mesh position={[0, 0.48, 0]}><cylinderGeometry args={[0.03, 0.03, 0.55, 8]} /><meshStandardMaterial color="#6e5b48" /></mesh>
      </group>)}
      <group position={[-8.1, 0, 5.6]}>
        <mesh castShadow position={[0, 0.25, 0]}><cylinderGeometry args={[0.34, 0.25, 0.5, 12]} /><meshStandardMaterial color="#b9a58d" /></mesh>
        {[[-0.18, 0.95, 0.08], [0.16, 1.15, -0.02], [0, 0.85, -0.1]].map((p, index) => <mesh key={index} castShadow position={p as [number, number, number]} rotation={[0, 0, index ? 0.35 : -0.35]}><capsuleGeometry args={[0.08, 0.85, 4, 8]} /><meshStandardMaterial color="#71866b" /></mesh>)}
      </group>
      <Hearth />
      <group position={[1.7, 0, 9.5]}>
        <mesh castShadow position={[0, 0.55, 0]}><cylinderGeometry args={[0.42, 0.58, 0.85, 8]} /><meshStandardMaterial color="#9b998f" /></mesh>
        <mesh castShadow position={[0, 1.18, 0]}><boxGeometry args={[0.72, 0.12, 0.72]} /><meshStandardMaterial color="#aaa79d" /></mesh>
        <mesh castShadow position={[0, 1.58, 0]}><boxGeometry args={[0.32, 0.68, 0.32]} /><meshStandardMaterial color="#9b998f" /></mesh>
        <mesh castShadow position={[0, 1.95, 0]}><cylinderGeometry args={[0.34, 0.48, 0.22, 6]} /><meshStandardMaterial color="#aaa79d" /></mesh>
      </group>
      <group position={[0, 0, 13.25]}>
        <mesh castShadow receiveShadow position={[0, 0.33, 0]}><boxGeometry args={[19, 0.65, 0.24]} /><meshStandardMaterial color="#e7e3d6" roughness={0.96} /></mesh>
        <mesh castShadow position={[0, 0.74, -0.02]}><boxGeometry args={[19, 0.14, 0.3]} /><meshStandardMaterial color="#8d6c50" /></mesh>
        {[-8.4, -6, -3.6, -1.2, 1.2, 3.6, 6, 8.4].map((x) => <mesh key={`garden-post-${x}`} castShadow position={[x, 0.65, -0.06]}><boxGeometry args={[0.13, 0.82, 0.3]} /><meshStandardMaterial color="#927258" /></mesh>)}
        {[-7.2, -4.8, -2.4, 0, 2.4, 4.8, 7.2].map((x, index) => <mesh key={`garden-screen-${x}`} position={[x, 0.58, 0.02]}><boxGeometry args={[2.08, 0.34, 0.06]} /><meshStandardMaterial color={index % 2 ? "#b9c8af" : "#c8d2bd"} roughness={1} /></mesh>)}
      </group>
      {[[-7.7, 12.35], [-5.4, 12.15], [5.8, 12.2], [8, 12.45]].map(([x, z], index) => <group key={`shrub-${index}`} position={[x, 0, z]}>
        <mesh castShadow position={[0, 0.32, 0]}><cylinderGeometry args={[0.38, 0.28, 0.55, 10]} /><meshStandardMaterial color="#ad9980" /></mesh>
        <mesh castShadow position={[0, 0.92, 0]} scale={[1.15, 1, 0.85]}><dodecahedronGeometry args={[0.58, 0]} /><meshStandardMaterial color={index % 2 ? "#758b70" : "#84977b"} roughness={1} /></mesh>
      </group>)}
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
      <RoomDecor />
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

function teaServiceOffset(seatId: string, kind: "shared" | "solo") {
  if (kind === "solo") return { x: 0, z: 0 };
  const index = (Number(seatId.replace("seat-", "")) - 1) % 4;
  return [
    { x: 0, z: -0.4 },
    { x: 0.6, z: 0 },
    { x: 0, z: 0.4 },
    { x: -0.6, z: 0 },
  ][index] ?? { x: 0, z: 0 };
}

function RemoteTeaServices({ people, localSessionId }: { people: PresenceSnapshot[]; localSessionId: string }) {
  const services = useMemo(() => people.filter((person) => person.sessionId !== localSessionId && person.seatId && person.teaware), [localSessionId, people]);
  return <>{services.map((person) => {
    const seat = SEAT_POSITIONS.find((candidate) => candidate.id === person.seatId);
    if (!seat || !person.teaware) return null;
    const table = TABLE_POSITIONS[seat.table];
    const offset = teaServiceOffset(seat.id, seat.kind);
    const serviceRotation = seat.kind === "solo" ? 0 : seat.rotation;
    const teaColor = TEAS.find((tea) => tea.id === person.tea)?.color;
    return <group key={person.sessionId} position={[table.x + offset.x, 0.58, table.z + offset.z]} rotation={[0, serviceRotation, 0]}><group position={[-0.05, 0, 0]}><TeaService kind={person.teaware} ritual={person.ritual} color={teaColor} /></group></group>;
  })}</>;
}

function World(props: SceneProps) {
  const pathRef = useRef<Array<{ x: number; z: number }>>([]);
  const queuedSeatRef = useRef<string | null>(null);
  const localPositionRef = useRef({ ...props.local.position });
  const playerRef = useRef<THREE.Group>(null);
  const handledSeatRequest = useRef(0);

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

  useEffect(() => {
    if (!props.seatRequest || handledSeatRequest.current === props.seatRequest.nonce) return;
    handledSeatRequest.current = props.seatRequest.nonce;
    requestSeat(props.seatRequest.seatId);
  }, [props.seatRequest]);

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
        <Rabbit key={person.sessionId} variant={person.variant} name={person.displayName} state={person.state} ritual={person.ritual} teaware={person.teaware} teaColor={TEAS.find((tea) => tea.id === person.tea)?.color} position={person.position} rotation={person.rotation} />
      ))}
      {props.local.seatId && props.local.teaware && props.local.ritual !== "sipping" && (() => {
        const seat = SEAT_POSITIONS.find((candidate) => candidate.id === props.local.seatId);
        if (!seat) return null;
        const table = TABLE_POSITIONS[seat.table];
        const offset = teaServiceOffset(seat.id, seat.kind);
        const serviceRotation = seat.kind === "solo" ? 0 : seat.rotation;
        return <group position={[table.x + offset.x, 0.58, table.z + offset.z]} rotation={[0, serviceRotation, 0]}><group position={[-0.05, 0, 0]}><TeaService kind={props.local.teaware} ritual={props.local.ritual} color={TEAS.find((tea) => tea.id === props.local.tea)?.color} /></group></group>;
      })()}
      <RemoteTeaServices people={props.room.people} localSessionId={props.identity.sessionId} />
      <CameraRig target={playerRef} focus={Boolean(props.local.seatId)} moving={props.local.state === "walking"} seatId={props.local.seatId} />
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
