// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// app.js — 도전 (도움전화) main controller.
// Senior-friendly, accessibility-first SPA. Runs fully in the browser in
// DEMO mode: no backend, no real accounts, fictional contacts only.

import * as store from './js/storage.js';
import * as speech from './js/speech.js';
import * as settings from './js/settings.js';
import * as contacts from './js/contacts.js';
import { icon, avatar } from './js/icons.js';
import { askAI, AI_TASKS } from './ai/ai.js';

const appEl = () => document.getElementById('app');
const announcer = () => document.getElementById('announcer');

let tutorials = [];
let funcs = [];

// Autonomous "오늘 안내" home briefing — auto-runs on load, read aloud once.
let homeBriefingSpoken = false;
let lastHomeBriefing = '';

/* ---------------------------------------------------------------- helpers */

function announce(text) {
  const a = announcer();
  if (a) {
    a.textContent = '';
    // force screen readers to re-announce
    requestAnimationFrame(() => { a.textContent = text; });
  }
}

// Speak + announce together (voice guidance is the point of this app).
function say(text) {
  announce(text);
  speech.speak(text);
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ------------------------------------------------------------- modal / dialog */

function closeModal() {
  const m = document.getElementById('modal');
  if (m) m.remove();
  speech.cancel();
  const restore = document.querySelector('[data-focus-return]');
  if (restore) { restore.focus(); restore.removeAttribute('data-focus-return'); }
}

/**
 * Accessible confirm dialog. Returns via onConfirm callback.
 * Focus is trapped simply (first button focused, ESC cancels).
 */
function showDialog({ title, body, confirmLabel = '예', cancelLabel = '아니요', tone = 'default', onConfirm }) {
  closeModal();
  const active = document.activeElement;
  if (active && active !== document.body) active.setAttribute('data-focus-return', '');

  const overlay = el(`
    <div id="modal" class="modal-overlay" role="presentation">
      <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-body">
        <h2 id="modal-title" class="modal-title ${tone === 'danger' ? 'danger' : ''}">${esc(title)}</h2>
        <div id="modal-body" class="modal-body">${body}</div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-act="cancel">${esc(cancelLabel)}</button>
          <button type="button" class="btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}" data-act="confirm">${esc(confirmLabel)}</button>
        </div>
      </div>
    </div>`);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
    const act = e.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'cancel') { say('취소했어요.'); closeModal(); }
    if (act.dataset.act === 'confirm') { closeModal(); onConfirm && onConfirm(); }
  });
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') { say('취소했어요.'); closeModal(); } });

  document.body.appendChild(overlay);
  const confirmBtn = overlay.querySelector('[data-act="confirm"]');
  confirmBtn && confirmBtn.focus();
  say(title.replace(/\n/g, ' '));
}

/* --------------------------------------------------------------- actions */

// In DEMO mode we show a confirm dialog instead of dialing for real.
// tel:/sms: still work on real phones via the underlying links.
function doCall(contact) {
  const num = contact.phone;
  showDialog({
    title: `${contact.name} 님께 전화할까요?`,
    body: `<p class="big">전화번호: <strong>${esc(num)}</strong></p>
           <p class="muted">데모 모드예요. 실제 휴대폰에서는 바로 전화가 걸립니다.</p>`,
    confirmLabel: '전화하기',
    cancelLabel: '그만두기',
    onConfirm: () => {
      say(`${contact.name} 님께 전화를 겁니다.`);
      // Real devices honor tel:. Desktop/demo simply no-ops safely.
      try { window.location.href = 'tel:' + num.replace(/[^0-9+]/g, ''); } catch { /* ignore */ }
      toast(`${contact.name} 님께 전화 연결을 시도했어요. (데모)`);
    },
  });
}

function doSms(contact) {
  showDialog({
    title: contact ? `${contact.name} 님께 문자할까요?` : '문자를 보낼까요?',
    body: `<p class="muted">데모 모드예요. 실제 휴대폰에서는 문자 앱이 열립니다.</p>`,
    confirmLabel: '문자 열기',
    cancelLabel: '그만두기',
    onConfirm: () => {
      say('문자 앱을 엽니다.');
      try { window.location.href = 'sms:' + (contact ? contact.phone.replace(/[^0-9+]/g, '') : ''); } catch { /* ignore */ }
      toast('문자 앱 열기를 시도했어요. (데모)');
    },
  });
}

function doFunction(fn) {
  switch (fn.action) {
    case 'call': location.hash = '#/'; toast('아래 큰 얼굴 단추를 눌러 전화하세요.'); say('전화할 사람의 얼굴 단추를 누르세요.'); break;
    case 'sms': doSms(null); break;
    case 'kakao':
      showDialog({ title: '카카오톡을 열까요?', body: '<p class="muted">데모 모드예요. 실제 폰에서는 카카오톡 앱이 열립니다.</p>', confirmLabel: '열기', cancelLabel: '그만두기', onConfirm: () => { say('카카오톡을 엽니다.'); toast('카카오톡 열기를 시도했어요. (데모)'); } });
      break;
    case 'camera':
      showDialog({ title: '카메라를 열까요?', body: '<p class="muted">데모 모드예요. 실제 폰에서는 카메라가 열립니다.</p>', confirmLabel: '열기', cancelLabel: '그만두기', onConfirm: () => { say('카메라를 엽니다.'); toast('카메라 열기를 시도했어요. (데모)'); } });
      break;
    case 'medication': doMedication(); break;
    case 'sos': location.hash = '#/sos'; break;
    default: break;
  }
}

