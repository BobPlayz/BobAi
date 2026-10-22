"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { AssistantVisualState } from "@/lib/assistantState";

export type CoreQuality = "low" | "medium" | "high";
export type CoreTheme = "light" | "dark";

/**
 * The Jarvis core as a physical object — a ceramic sphere held in brass gimbal rings, lit like a studio
 * product shot. It never glows; each state is expressed through motion:
 *   idle      — the rings drift slowly, like a desk orrery
 *   listening — the rings turn to face you and settle; the enamel bead lights up
 *   thinking  — the gimbals spin like a gyroscope
 *   speaking  — the sphere breathes with the voice
 */
type Motion = { ringSpeed: number; settle: number; breathe: number; wobble: number; bead: number };
const MOTION: Record<AssistantVisualState, Motion> = {
  idle: { ringSpeed: 0.18, settle: 0, breathe: 0, wobble: 0, bead: 0.15 },
  listening: { ringSpeed: 0.05, settle: 1, breathe: 0, wobble: 0, bead: 1 },
  thinking: { ringSpeed: 2.2, settle: 0, breathe: 0, wobble: 0.04, bead: 0.6 },
  speaking: { ringSpeed: 0.45, settle: 0.4, breathe: 1, wobble: 0, bead: 1 },
};

const SETTINGS: Record<CoreQuality, { sphere: number; ringSegments: number; shadowMap: number; dpr: [number, number]; antialias: boolean; shadows: boolean }> = {
  low: { sphere: 48, ringSegments: 96, shadowMap: 512, dpr: [1, 1], antialias: false, shadows: false },
  medium: { sphere: 72, ringSegments: 160, shadowMap: 1024, dpr: [1, 1.25], antialias: true, shadows: true },
  high: { sphere: 128, ringSegments: 256, shadowMap: 2048, dpr: [1, 1.75], antialias: true, shadows: true },
};

const ACCENT = { light: new THREE.Color("#d9381e"), dark: new THREE.Color("#f0592f") };

function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    // A procedural studio room for reflections: no HDR download, generated once on the GPU.
    const pmrem = new THREE.PMREMGenerator(gl);
    const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = texture;
    return () => { scene.environment = null; texture.dispose(); pmrem.dispose(); };
  }, [gl, scene]);
  return null;
}

