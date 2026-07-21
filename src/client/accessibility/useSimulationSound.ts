import { useCallback, useEffect, useRef, useState } from "react";

type ToneKind = "enabled" | "success" | "try-again";

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

export function useSimulationSound(input: {
  complete: boolean;
  successful: boolean;
}): {
  muted: boolean;
  toggleSound: () => void;
} {
  const [muted, setMuted] = useState(true);
  const contextRef = useRef<AudioContext | null>(null);
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
      setMuted(true);
      return;
    }
    try {
      const context = contextRef.current ?? new AudioContext();
      contextRef.current = context;
      playTone(context, "enabled");
      setMuted(false);
    } catch {
      setMuted(true);
    }
  }, [muted]);

  return { muted, toggleSound };
}