function doMedication() {
  const enabled = store.load('medication', { on: false });
  showDialog({
    title: '복약 알림',
    body: `<p class="big">지금 약 드실 시간을 기억하도록 도와드려요.</p>
           <p class="muted">현재 상태: <strong>${enabled.on ? '켜짐' : '꺼짐'}</strong> (데모)</p>`,
    confirmLabel: enabled.on ? '알림 끄기' : '알림 켜기',
    cancelLabel: '닫기',
    onConfirm: () => {
      const next = !enabled.on;
      store.save('medication', { on: next });
      say(next ? '복약 알림을 켰어요. 매일 약 드실 시간을 알려드릴게요.' : '복약 알림을 껐어요.');
      toast(next ? '복약 알림을 켰어요. (데모)' : '복약 알림을 껐어요.');
    },
  });
}

/* ------------------------------------------------------------------ SOS flow */

function renderSos() {
  const wrap = el(`
    <section class="view" aria-labelledby="sos-h">
      <h1 id="sos-h" class="view-title danger">${icon('sos', 44)} 긴급 도움 (SOS)</h1>
      <p class="lead">아래 큰 빨간 단추를 누르면 보호자에게 <strong>내 위치와 도움 요청</strong>을 보냅니다.</p>
      <button type="button" class="sos-button" data-act="send-sos" aria-label="긴급 도움 요청 보내기">
        <span class="sos-ico">${icon('sos', 90)}</span>
        <span class="sos-label">도움 요청<br>보내기</span>
      </button>
      <div id="sos-result" class="sos-result" aria-live="polite"></div>
      <p class="muted center">데모 모드예요. 실제로는 아무 곳에도 전송되지 않습니다.<br>진짜 위급하면 <strong>119</strong>에 전화하세요.</p>
      <button type="button" class="btn btn-danger big-block" data-act="call-119">${icon('phone', 30)} 119 전화하기</button>
    </section>`);

  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="send-sos"]')) sendSos(wrap.querySelector('#sos-result'));
    if (e.target.closest('[data-act="call-119"]')) {
      showDialog({ title: '119에 전화할까요?', body: '<p class="big">소방·구급 <strong>119</strong></p><p class="muted">데모 모드예요. 실제 폰에서는 바로 연결됩니다.</p>', tone: 'danger', confirmLabel: '119 전화', cancelLabel: '그만두기', onConfirm: () => { say('119에 전화를 겁니다.'); try { window.location.href = 'tel:119'; } catch {} toast('119 연결을 시도했어요. (데모)'); } });
    }
  });
  return wrap;
}

function sendSos(resultEl) {
  say('보호자에게 도움 요청을 보냅니다. 잠시만 기다리세요.');
  resultEl.innerHTML = `<p class="big">${icon('location', 26)} 위치를 확인하는 중이에요...</p>`;

  const guardian = store.load('guardian', { name: '보호자', phone: '010-0000-9999' });

  const finish = (coords) => {
    const where = coords ? `위도 ${coords.lat.toFixed(4)}, 경도 ${coords.lng.toFixed(4)}` : '위치 정보 없음 (데모)';
    const time = new Date().toLocaleTimeString('ko-KR');
    store.save('lastSos', { at: Date.now(), where, guardian: guardian.name });
    resultEl.innerHTML = `
      <div class="sos-sent" role="status">
        <p class="big ok">${icon('check', 26)} 도움 요청을 보냈어요! (데모)</p>
        <ul class="sos-detail">
          <li><strong>받는 사람:</strong> ${esc(guardian.name)} (${esc(guardian.phone)})</li>
          <li><strong>내 위치:</strong> ${esc(where)}</li>
          <li><strong>보낸 시각:</strong> ${esc(time)}</li>
        </ul>
        <p class="muted">실제 서비스에서는 이 정보가 보호자 휴대폰으로 전송됩니다.</p>
      </div>`;
    say(`${guardian.name} 님에게 도움 요청과 위치를 보냈어요.`);
    toast('SOS를 보냈어요. (데모)');
  };

  // Try real geolocation; fall back gracefully in demo.
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => finish({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => finish(null),
      { timeout: 4000 }
    );
  } else {
    finish(null);
  }
}

/* -------------------------------------------------------------- home view */

