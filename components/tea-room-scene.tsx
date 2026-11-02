"use client";

import { OrbitControls, Sparkles } from "@react-three/drei";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { LocalPresence, PresenceSnapshot, RabbitIdentity, RoomSnapshot, TeawareKind } from "@/lib/chagyeong-types";
import type { TimeOfDay } from "@/lib/time-of-day";
import { LIGHTING } from "@/lib/time-of-day";
import { findPath, SEAT_POSITIONS, TABLE_POSITIONS } from "@/lib/navigation";
import { TEAS } from "@/lib/catalog";
import type { TeaRoomWeather } from "@/lib/weather";
import { Rabbit } from "./rabbit";
import { TeaService } from "./teaware";

type SceneProps = {
  identity: RabbitIdentity;
  local: LocalPresence;
  room: RoomSnapshot;
  timeOfDay: TimeOfDay;
  weather: TeaRoomWeather;
  seatRequest: { seatId: string; nonce: number } | null;
  onMove: (patch: Partial<LocalPresence>) => void;
  onClaimSeat: (seatId: string) => Promise<{ ok: boolean; message: string }>;
  onNotice: (message: string) => void;
};

const CAMERA_SETTINGS = { position: [9, 6.5, 16] as [number, number, number], fov: 50, near: 0.1, far: 90 };
const PERFORMANCE_SETTINGS = { min: 0.55 };
const GL_SETTINGS = { antialias: true, powerPreference: "high-performance" as const, preserveDrawingBuffer: true };

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

function GardenWeather({ weather }: { weather: TeaRoomWeather }) {
  const points = useRef<THREE.Points>(null);
  const count = weather === "rain" ? 110 : 64;
  const positions = useMemo(() => {
    const values = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      values[index * 3] = (Math.random() - 0.5) * 26;
      values[index * 3 + 1] = Math.random() * 6.2;
      values[index * 3 + 2] = 9.35 + Math.random() * 8.35;
    }
    return values;
  }, [count]);
  useFrame((_, delta) => {
    if (!points.current || weather === "clear") return;
    const attribute = points.current.geometry.getAttribute("position") as THREE.BufferAttribute;
    const speed = weather === "rain" ? 5.8 : 0.72;
    for (let index = 0; index < count; index += 1) {
      let y = attribute.getY(index) - delta * speed;
      if (y < 0.15) y = 5.8 + Math.random() * 0.6;
      attribute.setY(index, y);
      if (weather === "snow") attribute.setX(index, attribute.getX(index) + Math.sin(index * 1.7 + y) * delta * 0.06);
    }
    attribute.needsUpdate = true;
  });
  if (weather === "clear") return null;
  return <points ref={points} frustumCulled={false}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <pointsMaterial color={weather === "rain" ? "#b7c9cc" : "#f4f0e7"} size={weather === "rain" ? 0.055 : 0.11} transparent opacity={weather === "rain" ? 0.62 : 0.86} depthWrite={false} sizeAttenuation />
  </points>;
}

function CameraRig({ target, focus, seatId }: { target: React.RefObject<THREE.Group | null>; focus: boolean; seatId: string | null }) {
  const controls = useRef<any>(null);
  const aligned = useRef(false);
  const previousTarget = useRef(new THREE.Vector3(Number.NaN, 0, 0));
  const viewportWidth = useThree((state) => state.size.width);
  const isMobile = viewportWidth <= 760;
  const activeSeat = seatId ? SEAT_POSITIONS.find((seat) => seat.id === seatId) : null;
  const activeTable = activeSeat ? TABLE_POSITIONS[activeSeat.table] : null;
  useEffect(() => { aligned.current = false; }, [focus, seatId]);
  useFrame(({ camera }, delta) => {
    if (!controls.current || !target.current) return;
    const actuallyMoving = Number.isFinite(previousTarget.current.x) && previousTarget.current.distanceTo(target.current.position) > 0.002;
    previousTarget.current.copy(target.current.position);
    controls.current.enableRotate = !focus && !actuallyMoving;
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = THREE.MathUtils.damp(camera.fov, focus ? (isMobile ? 60 : 52) : (isMobile ? 62 : 58), 3, delta);
      camera.updateProjectionMatrix();
    }
    const desired = focus && activeSeat && activeTable
      ? new THREE.Vector3(
        activeTable.x * 0.35 + activeSeat.x * 0.65,
        0.82,
        activeTable.z * 0.35 + activeSeat.z * 0.65,
      )
      : target.current.position.clone().setY(0.72);
    controls.current.target.lerp(desired, 1 - Math.exp(-delta * 2.7));
    if (!aligned.current || actuallyMoving) {
      let cameraTarget: THREE.Vector3;
      if (focus && activeSeat && activeTable) {
        const outward = new THREE.Vector3(activeSeat.x - activeTable.x, 0, activeSeat.z - activeTable.z).normalize();
        const sideways = new THREE.Vector3(-outward.z, 0, outward.x).multiplyScalar(0.45);
        cameraTarget = new THREE.Vector3(activeTable.x, isMobile ? 3.35 : 3.05, activeTable.z).add(outward.multiplyScalar(isMobile ? -5.15 : -3.35)).add(sideways);
      } else {
        cameraTarget = desired.clone().add(new THREE.Vector3(0, isMobile ? 3.55 : 3.25, isMobile ? 12.2 : 9.8));
      }
      cameraTarget.x = THREE.MathUtils.clamp(cameraTarget.x, -10.7, 10.7);
      cameraTarget.z = THREE.MathUtils.clamp(cameraTarget.z, -5.65, 17.2);
      camera.position.lerp(cameraTarget, 1 - Math.exp(-delta * (focus ? 2.35 : 1.15)));
      aligned.current = focus ? camera.position.distanceTo(cameraTarget) < 0.035 : true;
    }
    controls.current.update();
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, 1.65, 5.15);
  });
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.055} enablePan={false} enableZoom enableRotate={!focus} minDistance={focus ? 3.6 : 5.8} maxDistance={focus ? (isMobile ? 34 : 26) : (isMobile ? 40 : 34)} minPolarAngle={1.2} maxPolarAngle={1.44} rotateSpeed={0.16} zoomSpeed={0.95} />;
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
    const step = Math.min(distance, delta * 2.5);
    current.x += dx / distance * step;
    current.z += dz / distance * step;
    const nextRotation = Math.atan2(dx, dz);
    positionRef.current = current;
    setRenderPosition({ ...current });
    setRotation(nextRotation);
    const now = performance.now();
    if (now - lastPublish.current > 1_000) {
      lastPublish.current = now;
      onMove({ position: { ...current }, rotation: nextRotation, state: "walking" });
    }
  });

  const teaColor = TEAS.find((tea) => tea.id === local.tea)?.color;
  return <Rabbit groupRef={groupRef} local variant={identity.variant} name={identity.displayName} state={local.state} ritual={local.ritual} teaware={local.teaware} teaColor={teaColor} position={renderPosition} rotation={rotation} />;
}

