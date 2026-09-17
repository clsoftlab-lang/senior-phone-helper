// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// server/index.mjs — optional backend proxy for 도전 (도움전화).
//
// The browser NEVER holds the API key. This tiny server keeps ANTHROPIC_API_KEY
// server-side, receives { task, payload } from the front-end, builds a
// senior-friendly Korean prompt, and streams Claude's plain-text answer back.
//
// 고도화 (cost-efficient · autonomous · real AI):
//   • Cost-first default model claude-haiku-4-5 (override with AI_MODEL).
//   • Prompt caching on the stable per-task system prompt (cheaper repeat calls).
//   • Modest per-task max_tokens output caps.
//   • Cost guardrails: per-IP rate limit + monthly token budget → HTTP 429
//     {fallback:true} when exceeded, so the front-end auto-falls back to the mock.
//
// Run:
//   cp .env.example .env      # then paste your key into .env
//   npm install
//   npm start                 # listens on PORT (default 8787)
//
// Then set AI_ENDPOINT in ../ai/config.js to  http://localhost:8787/api/ai

import http from 'node:http';
import Anthropic from '@anthropic-ai/sdk';

const PORT = Number(process.env.PORT) || 8787;

// Cost-first default. Raise to `claude-sonnet-5` or `claude-opus-5` for higher
// quality (and higher cost) via the AI_MODEL environment variable.
const MODEL = process.env.AI_MODEL || 'claude-haiku-4-5';
const EFFORT = process.env.AI_EFFORT || 'low';

// Haiku 4.5 does not accept adaptive thinking / effort — sending them 400s.
const IS_HAIKU = MODEL.startsWith('claude-haiku');

// Per-task output caps. Modest by default (~700); only raised where a task
// genuinely needs more room. Senior answers are short and warm anyway.
const MAX_TOKENS = { help: 700, sms_draft: 500, daily: 500 };
const DEFAULT_MAX_TOKENS = 700;

// Cost guardrails.
const RATE_LIMIT = Number(process.env.AI_RATE_LIMIT) || 20;        // requests / minute / IP
const MONTHLY_TOKEN_CAP = Number(process.env.AI_MONTHLY_TOKEN_CAP) || 2_000_000;

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('[server] ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.');
  console.error('[server] (The DEMO front-end works without this server via the local MockProvider.)');
  process.exit(1);
}

const client = new Anthropic({ apiKey });

// Senior-friendly system prompts per task. Always plain, warm, large-print
// Korean; short sentences; no jargon; safe (defer emergencies to 119).
const SYSTEM = {
  help:
    '당신은 어르신을 돕는 아주 친절한 한국어 도우미입니다. 휴대폰 사용법 질문에 ' +
    '쉽고 짧은 문장으로, 한 단계씩 번호를 붙여 설명하세요. 어려운 용어는 쓰지 말고, ' +
    '큰 글씨로 읽어드릴 것을 생각해 천천히 안내하세요. 위급한 상황이면 119에 전화하도록 ' +
    '먼저 안내하세요.',
  sms_draft:
    '당신은 어르신을 돕는 한국어 문자 작성 도우미입니다. 사용자가 말한 짧은 뜻을 바탕으로 ' +
    '정중하고 따뜻한 한국어 문자 초안 하나만 만들어 주세요. 3~4문장, 존댓말, 이모지 없이. ' +
    '설명은 덧붙이지 말고 문자 본문만 출력하세요.',
  daily:
    '당신은 어르신을 돕는 한국어 비서입니다. 오늘 날짜와 알림을 바탕으로 짧고 따뜻한 ' +
    '오늘 안내를 만들어 주세요. 큰 글씨로 읽기 쉽게, 짧은 문장으로. 항목은 줄바꿈으로 ' +
    '나누세요. 날씨는 알 수 없으니 날씨 이야기는 하지 말고, 물 자주 마시기·가벼운 산책 ' +
    '같은 날씨와 무관한 건강 팁을 한 가지만 부드럽게 덧붙이세요.',
};

