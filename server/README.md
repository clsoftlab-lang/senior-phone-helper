<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국) -->

# 도전 (도움전화) — AI 백엔드 프록시 (AI backend proxy)

This optional Node server enables **real Claude answers** for the AI features.
The demo works **without** it (the front-end uses a local Korean MockProvider).
Its only job is to keep the **API key server-side** and stream Claude's answer to
the browser.

> **🔒 SECURITY — keys are server-side only.** The API key is read from
> `ANTHROPIC_API_KEY` (via `.env`) on the server. It is **NEVER** shipped to the
> browser, committed to the repo, or placed in `ai/config.js`. `ai/config.js`
> only holds a URL. `.env` is gitignored.

## What it does

- `POST /api/ai` with a JSON body `{ "task", "payload" }`.
- Builds a senior-friendly Korean system prompt per task
  (`help`, `sms_draft`, `daily`).
- Calls Claude (cost-first default **`claude-haiku-4-5`**, override with
  `AI_MODEL`) with streaming and pipes the text back as a plain-text stream, so
  the front-end can show a live "typing" effect and read it aloud with TTS.
- **Cost-efficient:** prompt caching on the stable per-task system prompt,
  modest per-task `max_tokens` output caps, a per-IP rate limit and a monthly
  token budget. When a limit is hit it returns **HTTP 429 `{fallback:true}`** and
  the browser silently uses its offline mock (never breaks).
- `GET /health` → `{ ok: true, model, monthlyTokens, monthlyCap }`.

## Setup

```bash
cd server
cp .env.example .env          # then paste your real key into .env
npm install                   # installs @anthropic-ai/sdk
npm start                     # loads .env, listens on http://localhost:8787
```

`npm start` uses Node's built-in `--env-file=.env` (Node 20+). If your Node is
older, export the key manually and run `npm run start:noenv`:

```bash
export ANTHROPIC_API_KEY=sk-ant-your-real-key
npm run start:noenv
```

## Point the front-end at it

Edit `../ai/config.js`:

```js
export const AI_ENDPOINT = "http://localhost:8787/api/ai";
```

Reload the app. The three AI features now use real Claude. Set `AI_ENDPOINT` back
to `""` to return to the offline MockProvider.

## Request shape

```jsonc
// POST /api/ai
{
  "task": "help",                       // "help" | "sms_draft" | "daily"
  "payload": { "question": "문자 보내는 법 알려줘" }
}
// → streamed text/plain response (Claude's answer)
```

- `help`     → `payload: { question }`
- `sms_draft`→ `payload: { intent, to? }`
- `daily`    → `payload: { date, day, reminders: string[] }`

## Config

- `ANTHROPIC_API_KEY` (required) — your key. Server refuses to start without it.
- `PORT` (default `8787`).
- `ALLOWED_ORIGIN` (default `*`) — set to your site origin in production.
- `AI_MODEL` (default `claude-haiku-4-5`) — raise to `claude-sonnet-5` /
  `claude-opus-5` for higher quality.
- `AI_EFFORT` (default `low`) — effort for non-Haiku models (ignored on Haiku).
- `AI_RATE_LIMIT` (default `20`) — requests per minute per IP.
- `AI_MONTHLY_TOKEN_CAP` (default `2000000`) — monthly token budget; over it the
  proxy returns `429 {fallback:true}`.

## Model & cost

- Default **`claude-haiku-4-5`** (~$1 / $5 per MTok in/out). Prompt caching makes
  the repeated per-task system prompt cheap; output is capped per task (~500–700
  tokens). A rough estimate is **~$2–3 per 1,000 requests**.
- Haiku 4.5 gets **no** `thinking` / effort (it 400s on them). For
  `claude-sonnet-5` / `claude-opus-5` the proxy sends `thinking:{type:'adaptive'}`
  and `output_config:{effort}`.

## 무인 (autonomous) — free Cloudflare Workers deploy

`worker.js` + `wrangler.toml` run the same proxy on Cloudflare's free tier — no
server to babysit. It calls the Anthropic REST API and returns Claude's text.

```bash
npm i -g wrangler                    # once
wrangler secret put ANTHROPIC_API_KEY  # key stays a Worker secret, never in the repo
wrangler deploy                      # prints https://<name>.<sub>.workers.dev
```

Then point the front-end at it in `../ai/config.js`:

```js
export const AI_ENDPOINT = "https://<your-worker>.workers.dev/api/ai";
```

If the Worker (or the Node proxy) is ever down or over budget, the browser
auto-falls back to the offline mock, so the app keeps working unmanned.

## License

Apache-2.0. SPDX headers on all source files.