function LocalNameTag({ target }: { target: React.RefObject<THREE.Group | null> }) {
  useFrame(({ camera }) => {
    if (!target.current) return;
    const marker = document.getElementById("local-rabbit-name");
    if (!marker) return;
    const point = target.current.position.clone().add(new THREE.Vector3(0, 2.38, 0)).project(camera);
    marker.style.left = `${(point.x * 0.5 + 0.5) * 100}%`;
    marker.style.top = `${(-point.y * 0.5 + 0.5) * 100}%`;
    marker.style.opacity = point.z > -1 && point.z < 1 ? "1" : "0";
  });
  return null;
}

function TableFlower({ solo = false }: { solo?: boolean }) {
  return <group position={[0, solo ? 0.76 : 0.68, solo ? -0.36 : 0]} scale={solo ? 0.7 : 0.78}>
    <mesh castShadow scale={[1, 0.9, 1]}><sphereGeometry args={[0.16, 12, 9]} /><meshStandardMaterial color="#f1eee4" roughness={0.88} /></mesh>
    <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.075, 0.1, 0.1, 12]} /><meshStandardMaterial color="#ebe7dc" /></mesh>
    {[[-0.055, 0.32, -0.08], [0.045, 0.38, 0.06], [0.01, 0.29, 0.12]].map(([x, y, turn], index) => <group key={index} position={[x, y, 0]} rotation={[0, 0, turn]}>
      <mesh><cylinderGeometry args={[0.009, 0.012, y * 1.25, 5]} /><meshStandardMaterial color="#6e7d59" /></mesh>
      {[[-0.035, 0.09], [0.025, 0.16]].map(([fx, fy], flower) => <mesh key={flower} position={[fx, fy, 0]}><dodecahedronGeometry args={[0.035, 0]} /><meshStandardMaterial color="#e2b65e" emissive="#bc8535" emissiveIntensity={0.08} /></mesh>)}
    </group>)}
  </group>;
}

function LowTable({ position }: { position: (typeof TABLE_POSITIONS)[number] }) {
  if (position.kind === "solo") return (
    <group position={[position.x, 0, position.z]}>
      <mesh castShadow receiveShadow position={[0, 0.62, 0]}><boxGeometry args={[1.08, 0.13, 1.42]} /><meshStandardMaterial color="#8f6243" roughness={0.86} /></mesh>
      <mesh castShadow position={[0, 0.3, 0]}><boxGeometry args={[0.14, 0.6, 0.88]} /><meshStandardMaterial color="#674532" /></mesh>
      <TableFlower solo />
    </group>
  );
  return (
    <group position={[position.x, 0, position.z]}>
      <mesh castShadow receiveShadow position={[0, 0.5, 0]}><cylinderGeometry args={[1.42, 1.5, 0.17, 8]} /><meshStandardMaterial color="#8e6040" roughness={0.88} /></mesh>
      {[[-0.82, 0.23, -0.82], [0.82, 0.23, -0.82], [-0.82, 0.23, 0.82], [0.82, 0.23, 0.82]].map((p, index) => (
        <mesh key={index} castShadow position={p as [number, number, number]}><boxGeometry args={[0.14, 0.46, 0.14]} /><meshStandardMaterial color="#654632" /></mesh>
      ))}
      <TableFlower />
    </group>
  );
}

