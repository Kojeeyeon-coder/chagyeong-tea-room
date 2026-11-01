"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TeaRoomWeather } from "@/lib/weather";

export function useAmbientSound(weather: TeaRoomWeather = "clear") {
  const [enabled, setEnabled] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);
  const melodyTimer = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (melodyTimer.current !== null) window.clearInterval(melodyTimer.current);
    melodyTimer.current = null;
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
    master.gain.exponentialRampToValueAtTime(0.075, context.currentTime + 1.8);
    master.connect(context.destination);

    const delay = context.createDelay(2);
    const delayGain = context.createGain();
    delay.delayTime.value = 0.38;
    delayGain.gain.value = 0.18;
    delay.connect(delayGain).connect(master);

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
    breezeGain.gain.value = 0.2;
    breeze.connect(filter).connect(breezeGain).connect(master);
    breeze.start();

    if (weather === "rain") {
      const rain = context.createBufferSource();
      const rainFilter = context.createBiquadFilter();
      const rainGain = context.createGain();
      rain.buffer = noiseBuffer;
      rain.loop = true;
      rainFilter.type = "bandpass";
      rainFilter.frequency.value = 1150;
      rainFilter.Q.value = 0.55;
      rainGain.gain.value = 0.42;
      rain.connect(rainFilter).connect(rainGain).connect(master);
      rain.start();
    }

    [73.42, 110].forEach((frequency, index) => {
      const tone = context.createOscillator();
      const gain = context.createGain();
      tone.type = "sine";
      tone.frequency.value = frequency;
      gain.gain.value = index === 0 ? 0.075 : 0.04;
      tone.connect(gain).connect(master);
      tone.start();
    });

    const phrases: Array<Array<number | null>> = [
      [293.66, 369.99, 440, null, 493.88, 440, 369.99, null],
      [329.63, 369.99, 493.88, 440, null, 369.99, 329.63, null],
      [293.66, 329.63, 369.99, null, 440, 493.88, 587.33, null],
      [493.88, 440, 369.99, 329.63, 293.66, null, 220, null],
    ];
    let phraseIndex = 0;
    const playPhrase = () => {
      if (context.state === "closed") return;
      const phrase = phrases[phraseIndex % phrases.length];
      phraseIndex += 1;
      const phraseStart = context.currentTime + 0.08;
      phrase.forEach((frequency, index) => {
        if (!frequency) return;
        const startAt = phraseStart + index * 0.64;
        const note = context.createOscillator();
        const overtone = context.createOscillator();
        const noteGain = context.createGain();
        const overtoneGain = context.createGain();
        const warmth = context.createBiquadFilter();
        note.type = "sine";
        overtone.type = "triangle";
        note.frequency.setValueAtTime(frequency, startAt);
        overtone.frequency.setValueAtTime(frequency * 2, startAt);
        overtoneGain.gain.value = 0.16;
        warmth.type = "lowpass";
        warmth.frequency.value = 1450;
        noteGain.gain.setValueAtTime(0.0001, startAt);
        noteGain.gain.exponentialRampToValueAtTime(0.16, startAt + 0.045);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.8);
        note.connect(noteGain);
        overtone.connect(overtoneGain).connect(noteGain);
        noteGain.connect(warmth).connect(master);
        warmth.connect(delay);
        note.start(startAt);
        overtone.start(startAt);
        note.stop(startAt + 1.9);
        overtone.stop(startAt + 1.9);
      });
    };
    playPhrase();
    melodyTimer.current = window.setInterval(playPhrase, 5_500);
    contextRef.current = context;
    await context.resume();
    setEnabled(true);
  }, [weather]);

  const toggle = useCallback(() => {
    if (enabled) stop();
    else void start();
  }, [enabled, start, stop]);

  useEffect(() => stop, [stop]);

  return { enabled, toggle };
}
