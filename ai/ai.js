// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// ai/ai.js — pluggable AI layer for 도전 (도움전화).
//
//   askAI(task, payload, { onToken })  →  Promise<string>
//
// Two providers, chosen automatically by ai/config.js:
//   • AI_ENDPOINT === ""  → deterministic Korean MockProvider (DEMO, offline).
//                           Grounded in the app's own contacts / tutorials data.
//   • AI_ENDPOINT set     → POST { task, payload } to the backend proxy and
//                           stream the plain-text answer back (real Claude).
//
// The API key is NEVER read here. Real calls go through ./server which keeps
// ANTHROPIC_API_KEY server-side only.

import { AI_ENDPOINT } from './config.js';
import * as contacts from '../js/contacts.js';

/** Supported tasks. Kept as constants so callers and the server agree. */
export const AI_TASKS = Object.freeze({
  HELP: 'help',        // 쉬운 도우미 챗봇 — plain-language "how do I…" answers
  SMS_DRAFT: 'sms_draft', // 말로 문자 초안 만들기 — intent → polite SMS draft
  DAILY: 'daily',      // 오늘 안내 — large-text daily summary
});

/**
 * Ask the AI layer a question.
 * @param {string} task one of AI_TASKS
 * @param {object} payload task-specific input
 * @param {{onToken?:(chunk:string)=>void}} [opts] streaming callback
 * @returns {Promise<string>} the full answer text
 */
export async function askAI(task, payload = {}, { onToken } = {}) {
  const endpoint = (AI_ENDPOINT || '').trim();
  if (!endpoint) {
    return mockProvider(task, payload, onToken);
  }
  return remoteProvider(endpoint, task, payload, onToken);
}

/* ------------------------------------------------------- remote (real) */

// POST to the backend proxy and stream the response body as plain-text chunks.
// AUTO-FALLBACK to the offline mock on ANY problem — network error, non-OK
// status, a 429 {fallback:true} cost-guardrail response, or a missing body — so
// the app never breaks and keeps running unmanned (무인). Streaming via onToken
// is preserved on both the real and the fallback paths.
async function remoteProvider(endpoint, task, payload, onToken) {
  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, payload }),
    });
  } catch (err) {
    console.error('[ai] network error, falling back to mock:', err);
    return mockProvider(task, payload, onToken);
  }
  // 429 {fallback:true} (rate limit / monthly token cap / upstream error) or any
  // other non-OK status → quietly use the mock instead of showing an error.
  if (!res.ok || !res.body) {
    console.warn('[ai] backend returned', res.status, '- falling back to mock');
    return mockProvider(task, payload, onToken);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (chunk) {
      full += chunk;
      if (onToken) onToken(chunk);
    }
  }
  const tail = decoder.decode();
  if (tail) { full += tail; if (onToken) onToken(tail); }
  return full;
}

/* --------------------------------------------------- mock (demo, offline) */

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Emit the finished text as small chunks so the UI shows a live "typing"
// effect identical to the real streaming path.
async function stream(text, onToken) {
  if (!onToken) return text;
  const words = String(text).split(/(\s+)/); // keep whitespace
  for (const w of words) {
    onToken(w);
    // Keep it snappy but visibly progressive; short pause per token.
    await delay(18);
  }
  return text;
}

let tutorialsCache = null;
async function getTutorials() {
  if (tutorialsCache) return tutorialsCache;
  try {
    const res = await fetch('./data/tutorials.json', { cache: 'no-store' });
    tutorialsCache = (await res.json()).tutorials || [];
  } catch {
    tutorialsCache = [];
  }
  return tutorialsCache;
}

async function mockProvider(task, payload, onToken) {
  let text;
  switch (task) {
    case AI_TASKS.HELP: text = await mockHelp(payload); break;
    case AI_TASKS.SMS_DRAFT: text = await mockSmsDraft(payload); break;
    case AI_TASKS.DAILY: text = await mockDaily(payload); break;
    default: text = '무엇을 도와드릴까요? 궁금한 것을 크게 말씀하거나 적어 주세요.';
  }
  return stream(text, onToken);
}

// (1) 쉬운 도우미 챗봇 — match the question to a tutorial and explain simply.
async function mockHelp(payload) {
  const q = String(payload && payload.question || '').trim();
  if (!q) return '무엇이 궁금하세요? 예를 들어 "문자 보내는 법", "사진 찍는 법" 처럼 물어보세요.';

  const tutorials = await getTutorials();
  const hit = matchTutorial(q, tutorials);

  if (hit) {
    const steps = hit.steps
      .map((s, i) => `${i + 1}. ${s.title} — ${s.body}`)
      .join('\n');
    return [
      `${hit.title}, 어렵지 않아요. 천천히 따라 해 보세요.`,
      '',
      steps,
      '',
      '한 단계씩 하시면 됩니다. 헷갈리면 "사용법" 화면에서 큰 그림으로 다시 볼 수 있어요.',
    ].join('\n');
  }

  // Generic, reassuring fallback grounded in the app's own tutorial list.
  const topics = tutorials.map((t) => `• ${t.title}`).join('\n');
  return [
    '제가 도와드릴게요. 지금은 아래 내용을 쉽게 알려드릴 수 있어요:',
    '',
    topics || '• 문자 보내기\n• 사진 찍기\n• 와이파이 연결',
    '',
    '이 중에서 궁금한 것을 눌러 물어보시면 한 단계씩 알려드릴게요.',
    '급한 일이면 아래 "긴급" 단추를 누르거나 119에 전화하세요.',
  ].join('\n');
}