function ShojiPanel({ x, display = false }: { x: number; display?: boolean }) {
  const displaySets = [
    [[-0.78, -0.92, "jar"], [0.35, -0.88, "cups"], [0.8, 0.06, "vase"], [-0.35, 0.78, "gaiwan"]],
    [[-0.75, -0.76, "yixing"], [0.18, -0.02, "jar"], [0.76, 0.78, "cups"], [-0.63, 0.86, "vase"]],
    [[-0.82, -0.9, "cups"], [0.12, -0.8, "gaiwan"], [0.72, 0.12, "jar"], [-0.48, 0.8, "yixing"]],
  ] as const;
  const wares = displaySets[Math.abs(Math.round(x / 2.6)) % displaySets.length];
  return (
    <group position={[x, 1.95, -7.17]}>
      <mesh><boxGeometry args={[2.5, 2.75, 0.08]} /><meshStandardMaterial color={display ? "#e4dfd2" : "#edf0e8"} transparent opacity={display ? 0.8 : 0.58} emissive="#d8e4df" emissiveIntensity={0.08} /></mesh>
      {[-1.25, 0, 1.25].map((offset) => <mesh key={`v-${offset}`} position={[offset, 0, 0.06]}><boxGeometry args={[0.08, 2.9, 0.08]} /><meshStandardMaterial color="#8f745b" /></mesh>)}
      {[-1.35, -0.45, 0.45, 1.35].map((offset) => <mesh key={`h-${offset}`} position={[0, offset, 0.06]}><boxGeometry args={[2.58, 0.06, 0.08]} /><meshStandardMaterial color="#9a7d61" /></mesh>)}
      {display && wares.map(([px, py, shape], index) => <group key={`ware-${index}`} position={[px, py, 0.17]}>
        {shape === "jar" && <><mesh castShadow scale={[1.15, 0.82, 1]}><sphereGeometry args={[0.17, 12, 8]} /><meshStandardMaterial color="#eee9df" roughness={0.88} /></mesh><mesh position={[0, 0.16, 0]}><cylinderGeometry args={[0.07, 0.09, 0.1, 10]} /><meshStandardMaterial color="#e8e2d7" /></mesh></>}
        {shape === "vase" && <><mesh castShadow scale={[0.72, 1.35, 0.72]}><sphereGeometry args={[0.15, 10, 8]} /><meshStandardMaterial color="#9eae99" roughness={0.9} /></mesh><mesh position={[0, 0.22, 0]}><cylinderGeometry args={[0.05, 0.08, 0.2, 9]} /><meshStandardMaterial color="#94a48f" /></mesh></>}
        {shape === "gaiwan" && <><mesh castShadow rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.18, 0.13, 12]} /><meshStandardMaterial color="#ddd9ce" /></mesh><mesh position={[0, 0.09, 0]}><sphereGeometry args={[0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#eee9df" /></mesh></>}
        {shape === "yixing" && <><mesh castShadow scale={[1.2, 0.82, 1]}><sphereGeometry args={[0.16, 12, 8]} /><meshStandardMaterial color="#95583e" roughness={0.8} /></mesh><mesh position={[0.19, 0.02, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.055, 0.22, 9]} /><meshStandardMaterial color="#8a5039" /></mesh></>}
        {shape === "cups" && <>{[-0.1, 0.1].map((cx) => <mesh key={cx} castShadow position={[cx, 0, 0]}><cylinderGeometry args={[0.075, 0.055, 0.1, 10]} /><meshStandardMaterial color="#d8ded5" /></mesh>)}</>}
      </group>)}
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
    <group position={[0, 0, -5.55]}>
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

function HanjiLantern({ position, floor = false }: { position: [number, number, number]; floor?: boolean }) {
  return <group position={position}>
    {floor && <><mesh castShadow position={[0, 0.12, 0]}><cylinderGeometry args={[0.28, 0.34, 0.14, 8]} /><meshStandardMaterial color="#694c39" /></mesh><mesh castShadow position={[0, 1.18, 0]}><boxGeometry args={[0.08, 2.15, 0.08]} /><meshStandardMaterial color="#75543d" /></mesh><mesh position={[0.28, 2.2, 0]}><boxGeometry args={[0.62, 0.07, 0.07]} /><meshStandardMaterial color="#75543d" /></mesh></>}
    <mesh castShadow position={[floor ? 0.55 : 0, floor ? 1.82 : 0, 0]}><cylinderGeometry args={[0.3, 0.45, 0.62, 8]} /><meshStandardMaterial color="#f2ead5" transparent opacity={0.88} emissive="#f0c584" emissiveIntensity={0.22} /></mesh>
    <mesh position={[floor ? 0.55 : 0, floor ? 2.22 : 0.42, 0]}><cylinderGeometry args={[0.03, 0.03, 0.48, 8]} /><meshStandardMaterial color="#604838" /></mesh>
  </group>;
}

function LowPolyPine({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return <group position={position} scale={scale}>
    <mesh castShadow position={[0, 0.62, 0]} rotation={[0.04, 0, -0.1]}><cylinderGeometry args={[0.08, 0.13, 1.25, 7]} /><meshStandardMaterial color="#604938" roughness={1} /></mesh>
    <mesh castShadow position={[0.3, 1.05, 0]} rotation={[0, 0, -0.78]}><cylinderGeometry args={[0.055, 0.085, 0.78, 7]} /><meshStandardMaterial color="#69503d" roughness={1} /></mesh>
    <mesh castShadow position={[-0.28, 1.18, 0.04]} rotation={[0.1, 0, 0.78]}><cylinderGeometry args={[0.05, 0.075, 0.66, 7]} /><meshStandardMaterial color="#604938" roughness={1} /></mesh>
    {[[-0.62, 1.38, 0.04, 0.72], [0.55, 1.28, 0, 0.86], [0.08, 1.72, -0.02, 0.92]].map(([x, y, z, size], index) => <mesh key={index} castShadow position={[x, y, z]} scale={[size * 1.35, size * 0.42, size]}><dodecahedronGeometry args={[0.62, 0]} /><meshStandardMaterial color={index === 1 ? "#4f6650" : "#587056"} roughness={1} /></mesh>)}
  </group>;
}

function WindChime() {
  const ornament = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ornament.current) ornament.current.rotation.z = Math.sin(clock.elapsedTime * 0.7) * 0.08 + Math.sin(clock.elapsedTime * 1.9) * 0.025;
  });
  return <group position={[10.7, 4.55, 6.65]}>
    <mesh position={[0, 0.28, 0]}><cylinderGeometry args={[0.025, 0.025, 0.55, 7]} /><meshStandardMaterial color="#554236" /></mesh>
    <group ref={ornament}>
      <mesh castShadow><cylinderGeometry args={[0.24, 0.34, 0.42, 12, 1, true]} /><meshStandardMaterial color="#a87a3e" metalness={0.48} roughness={0.35} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, -0.3, 0]}><cylinderGeometry args={[0.018, 0.018, 0.48, 6]} /><meshStandardMaterial color="#6b4b2f" /></mesh>
      <mesh position={[0, -0.58, 0]} rotation={[0, 0, 0.12]} scale={[0.72, 1, 0.12]}><circleGeometry args={[0.18, 5]} /><meshStandardMaterial color="#d8c28f" side={THREE.DoubleSide} /></mesh>
    </group>
  </group>;
}

