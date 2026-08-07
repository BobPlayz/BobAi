"use client";

import { useRef, useState } from "react";

export function useGeneration() {
  const controller = useRef<AbortController | null>(null);
  const [generating, setGenerating] = useState(false);

  function start() {
    controller.current = new AbortController();
    setGenerating(true);
    return controller.current.signal;
  }

  function stop() {
    controller.current?.abort();
    controller.current = null;
    setGenerating(false);
  }

  function finish() {
    controller.current = null;
    setGenerating(false);
  }

  return {
    generating,
    start,
    stop,
    finish,
  };
}