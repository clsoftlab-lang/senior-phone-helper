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
- Calls Claude (`claude-opus-5`) with streaming and pipes the text back as a
  plain-text stream, so the front-end can show a live "typing" effect and read
  it aloud with TTS.
- `GET /health` → `{ ok: true, model }`.

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

## Model

`claude-opus-5`, `max_tokens: 2048`, `thinking: { type: "adaptive" }`, streaming.

## License

Apache-2.0. SPDX headers on all source files.