function OctagonalWindow({ side, z }: { side: -1 | 1; z: number }) {
  return <group position={[side * 13.78, 2.05, z]} rotation={[0, Math.PI / 2, 0]}>
    <mesh><circleGeometry args={[1.11, 8]} /><meshStandardMaterial color="#e9e3d4" transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} /></mesh>
    <mesh position={[0, 0, 0.04]}><torusGeometry args={[1.04, 0.085, 6, 8]} /><meshStandardMaterial color="#694932" /></mesh>
    <mesh position={[0, 0, 0.055]}><torusGeometry args={[0.87, 0.035, 5, 8]} /><meshStandardMaterial color="#987154" /></mesh>
    {[-0.42, 0, 0.42].map((offset) => <mesh key={`window-v-${offset}`} position={[offset, 0, 0.06]}><boxGeometry args={[0.04, 1.62 - Math.abs(offset) * 0.4, 0.055]} /><meshStandardMaterial color="#7f5b42" /></mesh>)}
    {[-0.42, 0, 0.42].map((offset) => <mesh key={`window-h-${offset}`} position={[0, offset, 0.06]}><boxGeometry args={[1.62 - Math.abs(offset) * 0.4, 0.04, 0.055]} /><meshStandardMaterial color="#7f5b42" /></mesh>)}
    <mesh position={[0, 0, 0.075]} rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[0.27, 0.27, 0.045]} /><meshStandardMaterial color="#a17a5c" /></mesh>
  </group>;
}

function SideLandscape({ side }: { side: -1 | 1 }) {
  return <group position={[side * 14.15, 2.05, 0.2]} rotation={[0, Math.PI / 2, 0]}>
    <mesh><planeGeometry args={[16.5, 4.8]} /><meshBasicMaterial color="#d9d6bf" side={THREE.DoubleSide} /></mesh>
    <mesh position={[0, -1.35, 0.03]}><planeGeometry args={[16.5, 2.05]} /><meshBasicMaterial color="#8fa07b" side={THREE.DoubleSide} /></mesh>
    {[-6.2, -3.5, -0.8, 2.2, 5.4].map((x, index) => <group key={x} position={[x, -0.6 + (index % 2) * 0.18, 0.08]}>
      <mesh position={[0, 0.15, 0]}><boxGeometry args={[0.12, 1.15 + (index % 3) * 0.22, 0.08]} /><meshBasicMaterial color="#5f6249" /></mesh>
      <mesh position={[0, 0.82, 0]} scale={[0.95 + (index % 2) * 0.18, 0.72, 1]}><dodecahedronGeometry args={[0.72, 0]} /><meshBasicMaterial color={index % 2 ? "#677b5c" : "#758866"} /></mesh>
    </group>)}
  </group>;
}

function SideWall({ side }: { side: -1 | 1 }) {
  const wallColor = "#e5ded1";
  return <group>
    <mesh castShadow receiveShadow position={[side * 13.82, 0.52, 0.2]}><boxGeometry args={[0.28, 1.05, 16.4]} /><meshStandardMaterial color={wallColor} roughness={0.96} /></mesh>
    <mesh castShadow receiveShadow position={[side * 13.82, 4.38, 0.2]}><boxGeometry args={[0.28, 1.95, 16.4]} /><meshStandardMaterial color={wallColor} roughness={0.96} /></mesh>
    {[[-6.02, 2.35], [-1.7, 1.35], [2.1, 1.35], [6.12, 1.78]].map(([z, width], index) => <mesh key={index} castShadow receiveShadow position={[side * 13.82, 2.1, z]}><boxGeometry args={[0.28, 2.25, width]} /><meshStandardMaterial color={wallColor} roughness={0.96} /></mesh>)}
  </group>;
}