function matchTutorial(q, tutorials) {
  const text = q.toLowerCase();
  // keyword → tutorial id hints
  const hints = [
    ['문자|메시지|sms|톡 말고 문자', 'sms'],
    ['사진|카메라|찍', 'camera'],
    ['와이파이|wifi|인터넷|무선', 'wifi'],
    ['카카오|카톡|kakao', 'kakao'],
    ['소리|볼륨|음량|크게 안|작게', 'volume'],
  ];
  for (const [pat, id] of hints) {
    if (new RegExp(pat, 'i').test(text)) {
      const t = tutorials.find((x) => x.id === id);
      if (t) return t;
    }
  }
  // title substring match as a second pass
  return tutorials.find((t) => text.includes(String(t.title).replace(/\s+/g, '').toLowerCase().slice(0, 2))) || null;
}

// (2) 말로 문자 초안 만들기 — turn a short intent into a polite SMS draft.
async function mockSmsDraft(payload) {
  const intent = String(payload && payload.intent || '').trim();
  let to = String(payload && payload.to || '').trim();

  // Ground the greeting in a real contact when a name is given (or a favorite).
  if (!to) {
    try {
      const favs = await contacts.favorites();
      if (favs && favs.length) to = favs[0].name;
    } catch { /* ignore */ }
  }
  const hello = to ? `${to}에게,` : '안녕하세요,';

  if (!intent) {
    return `${hello}\n잘 지내고 있어요. 목소리 듣고 싶어서 연락했어요. 시간 될 때 전화 한 통 주세요. 사랑해요.`;
  }

  const body = draftBody(intent);
  return `${hello}\n${body}\n\n— 보내기 전에 한 번 읽어 보시고, 마음에 들면 아래 "이 내용으로 문자 보내기"를 누르세요.`;
}

function draftBody(intent) {
  const t = intent.toLowerCase();
  if (/저녁|밥|식사|점심/.test(t)) return '오늘 저녁 같이 먹을까 해서 연락했어요. 시간 괜찮으면 알려줘요. 기다릴게요.';
  if (/병원|아프|몸|약/.test(t)) return '몸이 조금 안 좋아서 병원에 다녀오려고 해요. 걱정 말아요. 다녀와서 다시 연락할게요.';
  if (/고마|감사/.test(t)) return '지난번에 도와줘서 정말 고마웠어요. 덕분에 큰 힘이 되었어요. 늘 고맙게 생각해요.';
  if (/늦|못 가|못가|미안/.test(t)) return '조금 늦을 것 같아요. 미안해요. 도착하면 바로 연락할게요. 먼저 시작하고 있어요.';
  if (/안부|잘 지|보고 싶|보고싶/.test(t)) return '잘 지내고 있는지 궁금해서 연락했어요. 보고 싶어요. 시간 날 때 얼굴 한번 봐요.';
  if (/생일|축하/.test(t)) return '생일 진심으로 축하해요. 건강하고 좋은 일만 가득하길 바라요. 곧 얼굴 봐요.';
  // Generic: wrap the intent politely.
  return `${intent}. 이 이야기를 전하고 싶었어요. 시간 될 때 답 주세요. 고마워요.`;
}

// (3) 오늘 안내 — simple, large-text daily summary (date + reminders).
async function mockDaily(payload) {
  const p = payload || {};
  const dateStr = String(p.date || new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }));
  const dayStr = String(p.day || new Date().toLocaleDateString('ko-KR', { weekday: 'long' }));

  const reminders = Array.isArray(p.reminders) ? p.reminders.filter(Boolean) : [];

  // Ground a friendly suggestion in a real favorite contact.
  let callSuggest = '';
  try {
    const favs = await contacts.favorites();
    if (favs && favs.length) {
      const who = favs[0];
      callSuggest = `오늘 ${who.name} ${who.relation ? '(' + who.relation + ')' : ''} 님께 안부 전화 한 통 어떠세요?`;
    }
  } catch { /* ignore */ }

  const lines = [
    `오늘은 ${dateStr} ${dayStr} 이에요.`,
    '',
    '오늘의 안내입니다:',
  ];
  if (reminders.length) {
    reminders.forEach((r) => lines.push(`• ${r}`));
  } else {
    lines.push('• 특별한 일정은 없어요. 편안한 하루 보내세요.');
  }
  if (callSuggest) { lines.push(''); lines.push(callSuggest); }

  // A gentle, weather-agnostic health tip. Rotates by day so it feels fresh but
  // stays deterministic (works offline, no network, no weather lookup).
  const tips = [
    '물을 자주 조금씩 드세요. 몸이 가벼워져요.',
    '집 안에서 가볍게 몇 걸음 걸어 보세요. 다리에 힘이 생겨요.',
    '어깨와 목을 천천히 돌려 주세요. 몸이 편안해져요.',
    '창가에서 잠시 밝은 빛을 쬐어 보세요. 기분이 좋아져요.',
    '식사는 거르지 말고 천천히 꼭꼭 씹어 드세요.',
    '오늘 약이 있으면 잊지 말고 챙겨 드세요.',
    '깊게 숨을 한 번 크게 들이쉬고 내쉬어 보세요.',
  ];
  const tip = tips[new Date().getDay() % tips.length];
  lines.push('');
  lines.push(`오늘의 건강 팁: ${tip}`);
  lines.push('');
  lines.push('오늘도 좋은 하루 되세요. 도움이 필요하면 언제든 저를 불러 주세요.');
  return lines.join('\n');
}
