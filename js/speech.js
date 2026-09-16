// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// speech.js — real text-to-speech using the Web Speech API (speechSynthesis).
// Guarded so the app keeps working when speech is unavailable.

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

let enabled = true; // user-controllable in settings
let pickedVoice = null;

/** Is the Web Speech API present in this browser? */
export function isSupported() {
  return !!synth && typeof window.SpeechSynthesisUtterance === 'function';
}

/** Turn voice guidance on/off (persisted by the caller). */
export function setEnabled(value) {
  enabled = !!value;
  if (!enabled) cancel();
}

export function getEnabled() {
  return enabled;
}

// Try to choose a Korean voice when the list becomes available.
function refreshVoice() {
  if (!isSupported()) return;
  const voices = synth.getVoices() || [];
  pickedVoice =
    voices.find((v) => /ko(-|_)?/i.test(v.lang)) ||
    voices.find((v) => /Korean/i.test(v.name)) ||
    null;
}

if (isSupported()) {
  refreshVoice();
  // Voice list often loads asynchronously.
  if (typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', refreshVoice);
  } else {
    synth.onvoiceschanged = refreshVoice;
  }
}

/** Stop any current or queued speech. */
export function cancel() {
  try {
    if (synth && synth.speaking) synth.cancel();
    else if (synth) synth.cancel();
  } catch {
    /* ignore */
  }
}

/**
 * Speak the given text aloud (Korean). No-op when disabled/unsupported.
 * @returns {boolean} whether speech was actually started.
 */
export function speak(text, { rate = 0.9, pitch = 1 } = {}) {
  if (!enabled || !isSupported() || !text) return false;
  try {
    cancel(); // avoid overlapping voices — one message at a time
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = 'ko-KR';
    u.rate = rate; // a little slower for clarity
    u.pitch = pitch;
    if (pickedVoice) u.voice = pickedVoice;
    synth.speak(u);
    return true;
  } catch (err) {
    console.warn('[speech] speak failed:', err);
    return false;
  }
}