async function renderHome() {
  const favs = await contacts.favorites();
  const now = new Date();
  const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  const dayStr = now.toLocaleDateString('ko-KR', { weekday: 'long' });

  const wrap = el(`
    <section class="view" aria-labelledby="home-h">
      <div class="today card" aria-label="오늘 날짜">
        <span class="today-ico">${icon('calendar', 40)}</span>
        <div>
          <p class="today-date">${esc(dateStr)}</p>
          <p class="today-day">${esc(dayStr)}</p>
        </div>
      </div>

      <div class="today-brief card" id="home-brief" aria-label="오늘 안내" aria-live="polite" tabindex="-1">
        <div class="brief-head">
          <span class="brief-ico">${icon('robot', 30)}</span>
          <h2 class="brief-title">오늘 안내</h2>
        </div>
        <p class="brief-status muted" id="home-brief-status">오늘 안내를 준비하고 있어요...</p>
        <p class="ai-answer-text" id="home-brief-text"></p>
        <button type="button" class="btn btn-ghost big-block" data-act="brief-repeat">${icon('speaker', 26)} 다시 읽어주기</button>
      </div>

      <h1 id="home-h" class="view-title">가족에게 전화하기</h1>
      <p class="lead">얼굴을 누르면 전화를 걸 수 있어요.</p>
      <div class="contact-grid" role="list" id="fav-grid"></div>

      <h2 class="section-title">자주 쓰는 기능</h2>
      <div class="func-grid" role="list" id="func-grid"></div>
    </section>`);

  const grid = wrap.querySelector('#fav-grid');
  favs.forEach((c) => {
    const card = el(`
      <button type="button" class="contact-card" role="listitem"
        data-id="${esc(c.id)}" aria-label="${esc(c.name)} ${esc(c.relation)} 에게 전화하기">
        <span class="contact-photo">${avatar(c.name, c.color, 96)}</span>
        <span class="contact-name">${esc(c.name)}</span>
        <span class="contact-relation">${esc(c.relation)}</span>
        <span class="contact-call">${icon('phone', 26)} 전화</span>
      </button>`);
    card.addEventListener('click', () => doCall(c));
    card.addEventListener('focus', () => announce(`${c.name}, ${c.relation}`));
    grid.appendChild(card);
  });
  if (!favs.length) grid.appendChild(el('<p class="muted">등록된 연락처가 없어요. 설정에서 추가하세요.</p>'));

  const fgrid = wrap.querySelector('#func-grid');
  funcs.forEach((fn) => {
    const b = el(`
      <button type="button" class="func-card" role="listitem" data-fn="${esc(fn.id)}"
        style="--fn-color:${esc(fn.color)}" aria-label="${esc(fn.label)}. ${esc(fn.hint)}">
        <span class="func-ico">${icon(fn.icon, 46)}</span>
        <span class="func-label">${esc(fn.label)}</span>
      </button>`);
    b.addEventListener('click', () => doFunction(fn));
    b.addEventListener('focus', () => announce(fn.label));
    fgrid.appendChild(b);
  });

  // --- Autonomous 오늘 안내 daily briefing (auto-runs on load) ---------------
  // Grounded in the app's own state, generated via askAI (so it also works
  // offline through the mock). Read aloud once via the existing TTS.
  const briefText = wrap.querySelector('#home-brief-text');
  const briefStatus = wrap.querySelector('#home-brief-status');
  const briefBox = wrap.querySelector('#home-brief');
  briefBox.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="brief-repeat"]')) {
      if (lastHomeBriefing) say(lastHomeBriefing);
      else say('오늘 안내를 준비하고 있어요. 잠시만 기다려 주세요.');
    }
  });

  const reminders = [];
  const med = store.load('medication', { on: false });
  if (med.on) reminders.push('약 드실 시간을 잊지 마세요. 복약 알림이 켜져 있어요.');
  const briefPayload = { date: dateStr, day: dayStr, reminders };

  // Speak aloud only the first time this session so returning home is quiet.
  const speakAloud = !homeBriefingSpoken;
  setTimeout(async () => {
    lastHomeBriefing = await streamAnswer(briefText, briefStatus, AI_TASKS.DAILY, briefPayload, { speak: speakAloud });
    homeBriefingSpoken = true;
  }, speakAloud ? 140 : 40);

  return wrap;
}

/* ---------------------------------------------------------- tutorials view */

function renderTutorialList() {
  const wrap = el(`
    <section class="view" aria-labelledby="tut-h">
      <h1 id="tut-h" class="view-title">${icon('list', 40)} 사용법 배우기</h1>
      <p class="lead">배우고 싶은 것을 누르세요. 한 단계씩 큰 그림으로 알려드려요.</p>
      <div class="tut-grid" role="list" id="tut-grid"></div>
    </section>`);
  const grid = wrap.querySelector('#tut-grid');
  tutorials.forEach((t) => {
    const b = el(`
      <button type="button" class="tut-card" role="listitem" data-tid="${esc(t.id)}"
        aria-label="${esc(t.title)}. ${esc(t.summary)}">
        <span class="tut-ico">${icon(t.icon, 46)}</span>
        <span class="tut-text"><span class="tut-title">${esc(t.title)}</span><span class="tut-summary">${esc(t.summary)}</span></span>
        <span class="tut-go">${icon('back', 26)}</span>
      </button>`);
    b.addEventListener('click', () => { location.hash = '#/tutorial/' + t.id; });
    b.addEventListener('focus', () => announce(t.title));
    grid.appendChild(b);
  });
  return wrap;
}

