// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// ai/config.js — AI endpoint configuration.
//
// DEMO / default: AI_ENDPOINT is EMPTY. With an empty endpoint the app uses a
// fully local, deterministic Korean MockProvider (see ai/ai.js) — no network,
// no API key, nothing leaves the browser.
//
// To enable REAL Claude answers, run the backend proxy in ./server (which holds
// the ANTHROPIC_API_KEY server-side) and set AI_ENDPOINT to its /api/ai URL,
// for example:
//
//     export const AI_ENDPOINT = "http://localhost:8787/api/ai";
//
// ⚠️ SECURITY: NEVER put an API key in this file or anywhere in the browser /
// repository. The key lives only on the server. This value is just a URL.

export const AI_ENDPOINT = "";