function Orrery({ state, quality, theme, reducedMotion }: { state: AssistantVisualState; quality: CoreQuality; theme: CoreTheme; reducedMotion: boolean }) {
  const settings = SETTINGS[quality];
  const root = useRef<THREE.Group>(null);
  const sphere = useRef<THREE.Mesh>(null);
  const outer = useRef<THREE.Group>(null);
  const middle = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const beadMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const { invalidate } = useThree();
  const live = useRef({ ringSpeed: MOTION.idle.ringSpeed, settle: 0, breathe: 0, wobble: 0, bead: MOTION.idle.bead });
  const time = useRef(0);

  const ceramic = useMemo(() => new THREE.MeshPhysicalMaterial({ color: theme === "dark" ? "#e9e2d4" : "#f4efe6", roughness: 0.42, metalness: 0, clearcoat: 0.65, clearcoatRoughness: 0.28, sheen: 0.4, sheenColor: new THREE.Color("#fff3df") }), [theme]);
  const brass = useMemo(() => new THREE.MeshStandardMaterial({ color: "#b48a4c", metalness: 1, roughness: 0.32 }), []);
  const darkMetal = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2a2620", metalness: 0.85, roughness: 0.45 }), []);
  useEffect(() => () => { ceramic.dispose(); brass.dispose(); darkMetal.dispose(); }, [ceramic, brass, darkMetal]);
  useEffect(() => { if (reducedMotion) invalidate(); }, [state, theme, reducedMotion, invalidate]);

  useFrame((frame, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const target = MOTION[state];
    const k = reducedMotion ? 1 : 1 - Math.pow(0.03, delta);
    const m = live.current;
    m.ringSpeed += (target.ringSpeed - m.ringSpeed) * k;
    m.settle += (target.settle - m.settle) * k;
    m.breathe += (target.breathe - m.breathe) * k;
    m.wobble += (target.wobble - m.wobble) * k;
    m.bead += (target.bead - m.bead) * k;
    if (beadMaterial.current) { beadMaterial.current.emissiveIntensity = 0.15 + m.bead * 1.4; beadMaterial.current.color.copy(ACCENT[theme]); beadMaterial.current.emissive.copy(ACCENT[theme]); }
    if (reducedMotion) return;
    time.current += delta;
    const t = time.current;
    // Each gimbal turns on its own axis; "settle" eases them toward a calm, camera-facing pose.
    const spin = delta * m.ringSpeed;
    const ease = (group: THREE.Group | null, axis: "x" | "y" | "z", rate: number, rest: number) => {
      if (!group) return;
      group.rotation[axis] += spin * rate;
      group.rotation[axis] += (rest - wrap(group.rotation[axis])) * m.settle * k * 0.5;
    };
    ease(outer.current, "y", 1, 0);
    ease(middle.current, "x", 1.35, 0.35);
    ease(inner.current, "z", -1.8, 0);
    if (sphere.current) {
      const voice = m.breathe * (0.028 * Math.sin(t * 9.5) + 0.018 * Math.sin(t * 15.3 + 1.2) + 0.012 * Math.sin(t * 4.1));
      sphere.current.scale.setScalar(1 + Math.max(0, voice));
      sphere.current.rotation.y += delta * 0.12;
    }
    if (root.current) {
      const pointer = frame.pointer;
      root.current.rotation.y += ((pointer.x * 0.28) - root.current.rotation.y) * 0.05;
      root.current.rotation.x += ((-pointer.y * 0.16 + Math.sin(t * 7) * m.wobble) - root.current.rotation.x) * 0.06;
      root.current.position.y = Math.sin(t * 0.8) * 0.04;
    }
  });

  return (
    <group ref={root}>
      <mesh ref={sphere} material={ceramic} castShadow receiveShadow>
        <sphereGeometry args={[0.78, settings.sphere, Math.round(settings.sphere * 0.75)]} />
      </mesh>
      {/* Gimbal: outer ring (Y axis) holds the middle ring (X axis), which holds the inner ring (Z axis). */}
      <group ref={outer} rotation={[0.18, 0.4, 0]}>
        <mesh material={brass} castShadow>
          <torusGeometry args={[1.42, 0.028, 20, settings.ringSegments]} />
        </mesh>
        {[0, Math.PI].map((angle) => (
          <mesh key={angle} material={darkMetal} position={[Math.cos(angle) * 1.42, 0, Math.sin(angle) * 0]} castShadow>
            <sphereGeometry args={[0.05, 16, 12]} />
          </mesh>
        ))}
        <group ref={middle} rotation={[0.35, 0, 0]}>
          <mesh material={brass} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[1.18, 0.022, 18, settings.ringSegments]} />
          </mesh>
          <mesh position={[0, 0, 1.18]} castShadow>
            <sphereGeometry args={[0.065, 24, 18]} />
            <meshStandardMaterial ref={beadMaterial} color={ACCENT[theme]} emissive={ACCENT[theme]} emissiveIntensity={0.2} roughness={0.25} metalness={0.1} />
          </mesh>
          <group ref={inner}>
            <mesh material={darkMetal} rotation={[0, Math.PI / 2, 0]} castShadow>
              <torusGeometry args={[0.98, 0.012, 12, settings.ringSegments]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

function wrap(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** Reports a rolling frame rate; the stage uses it to step quality down. */
function FrameMonitor({ onFps }: { onFps: (fps: number) => void }) {
  const frames = useRef(0);
  const since = useRef(0);
  useFrame((state) => {
    frames.current += 1;
    const now = state.clock.elapsedTime;
    if (!since.current) since.current = now;
    if (now - since.current >= 1) { onFps(frames.current / (now - since.current)); frames.current = 0; since.current = now; }
  });
  return null;
}

export default function JarvisCoreScene({ state, quality, theme, reducedMotion, onFps }: { state: AssistantVisualState; quality: CoreQuality; theme: CoreTheme; reducedMotion: boolean; onFps: (fps: number) => void }) {
  const settings = SETTINGS[quality];
  return (
    <Canvas
      dpr={settings.dpr}
      shadows={settings.shadows ? "soft" : false}
      frameloop={reducedMotion ? "demand" : "always"}
      camera={{ position: [0, 0.35, 5.4], fov: 36 }}
      gl={{ antialias: settings.antialias, alpha: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: theme === "dark" ? 1.05 : 1.15 }}
      aria-hidden="true"
    >
      <Environment />
      <hemisphereLight args={[theme === "dark" ? "#fff2dc" : "#fffaf0", theme === "dark" ? "#1a1814" : "#d9cfbd", 0.55]} />
      <directionalLight position={[-3.2, 4.5, 3]} intensity={2.2} color="#fff4e2" castShadow={settings.shadows} shadow-mapSize-width={settings.shadowMap} shadow-mapSize-height={settings.shadowMap} shadow-camera-near={1} shadow-camera-far={14} shadow-camera-left={-3} shadow-camera-right={3} shadow-camera-top={3} shadow-camera-bottom={-3} shadow-bias={-0.0004} shadow-radius={6} />
      <directionalLight position={[3.5, 1, -2.5]} intensity={0.7} color="#ffd9b0" />
      <Orrery state={state} quality={quality} theme={theme} reducedMotion={reducedMotion} />
      {/* A paper "table" that only shows the object's shadow. */}
      {settings.shadows && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.72, 0]} receiveShadow>
          <planeGeometry args={[12, 12]} />
          <shadowMaterial transparent opacity={theme === "dark" ? 0.45 : 0.16} />
        </mesh>
      )}
      {!reducedMotion && <FrameMonitor onFps={onFps} />}
    </Canvas>
  );
}
