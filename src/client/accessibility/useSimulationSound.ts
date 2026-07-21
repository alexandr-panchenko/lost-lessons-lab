import { useCallback, useEffect, useRef, useState } from "react";

type ToneKind = "enabled" | "success" | "try-again";
export type SimulationEffectSound = "bridge-break" | "splash" | "suspension";

function playTone(context: AudioContext, kind: ToneKind): void {
  void context
    .resume()
    .then(() => {
      if (context.state === "closed") return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime;
      const frequency =
        kind === "success" ? 660 : kind === "try-again" ? 240 : 440;
      oscillator.type = kind === "try-again" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      if (kind === "success") {
        oscillator.frequency.linearRampToValueAtTime(880, start + 0.12);
      }
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.045, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.2);
    })
    .catch(() => undefined);
}

function playEffectTone(
  context: AudioContext,
  kind: SimulationEffectSound,
): void {
  void context
    .resume()
    .then(() => {
      if (context.state === "closed") return;
      const start = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = kind === "splash" ? "sawtooth" : "triangle";
      const startFrequency =
        kind === "bridge-break" ? 150 : kind === "splash" ? 420 : 260;
      const endFrequency =
        kind === "bridge-break" ? 62 : kind === "splash" ? 95 : 190;
      const duration = kind === "splash" ? 0.42 : 0.24;
      oscillator.frequency.setValueAtTime(startFrequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(
        endFrequency,
        start + duration,
      );
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.055, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
    })
    .catch(() => undefined);
}

export function useSimulationSound(input: {
  complete: boolean;
  successful: boolean;
}): {
  muted: boolean;
  playEffect: (kind: SimulationEffectSound) => void;
  toggleSound: () => void;
} {
  const [muted, setMuted] = useState(true);
  const contextRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(true);
  const wasCompleteRef = useRef(input.complete);

  useEffect(() => {
    if (
      input.complete &&
      !wasCompleteRef.current &&
      !muted &&
      contextRef.current !== null
    ) {
      playTone(contextRef.current, input.successful ? "success" : "try-again");
    }
    wasCompleteRef.current = input.complete;
  }, [input.complete, input.successful, muted]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(
    () => () => {
      const context = contextRef.current;
      contextRef.current = null;
      if (context !== null && context.state !== "closed") void context.close();
    },
    [],
  );

  const toggleSound = useCallback(() => {
    if (!muted) {
      mutedRef.current = true;
      setMuted(true);
      return;
    }
    try {
      const context = contextRef.current ?? new AudioContext();
      contextRef.current = context;
      playTone(context, "enabled");
      mutedRef.current = false;
      setMuted(false);
    } catch {
      mutedRef.current = true;
      setMuted(true);
    }
  }, [muted]);

  const playEffect = useCallback((kind: SimulationEffectSound) => {
    if (mutedRef.current || contextRef.current === null) return;
    playEffectTone(contextRef.current, kind);
  }, []);

  return { muted, playEffect, toggleSound };
}
