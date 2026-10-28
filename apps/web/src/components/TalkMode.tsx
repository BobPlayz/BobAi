"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Mic, Minus, X } from "lucide-react";
import { setAssistantActivity } from "@/lib/assistantState";
import { audioUrl, browserRecognition, getVoiceAvailability, speakable, speechLocale, synthesizeSpeech, toPcm16Wav, transcribeAudio, type BrowserRecognition } from "@/lib/voice";

/**
 * Talk mode: a hands-free voice conversation. Jarvis listens, notices when you stop talking, answers through the
 * normal chat (so the conversation shows up in the chat too), says the answer out loud, then listens again.
 * Hearing uses Jarvis's server (ElevenLabs or Whisper) when available, else the browser's speech recognition;
 * speaking uses the server voice (ElevenLabs or Piper) when available, else the browser's built-in voice.
 */

type Phase = "starting" | "listening" | "thinking" | "speaking" | "error";
type Props = { language: string; onUtterance: (text: string) => Promise<string | null>; onClose: () => void; minimized?: boolean; onMinimize?: () => void; onExpand?: () => void; /** Cancels the answer being worked out (you started talking again). */ onCancel?: () => void };

const SILENCE_MS = 7_000;
const NO_SPEECH_MS = 10_000;
const MAX_TURN_MS = 30_000;

const LABEL: Record<Phase, string> = { starting: "Getting ready…", listening: "Listening…", thinking: "Thinking…", speaking: "Talking · tap to interrupt", error: "Paused" };