function renderTutorial(id) {
  const t = tutorials.find((x) => x.id === id);
  if (!t) { location.hash = '#/tutorials'; return el('<section class="view"></section>'); }

  let step = 0;
  const wrap = el(`
    <section class="view tutorial" aria-labelledby="tv-h">
      <h1 id="tv-h" class="view-title">${icon(t.icon, 40)} ${esc(t.title)}</h1>
      <div class="tut-progress" aria-hidden="true" id="tut-dots"></div>
      <div class="tut-step card" aria-live="polite" id="tut-step"></div>
      <div class="tut-nav">
        <button type="button" class="btn btn-ghost big" data-act="prev">${icon('back', 26)} 이전</button>
        <button type="button" class="btn btn-primary big" data-act="next">다음 ${icon('back', 26)}</button>
      </div>
      <button type="button" class="btn btn-ghost big-block" data-act="listen">${icon('speaker', 26)} 다시 읽어주기</button>
    </section>`);

  const stepEl = wrap.querySelector('#tut-step');
  const dotsEl = wrap.querySelector('#tut-dots');
  const nextBtn = wrap.querySelector('[data-act="next"]');
  const prevBtn = wrap.querySelector('[data-act="prev"]');

  function draw(readAloud = true) {
    const s = t.steps[step];
    stepEl.innerHTML = `
      <p class="step-count">${step + 1} / ${t.steps.length} 단계</p>
      <div class="step-ico">${icon(s.icon, 88)}</div>
      <h2 class="step-title">${esc(s.title)}</h2>
      <p class="step-body">${esc(s.body)}</p>`;
    dotsEl.innerHTML = t.steps.map((_, i) => `<span class="dot ${i === step ? 'on' : ''}"></span>`).join('');
    prevBtn.disabled = step === 0;
    nextBtn.textContent = '';
    nextBtn.insertAdjacentHTML('beforeend', step === t.steps.length - 1 ? `다 배웠어요 ${icon('check', 26)}` : `다음 ${icon('back', 26)}`);
    if (readAloud) say(`${step + 1}단계. ${s.title}. ${s.body}`);
  }

  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="next"]')) {
      if (step < t.steps.length - 1) { step++; draw(); }
      else { say('잘하셨어요! 사용법을 다 배웠어요.'); toast('다 배웠어요! 잘하셨어요.'); location.hash = '#/tutorials'; }
    }
    if (e.target.closest('[data-act="prev"]')) { if (step > 0) { step--; draw(); } }
    if (e.target.closest('[data-act="listen"]')) { const s = t.steps[step]; say(`${s.title}. ${s.body}`); }
  });

  draw(false);
  setTimeout(() => draw(true), 60);
  return wrap;
}

/* ---------------------------------------------------------- settings view */

function renderSettings() {
  const s = settings.get();
  const persistent = store.isPersistent();
  const wrap = el(`
    <section class="view" aria-labelledby="set-h">
      <h1 id="set-h" class="view-title">${icon('gear', 40)} 설정</h1>

      <div class="setting card">
        <h2 class="setting-title">${icon('aplus', 30)} 글자 크기</h2>
        <p class="setting-value" id="font-value">현재: ${settings.fontLabel()} (${settings.fontPercent()}%)</p>
        <div class="setting-row">
          <button type="button" class="btn btn-ghost big" data-act="font-down" aria-label="글자 작게">가 －</button>
          <button type="button" class="btn btn-primary big" data-act="font-up" aria-label="글자 크게">가 ＋</button>
        </div>
      </div>

      <div class="setting card">
        <h2 class="setting-title">${icon('contrast', 30)} 고대비 모드</h2>
        <p class="muted">검정 바탕에 밝은 글씨로 더 잘 보이게 해요.</p>
        <button type="button" class="btn toggle big-block ${s.highContrast ? 'on' : ''}" data-act="contrast" aria-pressed="${s.highContrast}">
          고대비 <span class="toggle-state">${s.highContrast ? '켜짐' : '꺼짐'}</span>
        </button>
      </div>

      <div class="setting card">
        <h2 class="setting-title">${icon('speaker', 30)} 음성 안내</h2>
        <p class="muted">단추와 안내를 소리로 읽어드려요.${speech.isSupported() ? '' : ' (이 기기는 음성 안내를 지원하지 않아요)'}</p>
        <button type="button" class="btn toggle big-block ${s.voice ? 'on' : ''}" data-act="voice" aria-pressed="${s.voice}" ${speech.isSupported() ? '' : 'disabled'}>
          음성 안내 <span class="toggle-state">${s.voice ? '켜짐' : '꺼짐'}</span>
        </button>
        <button type="button" class="btn btn-ghost big-block" data-act="test-voice">${icon('speaker', 26)} 소리 들어보기</button>
      </div>

      <div class="setting card">
        <h2 class="setting-title">${icon('person', 30)} 보호자 설정</h2>
        <p class="muted">연락처 추가·삭제, 보호자 정보 등록</p>
        <button type="button" class="btn btn-primary big-block" data-act="go-caregiver">보호자 설정 열기 ${icon('back', 26)}</button>
      </div>

      <div class="setting card">
        <h2 class="setting-title">${icon('trash', 30)} 처음으로 되돌리기</h2>
        <p class="muted">저장된 설정과 연락처를 모두 지우고 처음 상태로 돌아가요.
          ${persistent ? '' : '<br>※ 이 브라우저는 저장이 제한되어 있어요.'}</p>
        <button type="button" class="btn btn-danger big-block" data-act="reset">모두 초기화</button>
      </div>
    </section>`);

  wrap.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (!act) return;
    switch (act.dataset.act) {
      case 'font-up': settings.increaseFont(); wrap.querySelector('#font-value').textContent = `현재: ${settings.fontLabel()} (${settings.fontPercent()}%)`; say(`글자를 키웠어요. ${settings.fontLabel()}.`); break;
      case 'font-down': settings.decreaseFont(); wrap.querySelector('#font-value').textContent = `현재: ${settings.fontLabel()} (${settings.fontPercent()}%)`; say(`글자를 줄였어요. ${settings.fontLabel()}.`); break;
      case 'contrast': { const on = settings.toggleContrast(); rerenderCurrent(); say(on ? '고대비 모드를 켰어요.' : '고대비 모드를 껐어요.'); break; }
      case 'voice': { const on = settings.toggleVoice(); rerenderCurrent(); if (on) say('음성 안내를 켰어요.'); break; }
      case 'test-voice': say('안녕하세요. 저는 도전, 도움전화 앱이에요. 큰 단추를 눌러 사용해 보세요.'); break;
      case 'go-caregiver': location.hash = '#/caregiver'; break;
      case 'reset': confirmReset(); break;
      default: break;
    }
  });
  return wrap;
}

