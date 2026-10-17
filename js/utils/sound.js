// Short feedback sounds, synthesized with the Web Audio API so no audio files are needed.

import { getSettings } from '../data/settings.js';

// Each note: [frequency in Hz, start offset in seconds, duration in seconds]
const SOUNDS = {
  correct: [[660, 0, 0.09], [880, 0.08, 0.16]],
  wrong: [[240, 0, 0.16], [190, 0.12, 0.22]],
  match: [[740, 0, 0.08]],
  complete: [[523, 0, 0.12], [659, 0.11, 0.12], [784, 0.22, 0.12], [1047, 0.33, 0.28]],
};

let audioContext = null;

export function playSound(name) {
  const notes = SOUNDS[name];
  if (!notes || !getSettings().soundOn) return;

  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    const start = audioContext.currentTime;

    for (const [frequency, offset, duration] of notes) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = name === 'wrong' ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;

      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.14, start + offset + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + duration);

      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + duration + 0.02);
    }
  } catch {
    // Audio is a nice-to-have; ignore browsers that block or lack it.
  }
}