function buildMessages(task, payload) {
  const p = payload || {};
  if (task === 'help') {
    return [{ role: 'user', content: `질문: ${p.question || '휴대폰 사용법을 알려주세요.'}` }];
  }
  if (task === 'sms_draft') {
    const to = p.to ? `받는 사람: ${p.to}\n` : '';
    return [{ role: 'user', content: `${to}전하고 싶은 뜻: ${p.intent || '안부 인사'}` }];
  }
  if (task === 'daily') {
    const reminders = Array.isArray(p.reminders) && p.reminders.length
      ? p.reminders.map((r) => `- ${r}`).join('\n')
      : '- 특별한 일정 없음';
    return [{ role: 'user', content: `오늘 날짜: ${p.date || ''} ${p.day || ''}\n알림:\n${reminders}` }];
  }
  return [{ role: 'user', content: String((payload && payload.question) || '무엇을 도와드릴까요?') }];
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e6) { reject(new Error('payload too large')); req.destroy(); }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/* --------------------------------------------------------- cost guardrails */

// Simple in-memory per-IP rate limit (fixed 60s window). Good enough for a
// single small instance; a real fleet would use a shared store.
const hits = new Map(); // ip -> { count, windowStart }
function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.windowStart >= 60_000) {
    hits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  rec.count += 1;
  return rec.count > RATE_LIMIT;
}

// In-memory monthly token budget. Resets when the calendar month changes.
let monthlyTokens = 0;
let budgetMonth = new Date().getUTCMonth();
function budgetExceeded() {
  const m = new Date().getUTCMonth();
  if (m !== budgetMonth) { budgetMonth = m; monthlyTokens = 0; }
  return monthlyTokens >= MONTHLY_TOKEN_CAP;
}
function addUsage(usage) {
  if (!usage) return;
  monthlyTokens +=
    (usage.input_tokens || 0) +
    (usage.output_tokens || 0) +
    (usage.cache_creation_input_tokens || 0) +
    (usage.cache_read_input_tokens || 0);
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function sendFallback(res, reason) {
  console.warn('[server] guardrail →', reason, '(responding 429 {fallback:true})');
  res.writeHead(429, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ fallback: true, reason }));
}

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, model: MODEL, monthlyTokens, monthlyCap: MONTHLY_TOKEN_CAP }));
    return;
  }

  if (req.method !== 'POST' || req.url !== '/api/ai') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }

  // Cost guardrails (before touching the paid API). On limit → 429 {fallback:true}
  // so the browser silently uses its offline mock and never breaks (무인).
  if (rateLimited(clientIp(req))) { sendFallback(res, 'rate-limit'); return; }
  if (budgetExceeded()) { sendFallback(res, 'monthly-token-cap'); return; }

  let body;
  try {
    body = JSON.parse((await readBody(req)) || '{}');
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid JSON body' }));
    return;
  }

  const { task, payload } = body;
  const system = SYSTEM[task] || SYSTEM.help;
  const messages = buildMessages(task, payload);
  const max_tokens = MAX_TOKENS[task] || DEFAULT_MAX_TOKENS;

  // Prompt caching: send the stable per-task system prompt as a cacheable block
  // so repeated calls read the cache and cost less.
  const request = {
    model: MODEL,
    max_tokens,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages,
  };
  // Thinking/effort only for models that accept it (NOT Haiku 4.5).
  if (!IS_HAIKU) {
    request.thinking = { type: 'adaptive' };
    request.output_config = { effort: EFFORT };
  }

  try {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    const streamed = client.messages.stream(request);
    streamed.on('text', (delta) => { res.write(delta); });
    const finalMessage = await streamed.finalMessage();
    addUsage(finalMessage && finalMessage.usage); // accumulate toward the monthly cap
    res.end();
  } catch (err) {
    console.error('[server] Anthropic error:', err && err.message ? err.message : err);
    if (!res.headersSent) {
      // Let the browser fall back to the mock instead of showing a hard error.
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ fallback: true, reason: 'upstream-error' }));
    } else {
      res.end();
    }
  }
});

server.listen(PORT, () => {
  console.log(`[server] 도전 AI proxy on http://localhost:${PORT}  (model: ${MODEL}, cap: ${MONTHLY_TOKEN_CAP} tok/mo)`);
});
