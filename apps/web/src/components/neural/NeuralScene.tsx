"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, Float } from "@react-three/drei";
import RobotIntro from "./RobotIntro";

function ChargingStation() {
  return (
    <group position={[-3.4, -1.05, 0]}>
      <mesh receiveShadow>
        <cylinderGeometry args={[0.5, 0.6, 0.14, 64]} />
        <meshStandardMaterial
          color="#071018"
          metalness={0.9}
          roughness={0.2}
        />
      </mesh>

      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.02, 64]} />
        <meshStandardMaterial
          color="#00D9FF"
          emissive="#00D9FF"
          emissiveIntensity={3}
        />
      </mesh>
    </group>
  );
}

function NeuralCore() {
  return (
    <Float speed={1.1} rotationIntensity={0.3} floatIntensity={0.45}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <icosahedronGeometry args={[0.3, 2]} />
        <meshStandardMaterial
          color="#7DE3FF"
          emissive="#00D9FF"
          emissiveIntensity={3}
          metalness={0.8}
          roughness={0.15}
        />
      </mesh>
    </Float>
  );
}

function FloorGrid() {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.22, 0]}>
      <gridHelper args={[14, 28, "#0EA5E9", "#083344"]} />
    </group>
  );
}

export default function NeuralScene() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <Canvas
        shadows
        camera={{ position: [0, 1.1, 5.2], fov: 34 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#02050A"]} />

        <ambientLight intensity={0.22} />

        <directionalLight
          position={[5, 6, 4]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />

        <pointLight
          position={[0, 2, 2]}
          intensity={2.2}
          color="#00D9FF"
        />

        <Environment preset="night" />

        <FloorGrid />
        <ChargingStation />
        <NeuralCore />

        {/* Robot is intentionally oversized so it is clearly visible */}
        <RobotIntro />
      </Canvas>
    </div>
  );
}