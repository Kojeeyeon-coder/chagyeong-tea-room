"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { RabbitState, RabbitVariant, TeaRitualState, TeawareKind, Vec2 } from "@/lib/chagyeong-types";

const COLORS: Record<RabbitVariant, { fur: string; ear: string }> = {
  snow: { fur: "#f5f1e8", ear: "#d6aaa4" }, ink: { fur: "#343735", ear: "#8f6e6c" },
  mist: { fur: "#a9aca8", ear: "#c29d9a" }, chestnut: { fur: "#906b50", ear: "#bd8f83" },
  cream: { fur: "#d9c7a2", ear: "#c8948c" }, dapple: { fur: "#c8b9a2", ear: "#b77f7b" },
};

type RabbitProps = {
  variant: RabbitVariant;
  name: string;
  state: RabbitState;
  position: Vec2;
  rotation: number;
  ritual?: TeaRitualState;
  teaware?: TeawareKind | null;
  teaColor?: string;
  local?: boolean;
  groupRef?: React.RefObject<THREE.Group | null>;
};

export function Rabbit({ variant, name, state, position, rotation, ritual = "idle", teaware, teaColor = "#9b744b", local = false, groupRef }: RabbitProps) {
  const internal = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const leftEar = useRef<THREE.Mesh>(null);
  const rightEar = useRef<THREE.Mesh>(null);
  const leftPaw = useRef<THREE.Mesh>(null);
  const rightPaw = useRef<THREE.Mesh>(null);
  const cup = useRef<THREE.Group>(null);
  const colors = COLORS[variant];
  const isDrinking = state === "drinking";

  useFrame(({ clock }, delta) => {
    const root = (groupRef?.current ?? internal.current);
    if (!root || !body.current) return;
    root.position.x = THREE.MathUtils.damp(root.position.x, position.x, local ? 18 : 6, delta);
    root.position.z = THREE.MathUtils.damp(root.position.z, position.z, local ? 18 : 6, delta);
    root.rotation.y = THREE.MathUtils.damp(root.rotation.y, rotation, 9, delta);
    const t = clock.elapsedTime;
    const walking = state === "walking";
    const greeting = state === "greeting";
    const requesting = state === "requesting";
    const pouring = state === "pouring";
    const brewing = state === "brewing";
    const drinking = isDrinking;
    const preparing = brewing && ritual === "preparing";
    const whisking = brewing && ritual === "brewing" && teaware === "matchaSet";
    const steeping = brewing && ritual === "brewing" && teaware !== "matchaSet";
    const serving = brewing && ritual === "serving";
    const resting = state === "sitting" || brewing || drinking;
    body.current.position.y = walking ? Math.abs(Math.sin(t * 7)) * 0.09 : resting ? -0.12 : 0;
    body.current.rotation.x = greeting ? Math.sin(t * 5) * 0.22 + 0.18 : requesting ? 0.1 + Math.sin(t * 3) * 0.04 : pouring ? 0.16 : 0;
    body.current.rotation.z = whisking ? Math.sin(t * 7) * 0.07 : pouring ? -0.11 : serving ? -0.05 : 0;
    if (leftEar.current && rightEar.current) {
      leftEar.current.rotation.z = -0.1 + Math.sin(t * 2.2) * 0.035;
      rightEar.current.rotation.z = 0.1 - Math.sin(t * 2.2) * 0.035;
    }
    if (leftPaw.current && rightPaw.current) {
      const pawLift = drinking ? -1.2 : pouring ? -1.08 : requesting ? -0.72 : serving ? -1.02 : steeping ? -0.82 : preparing ? -0.55 : whisking ? -0.9 : greeting ? -0.55 : walking ? Math.sin(t * 7) * 0.35 : 0;
      const ritualMotion = whisking ? Math.sin(t * 12) * 0.32 : steeping ? Math.sin(t * 2.5) * 0.08 : 0;
      leftPaw.current.rotation.x = pawLift + ritualMotion;
      rightPaw.current.rotation.x = pawLift - ritualMotion * 0.7;
      leftPaw.current.rotation.z = 0.18 + (serving ? 0.18 : 0);
      rightPaw.current.rotation.z = -0.18 - (serving ? 0.1 : 0);
      leftPaw.current.position.x = THREE.MathUtils.damp(leftPaw.current.position.x, drinking ? -0.23 : -0.34, 9, delta);
      rightPaw.current.position.x = THREE.MathUtils.damp(rightPaw.current.position.x, drinking ? 0.23 : 0.34, 9, delta);
      leftPaw.current.position.y = THREE.MathUtils.damp(leftPaw.current.position.y, drinking ? 0.94 : 0.72, 9, delta);
      rightPaw.current.position.y = THREE.MathUtils.damp(rightPaw.current.position.y, drinking ? 0.94 : 0.72, 9, delta);
    }
    if (cup.current) {
      cup.current.position.x = 0.21;
      cup.current.position.y = 1.54 + Math.sin(t * 2.4) * 0.018;
      cup.current.position.z = 0.92;
      cup.current.rotation.x = drinking ? -0.38 + Math.sin(t * 2.4) * 0.035 : 0;
    }
  });

  return (
    <group ref={groupRef ?? internal} position={[position.x, 0, position.z]} rotation={[0, rotation, 0]}>
      <group ref={body}>
        <mesh castShadow position={[0, 0.65, 0]} scale={[0.72, 0.88, 0.62]}>
          <sphereGeometry args={[0.56, 16, 12]} /><meshStandardMaterial color={colors.fur} roughness={0.94} />
        </mesh>
        <mesh castShadow position={[0, 1.35, -0.03]}>
          <sphereGeometry args={[0.48, 16, 12]} /><meshStandardMaterial color={colors.fur} roughness={0.92} />
        </mesh>
        <mesh ref={leftEar} castShadow position={[-0.2, 1.93, -0.02]} scale={[0.34, 1, 0.28]} rotation={[0.05, 0, -0.1]}>
          <capsuleGeometry args={[0.18, 0.55, 6, 10]} /><meshStandardMaterial color={colors.fur} roughness={0.92} />
        </mesh>
        <mesh ref={rightEar} castShadow position={[0.2, 1.93, -0.02]} scale={[0.34, 1, 0.28]} rotation={[0.05, 0, 0.1]}>
          <capsuleGeometry args={[0.18, 0.55, 6, 10]} /><meshStandardMaterial color={colors.fur} roughness={0.92} />
        </mesh>
        <mesh position={[-0.16, 1.42, 0.43]}><sphereGeometry args={[0.035, 8, 8]} /><meshBasicMaterial color="#302b29" /></mesh>
        <mesh position={[0.16, 1.42, 0.43]}><sphereGeometry args={[0.035, 8, 8]} /><meshBasicMaterial color="#302b29" /></mesh>
        <mesh position={[0, 1.28, 0.46]} scale={[1, 0.7, 0.7]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#a77875" /></mesh>
        <mesh ref={leftPaw} castShadow position={[-0.34, 0.72, 0.27]} rotation={[0, 0, 0.18]}>
          <capsuleGeometry args={[0.1, 0.35, 4, 8]} /><meshStandardMaterial color={colors.fur} />
        </mesh>
        <mesh ref={rightPaw} castShadow position={[0.34, 0.72, 0.27]} rotation={[0, 0, -0.18]}>
          <capsuleGeometry args={[0.1, 0.35, 4, 8]} /><meshStandardMaterial color={colors.fur} />
        </mesh>
        <mesh castShadow position={[0, 0.72, -0.54]}><sphereGeometry args={[0.19, 10, 8]} /><meshStandardMaterial color={colors.fur} /></mesh>
        <group ref={cup} visible={isDrinking} position={[0, 1.31, 0.92]} scale={1.08}>
          {teaware === "matchaSet" ? <>
            <mesh castShadow><cylinderGeometry args={[0.28, 0.2, 0.22, 18]} /><meshStandardMaterial color="#eee8dc" roughness={0.88} /></mesh>
            <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.22, 0.22, 0.018, 18]} /><meshStandardMaterial color="#91aa68" /></mesh>
            <mesh position={[0, 0.125, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.245, 0.018, 6, 18]} /><meshStandardMaterial color="#788762" roughness={0.8} /></mesh>
          </> : <>
            <mesh castShadow><cylinderGeometry args={[0.13, 0.1, 0.18, 14]} /><meshStandardMaterial color="#f6f1e8" roughness={0.8} /></mesh>
            <mesh position={[0, 0.095, 0]}><cylinderGeometry args={[0.09, 0.09, 0.015, 14]} /><meshStandardMaterial color={teaColor} /></mesh>
          </>}
        </group>
      </group>
    </group>
  );
}