function CeilingStructure() {
  return <group position={[0, 1.85, 0]}>
    <mesh receiveShadow position={[0, 4.02, 0.35]}><boxGeometry args={[27.8, 0.12, 16.8]} /><meshStandardMaterial color="#4b372c" roughness={0.95} side={THREE.DoubleSide} /></mesh>
    <mesh castShadow receiveShadow position={[-6.85, 4.35, 0.35]} rotation={[0, 0, -0.105]}><boxGeometry args={[13.8, 0.16, 16.8]} /><meshStandardMaterial color="#5b4434" roughness={0.92} /></mesh>
    <mesh castShadow receiveShadow position={[6.85, 4.35, 0.35]} rotation={[0, 0, 0.105]}><boxGeometry args={[13.8, 0.16, 16.8]} /><meshStandardMaterial color="#5b4434" roughness={0.92} /></mesh>
    <mesh castShadow position={[0, 4.98, 0.35]}><boxGeometry args={[0.3, 0.34, 17]} /><meshStandardMaterial color="#3f3027" /></mesh>
    {[-6.4, -4.2, -2, 0.2, 2.4, 4.6, 6.8].map((z) => <group key={z} position={[0, 4.43, z]}>
      <mesh castShadow position={[-6.8, 0, 0]} rotation={[0, 0, -0.105]}><boxGeometry args={[13.8, 0.13, 0.16]} /><meshStandardMaterial color="#3f3027" /></mesh>
      <mesh castShadow position={[6.8, 0, 0]} rotation={[0, 0, 0.105]}><boxGeometry args={[13.8, 0.13, 0.16]} /><meshStandardMaterial color="#3f3027" /></mesh>
    </group>)}
    {[-12, -8, -4, 0, 4, 8, 12].map((x) => <mesh key={x} castShadow position={[x, 3.92, 0.35]}><boxGeometry args={[0.16, 0.22, 16.7]} /><meshStandardMaterial color="#654b39" /></mesh>)}
  </group>;
}

