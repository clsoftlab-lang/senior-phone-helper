// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// icons.js — inline SVG icons and contact avatar placeholders.
// All icons use currentColor so they follow theme + high-contrast automatically.
// Contact photos are intentionally SVG placeholders (no real photos / PII).

const P = 'stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"';

const PATHS = {
  phone: `<path ${P} d="M6.6 3.5 9 3.9l1.2 3.6-1.8 1.4a12 12 0 0 0 5.3 5.3l1.4-1.8 3.6 1.2.4 2.4a1.8 1.8 0 0 1-1.9 2A15 15 0 0 1 4.6 5.4a1.8 1.8 0 0 1 2-1.9Z"/>`,
  envelope: `<rect ${P} x="3" y="5" width="18" height="14" rx="2"/><path ${P} d="m3.5 6.5 8.5 6 8.5-6"/>`,
  chat: `<path ${P} d="M4 5h16v11H9l-4 3v-3H4Z"/><circle cx="9" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10.5" r="1" fill="currentColor" stroke="none"/>`,
  camera: `<path ${P} d="M4 8h3l1.5-2h7L17 8h3v11H4Z"/><circle ${P} cx="12" cy="13" r="3.2"/>`,
  pill: `<rect ${P} x="4" y="9" width="16" height="6" rx="3" transform="rotate(45 12 12)"/><path ${P} d="M9.2 9.2 14.8 14.8"/>`,
  sos: `<circle ${P} cx="12" cy="12" r="9"/><path ${P} d="M12 7v6"/><circle cx="12" cy="16.3" r="1.2" fill="currentColor" stroke="none"/>`,
  gear: `<circle ${P} cx="12" cy="12" r="3"/><path ${P} d="M12 3v2.5M12 18.5V21M4.2 7l2.2 1.3M17.6 15.7 19.8 17M4.2 17l2.2-1.3M17.6 8.3 19.8 7"/>`,
  wifi: `<path ${P} d="M3 9a15 15 0 0 1 18 0M6 12.5a10 10 0 0 1 12 0M9 16a5 5 0 0 1 6 0"/><circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none"/>`,
  pencil: `<path ${P} d="M4 20l4-1 10-10-3-3L5 16Z"/><path ${P} d="M14 6l3 3"/>`,
  person: `<circle ${P} cx="12" cy="8" r="3.4"/><path ${P} d="M5.5 19a6.5 6.5 0 0 1 13 0"/>`,
  send: `<path ${P} d="M4 12 20 5l-4 15-4-6-8-2Z"/>`,
  eye: `<path ${P} d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle ${P} cx="12" cy="12" r="2.6"/>`,
  sun: `<circle ${P} cx="12" cy="12" r="4"/><path ${P} d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.5 4.5 6.3 6.3M17.7 17.7l1.8 1.8M19.5 4.5 17.7 6.3M6.3 17.7 4.5 19.5"/>`,
  power: `<path ${P} d="M12 3v8"/><path ${P} d="M7 6.5a7 7 0 1 0 10 0"/>`,
  list: `<path ${P} d="M8 7h11M8 12h11M8 17h11"/><circle cx="4.5" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="17" r="1.2" fill="currentColor" stroke="none"/>`,
  key: `<circle ${P} cx="8" cy="12" r="3.4"/><path ${P} d="M11.4 12H21l-2 2 2 2-3 2"/>`,
  sound: `<path ${P} d="M4 9v6h4l5 4V5L8 9Z"/><path ${P} d="M16 9.5a4 4 0 0 1 0 5"/>`,
  back: `<path ${P} d="M15 5 8 12l7 7"/>`,
  home: `<path ${P} d="M4 11 12 4l8 7"/><path ${P} d="M6 10v9h12v-9"/>`,
  location: `<path ${P} d="M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10Z"/><circle ${P} cx="12" cy="11" r="2.3"/>`,
  check: `<path ${P} d="M4 12.5 9.5 18 20 6"/>`,
  plus: `<path ${P} d="M12 5v14M5 12h14"/>`,
  trash: `<path ${P} d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13"/>`,
  aplus: `<path ${P} d="M4 18 8 6l4 12M5.5 14h5M16 8v8M13 12h6"/>`,
  contrast: `<circle ${P} cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none"/>`,
  speaker: `<path ${P} d="M4 9v6h4l5 4V5L8 9Z"/><path ${P} d="M16 9.5a4 4 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10"/>`,
  calendar: `<rect ${P} x="4" y="5" width="16" height="15" rx="2"/><path ${P} d="M4 9h16M8 3v4M16 3v4"/>`,
  robot: `<rect ${P} x="4" y="8" width="16" height="12" rx="3"/><path ${P} d="M12 4v4"/><circle cx="12" cy="4" r="1.3" fill="currentColor" stroke="none"/><circle cx="9.5" cy="13" r="1.2" fill="currentColor" stroke="none"/><circle cx="14.5" cy="13" r="1.2" fill="currentColor" stroke="none"/><path ${P} d="M9.5 16.5h5"/><path ${P} d="M4 12H2.5M21.5 12H20"/>`,
  mic: `<rect ${P} x="9" y="3" width="6" height="11" rx="3"/><path ${P} d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/>`,
};

/**
 * Return an inline SVG string for the given icon name.
 * @param {string} name
 * @param {number} size pixel size (default 40)
 */
export function icon(name, size = 40) {
  const body = PATHS[name] || PATHS.person;
  return `<svg class="icon" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">${body}</svg>`;
}

/**
 * Build a colored circular avatar placeholder showing the first character
 * of the contact name. No real photographs are used (privacy by design).
 * @param {string} name contact display name
 * @param {string} color hex background color
 * @param {number} size pixel diameter
 */
export function avatar(name, color = '#2563eb', size = 96) {
  const initial = (name || '?').trim().charAt(0) || '?';
  const font = Math.round(size * 0.42);
  return `<svg class="avatar" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${escapeAttr(name)} 사진 자리">
    <circle cx="50" cy="50" r="50" fill="${escapeAttr(color)}"/>
    <text x="50" y="50" dy="0.36em" text-anchor="middle" font-size="${font}" font-family="'Noto Sans KR', sans-serif" fill="#ffffff" font-weight="700">${escapeText(initial)}</text>
  </svg>`;
}

function escapeText(s) {
  return String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}
function escapeAttr(s) {
  return String(s).replace(/["&<>]/g, (c) => ({ '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
