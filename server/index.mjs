// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// server/index.mjs — optional backend proxy for 도전 (도움전화).
//
// The browser NEVER holds the API key. This tiny server keeps ANTHROPIC_API_KEY
// server-side, receives { task, payload } from the front-end, builds a
// senior-friendly Korean prompt, and streams Claude's plain-text answer back.
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
const MODEL = 'claude-opus-5';

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
    '나누세요.',
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

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, model: MODEL }));
    return;
  }

  if (req.method !== 'POST' || req.url !== '/api/ai') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }

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

  try {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    const streamed = client.messages.stream({
      model: MODEL,
      max_tokens: 2048,
      thinking: { type: 'adaptive' },
      system,
      messages,
    });
    streamed.on('text', (delta) => { res.write(delta); });
    await streamed.finalMessage();
    res.end();
  } catch (err) {
    console.error('[server] Anthropic error:', err && err.message ? err.message : err);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'upstream AI error' }));
    } else {
      res.end();
    }
  }
});

server.listen(PORT, () => {
  console.log(`[server] 도전 AI proxy listening on http://localhost:${PORT}  (model: ${MODEL})`);
});
