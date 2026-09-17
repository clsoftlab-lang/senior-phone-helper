// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// server/worker.js — Cloudflare Workers variant of the 도전 (도움전화) AI proxy.
//
// Same task routing + model / prompt-caching rules as server/index.mjs, but
// runs on Cloudflare's free tier — no server to babysit (무인). It calls the
// Anthropic REST API directly and returns Claude's plain text.
//
// The API key is NEVER in the browser or the repo. It lives only as a Worker
// secret:   wrangler secret put ANTHROPIC_API_KEY
//
// Deploy (see server/README.md):
//   npm i -g wrangler
//   wrangler secret put ANTHROPIC_API_KEY
//   wrangler deploy
//
// Point the front-end at the deployed URL in ../ai/config.js:
//   export const AI_ENDPOINT = "https://<your-worker>.workers.dev/api/ai";

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

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

const MAX_TOKENS = { help: 700, sms_draft: 500, daily: 500 };
const DEFAULT_MAX_TOKENS = 700;

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

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': (env && env.ALLOWED_ORIGIN) || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(env);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // Cost-first default; raise via the AI_MODEL var for higher quality.
    const MODEL = (env && env.AI_MODEL) || 'claude-haiku-4-5';
    const EFFORT = (env && env.AI_EFFORT) || 'low';
    const IS_HAIKU = MODEL.startsWith('claude-haiku');

    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, model: MODEL }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (request.method !== 'POST' || url.pathname !== '/api/ai') {
      return new Response(JSON.stringify({ error: 'not found' }), {
        status: 404, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (!env || !env.ANTHROPIC_API_KEY) {
      // No key configured → tell the browser to use its offline mock.
      return new Response(JSON.stringify({ fallback: true, reason: 'no-key' }), {
        status: 429, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'invalid JSON body' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { task, payload } = body || {};
    const system = SYSTEM[task] || SYSTEM.help;
    const messages = buildMessages(task, payload);
    const max_tokens = MAX_TOKENS[task] || DEFAULT_MAX_TOKENS;

    // Prompt caching on the stable per-task system prompt (cheaper repeat calls).
    const payloadOut = {
      model: MODEL,
      max_tokens,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages,
    };
    // Thinking/effort only for models that accept it (NOT Haiku 4.5).
    if (!IS_HAIKU) {
      payloadOut.thinking = { type: 'adaptive' };
      payloadOut.output_config = { effort: EFFORT };
    }

    try {
      const upstream = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify(payloadOut),
      });

      if (!upstream.ok) {
        // Upstream error → let the browser fall back to the mock.
        return new Response(JSON.stringify({ fallback: true, reason: 'upstream-error' }), {
          status: 429, headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      const data = await upstream.json();
      const text = Array.isArray(data.content)
        ? data.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
        : '';

      return new Response(text, {
        status: 200,
        headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ fallback: true, reason: 'worker-error' }), {
        status: 429, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  },
};
