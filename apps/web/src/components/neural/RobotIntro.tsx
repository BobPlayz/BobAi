"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import { useScene } from "./SceneEngine";

const MODEL_PATH = "/models/junk-yard-robot-boy/multiclip.gltf";

export default function RobotIntro() {
  const group = useRef<THREE.Group>(null);
  const { state } = useScene();

  const gltf = useGLTF(MODEL_PATH);
  const { actions, names } = useAnimations(gltf.animations, group);

  const walkAction = useMemo(() => {
    if (!actions) return undefined;

    const preferred = names.find((n) =>
      /walk|run|move|locomotion/i.test(n)
    );

    return actions[preferred ?? names[0]];
  }, [actions, names]);

  useEffect(() => {
    if (!walkAction) return;

    walkAction.reset();
    walkAction.setLoop(THREE.LoopRepeat, Infinity);
    walkAction.fadeIn(0.25);
    walkAction.play();

    return () => {
      walkAction.fadeOut(0.2);
      walkAction.stop();
    };
  }, [walkAction]);

  useFrame((_, delta) => {
    if (!group.current) return;

    let targetX = 4.4;
    let targetY = -1.18;
    let targetScale = 1.25;
    let targetRotation = Math.PI;

    switch (state) {
      case "robot-enter":
        targetX = 4.2;
        break;

      case "robot-walk":
        targetX = -3.2;
        break;

      case "robot-charge":
        targetX = -3.55;
        break;

      case "robot-dissolve":
        targetX = -3.55;
        targetScale = 0.9;
        break;
    }

    group.current.position.x = THREE.MathUtils.damp(
      group.current.position.x,
      targetX,
      3.6,
      delta
    );

    group.current.position.y = THREE.MathUtils.damp(
      group.current.position.y,
      targetY,
      3.6,
      delta
    );

    group.current.rotation.y = THREE.MathUtils.damp(
      group.current.rotation.y,
      targetRotation,
      4,
      delta
    );

    const currentScale = group.current.scale.x;

    group.current.scale.setScalar(
      THREE.MathUtils.damp(
        currentScale,
        targetScale,
        3,
        delta
      )
    );

    if (state === "robot-charge") {
      const pulse =
        1 + Math.sin(performance.now() * 0.008) * 0.05;

      group.current.scale.setScalar(targetScale * pulse);
    }

    if (state === "robot-dissolve") {
      group.current.scale.multiplyScalar(0.992);

      group.current.position.x = THREE.MathUtils.damp(
        group.current.position.x,
        -0.4,
        0.9,
        delta
      );

      group.current.position.y = THREE.MathUtils.damp(
        group.current.position.y,
        0.1,
        0.9,
        delta
      );
    }
  });

  if (
    state !== "robot-enter" &&
    state !== "robot-walk" &&
    state !== "robot-charge" &&
    state !== "robot-dissolve"
  ) {
    return null;
  }

  return (
    <group
      ref={group}
      position={[4.4, -1.18, 0]}
      scale={1.25}
      rotation={[0, Math.PI, 0]}
    >
      <primitive object={gltf.scene} />

      {state === "robot-charge" && (
        <>
          <pointLight
            position={[0, 1.2, 0.2]}
            intensity={4}
            distance={5}
            color="#00D9FF"
          />

          <mesh position={[0, 1.05, 0.18]}>
            <sphereGeometry args={[0.12, 24, 24]} />
            <meshBasicMaterial color="#7DE3FF" />
          </mesh>
        </>
      )}
    </group>
  );
}

useGLTF.preload(MODEL_PATH);