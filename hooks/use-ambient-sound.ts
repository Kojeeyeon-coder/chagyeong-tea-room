"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useAmbientSound() {
  const [enabled, setEnabled] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);
  const chimeTimer = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (chimeTimer.current !== null) window.clearInterval(chimeTimer.current);
    chimeTimer.current = null;
    const context = contextRef.current;
    contextRef.current = null;
    if (context) void context.close();
    setEnabled(false);
  }, []);

  const start = useCallback(async () => {
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.07, context.currentTime + 1.8);
    master.connect(context.destination);

    const noiseBuffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    const noise = noiseBuffer.getChannelData(0);
    for (let index = 0; index < noise.length; index += 1) noise[index] = (Math.random() * 2 - 1) * 0.18;
    const breeze = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const breezeGain = context.createGain();
    breeze.buffer = noiseBuffer;
    breeze.loop = true;
    filter.type = "lowpass";
    filter.frequency.value = 520;
    breezeGain.gain.value = 0.34;
    breeze.connect(filter).connect(breezeGain).connect(master);
    breeze.start();

    [110, 164.81].forEach((frequency, index) => {
      const tone = context.createOscillator();
      const gain = context.createGain();
      tone.type = "sine";
      tone.frequency.value = frequency;
      gain.gain.value = index === 0 ? 0.11 : 0.055;
      tone.connect(gain).connect(master);
      tone.start();
    });

    const ringChime = () => {
      if (context.state === "closed") return;
      const now = context.currentTime;
      const chime = context.createOscillator();
      const chimeGain = context.createGain();
      chime.type = "sine";
      chime.frequency.value = Math.random() > 0.5 ? 659.25 : 783.99;
      chimeGain.gain.setValueAtTime(0.0001, now);
      chimeGain.gain.exponentialRampToValueAtTime(0.045, now + 0.08);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);
      chime.connect(chimeGain).connect(master);
      chime.start(now);
      chime.stop(now + 4);
    };
    chimeTimer.current = window.setInterval(ringChime, 13_000);
    contextRef.current = context;
    await context.resume();
    setEnabled(true);
  }, []);

  const toggle = useCallback(() => {
    if (enabled) stop();
    else void start();
  }, [enabled, start, stop]);

  useEffect(() => stop, [stop]);

  return { enabled, toggle };
}
