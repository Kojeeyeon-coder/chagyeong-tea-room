"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { TeaRitualState, TeawareKind } from "@/lib/chagyeong-types";

export function TeaService({ kind, ritual, color = "#9b744b", socialPour = false }: { kind: TeawareKind; ritual: TeaRitualState; color?: string; socialPour?: boolean }) {
  const root = useRef<THREE.Group>(null);
  const vessel = useRef<THREE.Group>(null);
  const fairness = useRef<THREE.Group>(null);
  const whisk = useRef<THREE.Group>(null);
  const foam = useRef<THREE.Group>(null);
  const stream = useRef<THREE.Mesh>(null);
  const secondStream = useRef<THREE.Mesh>(null);
  const previousRitual = useRef(ritual);
  const stageStartedAt = useRef(0);
  // 다완은 말차 전용으로 색을 고정하지 않는다. 사용자가 고른 차의 수색을
  // 그대로 따르고, 거품만 백자빛을 섞어 같은 계열의 밝은 색으로 만든다.
  const liquidColor = color;
  const foamColor = new THREE.Color(liquidColor).lerp(new THREE.Color("#f3edcf"), 0.48).getStyle();
  const foamTrailColor = new THREE.Color(liquidColor).lerp(new THREE.Color("#f7f2dc"), 0.66).getStyle();

  useFrame(({ clock }, delta) => {
    if (!root.current || !vessel.current) return;
    vessel.current.visible = !socialPour;
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
    vessel.current.position.x = THREE.MathUtils.damp(vessel.current.position.x, kind === "matchaSet" ? 0 : firstPour ? -0.12 : -0.42, 7, delta);
    vessel.current.rotation.z = THREE.MathUtils.damp(vessel.current.rotation.z, firstPour ? -0.66 : 0, 8, delta);
    root.current.position.y = 0.08 + ((preparing || brewing) ? Math.sin(t * 2.2) * 0.018 : 0);
    if (whisk.current) {
      whisk.current.visible = preparing || brewing;
      const whiskCycle = (t * 4.8) % 1;
      const whiskPhase = whiskCycle * 4;
      let whiskX = 0;
      let whiskZ = -0.09;
      if (whiskPhase < 1) {
        whiskX = -0.23 + whiskPhase * 0.23;
        whiskZ = 0.09 - whiskPhase * 0.18;
      } else if (whiskPhase < 2) {
        whiskX = (whiskPhase - 1) * 0.23;
        whiskZ = -0.09 + (whiskPhase - 1) * 0.18;
      } else if (whiskPhase < 3) {
        whiskX = 0.23 - (whiskPhase - 2) * 0.23;
        whiskZ = 0.09 - (whiskPhase - 2) * 0.18;
      } else {
        whiskX = -(whiskPhase - 3) * 0.23;
        whiskZ = -0.09 + (whiskPhase - 3) * 0.18;
      }
      whisk.current.position.x = brewing ? whiskX : 0;
      whisk.current.position.z = brewing ? whiskZ : 0;
      whisk.current.rotation.x = brewing ? -0.22 + (whiskZ / 0.09) * 0.08 : -0.12;
      whisk.current.rotation.z = 0.46 + (brewing ? (whiskX / 0.23) * 0.18 : 0);
    }
    if (foam.current) {
      foam.current.visible = brewing;
      foam.current.rotation.y = 0;
      foam.current.position.x = Math.sin(t * 9.6) * 0.035;
      foam.current.position.z = -0.015 + Math.abs(Math.sin(t * 4.8)) * 0.03;
      const pulse = 0.92 + Math.sin(t * 10) * 0.08;
      foam.current.scale.setScalar(pulse);
    }
    if (stream.current) {
      stream.current.visible = firstPour;
      stream.current.scale.y = firstPour ? 0.82 + Math.sin(t * 8) * 0.08 : 0.01;
    }
    if (fairness.current) {
      fairness.current.position.x = THREE.MathUtils.damp(fairness.current.position.x, secondPour ? 0.42 : 0.22, 7, delta);
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
        <mesh position={[0, 0.19, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.08, 0.3, 20]} /><meshBasicMaterial color={foamColor} transparent opacity={ritual === "brewing" ? 0.9 : 0.35} /></mesh>
        {[[-0.09, -0.55], [0.09, 0.55]].map(([x, turn], index) => <mesh key={`v-trail-${index}`} position={[x, 0.207, 0.035]} rotation={[0, turn, Math.PI / 2]}>
          <cylinderGeometry args={[0.009, 0.016, 0.24, 5]} /><meshBasicMaterial color={foamTrailColor} transparent opacity={ritual === "brewing" ? 0.62 : 0} />
        </mesh>)}
        <group ref={foam} position={[0, 0.205, 0]} visible={false}>
          {[[0.18, 0], [0.08, 0.15], [-0.13, 0.11], [-0.17, -0.08], [0.08, -0.16]].map(([x, z], index) => <mesh key={index} position={[x, 0, z]}><sphereGeometry args={[0.022 + index * 0.002, 7, 5]} /><meshBasicMaterial color={foamTrailColor} transparent opacity={0.9} /></mesh>)}
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
    <group ref={root} position={[0, 0.08, 0]} scale={0.56}>
      <group ref={vessel}>
        {isGaiwan ? <>
          <mesh castShadow><cylinderGeometry args={[0.38, 0.26, 0.3, 18]} /><meshStandardMaterial color={clay} roughness={0.82} /></mesh>
          <mesh castShadow position={[0, 0.22, 0]}><coneGeometry args={[0.3, 0.12, 18]} /><meshStandardMaterial color={clay} /></mesh>
          <mesh castShadow position={[0, 0.31, 0]}><sphereGeometry args={[0.055, 10, 8]} /><meshStandardMaterial color={clay} /></mesh>
        </> : isYixing ? <>
          <mesh castShadow scale={[1.12, 0.78, 1]}><sphereGeometry args={[0.39, 18, 14]} /><meshStandardMaterial color="#96543f" roughness={0.76} /></mesh>
          <mesh castShadow position={[0, 0.28, 0]} scale={[1.1, 0.5, 1]}><sphereGeometry args={[0.24, 14, 10]} /><meshStandardMaterial color="#96543f" roughness={0.72} /></mesh>
          <mesh castShadow position={[0, 0.39, 0]}><sphereGeometry args={[0.065, 10, 8]} /><meshStandardMaterial color="#7e4133" /></mesh>
          <mesh castShadow position={[0.34, 0.02, 0]} rotation={[0, 0, -Math.PI / 2]}><cylinderGeometry args={[0.07, 0.11, 0.3, 12]} /><meshStandardMaterial color="#96543f" roughness={0.74} /></mesh>
          <mesh castShadow position={[0.5, 0.02, 0]} scale={[1.15, 0.72, 1.15]}><sphereGeometry args={[0.075, 10, 8]} /><meshStandardMaterial color="#96543f" roughness={0.74} /></mesh>
          <mesh position={[-0.38, 0.04, 0]} rotation={[0, 0, -0.15]}><torusGeometry args={[0.23, 0.052, 9, 18, Math.PI]} /><meshStandardMaterial color="#8d4938" roughness={0.78} /></mesh>
        </> : <>
          <mesh castShadow scale={[1, 0.9, 1]}><sphereGeometry args={[0.36, 16, 12]} /><meshStandardMaterial color={clay} roughness={0.82} /></mesh>
          <mesh castShadow position={[0, 0.3, 0]}><cylinderGeometry args={[0.18, 0.22, 0.12, 14]} /><meshStandardMaterial color={clay} /></mesh>
          <mesh castShadow position={[0.36, 0.04, 0]} rotation={[0, 0, -Math.PI / 2]}><cylinderGeometry args={[0.075, 0.12, 0.34, 12]} /><meshStandardMaterial color={clay} /></mesh>
          <mesh castShadow position={[0.54, 0.04, 0]} scale={[1.1, 0.72, 1.1]}><sphereGeometry args={[0.08, 10, 8]} /><meshStandardMaterial color={clay} /></mesh>
          <mesh position={[-0.39, 0.05, 0]}><torusGeometry args={[0.22, 0.045, 8, 14, Math.PI]} /><meshStandardMaterial color={clay} /></mesh>
        </>}
      </group>
      <group ref={fairness} position={[0.18, 0, -0.46]} renderOrder={3}>
        <mesh position={[0, -0.012, 0]} scale={[0.78, 0.9, 0.78]}><cylinderGeometry args={[0.19, 0.12, 0.28, 14]} /><meshStandardMaterial color={liquidColor} transparent opacity={0.94} roughness={0.3} /></mesh>
        <mesh castShadow scale={[1, 1.14, 1]}><cylinderGeometry args={[0.21, 0.14, 0.34, 14]} /><meshStandardMaterial color="#d6e5e1" transparent opacity={0.7} roughness={0.14} metalness={0.03} depthWrite={false} /></mesh>
        <mesh castShadow position={[0.2, 0.07, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.08, 0.27, 9]} /><meshStandardMaterial color="#eaf2ef" transparent opacity={0.68} roughness={0.1} metalness={0.08} /></mesh>
        <mesh position={[-0.19, 0.04, 0]}><torusGeometry args={[0.145, 0.03, 7, 12, Math.PI]} /><meshStandardMaterial color="#dfeae6" transparent opacity={0.86} roughness={0.1} metalness={0.08} /></mesh>
        <mesh position={[0, 0.18, 0]}><cylinderGeometry args={[0.145, 0.145, 0.016, 14]} /><meshStandardMaterial color={liquidColor} transparent opacity={0.9} /></mesh>
        <mesh position={[0, 0.188, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.17, 0.016, 7, 14]} /><meshStandardMaterial color="#f0f7f4" transparent opacity={0.95} roughness={0.14} /></mesh>
      </group>
      <group position={[0.62, -0.09, -0.12]}>
        <mesh castShadow><cylinderGeometry args={[0.17, 0.12, 0.2, 14]} /><meshStandardMaterial color="#eee8dd" /></mesh>
        <mesh position={[0, 0.11, 0]}><cylinderGeometry args={[0.115, 0.115, 0.018, 14]} /><meshStandardMaterial color={liquidColor} /></mesh>
        <mesh position={[0, 0.115, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.145, 0.014, 6, 14]} /><meshStandardMaterial color="#9b806b" roughness={0.8} /></mesh>
      </group>
      <mesh ref={stream} visible={false} position={[0.06, 0.21, 0.08]} rotation={[0, 0, -0.7]}>
        <cylinderGeometry args={[0.018, 0.012, 0.54, 7]} /><meshStandardMaterial color={liquidColor} transparent opacity={0.82} emissive={liquidColor} emissiveIntensity={0.06} />
      </mesh>
      <mesh ref={secondStream} visible={false} position={[0.45, 0.11, 0.06]} rotation={[0, 0, -0.72]}>
        <cylinderGeometry args={[0.017, 0.011, 0.3, 7]} /><meshStandardMaterial color={liquidColor} transparent opacity={0.82} emissive={liquidColor} emissiveIntensity={0.06} />
      </mesh>
      {[0, 1, 2].map((index) => <mesh key={index} position={[0.58 + index * 0.05, 0.28 + index * 0.18, 0.06]} scale={0.8 - index * 0.16}>
        <sphereGeometry args={[0.055, 8, 8]} /><meshBasicMaterial color="#f7f4ec" transparent opacity={ritual === "serving" || ritual === "complete" ? 0.22 : 0} />
      </mesh>)}
    </group>
  );
}