function RoomDecor() {
  return (
    <group>
      {TABLE_POSITIONS.filter((table) => table.kind === "shared").map((table, index) => <mesh key={`mat-${index}`} receiveShadow position={[table.x, 0.025, table.z]}><boxGeometry args={[4.15, 0.05, 2.85]} /><meshStandardMaterial color={index % 2 ? "#d8d4bc" : "#ded8c5"} roughness={1} /></mesh>)}
      {[-12, -9, -6, -3, 0, 3, 6, 9, 12].map((x) => <mesh key={`beam-${x}`} castShadow position={[x, 5.35, -6.92]}><boxGeometry args={[0.13, 0.28, 0.34]} /><meshStandardMaterial color="#8d6c50" /></mesh>)}
      <mesh castShadow position={[0, 5.35, -6.92]}><boxGeometry args={[27.6, 0.18, 0.34]} /><meshStandardMaterial color="#8d6c50" /></mesh>
      {[-12, -8, -4, 0, 4, 8, 12].map((x) => <mesh key={`rear-post-${x}`} castShadow position={[x, 2.8, -6.86]}><boxGeometry args={[0.28, 5.6, 0.34]} /><meshStandardMaterial color="#5b3f2e" roughness={0.92} /></mesh>)}
      {([-1, 1] as const).flatMap((side) => [-5.7, -1.8, 2.1, 6].map((z) => <mesh key={`side-post-${side}-${z}`} castShadow position={[side * 13.52, 2.85, z]}><boxGeometry args={[0.32, 5.7, 0.34]} /><meshStandardMaterial color="#5b3f2e" roughness={0.92} /></mesh>))}
      {[-10.4, -7.8, -5.2, -2.6, 0, 2.6, 5.2, 7.8, 10.4].map((x) => <ShojiPanel key={x} x={x} display={[-10.4, -5.2, 5.2, 10.4].includes(x)} />)}
      <group position={[-7.45, 1.82, -6.1]}>
        <mesh><boxGeometry args={[1.55, 2.45, 0.08]} /><meshStandardMaterial color="#d9d2bf" /></mesh>
        <mesh position={[0, 0.15, 0.06]}><boxGeometry args={[0.84, 1.5, 0.025]} /><meshStandardMaterial color="#f3efe4" /></mesh>
        <mesh position={[0, 0.18, 0.08]} rotation={[0, 0, -0.28]}><boxGeometry args={[0.035, 0.78, 0.02]} /><meshStandardMaterial color="#536652" /></mesh>
        <mesh position={[0.19, 0.02, 0.09]} rotation={[0, 0, 0.65]}><boxGeometry args={[0.025, 0.42, 0.02]} /><meshStandardMaterial color="#6f8068" /></mesh>
      </group>
      <HanjiLantern position={[-5, 3.1, -0.5]} />
      <HanjiLantern position={[5, 3.1, -0.5]} />
      <HanjiLantern position={[-12.5, 0, -5.7]} floor />
      <HanjiLantern position={[12, 0, -5.7]} floor />
      <group position={[-8.1, 0, 5.6]}><mesh castShadow position={[0, 0.25, 0]}><cylinderGeometry args={[0.34, 0.25, 0.5, 12]} /><meshStandardMaterial color="#b9a58d" /></mesh><LowPolyPine position={[0, 0.42, 0]} scale={0.7} /></group>
      <Hearth />
      <group position={[1.7, 0, 12]}>
        <mesh castShadow position={[0, 0.55, 0]}><cylinderGeometry args={[0.42, 0.58, 0.85, 8]} /><meshStandardMaterial color="#9b998f" /></mesh>
        <mesh castShadow position={[0, 1.18, 0]}><boxGeometry args={[0.72, 0.12, 0.72]} /><meshStandardMaterial color="#aaa79d" /></mesh>
        <mesh castShadow position={[0, 1.58, 0]}><boxGeometry args={[0.32, 0.68, 0.32]} /><meshStandardMaterial color="#9b998f" /></mesh>
        <mesh castShadow position={[0, 1.95, 0]}><cylinderGeometry args={[0.34, 0.48, 0.22, 6]} /><meshStandardMaterial color="#aaa79d" /></mesh>
      </group>
      <group position={[0, 0, 18.2]}>
        <mesh castShadow receiveShadow position={[0, 0.33, 0]}><boxGeometry args={[19, 0.65, 0.24]} /><meshStandardMaterial color="#e7e3d6" roughness={0.96} /></mesh>
        <mesh castShadow position={[0, 0.74, -0.02]}><boxGeometry args={[19, 0.14, 0.3]} /><meshStandardMaterial color="#8d6c50" /></mesh>
        {[-8.4, -6, -3.6, -1.2, 1.2, 3.6, 6, 8.4].map((x) => <mesh key={`garden-post-${x}`} castShadow position={[x, 0.65, -0.06]}><boxGeometry args={[0.13, 0.82, 0.3]} /><meshStandardMaterial color="#927258" /></mesh>)}
        {[-7.2, -4.8, -2.4, 0, 2.4, 4.8, 7.2].map((x, index) => <mesh key={`garden-screen-${x}`} position={[x, 0.58, 0.02]}><boxGeometry args={[2.08, 0.34, 0.06]} /><meshStandardMaterial color={index % 2 ? "#b9c8af" : "#c8d2bd"} roughness={1} /></mesh>)}
      </group>
      {[[-7.7, 17.35], [-5.4, 17.15], [5.8, 17.2], [8, 17.45]].map(([x, z], index) => <group key={`shrub-${index}`} position={[x, 0, z]}>
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
      <mesh receiveShadow position={[0, -0.08, -0.15]}><boxGeometry args={[28, 0.18, 14.2]} /><meshStandardMaterial color="#bd9672" roughness={0.9} /></mesh>
      {[-6.8, -5.6, -4.4, -3.2, -2, -0.8, 0.4, 1.6, 2.8, 4, 5.2, 6.4].map((z) => <mesh key={`floor-plank-${z}`} position={[0, 0.016, z]}><boxGeometry args={[27.7, 0.012, 0.025]} /><meshStandardMaterial color="#806047" roughness={1} /></mesh>)}
      <mesh receiveShadow position={[0, -0.06, 14]}><boxGeometry args={[28, 0.14, 10]} /><meshStandardMaterial color="#cbd5c1" roughness={1} /></mesh>
      <mesh position={[0, 2.75, -7.45]}><planeGeometry args={[28, 6.1]} /><meshBasicMaterial color="#d8d2c2" /></mesh>
      <mesh castShadow receiveShadow position={[0, 0.22, -7.18]}><boxGeometry args={[28, 0.55, 0.22]} /><meshStandardMaterial color="#f2eee4" /></mesh>
      <mesh castShadow receiveShadow position={[0, 3.5, -7.18]}><boxGeometry args={[28, 0.6, 0.22]} /><meshStandardMaterial color="#f2eee4" /></mesh>
      <SideLandscape side={-1} />
      <SideLandscape side={1} />
      <SideWall side={-1} />
      <SideWall side={1} />
      {([-1, 1] as const).flatMap((side) => [-3.6, 0.2, 4].map((z) => <OctagonalWindow key={`${side}-${z}`} side={side} z={z} />))}
      <mesh castShadow receiveShadow position={[0, 0, 8]}><boxGeometry args={[28, 0.16, 2]} /><meshStandardMaterial color="#ad835f" roughness={0.9} /></mesh>
      <mesh castShadow position={[0, 0.09, 7]}><boxGeometry args={[28, 0.12, 0.13]} /><meshStandardMaterial color="#76543e" /></mesh>
      {[-12, -9, -6, -3, 0, 3, 6, 9, 12].map((x) => <mesh key={`veranda-${x}`} position={[x, 0.086, 8]}><boxGeometry args={[0.045, 0.015, 1.96]} /><meshStandardMaterial color="#73523e" /></mesh>)}
      <CeilingStructure />
      <WindChime />
      <RoomDecor />
      {TABLE_POSITIONS.map((position, index) => <LowTable key={index} position={position} />)}
      <mesh receiveShadow position={[4.8, -0.005, 14]}><cylinderGeometry args={[3.05, 3.45, 0.08, 24]} /><meshStandardMaterial color="#75918a" roughness={0.4} /></mesh>
      {[[-6.8, 10.75], [-4.5, 14.15], [-1.8, 11.25], [-0.2, 16.25]].map(([x, z], index) => (
        <mesh key={index} castShadow position={[x, 0.12, z]} scale={[1.2, 0.32, 0.85]}><dodecahedronGeometry args={[0.72, 0]} /><meshStandardMaterial color="#aaa99f" roughness={1} /></mesh>
      ))}
      {[[-7.8, 11.15, 0.9], [-7, 15.25, 1.15], [8.4, 10.95, 0.95]].map(([x, z, pineScale], index) => <LowPolyPine key={`pine-${index}`} position={[x, 0, z]} scale={pineScale} />)}
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
  const seat = SEAT_POSITIONS.find((candidate) => candidate.id === seatId);
  if (!seat) return { x: 0, z: 0 };
  const table = TABLE_POSITIONS[seat.table];
  const factor = kind === "solo" ? 0.22 : 0.24;
  return { x: (seat.x - table.x) * factor, z: (seat.z - table.z) * factor };
}

function teaCupOffset(seatId: string) {
  const index = (Number(seatId.replace("seat-", "")) - 1) % 4;
  return [
    { x: 0, z: -0.92 },
    { x: 0.92, z: 0 },
    { x: 0, z: 0.92 },
    { x: -0.92, z: 0 },
  ][index] ?? { x: 0, z: 0 };
}

function GuestCup({ color = "#d7c69f", filled = false }: { color?: string; filled?: boolean }) {
  return <group>
    <mesh castShadow><cylinderGeometry args={[0.14, 0.1, 0.18, 14]} /><meshStandardMaterial color="#f1ebe0" roughness={0.82} /></mesh>
    <mesh position={[0, 0.1, 0]} visible={filled}><cylinderGeometry args={[0.095, 0.095, 0.014, 14]} /><meshStandardMaterial color={color} /></mesh>
    <mesh position={[0, 0.105, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.12, 0.012, 6, 14]} /><meshStandardMaterial color="#9c8068" /></mesh>
  </group>;
}

function SocialVessel({ kind }: { kind: TeawareKind }) {
  const color = kind === "yixing" ? "#96543f" : kind === "koreanTeapot" ? "#e6e1d5" : "#f4f0e7";
  if (kind === "gaiwan" || kind === "matchaSet") return <group>
    <mesh castShadow><cylinderGeometry args={kind === "matchaSet" ? [0.28, 0.2, 0.22, 16] : [0.23, 0.16, 0.2, 16]} /><meshStandardMaterial color={color} roughness={0.84} /></mesh>
    {kind === "gaiwan" && <mesh position={[0, 0.16, 0]}><coneGeometry args={[0.2, 0.1, 16]} /><meshStandardMaterial color={color} /></mesh>}
  </group>;
  return <group>
    <mesh castShadow scale={[1.08, kind === "yixing" ? 0.78 : 0.9, 1]}><sphereGeometry args={[0.25, 14, 10]} /><meshStandardMaterial color={color} roughness={0.8} /></mesh>
    <mesh castShadow position={[0.25, 0.01, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.07, 0.26, 10]} /><meshStandardMaterial color={color} /></mesh>
    <mesh position={[-0.22, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.16, 0.035, 7, 14, Math.PI]} /><meshStandardMaterial color={color} /></mesh>
    <mesh position={[0, 0.2, 0]}><sphereGeometry args={[0.055, 8, 6]} /><meshStandardMaterial color={color} /></mesh>
  </group>;
}

function SocialPourAction({ start, end, kind, color, startedAt }: { start: THREE.Vector3; end: THREE.Vector3; kind: TeawareKind; color: string; startedAt: number }) {
  const vessel = useRef<THREE.Group>(null);
  const stream = useRef<THREE.Mesh>(null);
  const direction = end.clone().sub(start).setY(0).normalize();
  const pourPosition = end.clone().add(direction.clone().multiplyScalar(-0.42)).setY(1.02);
  const heading = Math.atan2(-direction.z, direction.x);
  useFrame(() => {
    if (!vessel.current) return;
    const progress = THREE.MathUtils.smoothstep(Math.min(1, Math.max(0, (Date.now() - startedAt) / 700)), 0, 1);
    vessel.current.position.lerpVectors(start, pourPosition, progress);
    vessel.current.rotation.y = heading;
    vessel.current.rotation.z = -0.58 * progress;
    if (stream.current) stream.current.visible = progress > 0.78;
  });
  return <>
    <group ref={vessel} position={start} scale={0.72}><SocialVessel kind={kind} /></group>
    <mesh ref={stream} visible={false} position={[end.x, 0.84, end.z]}><cylinderGeometry args={[0.016, 0.01, 0.27, 7]} /><meshStandardMaterial color={color} transparent opacity={0.78} /></mesh>
  </>;
}

function SharedPourActions({ people, room }: { people: PresenceSnapshot[]; room: RoomSnapshot }) {
  return <>{TABLE_POSITIONS.map((table, tableIndex) => {
    if (table.kind !== "shared") return null;
    const hostId = room.tableHosts[String(tableIndex)];
    const host = people.find((person) => person.sessionId === hostId && person.state === "pouring");
    if (!host?.seatId) return null;
    const guests = people.filter((person) => person.sessionId !== hostId && SEAT_POSITIONS.find((seat) => seat.id === person.seatId)?.table === tableIndex);
    const target = guests.find((person) => person.state === "requesting") ?? guests[0];
    if (!target?.seatId) return null;
    const hostOffset = teaServiceOffset(host.seatId, "shared");
    const targetOffset = teaCupOffset(target.seatId);
    const color = TEAS.find((tea) => tea.id === host.tea)?.color ?? "#bd8b57";
    return <SocialPourAction key={`pour-${tableIndex}`} start={new THREE.Vector3(table.x + hostOffset.x, 0.82, table.z + hostOffset.z)} end={new THREE.Vector3(table.x + targetOffset.x, 0.72, table.z + targetOffset.z)} kind={host.teaware ?? "koreanTeapot"} color={color} startedAt={host.actionStartedAt ?? Date.now()} />;
  })}</>;
}

function RemoteTeaServices({ people, localSessionId, room }: { people: PresenceSnapshot[]; localSessionId: string; room: RoomSnapshot }) {
  const services = useMemo(() => people.filter((person) => person.sessionId !== localSessionId && person.seatId), [localSessionId, people]);
  return <>{services.map((person) => {
    const seat = SEAT_POSITIONS.find((candidate) => candidate.id === person.seatId);
    if (!seat) return null;
    const table = TABLE_POSITIONS[seat.table];
    const isHost = seat.kind === "solo" || room.tableHosts[String(seat.table)] === person.sessionId;
    const usesOwnService = isHost || Boolean(person.teaware && person.ritual !== "idle");
    const offset = usesOwnService ? teaServiceOffset(seat.id, seat.kind) : teaCupOffset(seat.id);
    const serviceRotation = seat.rotation;
    const host = people.find((candidate) => candidate.sessionId === room.tableHosts[String(seat.table)]);
    const teaColor = TEAS.find((tea) => tea.id === (isHost ? person.tea : host?.tea))?.color;
    const filled = !isHost && (person.state === "drinking" || person.ritual === "complete" || host?.state === "pouring");
    const surfaceY = seat.kind === "solo" ? 0.76 : 0.68;
    return <group key={person.sessionId} position={[table.x + offset.x, surfaceY, table.z + offset.z]} rotation={[0, serviceRotation, 0]}>{usesOwnService && person.teaware
      ? <TeaService kind={person.teaware} ritual={person.ritual} color={teaColor} socialPour={person.state === "pouring"} />
      : <GuestCup color={teaColor} filled={filled} />}</group>;
  })}</>;
}

function World(props: SceneProps) {
  const pathRef = useRef<Array<{ x: number; z: number }>>([]);
  const queuedSeatRef = useRef<string | null>(null);
  const localPositionRef = useRef({ ...props.local.position });
  const playerRef = useRef<THREE.Group>(null);
  const handledSeatRequest = useRef(0);
  const scenePeople = useMemo<PresenceSnapshot[]>(() => [
    ...props.room.people.filter((person) => person.sessionId !== props.identity.sessionId),
    { ...props.local, sessionId: props.identity.sessionId, displayName: props.identity.displayName, variant: props.identity.variant, roomId: props.identity.roomId, updatedAt: props.room.serverTime },
  ], [props.identity, props.local, props.room.people, props.room.serverTime]);

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
      <GardenWeather weather={props.weather} />
      <mesh position={[0, 0.01, 5.8]} rotation={[-Math.PI / 2, 0, 0]} onPointerUp={handleFloor}>
        <planeGeometry args={[28, 30]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {SEAT_POSITIONS.map((seat) => <Seat key={seat.id} seat={seat} occupied={Boolean(props.room.occupiedSeats[seat.id])} onClick={() => requestSeat(seat.id)} />)}
      <Player identity={props.identity} local={props.local} pathRef={pathRef} positionRef={localPositionRef} groupRef={playerRef} queuedSeatRef={queuedSeatRef} onMove={props.onMove} onArriveSeat={(seatId) => void props.onClaimSeat(seatId).then((result) => props.onNotice(result.message))} />
      <LocalNameTag target={playerRef} />
      {props.room.people.filter((person) => person.sessionId !== props.identity.sessionId).map((person) => (
        <Rabbit key={person.sessionId} variant={person.variant} name={person.displayName} state={person.state} ritual={person.ritual} teaware={person.teaware} teaColor={TEAS.find((tea) => tea.id === person.tea)?.color} position={person.position} rotation={person.rotation} />
      ))}
      {props.local.seatId && props.local.ritual !== "sipping" && (() => {
        const seat = SEAT_POSITIONS.find((candidate) => candidate.id === props.local.seatId);
        if (!seat) return null;
        const table = TABLE_POSITIONS[seat.table];
        const isHost = seat.kind === "solo" || props.room.tableHosts[String(seat.table)] === props.identity.sessionId;
        const usesOwnService = isHost || Boolean(props.local.teaware && props.local.ritual !== "idle");
        const offset = usesOwnService ? teaServiceOffset(seat.id, seat.kind) : teaCupOffset(seat.id);
        const serviceRotation = seat.rotation;
        const host = scenePeople.find((person) => person.sessionId === props.room.tableHosts[String(seat.table)]);
        const teaColor = TEAS.find((tea) => tea.id === (isHost ? props.local.tea : host?.tea))?.color;
        const filled = !isHost && (props.local.state === "drinking" || props.local.ritual === "complete" || host?.state === "pouring");
        const surfaceY = seat.kind === "solo" ? 0.76 : 0.68;
        return <group position={[table.x + offset.x, surfaceY, table.z + offset.z]} rotation={[0, serviceRotation, 0]}>{usesOwnService && props.local.teaware
          ? <TeaService kind={props.local.teaware} ritual={props.local.ritual} color={teaColor} socialPour={props.local.state === "pouring"} />
          : <GuestCup color={teaColor} filled={filled} />}</group>;
      })()}
      <RemoteTeaServices people={scenePeople} localSessionId={props.identity.sessionId} room={props.room} />
      <SharedPourActions people={scenePeople} room={props.room} />
      <CameraRig target={playerRef} focus={Boolean(props.local.seatId)} seatId={props.local.seatId} />
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