function confirmReset() {
  showDialog({
    title: '모두 초기화할까요?',
    body: '<p class="big">저장된 연락처와 설정이 모두 지워지고<br>처음 상태로 돌아갑니다.</p>',
    tone: 'danger', confirmLabel: '초기화', cancelLabel: '그만두기',
    onConfirm: () => { store.resetAll(); settings.reset(); contacts.all().catch(() => {}); say('처음 상태로 되돌렸어요.'); toast('초기화했어요.'); location.hash = '#/'; location.reload(); },
  });
}

/* ------------------------------------------------------------ caregiver view */

async function renderCaregiver() {
  const list = await contacts.all();
  const g = store.load('guardian', { name: '', phone: '' });
  const wrap = el(`
    <section class="view" aria-labelledby="cg-h">
      <h1 id="cg-h" class="view-title">${icon('person', 40)} 보호자 설정</h1>
      <p class="lead">가족·보호자 연락처를 등록하세요. (데모 · 가상의 정보만 사용)</p>

      <div class="setting card">
        <h2 class="setting-title">${icon('sos', 28)} 긴급 SOS 받을 보호자</h2>
        <label class="field"><span>이름</span><input id="g-name" class="input" type="text" value="${esc(g.name)}" placeholder="예: 김보호" autocomplete="off"></label>
        <label class="field"><span>전화번호</span><input id="g-phone" class="input" type="tel" value="${esc(g.phone)}" placeholder="010-0000-0000" autocomplete="off"></label>
        <button type="button" class="btn btn-primary big-block" data-act="save-guardian">보호자 저장</button>
      </div>

      <div class="setting card">
        <h2 class="setting-title">${icon('list', 28)} 연락처 (${list.length}명)</h2>
        <div id="cg-list" class="cg-list"></div>
      </div>

      <div class="setting card">
        <h2 class="setting-title">${icon('plus', 28)} 새 연락처 추가</h2>
        <label class="field"><span>이름</span><input id="n-name" class="input" type="text" placeholder="예: 이순신" autocomplete="off"></label>
        <label class="field"><span>관계</span><input id="n-rel" class="input" type="text" placeholder="예: 아들, 딸, 친구" autocomplete="off"></label>
        <label class="field"><span>전화번호</span><input id="n-phone" class="input" type="tel" placeholder="010-0000-0000" autocomplete="off"></label>
        <button type="button" class="btn btn-primary big-block" data-act="add-contact">${icon('plus', 24)} 추가하기</button>
      </div>
    </section>`);

  const listEl = wrap.querySelector('#cg-list');
  function drawList(items) {
    listEl.innerHTML = '';
    items.forEach((c) => {
      const row = el(`
        <div class="cg-row">
          <span class="cg-avatar">${avatar(c.name, c.color, 56)}</span>
          <span class="cg-info"><strong>${esc(c.name)}</strong><span class="muted">${esc(c.relation)} · ${esc(c.phone)}</span></span>
          <button type="button" class="btn btn-ghost cg-del" data-del="${esc(c.id)}" aria-label="${esc(c.name)} 삭제">${icon('trash', 24)}</button>
        </div>`);
      listEl.appendChild(row);
    });
    if (!items.length) listEl.appendChild(el('<p class="muted">연락처가 없어요.</p>'));
  }
  drawList(list);

  wrap.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]');
    const del = e.target.closest('[data-del]');
    if (del) {
      const c = await contacts.getById(del.dataset.del);
      showDialog({ title: `${c ? c.name : '이 연락처'}를 삭제할까요?`, body: '<p class="big">삭제하면 목록에서 사라져요.</p>', tone: 'danger', confirmLabel: '삭제', cancelLabel: '그만두기',
        onConfirm: async () => { const items = await contacts.remove(del.dataset.del); drawList(items); say('연락처를 삭제했어요.'); toast('삭제했어요.'); } });
      return;
    }
    if (!act) return;
    if (act.dataset.act === 'save-guardian') {
      const name = wrap.querySelector('#g-name').value.trim() || '보호자';
      const phone = wrap.querySelector('#g-phone').value.trim() || '010-0000-9999';
      store.save('guardian', { name, phone });
      say('보호자 정보를 저장했어요.'); toast('보호자를 저장했어요.');
    }
    if (act.dataset.act === 'add-contact') {
      const name = wrap.querySelector('#n-name').value.trim();
      const rel = wrap.querySelector('#n-rel').value.trim();
      const phone = wrap.querySelector('#n-phone').value.trim();
      if (!name || !phone) { say('이름과 전화번호를 넣어 주세요.'); toast('이름과 전화번호를 넣어 주세요.'); return; }
      await contacts.add({ name, relation: rel, phone, favorite: true });
      const items = await contacts.all();
      drawList(items);
      wrap.querySelector('#cg-list').closest('.setting').querySelector('.setting-title').textContent = '';
      wrap.querySelector('#n-name').value = ''; wrap.querySelector('#n-rel').value = ''; wrap.querySelector('#n-phone').value = '';
      say(`${name} 님을 연락처에 추가했어요.`); toast('연락처를 추가했어요.');
    }
  });
  return wrap;
}

