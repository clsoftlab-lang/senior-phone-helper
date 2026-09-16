// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// settings.js — accessibility settings: font scale, high-contrast, voice.
// Persisted to localStorage and applied to <html> so styles.css can react.

import { load, save } from './storage.js';
import * as speech from './speech.js';

// Font scale steps (multipliers applied to the 20px base). 200% = 2.0.
export const FONT_STEPS = [1.0, 1.25, 1.5, 1.75, 2.0];
export const FONT_LABELS = ['보통', '조금 크게', '크게', '더 크게', '아주 크게'];

const DEFAULTS = { fontIndex: 1, highContrast: false, voice: true };

let state = { ...DEFAULTS, ...(load('settings') || {}) };

function persist() {
  save('settings', state);
}

/** Apply current settings to the document + speech engine. */
export function apply() {
  const root = document.documentElement;
  const scale = FONT_STEPS[clampIndex(state.fontIndex)];
  root.style.setProperty('--font-scale', String(scale));
  root.setAttribute('data-contrast', state.highContrast ? 'high' : 'normal');
  root.setAttribute('data-voice', state.voice ? 'on' : 'off');
  speech.setEnabled(state.voice);
}

function clampIndex(i) {
  return Math.max(0, Math.min(FONT_STEPS.length - 1, i | 0));
}

export function get() {
  return { ...state };
}

export function fontLabel() {
  return FONT_LABELS[clampIndex(state.fontIndex)];
}

export function fontPercent() {
  return Math.round(FONT_STEPS[clampIndex(state.fontIndex)] * 100);
}

export function increaseFont() {
  state.fontIndex = clampIndex(state.fontIndex + 1);
  persist();
  apply();
  return state.fontIndex;
}

export function decreaseFont() {
  state.fontIndex = clampIndex(state.fontIndex - 1);
  persist();
  apply();
  return state.fontIndex;
}

export function setFontIndex(i) {
  state.fontIndex = clampIndex(i);
  persist();
  apply();
}

export function toggleContrast() {
  state.highContrast = !state.highContrast;
  persist();
  apply();
  return state.highContrast;
}

export function toggleVoice() {
  state.voice = !state.voice;
  persist();
  apply();
  return state.voice;
}

export function reset() {
  state = { ...DEFAULTS };
  persist();
  apply();
}
