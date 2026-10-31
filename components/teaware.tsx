"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { TeaRitualState, TeawareKind } from "@/lib/chagyeong-types";

export function TeaService({ kind, ritual, color = "#9b744b" }: { kind: TeawareKind; ritual: TeaRitualState; color?: string }) {
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const active = ritual === "brewing" || ritual === "serving";
    root.current.rotation.z = THREE.MathUtils.lerp(root.current.rotation.z, ritual === "serving" ? -0.28 : 0, 0.08);
    root.current.position.y = active ? 0.15 + Math.sin(clock.elapsedTime * 3) * 0.03 : 0.1;
  });

  if (kind === "matchaSet") return (
    <group ref={root} position={[0, 0.1, 0]} scale={0.72}>
      <mesh castShadow><cylinderGeometry args={[0.38, 0.28, 0.28, 16]} /><meshStandardMaterial color="#eee8dc" /></mesh>
      <mesh position={[0.48, 0.28, 0]} rotation={[0, 0, 0.18]}><cylinderGeometry args={[0.035, 0.06, 0.72, 8]} /><meshStandardMaterial color="#b7a477" /></mesh>
      <mesh position={[0, 0.15, 0]}><cylinderGeometry args={[0.3, 0.3, 0.02, 16]} /><meshStandardMaterial color={color} /></mesh>
    </group>
  );

  const clay = kind === "yixing" ? "#8c4f3d" : kind === "koreanTeapot" ? "#e9e4da" : "#f7f4ec";
  return (
    <group ref={root} position={[0, 0.1, 0]} scale={0.7}>
      <mesh castShadow><sphereGeometry args={[0.34, 14, 10]} /><meshStandardMaterial color={clay} roughness={0.82} /></mesh>
      <mesh castShadow position={[0, 0.31, 0]}><cylinderGeometry args={[0.18, 0.22, 0.12, 14]} /><meshStandardMaterial color={clay} /></mesh>
      <mesh castShadow position={[0.43, 0.02, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.13, 0.5, 10]} /><meshStandardMaterial color={clay} /></mesh>
      <mesh position={[-0.38, 0.05, 0]}><torusGeometry args={[0.22, 0.045, 8, 14, Math.PI]} /><meshStandardMaterial color={clay} /></mesh>
      <mesh position={[0.2, -0.18, 0.46]}><cylinderGeometry args={[0.16, 0.12, 0.18, 14]} /><meshStandardMaterial color="#f6f1e8" /></mesh>
      <mesh position={[0.2, -0.08, 0.46]}><cylinderGeometry args={[0.11, 0.11, 0.02, 14]} /><meshStandardMaterial color={color} /></mesh>
    </group>
  );
}
