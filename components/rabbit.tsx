"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { RabbitState, RabbitVariant, Vec2 } from "@/lib/chagyeong-types";

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
  local?: boolean;
  groupRef?: React.RefObject<THREE.Group | null>;
};

export function Rabbit({ variant, name, state, position, rotation, local = false, groupRef }: RabbitProps) {
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
    const brewing = state === "brewing";
    const drinking = isDrinking;
    const resting = state === "sitting" || brewing || drinking;
    body.current.position.y = walking ? Math.abs(Math.sin(t * 7)) * 0.09 : resting ? -0.12 : 0;
    body.current.rotation.x = greeting ? Math.sin(t * 5) * 0.22 + 0.18 : 0;
    body.current.rotation.z = brewing ? Math.sin(t * 3.2) * 0.055 : 0;
    if (leftEar.current && rightEar.current) {
      leftEar.current.rotation.z = -0.1 + Math.sin(t * 2.2) * 0.035;
      rightEar.current.rotation.z = 0.1 - Math.sin(t * 2.2) * 0.035;
    }
    if (leftPaw.current && rightPaw.current) {
      const pawLift = drinking ? -1.2 : brewing ? -0.78 : greeting ? -0.55 : walking ? Math.sin(t * 7) * 0.35 : 0;
      leftPaw.current.rotation.x = pawLift + (brewing ? Math.sin(t * 4) * 0.12 : 0);
      rightPaw.current.rotation.x = pawLift - (brewing ? Math.sin(t * 4) * 0.12 : 0);
    }
    if (cup.current) {
      cup.current.position.y = 1.02 + Math.sin(t * 2.4) * 0.025;
      cup.current.rotation.x = drinking ? -0.2 + Math.sin(t * 2.4) * 0.05 : 0;
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
        <group ref={cup} visible={isDrinking} position={[0, 1.02, 0.55]}>
          <mesh castShadow><cylinderGeometry args={[0.13, 0.1, 0.18, 14]} /><meshStandardMaterial color="#f6f1e8" roughness={0.8} /></mesh>
          <mesh position={[0, 0.095, 0]}><cylinderGeometry args={[0.09, 0.09, 0.015, 14]} /><meshStandardMaterial color="#a38352" /></mesh>
        </group>
      </group>
    </group>
  );
}