/* --------------------------------------------------------------- AI views */

// Shared: stream an AI answer into a large-text element, then read it aloud.
// Works identically for the offline mock and the real backend (both stream).
async function streamAnswer(targetEl, statusEl, task, payload, { speak = true } = {}) {
  targetEl.textContent = '';
  if (statusEl) statusEl.textContent = '생각하는 중이에요...';
  if (speak) say('잠시만요. 생각하고 있어요.');
  let full = '';
  try {
    full = await askAI(task, payload, {
      onToken: (chunk) => { targetEl.textContent += chunk; },
    });
  } catch (err) {
    console.error('[ai] failed:', err);
    full = '죄송해요, 지금은 답을 만들지 못했어요. 잠시 후 다시 해 주세요.';
    targetEl.textContent = full;
  }
  targetEl.textContent = full; // ensure final text is complete
  if (statusEl) statusEl.textContent = '';
  if (speak) say(full);       // read the whole answer aloud via TTS
  else announce(full);        // still announce to screen readers, no double voice
  return full;
}

// Voice input helper (말로 입력). Uses Web Speech recognition when available.
function speechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  return typeof SR === 'function' ? new SR() : null;
}

function renderAiHub() {
  const wrap = el(`
    <section class="view" aria-labelledby="ai-h">
      <h1 id="ai-h" class="view-title">${icon('robot', 44)} AI 도우미</h1>
      <p class="lead">무엇이든 쉽게 도와드려요. 아래에서 골라 누르세요.</p>
      <div class="ai-grid" role="list">
        <a class="ai-card" role="listitem" href="#/ai/chat" data-label="쉬운 도우미 챗봇">
          <span class="ai-ico">${icon('chat', 46)}</span>
          <span class="ai-text"><span class="ai-title">쉬운 도우미 챗봇</span><span class="ai-sub">"어떻게 하나요?" 물어보면 쉽게 알려드려요.</span></span>
          <span class="ai-go">${icon('back', 26)}</span>
        </a>
        <a class="ai-card" role="listitem" href="#/ai/sms" data-label="말로 문자 초안 만들기">
          <span class="ai-ico">${icon('mic', 46)}</span>
          <span class="ai-text"><span class="ai-title">말로 문자 초안 만들기</span><span class="ai-sub">하고 싶은 말을 하면 정중한 문자로 만들어 드려요.</span></span>
          <span class="ai-go">${icon('back', 26)}</span>
        </a>
        <a class="ai-card" role="listitem" href="#/ai/today" data-label="오늘 안내">
          <span class="ai-ico">${icon('calendar', 46)}</span>
          <span class="ai-text"><span class="ai-title">오늘 안내</span><span class="ai-sub">오늘 날짜와 알림을 큰 글씨로 알려드려요.</span></span>
          <span class="ai-go">${icon('back', 26)}</span>
        </a>
      </div>
      <p class="muted center">데모에서는 인터넷 없이도 답해드려요. (실제 AI 연결은 README 참고)</p>
    </section>`);
  wrap.querySelectorAll('.ai-card').forEach((a) => {
    a.addEventListener('focus', () => announce(a.dataset.label));
  });
  return wrap;
}

