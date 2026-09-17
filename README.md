# 도전 (도움전화) — Senior Phone Helper

[English] · [한국어](./README.ko.md)

**도전 (Dojeon, "도움전화" = Help-Phone)** is a senior-friendly, accessibility-first
phone helper web app. Older adults tap a family member's big face-and-name card to
call, learn phone features step by step, and reach a caregiver instantly with an
emergency SOS. Everything is huge, high-contrast, and read aloud.

Accessibility is the point. Big text (scalable to ~200%), 48px+ tap targets,
strong contrast in both themes, ARIA labels, keyboard focus, and real
text-to-speech voice guidance.

## LIVE DEMO

**https://clsoftlab-lang.github.io/senior-phone-helper/**

## Features

- **Big favorite contacts** — colorful avatar (photo placeholder) + name; tap to call.
- **Common feature buttons** — call, text, open KakaoTalk, camera, medication reminder, emergency.
- **Step-by-step tutorials** — large picture + text guides: "How to send a text", "How to take a photo", "How to connect Wi-Fi", "How to open KakaoTalk", "How to adjust volume". One step at a time, read aloud, with next/previous.
- **Emergency SOS** — one giant red button sends the caregiver a simulated location + help request (uses real geolocation when allowed).
- **Real voice guidance** — buttons and instructions are spoken via the Web Speech API (`speechSynthesis`), Korean voice preferred, gracefully skipped when unsupported.
- **Font size control** — five steps from normal up to ~200%, persisted.
- **High-contrast mode** — black background, bright text; persisted.
- **Caregiver settings** — large UI to register the SOS guardian and add/remove contacts.
- **Extras** — today's date + weekday shown large, medication reminder toggle, a giant always-present "back" button so a wrong tap is never scary.

## 🤖 AI 기능 (API 연동)

Three senior-friendly AI features live under the **AI 도우미** tab, all with big
text and read aloud via TTS:

1. **AI 쉬운 도우미 챗봇** — plain-language answers to "how do I…" phone questions.
2. **말로 문자 초안 만들기** — turn a short spoken or typed intent into a polite SMS draft.
3. **오늘 안내** — a simple, large-text daily summary (date + reminders).

**Demo = mock (default).** With `ai/config.js`'s `AI_ENDPOINT` empty, everything
runs offline through a deterministic Korean MockProvider that reuses the app's
own contacts and tutorials data. No network, no key, nothing leaves the browser.

**Enable real Claude:** run the backend proxy in [`server/`](./server/), which
holds the key server-side and streams answers:

```bash
cd server
cp .env.example .env          # paste your key into .env
npm install && npm start      # http://localhost:8787
```

Then set the endpoint in `ai/config.js`:

```js
export const AI_ENDPOINT = "http://localhost:8787/api/ai";
```

The proxy calls Claude (model **`claude-opus-5`**) with your `ANTHROPIC_API_KEY`.

> **🔒 SECURITY: keys are server-side only.** The API key is read from
> `ANTHROPIC_API_KEY` on the server and is **NEVER** placed in the browser,
> `ai/config.js`, or the repository. `ai/config.js` holds only a URL, and `.env`
> is gitignored.

## Run locally

No build step. Any static server works:

```bash
python -m http.server 8984
# then open http://localhost:8984/
```

Or open `index.html` through a local server (ES modules need `http://`, not `file://`).

## Verify

```bash
node check.mjs        # JSON parses, node --check on all JS, index.html a11y contract
```

## DEMO-MODE boundaries

> **This is a DEMO. Read these limits before assuming real behavior:**
> - **Contacts are fictional.** No real people, no real phone numbers, no real PII.
> - **localStorage is not a real database.** Settings and contacts live only in this browser and can be cleared any time.
> - **`tel:` / `sms:` depend on the device.** On a real phone they dial/open messaging; on desktop the app just shows a confirmation.
> - **SOS is simulated.** Nothing is actually sent anywhere. For a real emergency, call **119** (Korea).
> - **No real accounts, no sign-in, no server.**
> - A real production build would add a backend, real SOS dispatch to caregivers, caregiver sync, and verified contacts.

## Accessibility notes

- Minimum 20px base font, scalable to ~200% (`--font-scale`).
- 48px+ (60px default) tap targets on every interactive element.
- WCAG-minded contrast in both the default and high-contrast themes.
- ARIA labels on nav, contacts, functions; `aria-live` announcer for status.
- Visible keyboard focus (4px outline), skip link, focus moved to view heading on navigation.
- `prefers-reduced-motion` respected (SOS pulse and press animations disabled).

## Tech

- Static SPA: `index.html` + `styles.css` + ES-module JavaScript. No build, no dependencies, relative paths only.
- Modules: `js/storage.js` (safe localStorage), `js/speech.js` (Web Speech API), `js/settings.js` (font/contrast/voice), `js/contacts.js` (demo contact book), `js/icons.js` (inline SVG icons + avatars).
- Data: `data/contacts.json`, `data/tutorials.json`, `data/functions.json` (all fictional demo data).
- CI: GitHub Actions runs `node check.mjs`.

## Contributors

- Dr. Lee Il-guk (이일국)
- LWJ
- LMJ
- Claude

## License

- Code: **Apache-2.0** — see [LICENSE](./LICENSE).
- Documentation: **CC BY 4.0**.

SPDX headers: `Apache-2.0`, `Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)`.

---

*Not an official Anthropic product.*

## 🎓 Idea origin

The seed idea for this project came from the **entrepreneurship class taught by Dr. Lee Il-guk (이일국) at Yongin University (용인대학교)**. The students in that class produced startup ideas of remarkable, standout creativity — this project is one of those exceptional ideas, finally brought to life as a working service. Built with deep admiration and gratitude for those students' imagination. *(No student personal information is included; only the idea itself was used, implemented clean-room.)*