export default function TalkMode({ language, onUtterance, onClose, minimized = false, onMinimize, onExpand, onCancel }: Props) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [level, setLevel] = useState(0);
  const [browserVoice, setBrowserVoice] = useState(false);
  const session = useRef(0);
  const turnRef = useRef(0);
  const noiseFloor = useRef(0.01);
  const utter = useRef(onUtterance);
  const closeButton = useRef<HTMLButtonElement>(null);
  const res = useRef<{ stream?: MediaStream; context?: AudioContext; analyser?: AnalyserNode; recognition?: BrowserRecognition; audio?: HTMLAudioElement; timer?: number; finishListening?: () => void; stopSpeaking?: () => void }>({});
  const engines = useRef<{ hear: "server" | "browser"; speak: "server" | "browser" | "none" }>({ hear: "browser", speak: "browser" });

  useEffect(() => { utter.current = onUtterance; }, [onUtterance]);

  function release() {
    const r = res.current;
    window.clearInterval(r.timer);
    r.recognition?.abort();
    r.stopSpeaking?.();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    r.stream?.getTracks().forEach((track) => track.stop());
    void r.context?.close().catch(() => undefined);
    res.current = {};
  }

  /** Records one thing you say on the server engine: stops after a short silence, then transcribes it. */
  function listenServer(id: number) {
    return new Promise<string>((resolve, reject) => {
      const { stream, analyser } = res.current;
      if (!stream || !analyser) return reject(new Error("Microphone isn't ready."));
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      const samples = new Float32Array(analyser.fftSize);
      const started = performance.now();
      let floor = 0, calibrated = 0, spoke = false, lastVoice = 0, done = false;
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = async () => {
        if (session.current !== id) return resolve("");
        if (!spoke) return resolve("");
        try { resolve(await transcribeAudio(await toPcm16Wav(new Blob(chunks, { type: recorder.mimeType || mime || "audio/webm" })), language)); }
        catch (problem) { /^didn't catch/i.test(problem instanceof Error ? problem.message : "") ? resolve("") : reject(problem); }
      };
      const finish = () => { if (done) return; done = true; window.clearInterval(res.current.timer); setLevel(0); if (recorder.state !== "inactive") recorder.stop(); };
      res.current.finishListening = () => { spoke = spoke || chunks.length > 0 || performance.now() - started > 600; finish(); };
      recorder.start(250);
      res.current.timer = window.setInterval(() => {
        if (session.current !== id) return finish();
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) sum += sample * sample;
        const rms = Math.sqrt(sum / samples.length);
        const now = performance.now();
        // The first moment calibrates to the room's background noise.
        if (now - started < 350) { floor = (floor * calibrated + rms) / (calibrated + 1); calibrated += 1; noiseFloor.current = floor; return; }
        const threshold = Math.max(0.015, floor * 3);
        setLevel(Math.min(1, rms / (threshold * 4)));
        if (rms > threshold) { spoke = true; lastVoice = now; }
        if ((spoke && now - lastVoice > SILENCE_MS) || (!spoke && now - started > NO_SPEECH_MS) || now - started > MAX_TURN_MS) finish();
      }, 50);
    });
  }

  /** One thing you say, using the browser's own speech recognition. */
  function listenBrowser(id: number) {
    return new Promise<string>((resolve, reject) => {
      const Recognition = browserRecognition();
      if (!Recognition) return reject(new Error("This browser can't do voice chat. Try Chrome or Edge."));
      const recognition = new Recognition();
      let finalText = "";
      let lastSpeechAt = 0;
      let finished = false;
      const startedAt = performance.now();
      recognition.lang = speechLocale(language);
      recognition.continuous = true;
      recognition.interimResults = true;
      const finish = () => {
        if (finished) return;
        finished = true;
        window.clearInterval(res.current.timer);
        try { recognition.stop(); } catch { /* Recognition may already have stopped. */ }
      };
      res.current.timer = window.setInterval(() => {
        const elapsed = performance.now() - (lastSpeechAt || startedAt);
        if (lastSpeechAt ? elapsed >= SILENCE_MS : elapsed >= NO_SPEECH_MS) finish();
      }, 100);
      recognition.onresult = (event) => {
        // Rebuilt from every result each time (browsers resend earlier phrases), so words never repeat.
        let interim = "";
        finalText = "";
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) finalText += `${result[0].transcript} `; else interim += `${result[0].transcript} `;
        }
        const combined = `${finalText}${interim}`.replace(/\\s+/g, " ").trim();
        if (combined) lastSpeechAt = performance.now();
        if (session.current === id) setHeard(combined);
      };
      recognition.onerror = (event) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") reject(new Error("Mic access is blocked. Allow the microphone for this site and try again."));
        else if (event.error === "network") reject(new Error("Voice recognition needs an internet connection."));
      };
      recognition.onend = () => {
        if (finished || session.current !== id || !lastSpeechAt || performance.now() - lastSpeechAt >= SILENCE_MS) {
          window.clearInterval(res.current.timer);
          resolve(finalText.replace(/\\s+/g, " ").trim());
          return;
        }
        // Some browsers end a continuous recognition session early. Reopen it during the user's thinking pause.
        try { recognition.start(); } catch { /* Fall through if the browser won't restart recognition. */ }
      };
      res.current.recognition = recognition;
      res.current.finishListening = finish;
      recognition.start();
    });
  }

  function speakBrowser(text: string) {
    return new Promise<void>((resolve) => {
      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = speechLocale(language);
      const voice = synth.getVoices().find((item) => item.lang === utterance.lang) ?? synth.getVoices().find((item) => item.lang.startsWith(language));
      if (voice) utterance.voice = voice;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      res.current.stopSpeaking = () => { synth.cancel(); resolve(); };
      synth.cancel();
      synth.speak(utterance);
    });
  }

  function sentenceChunks(text: string): string[] {
    const clean = speakable(text).replace(/\s+/g, " ").trim();
    if (!clean) return [];
    // Keep punctuation with its sentence so each spoken chunk is also what appears on screen.
    return clean.match(/[^.!?]+[.!?]+[”’"')\]]*|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) ?? [clean];
  }

  async function speak(text: string, id: number) {
    const sentences = sentenceChunks(text);
    if (!sentences.length || engines.current.speak === "none") return;
    for (const sentence of sentences) {
      if (session.current !== id) return;
      setReply(sentence);
      if (engines.current.speak === "server") {
        try {
          const result = await synthesizeSpeech(sentence);
          if (session.current !== id) return;
          const url = audioUrl(result.audio, result.mimeType);
          const audio = new Audio(url);
          res.current.audio = audio;
          await new Promise<void>((resolve) => {
            let finished = false;
            const end = () => {
              if (finished) return;
              finished = true;
              audio.pause();
              URL.revokeObjectURL(url);
              if (res.current.audio === audio) res.current.audio = undefined;
              resolve();
            };
            audio.onended = end; audio.onerror = end;
            res.current.stopSpeaking = end;
            audio.play().catch(end);
          });
          if (session.current !== id) return;
          continue;
        } catch { /* Server voice unavailable or out of allowance: fall back to browser speech. */ }
      }
      if ("speechSynthesis" in window) await speakBrowser(sentence);
      if (session.current !== id) return;
    }
  }

  /**
   * Barge-in: watches the open mic and calls `onSpeech` once someone has been talking for about 0.3 s. The bar is
   * higher than when listening, so Jarvis's own voice leaking from the speakers doesn't interrupt it.
   */
  function watchForSpeech(id: number, onSpeech: () => void) {
    const analyser = res.current.analyser;
    if (!analyser) return () => undefined;
    const samples = new Float32Array(analyser.fftSize);
    let voiced = 0;
    const timer = window.setInterval(() => {
      if (session.current !== id) { window.clearInterval(timer); return; }
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      const rms = Math.sqrt(sum / samples.length);
      voiced = rms > Math.max(0.05, noiseFloor.current * 6) ? voiced + 50 : Math.max(0, voiced - 50);
      if (voiced >= 300) { window.clearInterval(timer); onSpeech(); }
    }, 50);
    return () => window.clearInterval(timer);
  }

  async function loop(id: number) {
    let quickEmpties = 0;
    while (session.current === id) {
      setPhase("listening"); setHeard(""); setError("");
      const listenedAt = performance.now();
      let text: string;
      try { text = engines.current.hear === "server" ? await listenServer(id) : await listenBrowser(id); }
      catch (problem) {
        if (session.current !== id) return;
        const message = problem instanceof Error ? problem.message : "Voice stopped working.";
        // Server hearing failed or its free allowance ran out: carry on with the browser's recognition if there is one.
        if (engines.current.hear === "server" && browserRecognition() && !/mic access|microphone/i.test(message)) { engines.current.hear = "browser"; setBrowserVoice(true); continue; }
        setError(message); setPhase("error"); return;
      }
      if (session.current !== id) return;
      if (!text) {
        // Recognition that keeps ending instantly (mic busy elsewhere) would spin; back off, then stop.
        quickEmpties = performance.now() - listenedAt < 1_000 ? quickEmpties + 1 : 0;
        if (quickEmpties >= 5) { setError("The mic keeps cutting out. Is another app using it?"); setPhase("error"); return; }
        await new Promise((resolve) => window.setTimeout(resolve, 150 * quickEmpties));
        continue;
      }
      quickEmpties = 0;
      setHeard(text); setReply(""); setPhase("thinking");
      // Talking again while Jarvis is still thinking cancels that answer; a late reply to an old question is ignored.
      const turn = ++turnRef.current;
      let interrupted = false;
      const stopWatching = watchForSpeech(id, () => { interrupted = true; onCancel?.(); });
      const answer = await utter.current(text);
      stopWatching();
      if (session.current !== id) return;
      if (interrupted || turn !== turnRef.current) { setReply(""); continue; }
      if (!answer?.trim()) { setReply("Hmm, I couldn't answer that one. Try again?"); continue; }
      setReply(answer); setPhase("speaking");
      // Talking over Jarvis stops the voice at once and goes straight back to listening.
      const stopBargeIn = watchForSpeech(id, () => res.current.stopSpeaking?.());
      await speak(answer, id);
      stopBargeIn();
      res.current.stopSpeaking = undefined;
    }
  }

  async function start() {
    release();
    const id = ++session.current;
    setPhase("starting"); setError(""); setReply(""); setHeard("");
    try {
      const available = await getVoiceAvailability();
      if (session.current !== id) return;
      const canRecord = typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
      // Prefer browser recognition because it can show interim words while the user is still speaking.
      const hear = browserRecognition() ? "browser" : available.speechToText && canRecord ? "server" : null;
      if (!hear) throw new Error("This browser can't do voice chat. Try Chrome, Edge or Safari.");
      const speakWith = available.textToSpeech ? "server" : "speechSynthesis" in window ? "browser" : "none";
      engines.current = { hear, speak: speakWith };
      setBrowserVoice(hear === "browser" || speakWith === "browser");
      // The mic stays open for the whole conversation (echo-cancelled) so you can talk over Jarvis to interrupt it.
      // With the browser's recognition it is only used for that; if it is refused there, tapping still interrupts.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).catch((problem: unknown) => { if (hear === "server") throw problem; return null; });
      if (stream) {
        if (session.current !== id) { stream.getTracks().forEach((track) => track.stop()); return; }
        const context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        context.createMediaStreamSource(stream).connect(analyser);
        res.current = { ...res.current, stream, context, analyser };
      }
      await loop(id);
    } catch (problem) {
      if (session.current !== id) return;
      const message = problem instanceof Error ? problem.message : "";
      setError(/denied|not allowed|permission/i.test(message) ? "Mic access is blocked. Allow the microphone for this site and try again." : message || "Voice chat couldn't start.");
      setPhase("error");
    }
  }

  useEffect(() => {
    closeButton.current?.focus();
    void start();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); session.current += 1; release(); };
    // Starts once per opening; language changes need a reopen.
  }, []);

  useEffect(() => {
    if (!minimized) closeButton.current?.focus();
  }, [minimized]);

  useEffect(() => {
    setAssistantActivity("voice-input", phase === "listening");
    setAssistantActivity("voice-output", phase === "speaking");
    return () => { setAssistantActivity("voice-input", false); setAssistantActivity("voice-output", false); };
  }, [phase]);

  function tapOrb() {
    if (phase === "speaking") res.current.stopSpeaking?.();
    else if (phase === "listening") res.current.finishListening?.();
    else if (phase === "error") void start();
  }

  const scale = phase === "listening" ? 1 + level * 0.35 : 1;
  if (minimized) {
    return (
      <div role="region" aria-label="Talk mode minimized" className="mx-auto flex w-full max-w-[820px] items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2.5 text-[var(--text)] shadow-sm">
        <span className={`size-2.5 shrink-0 rounded-full ${phase === "speaking" ? "bg-[var(--accent)] animate-pulse" : phase === "listening" ? "bg-emerald-500" : "bg-[var(--muted)]"}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Jarvis · {LABEL[phase]}</p>
          <p className="truncate text-xs text-[var(--muted)]" title={phase === "speaking" ? reply : heard || error}>{phase === "speaking" ? reply : heard || error || "Voice conversation is still running"}</p>
        </div>
        <button type="button" onClick={onExpand} aria-label="Restore talk mode" title="Restore talk mode" className="atelier-iconbtn !h-9 !w-9 shrink-0"><Maximize2 className="h-4 w-4" aria-hidden /></button>
        <button type="button" onClick={onClose} aria-label="End talk mode" title="End talk mode" className="atelier-iconbtn !h-9 !w-9 shrink-0"><X className="h-4 w-4" aria-hidden /></button>
      </div>
    );
  }
  return (
    <div role="dialog" aria-modal="true" aria-label="Talk to Jarvis" className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)] text-[var(--text)] animate-[chatEnter_250ms_ease-out_both] motion-reduce:animate-none">
      <div className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <p className="caption">Talk mode{browserVoice ? " · browser voice" : ""}</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onMinimize} aria-label="Minimize talk mode" title="Minimize and return to chat" className="atelier-iconbtn !h-11 !w-11"><Minus className="h-5 w-5" aria-hidden /></button>
          <button ref={closeButton} type="button" onClick={onClose} aria-label="End talk mode" className="atelier-iconbtn !h-11 !w-11"><X className="h-5 w-5" aria-hidden /></button>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6 text-center">
        <button
          type="button"
          onClick={tapOrb}
          aria-label={phase === "speaking" ? "Interrupt Jarvis" : phase === "listening" ? "I'm done talking" : phase === "error" ? "Try again" : LABEL[phase]}
          className="relative grid size-48 place-items-center rounded-full outline-offset-8 sm:size-56"
        >
          <span aria-hidden className={`absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff8,transparent_55%),var(--accent)] shadow-[0_30px_80px_-20px_var(--accent)] transition-transform duration-100 ${phase === "thinking" ? "animate-pulse" : ""} ${phase === "speaking" ? "animate-[dockPulse_1.1s_ease-in-out_infinite]" : ""} ${phase === "error" || phase === "starting" ? "opacity-25" : ""} motion-reduce:animate-none`} style={{ transform: `scale(${scale})` }} />
          {phase === "error" && <Mic aria-hidden className="relative h-12 w-12 text-[var(--accent)]" />}
        </button>

        <div className="min-h-40 max-w-xl space-y-4" aria-live="polite">
          <p className="font-display text-3xl">{phase === "error" ? "Tap to try again" : LABEL[phase]}</p>
          {error && <p role="alert" className="text-[var(--danger)]">{error}</p>}
          {heard && <p className="text-lg text-[var(--muted)]">&ldquo;{heard}&rdquo;</p>}
          {reply && phase !== "listening" && <p className="text-lg leading-8">{reply}</p>}
        </div>
      </div>

      <p className="caption px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center normal-case tracking-normal">Just talk. Jarvis answers when you pause. Everything also shows up in your chat.</p>
    </div>
  );
}
