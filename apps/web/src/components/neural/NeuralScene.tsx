"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, Float } from "@react-three/drei";
import { useScene } from "./SceneEngine";
import RobotIntro from "./RobotIntro";

function ChargingStation() {
  return (
    <group position={[-3.55, -1.18, 0]}>
      <mesh receiveShadow>
        <cylinderGeometry args={[0.5, 0.62, 0.14, 64]} />
        <meshStandardMaterial
          color="#071018"
          metalness={0.92}
          roughness={0.18}
        />
      </mesh>

      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.02, 64]} />
        <meshStandardMaterial
          color="#00D9FF"
          emissive="#00D9FF"
          emissiveIntensity={3.5}
        />
      </mesh>

      <pointLight
        position={[0, 0.32, 0]}
        intensity={3.4}
        distance={4}
        color="#00D9FF"
      />
    </group>
  );
}

function NeuralCore() {
  const { state } = useScene();

  const intensity =
    state === "robot-dissolve" || state === "interface-online"
      ? 3.8
      : state === "robot-charge"
      ? 2.8
      : 1.6;

  return (
    <Float speed={1.05} rotationIntensity={0.35} floatIntensity={0.42}>
      <mesh position={[0, 0.34, 0]} castShadow>
        <icosahedronGeometry args={[0.3, 2]} />
        <meshStandardMaterial
          color="#7DE3FF"
          emissive="#00D9FF"
          emissiveIntensity={intensity}
          metalness={0.82}
          roughness={0.14}
        />
      </mesh>

      <pointLight
        position={[0, 0.34, 0]}
        intensity={intensity}
        distance={5}
        color="#00D9FF"
      />
    </Float>
  );
}

function FloorGrid() {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.26, 0]}>
      <gridHelper args={[16, 32, "#0EA5E9", "#062A38"]} />
    </group>
  );
}

function EnergyPulse() {
  const { state } = useScene();

  if (
    state !== "robot-charge" &&
    state !== "robot-dissolve" &&
    state !== "interface-online"
  ) {
    return null;
  }

  return (
    <mesh position={[-1.7, -0.92, 0]}>
      <boxGeometry args={[3.6, 0.04, 0.04]} />
      <meshBasicMaterial color="#00D9FF" />
    </mesh>
  );
}

export default function NeuralScene() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <Canvas
        shadows
        camera={{ position: [0, 1.15, 5.4], fov: 32 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#02050A"]} />

        <ambientLight intensity={0.18} />

        <directionalLight
          position={[5, 7, 4]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />

        <pointLight
          position={[0, 2.1, 2]}
          intensity={2.1}
          color="#00D9FF"
        />

        <Environment preset="night" />

        <FloorGrid />
        <ChargingStation />
        <EnergyPulse />
        <NeuralCore />
        <RobotIntro />
      </Canvas>
    </div>
  );
}