// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// contacts.js — DEMO contact book. Fictional data only (no real PII).
// Seed loads from data/contacts.json once, then edits live in localStorage.

import { load, save } from './storage.js';

const STORE_KEY = 'contacts';
const PALETTE = ['#2563eb', '#db2777', '#16a34a', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04', '#dc2626'];

let cache = null;

/** Load seed JSON (only used the first time, before anything is saved). */
async function loadSeed() {
  const res = await fetch('./data/contacts.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('contacts.json load failed: ' + res.status);
  const json = await res.json();
  return Array.isArray(json.contacts) ? json.contacts : [];
}

/** Return all contacts (from storage, or seed on first run). */
export async function all() {
  if (cache) return cache;
  const stored = load(STORE_KEY, null);
  if (stored && Array.isArray(stored)) {
    cache = stored;
  } else {
    cache = await loadSeed();
    save(STORE_KEY, cache);
  }
  return cache;
}

export async function favorites() {
  const list = await all();
  return list.filter((c) => c.favorite);
}

export async function getById(id) {
  const list = await all();
  return list.find((c) => c.id === id) || null;
}

function genId() {
  return 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
}

export async function add({ name, relation, phone, favorite = true }) {
  const list = await all();
  const color = PALETTE[list.length % PALETTE.length];
  const contact = { id: genId(), name: name.trim(), relation: (relation || '').trim(), phone: phone.trim(), color, favorite: !!favorite };
  list.push(contact);
  save(STORE_KEY, list);
  return contact;
}

export async function update(id, patch) {
  const list = await all();
  const c = list.find((x) => x.id === id);
  if (!c) return null;
  Object.assign(c, patch);
  save(STORE_KEY, list);
  return c;
}

export async function remove(id) {
  let list = await all();
  list = list.filter((c) => c.id !== id);
  cache = list;
  save(STORE_KEY, list);
  return list;
}