// (1) 쉬운 도우미 챗봇
function renderAiChat() {
  const wrap = el(`
    <section class="view" aria-labelledby="aic-h">
      <h1 id="aic-h" class="view-title">${icon('chat', 40)} 쉬운 도우미 챗봇</h1>
      <p class="lead">궁금한 것을 크게 적거나, 아래 단추를 누르세요.</p>

      <div class="ai-chips" id="ai-chips" role="group" aria-label="자주 묻는 질문"></div>

      <label class="field"><span>질문</span>
        <input id="ai-q" class="input" type="text" placeholder="예: 문자 보내는 법 알려줘" autocomplete="off">
      </label>
      <button type="button" class="btn btn-primary big-block" data-act="ask">${icon('chat', 26)} 물어보기</button>

      <div class="ai-answer card" id="ai-answer" aria-live="polite" tabindex="-1">
        <p class="muted" id="ai-status">궁금한 것을 물어보시면 여기에 크게 알려드릴게요.</p>
        <p class="ai-answer-text" id="ai-answer-text"></p>
      </div>
      <button type="button" class="btn btn-ghost big-block" data-act="repeat">${icon('speaker', 26)} 다시 읽어주기</button>
    </section>`);

  const chips = wrap.querySelector('#ai-chips');
  const questionsFromData = (tutorials || []).map((t) => `${t.title.replace(/\s*법$/, '')} 어떻게 해요?`);
  const fallbackChips = ['문자 보내는 법', '사진 찍는 법', '와이파이 연결하는 법'];
  (questionsFromData.length ? questionsFromData : fallbackChips).forEach((q) => {
    const c = el(`<button type="button" class="ai-chip" data-q="${esc(q)}">${esc(q)}</button>`);
    chips.appendChild(c);
  });

  const input = wrap.querySelector('#ai-q');
  const answer = wrap.querySelector('#ai-answer-text');
  const status = wrap.querySelector('#ai-status');
  let last = '';

  async function ask(q) {
    const question = (q || input.value || '').trim();
    if (!question) { say('궁금한 것을 적어 주세요.'); input.focus(); return; }
    input.value = question;
    last = await streamAnswer(answer, status, AI_TASKS.HELP, { question });
    wrap.querySelector('#ai-answer').focus();
  }

  wrap.addEventListener('click', (e) => {
    const chip = e.target.closest('.ai-chip');
    if (chip) { ask(chip.dataset.q); return; }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'ask') ask();
    if (act.dataset.act === 'repeat') { if (last) say(last); else say('먼저 궁금한 것을 물어보세요.'); }
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') ask(); });
  return wrap;
}

// (2) 말로 문자 초안 만들기
async function renderAiSms() {
  const favs = await contacts.favorites().catch(() => []);
  const options = favs.map((c) => `<option value="${esc(c.name)}">${esc(c.name)} (${esc(c.relation)})</option>`).join('');
  const sr = speechRecognition();

  const wrap = el(`
    <section class="view" aria-labelledby="ais-h">
      <h1 id="ais-h" class="view-title">${icon('mic', 40)} 말로 문자 초안 만들기</h1>
      <p class="lead">하고 싶은 말을 말하거나 적으면 정중한 문자로 만들어 드려요.</p>

      <label class="field"><span>받는 사람 (고르기)</span>
        <select id="ai-to" class="input"><option value="">— 선택 안 함 —</option>${options}</select>
      </label>

      <label class="field"><span>하고 싶은 말</span>
        <input id="ai-intent" class="input" type="text" placeholder="예: 오늘 저녁 같이 먹자고" autocomplete="off">
      </label>
      <button type="button" class="btn btn-ghost big-block" data-act="mic" ${sr ? '' : 'disabled'}>
        ${icon('mic', 26)} ${sr ? '말로 입력하기' : '이 기기는 말로 입력을 지원하지 않아요'}
      </button>
      <button type="button" class="btn btn-primary big-block" data-act="make">${icon('envelope', 26)} 문자 초안 만들기</button>

      <div class="ai-answer card" id="ai-draft-box" aria-live="polite" tabindex="-1">
        <p class="muted" id="ai-draft-status">만들어진 문자가 여기에 크게 나와요.</p>
        <p class="ai-answer-text" id="ai-draft"></p>
      </div>
      <button type="button" class="btn btn-ghost big-block" data-act="repeat">${icon('speaker', 26)} 다시 읽어주기</button>
      <button type="button" class="btn btn-primary big-block" data-act="send" disabled>${icon('send', 26)} 이 내용으로 문자 보내기</button>
    </section>`);

  const intent = wrap.querySelector('#ai-intent');
  const toSel = wrap.querySelector('#ai-to');
  const draft = wrap.querySelector('#ai-draft');
  const status = wrap.querySelector('#ai-draft-status');
  const sendBtn = wrap.querySelector('[data-act="send"]');
  let last = '';

  async function make() {
    const text = (intent.value || '').trim();
    if (!text) { say('하고 싶은 말을 적거나 말해 주세요.'); intent.focus(); return; }
    last = await streamAnswer(draft, status, AI_TASKS.SMS_DRAFT, { intent: text, to: toSel.value || '' });
    sendBtn.disabled = false;
    wrap.querySelector('#ai-draft-box').focus();
  }

  function startMic() {
    if (!sr) return;
    try {
      sr.lang = 'ko-KR';
      sr.interimResults = false;
      sr.maxAlternatives = 1;
      say('말씀하세요. 듣고 있어요.');
      status.textContent = '🎤 듣고 있어요... 하고 싶은 말을 말씀하세요.';
      sr.onresult = (ev) => {
        const said = ev.results && ev.results[0] && ev.results[0][0] ? ev.results[0][0].transcript : '';
        if (said) { intent.value = said; status.textContent = ''; toast('들은 말: ' + said); make(); }
      };
      sr.onerror = () => { status.textContent = ''; say('잘 못 들었어요. 다시 말하거나 적어 주세요.'); };
      sr.onend = () => { if (status.textContent.startsWith('🎤')) status.textContent = ''; };
      sr.start();
    } catch (err) {
      console.warn('[ai] speech recognition failed:', err);
      say('말로 입력을 시작하지 못했어요. 직접 적어 주세요.');
    }
  }

  wrap.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (!act) return;
    switch (act.dataset.act) {
      case 'mic': startMic(); break;
      case 'make': make(); break;
      case 'repeat': if (last) say(last); else say('먼저 문자 초안을 만들어 주세요.'); break;
      case 'send': sendDraft(); break;
      default: break;
    }
  });
  intent.addEventListener('keydown', (e) => { if (e.key === 'Enter') make(); });

  function sendDraft() {
    if (!last) { say('먼저 문자 초안을 만들어 주세요.'); return; }
    const name = toSel.value || '';
    const target = favs.find((c) => c.name === name);
    showDialog({
      title: name ? `${name} 님께 이 문자를 보낼까요?` : '이 문자를 보낼까요?',
      body: `<p class="big">${esc(last)}</p><p class="muted">데모 모드예요. 실제 휴대폰에서는 문자 앱이 이 내용으로 열립니다.</p>`,
      confirmLabel: '문자 앱 열기', cancelLabel: '그만두기',
      onConfirm: () => {
        say('문자 앱을 엽니다.');
        const num = target ? target.phone.replace(/[^0-9+]/g, '') : '';
        try { window.location.href = `sms:${num}?body=${encodeURIComponent(last)}`; } catch { /* ignore */ }
        toast('문자 앱 열기를 시도했어요. (데모)');
      },
    });
  }

  return wrap;
}

