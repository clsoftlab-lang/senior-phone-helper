// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// storage.js — safe localStorage wrapper (try/catch + reset).
// Everything is DEMO data only. No real PII, no real backend.

const PREFIX = 'dojeon.'; // 도전(도움전화)
const memoryFallback = new Map(); // used when localStorage is unavailable

function key(name) {
  return PREFIX + name;
}

/**
 * Read a JSON value from localStorage.
 * Falls back to an in-memory map when storage is blocked (private mode, etc.).
 */
export function load(name, fallback = null) {
  try {
    const raw = localStorage.getItem(key(name));
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[storage] load failed, using memory fallback:', err);
    return memoryFallback.has(key(name)) ? memoryFallback.get(key(name)) : fallback;
  }
}

/**
 * Persist a JSON value. Never throws; degrades to in-memory storage.
 */
export function save(name, value) {
  try {
    localStorage.setItem(key(name), JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn('[storage] save failed, using memory fallback:', err);
    memoryFallback.set(key(name), value);
    return false;
  }
}

/**
 * Remove every key this app owns. Used by the "초기화" (reset) button.
 */
export function resetAll() {
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.warn('[storage] reset failed:', err);
  }
  memoryFallback.clear();
}

/** True when real browser storage is usable (not private-mode blocked). */
export function isPersistent() {
  try {
    const t = key('__probe__');
    localStorage.setItem(t, '1');
    localStorage.removeItem(t);
    return true;
  } catch {
    return false;
  }
}
