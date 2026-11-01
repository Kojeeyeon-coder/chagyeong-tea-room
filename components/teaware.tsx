"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { TeaRitualState, TeawareKind } from "@/lib/chagyeong-types";

export function TeaService({ kind, ritual, color = "#9b744b" }: { kind: TeawareKind; ritual: TeaRitualState; color?: string }) {
  const root = useRef<THREE.Group>(null);
  const vessel = useRef<THREE.Group>(null);
  const fairness = useRef<THREE.Group>(null);
  const whisk = useRef<THREE.Group>(null);
  const foam = useRef<THREE.Group>(null);
  const stream = useRef<THREE.Mesh>(null);
  const secondStream = useRef<THREE.Mesh>(null);
  const previousRitual = useRef(ritual);
  const stageStartedAt = useRef(0);
  const liquidColor = kind === "matchaSet" ? "#91aa68" : color;

  useFrame(({ clock }, delta) => {
    if (!root.current || !vessel.current) return;
    const t = clock.elapsedTime;
    const serving = ritual === "serving";
    const brewing = ritual === "brewing";
    const preparing = ritual === "preparing";
    if (previousRitual.current !== ritual) {
      previousRitual.current = ritual;
      stageStartedAt.current = t;
    }
    const servingElapsed = serving ? t - stageStartedAt.current : 0;
    const firstPour = serving && kind !== "matchaSet" && servingElapsed < 1.45;
    const secondPour = serving && kind !== "matchaSet" && servingElapsed >= 1.45 && servingElapsed < 2.9;
    vessel.current.position.y = THREE.MathUtils.damp(vessel.current.position.y, firstPour ? 0.42 : brewing ? 0.24 : preparing ? 0.16 : 0.1, 7, delta);
    vessel.current.position.x = THREE.MathUtils.damp(vessel.current.position.x, kind === "matchaSet" ? 0 : firstPour ? -0.08 : -0.34, 7, delta);
    vessel.current.rotation.z = THREE.MathUtils.damp(vessel.current.rotation.z, firstPour ? -0.66 : 0, 8, delta);
    root.current.position.y = 0.08 + ((preparing || brewing) ? Math.sin(t * 2.2) * 0.018 : 0);
    if (whisk.current) {
      whisk.current.visible = preparing || brewing;
      whisk.current.position.x = brewing ? Math.sin(t * 12) * 0.23 : 0;
      whisk.current.position.z = brewing ? Math.cos(t * 12) * 0.08 : 0;
      whisk.current.rotation.x = brewing ? Math.cos(t * 12) * 0.1 : 0;
      whisk.current.rotation.z = 0.14 + (brewing ? Math.sin(t * 12) * 0.2 : 0);
    }
    if (foam.current) {
      foam.current.visible = brewing;
      foam.current.rotation.y = t * 3.8;
      const pulse = 0.92 + Math.sin(t * 10) * 0.08;
      foam.current.scale.setScalar(pulse);
    }
    if (stream.current) {
      stream.current.visible = firstPour;
      stream.current.scale.y = firstPour ? 0.82 + Math.sin(t * 8) * 0.08 : 0.01;
    }
    if (fairness.current) {
      fairness.current.position.x = THREE.MathUtils.damp(fairness.current.position.x, secondPour ? 0.42 : 0.24, 7, delta);
      fairness.current.position.y = THREE.MathUtils.damp(fairness.current.position.y, secondPour ? 0.32 : 0, 7, delta);
      fairness.current.rotation.z = THREE.MathUtils.damp(fairness.current.rotation.z, secondPour ? -0.7 : 0, 8, delta);
    }
    if (secondStream.current) {
      secondStream.current.visible = secondPour;
      secondStream.current.scale.y = secondPour ? 0.72 + Math.sin(t * 8) * 0.08 : 0.01;
    }
  });

  if (kind === "matchaSet") return (
    <group ref={root} position={[0, 0.08, 0]} scale={0.76} visible={ritual !== "sipping"}>
      <group ref={vessel}>
        <mesh castShadow><cylinderGeometry args={[0.43, 0.3, 0.32, 20]} /><meshStandardMaterial color="#eee8dc" roughness={0.9} /></mesh>
        <mesh position={[0, 0.17, 0]}><cylinderGeometry args={[0.34, 0.34, 0.025, 20]} /><meshStandardMaterial color={liquidColor} roughness={0.55} /></mesh>
        <mesh position={[0, 0.19, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.08, 0.3, 20]} /><meshBasicMaterial color="#b8c98a" transparent opacity={ritual === "brewing" ? 0.9 : 0.35} /></mesh>
        <group ref={foam} position={[0, 0.205, 0]} visible={false}>
          {[[0.18, 0], [0.08, 0.15], [-0.13, 0.11], [-0.17, -0.08], [0.08, -0.16]].map(([x, z], index) => <mesh key={index} position={[x, 0, z]}><sphereGeometry args={[0.022 + index * 0.002, 7, 5]} /><meshBasicMaterial color="#d7e2ad" transparent opacity={0.9} /></mesh>)}
        </group>
      </group>
      <group ref={whisk} position={[0, 0.47, 0]} rotation={[0, 0, 0.14]}>
        <mesh castShadow position={[0, 0.19, 0]}><cylinderGeometry args={[0.045, 0.06, 0.36, 9]} /><meshStandardMaterial color="#b8a274" /></mesh>
        <mesh position={[0, -0.015, 0]}><cylinderGeometry args={[0.095, 0.06, 0.08, 10]} /><meshStandardMaterial color="#c8ae78" /></mesh>
        {[-0.1, -0.05, 0, 0.05, 0.1].map((x) => <mesh key={x} position={[x, -0.15, 0]} rotation={[0, 0, -x * 1.6]}><cylinderGeometry args={[0.009, 0.014, 0.28, 5]} /><meshStandardMaterial color="#dcc58f" /></mesh>)}
      </group>
      <mesh position={[0.62, 0.08, -0.12]} rotation={[0, 0, Math.PI / 2 + 0.1]}><cylinderGeometry args={[0.028, 0.05, 0.72, 8]} /><meshStandardMaterial color="#b7a477" /></mesh>
    </group>
  );

  const clay = kind === "yixing" ? "#8c4f3d" : kind === "koreanTeapot" ? "#e6e1d5" : "#f7f4ec";
  const isGaiwan = kind === "gaiwan";
  const isYixing = kind === "yixing";
  return (
    <group ref={root} position={[0, 0.08, 0]} scale={0.74}>
      <group ref={vessel}>
        {isGaiwan ? <>
          <mesh castShadow><cylinderGeometry args={[0.38, 0.26, 0.3, 18]} /><meshStandardMaterial color={clay} roughness={0.82} /></mesh>
          <mesh castShadow position={[0, 0.22, 0]}><coneGeometry args={[0.3, 0.12, 18]} /><meshStandardMaterial color={clay} /></mesh>
          <mesh castShadow position={[0, 0.31, 0]}><sphereGeometry args={[0.055, 10, 8]} /><meshStandardMaterial color={clay} /></mesh>
        </> : isYixing ? <>
          <mesh castShadow scale={[1.12, 0.78, 1]}><sphereGeometry args={[0.39, 18, 14]} /><meshStandardMaterial color="#96543f" roughness={0.76} /></mesh>
          <mesh castShadow position={[0, 0.28, 0]} scale={[1.1, 0.5, 1]}><sphereGeometry args={[0.24, 14, 10]} /><meshStandardMaterial color="#96543f" roughness={0.72} /></mesh>
          <mesh castShadow position={[0, 0.39, 0]}><sphereGeometry args={[0.065, 10, 8]} /><meshStandardMaterial color="#7e4133" /></mesh>
          <mesh castShadow position={[0.42, 0.02, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.105, 0.46, 12]} /><meshStandardMaterial color="#96543f" roughness={0.74} /></mesh>
          <mesh position={[-0.38, 0.04, 0]} rotation={[0, 0, -0.15]}><torusGeometry args={[0.23, 0.052, 9, 18, Math.PI]} /><meshStandardMaterial color="#8d4938" roughness={0.78} /></mesh>
        </> : <>
          <mesh castShadow scale={[1, 0.9, 1]}><sphereGeometry args={[0.36, 16, 12]} /><meshStandardMaterial color={clay} roughness={0.82} /></mesh>
          <mesh castShadow position={[0, 0.3, 0]}><cylinderGeometry args={[0.18, 0.22, 0.12, 14]} /><meshStandardMaterial color={clay} /></mesh>
          <mesh castShadow position={[0.44, 0.04, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.13, 0.52, 10]} /><meshStandardMaterial color={clay} /></mesh>
          <mesh position={[-0.39, 0.05, 0]}><torusGeometry args={[0.22, 0.045, 8, 14, Math.PI]} /><meshStandardMaterial color={clay} /></mesh>
        </>}
      </group>
      <group ref={fairness} position={[0.24, 0, 0.2]}>
        <mesh position={[0, -0.015, 0]} scale={[0.72, 0.84, 0.72]}><cylinderGeometry args={[0.17, 0.11, 0.25, 14]} /><meshStandardMaterial color={liquidColor} transparent opacity={0.86} roughness={0.35} /></mesh>
        <mesh castShadow scale={[0.82, 1, 0.82]}><cylinderGeometry args={[0.19, 0.13, 0.3, 14]} /><meshStandardMaterial color="#eaf2ef" transparent opacity={0.28} roughness={0.12} metalness={0.08} depthWrite={false} /></mesh>
        <mesh castShadow position={[0.18, 0.05, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.075, 0.26, 9]} /><meshStandardMaterial color="#eaf2ef" transparent opacity={0.32} roughness={0.12} metalness={0.08} depthWrite={false} /></mesh>
        <mesh position={[-0.17, 0.03, 0]}><torusGeometry args={[0.13, 0.025, 7, 12, Math.PI]} /><meshStandardMaterial color="#dfeae6" transparent opacity={0.48} roughness={0.12} metalness={0.08} /></mesh>
        <mesh position={[0, 0.16, 0]}><cylinderGeometry args={[0.13, 0.13, 0.014, 14]} /><meshStandardMaterial color={liquidColor} transparent opacity={0.82} /></mesh>
      </group>
      <group position={[0.78, -0.09, 0.42]}>
        <mesh castShadow><cylinderGeometry args={[0.17, 0.12, 0.2, 14]} /><meshStandardMaterial color="#f6f1e8" /></mesh>
        <mesh position={[0, 0.11, 0]}><cylinderGeometry args={[0.115, 0.115, 0.018, 14]} /><meshStandardMaterial color={liquidColor} /></mesh>
      </group>
      <mesh ref={stream} visible={false} position={[0.12, 0.18, 0.12]} rotation={[0.35, 0, -0.38]}>
        <cylinderGeometry args={[0.025, 0.018, 0.58, 7]} /><meshStandardMaterial color={liquidColor} transparent opacity={0.76} />
      </mesh>
      <mesh ref={secondStream} visible={false} position={[0.67, 0.12, 0.3]} rotation={[0.35, 0, -0.42]}>
        <cylinderGeometry args={[0.022, 0.016, 0.46, 7]} /><meshStandardMaterial color={liquidColor} transparent opacity={0.76} />
      </mesh>
      {[0, 1, 2].map((index) => <mesh key={index} position={[0.55 + index * 0.05, 0.28 + index * 0.18, 0.42]} scale={0.8 - index * 0.16}>
        <sphereGeometry args={[0.055, 8, 8]} /><meshBasicMaterial color="#f7f4ec" transparent opacity={ritual === "serving" || ritual === "complete" ? 0.22 : 0} />
      </mesh>)}
    </group>
  );
}