// (3) 오늘 안내
async function renderAiToday() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  const dayStr = now.toLocaleDateString('ko-KR', { weekday: 'long' });

  // Build reminders grounded in the app's own state (medication toggle, etc.).
  const reminders = [];
  const med = store.load('medication', { on: false });
  if (med.on) reminders.push('약 드실 시간을 잊지 마세요. 복약 알림이 켜져 있어요.');

  const wrap = el(`
    <section class="view" aria-labelledby="ait-h">
      <h1 id="ait-h" class="view-title">${icon('calendar', 40)} 오늘 안내</h1>
      <p class="lead">오늘 하루를 큰 글씨로 알려드려요.</p>
      <div class="ai-answer card" id="ai-today-box" aria-live="polite" tabindex="-1">
        <p class="muted" id="ai-today-status">오늘 안내를 준비하고 있어요...</p>
        <p class="ai-answer-text" id="ai-today"></p>
      </div>
      <button type="button" class="btn btn-primary big-block" data-act="refresh">${icon('calendar', 26)} 다시 안내받기</button>
      <button type="button" class="btn btn-ghost big-block" data-act="repeat">${icon('speaker', 26)} 다시 읽어주기</button>
    </section>`);

  const out = wrap.querySelector('#ai-today');
  const status = wrap.querySelector('#ai-today-status');
  let last = '';

  async function run() {
    last = await streamAnswer(out, status, AI_TASKS.DAILY, { date: dateStr, day: dayStr, reminders });
  }

  wrap.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'refresh') run();
    if (act.dataset.act === 'repeat') { if (last) say(last); }
  });

  setTimeout(run, 80); // auto-generate on open
  return wrap;
}

/* ------------------------------------------------------------------- toast */

let toastTimer = null;
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = el('<div id="toast" class="toast" role="status" aria-live="polite"></div>'); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ------------------------------------------------------------------- router */

const routes = {
  '': renderHome,
  '/': renderHome,
  '/tutorials': renderTutorialList,
  '/settings': renderSettings,
  '/caregiver': renderCaregiver,
  '/sos': renderSos,
  '/ai': renderAiHub,
  '/ai/chat': renderAiChat,
  '/ai/sms': renderAiSms,
  '/ai/today': renderAiToday,
};

let currentRoute = '/';

async function render() {
  const hash = location.hash.replace(/^#/, '') || '/';
  currentRoute = hash;
  const container = appEl();
  container.setAttribute('aria-busy', 'true');

  let view;
  const tutMatch = hash.match(/^\/tutorial\/(.+)$/);
  if (tutMatch) view = renderTutorial(tutMatch[1]);
  else {
    const fn = routes[hash] || renderHome;
    view = await fn();
  }

  container.innerHTML = '';
  container.appendChild(view);
  container.setAttribute('aria-busy', 'false');

  // highlight active nav item
  document.querySelectorAll('.nav-item').forEach((n) => {
    const active = n.getAttribute('href') === '#' + (hash === '/' ? '/' : hash) ||
      (hash.startsWith('/tutorial') && n.dataset.match === 'tutorials') ||
      (hash.startsWith('/ai') && n.dataset.match === 'ai');
    n.setAttribute('aria-current', active ? 'page' : 'false');
  });

  // move focus to the new view heading for keyboard/screen-reader users
  const h = view.querySelector('.view-title');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: false }); }
  window.scrollTo(0, 0);
}

function rerenderCurrent() { render(); }

/* -------------------------------------------------------------------- init */

async function init() {
  settings.apply();

  // Load static demo data (tutorials + function buttons).
  try {
    const [tRes, fRes] = await Promise.all([
      fetch('./data/tutorials.json', { cache: 'no-store' }),
      fetch('./data/functions.json', { cache: 'no-store' }),
    ]);
    tutorials = (await tRes.json()).tutorials || [];
    funcs = (await fRes.json()).functions || [];
  } catch (err) {
    console.error('[app] data load failed:', err);
    tutorials = []; funcs = [];
  }

  // Global nav (top app bar buttons + bottom tab bar) is in index.html.
  const back = document.getElementById('back-btn');
  if (back) back.addEventListener('click', () => {
    if (currentRoute && currentRoute !== '/' && currentRoute !== '') history.back();
    else { say('여기가 첫 화면이에요.'); }
  });

  document.querySelectorAll('.nav-item').forEach((n) => {
    n.addEventListener('focus', () => announce(n.dataset.label || n.textContent.trim()));
  });

  window.addEventListener('hashchange', render);
  await render();
  // On the home screen the autonomous "오늘 안내" briefing is the spoken welcome,
  // so only greet by voice when we land elsewhere (avoids two voices at once).
  const startRoute = location.hash.replace(/^#/, '') || '/';
  if (startRoute !== '/' && startRoute !== '') {
    say('안녕하세요. 도전, 도움전화 앱이에요. 전화할 사람의 얼굴을 눌러 보세요.');
  } else {
    announce('안녕하세요. 도전, 도움전화 앱이에요.');
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
