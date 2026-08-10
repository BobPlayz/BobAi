"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

// Your extracted model path
const MODEL_PATH = "/models/junk-yard-robot-boy/multiclip.gltf";

export default function RobotIntro() {
  const group = useRef<THREE.Group>(null);
  const gltf = useGLTF(MODEL_PATH);

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.5;
  });

  return (
    <group
      ref={group}
      position={[0, -0.8, 0]}
      scale={2.5}
      rotation={[0, Math.PI, 0]}
    >
      <primitive object={gltf.scene} />
    </group>
  );
}

useGLTF.preload(MODEL_PATH);