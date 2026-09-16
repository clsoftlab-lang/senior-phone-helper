// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// check.mjs — zero-dependency verification for CI and local use.
// 1) every data/*.json parses
// 2) `node --check` on every .js / .mjs file (syntax valid)
// 3) index.html has required containers + basic accessibility markers
//
// Exits non-zero on the first failing category so CI fails loudly.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, extname } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
let failures = 0;
const pass = (m) => console.log('  ✓ ' + m);
const fail = (m) => { console.error('  ✗ ' + m); failures++; };

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(ROOT);
const rel = (f) => relative(ROOT, f).replace(/\\/g, '/');

/* ---------------------------------------------------------- 1. JSON parses */
console.log('\n[1] JSON files parse');
const jsonFiles = files.filter((f) => extname(f) === '.json');
if (!jsonFiles.length) fail('no JSON files found');
for (const f of jsonFiles) {
  try {
    JSON.parse(readFileSync(f, 'utf8'));
    pass(rel(f));
  } catch (e) {
    fail(`${rel(f)} — ${e.message}`);
  }
}

/* ------------------------------------------------------- 2. JS syntax check */
console.log('\n[2] JavaScript syntax (node --check)');
const jsFiles = files.filter((f) => ['.js', '.mjs'].includes(extname(f)));
if (!jsFiles.length) fail('no JS files found');
for (const f of jsFiles) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    pass(rel(f));
  } catch (e) {
    fail(`${rel(f)} — ${(e.stderr || e.message).toString().split('\n')[0]}`);
  }
}

/* --------------------------------------------------- 3. index.html contract */
console.log('\n[3] index.html containers + accessibility');
let html = '';
try {
  html = readFileSync(join(ROOT, 'index.html'), 'utf8');
} catch {
  fail('index.html is missing');
}
if (html) {
  const checks = [
    ['lang attribute on <html>', /<html[^>]*\blang=["'][a-z-]+["']/i],
    ['viewport meta tag', /<meta[^>]*name=["']viewport["'][^>]*width=device-width/i],
    ['charset meta tag', /<meta[^>]*charset=/i],
    ['#app main container', /id=["']app["']/],
    ['<main> element', /<main\b/i],
    ['<nav> element', /<nav\b/i],
    ['aria-label on nav', /<nav[^>]*aria-label=/i],
    ['#announcer live region', /id=["']announcer["']/],
    ['aria-live region present', /aria-live=/i],
    ['skip link to content', /class=["']skip-link["']/],
    ['back button (#back-btn)', /id=["']back-btn["']/],
    ['loads app.js as module', /<script[^>]*type=["']module["'][^>]*app\.js/i],
    ['links styles.css', /href=["']\.\/styles\.css["']/],
  ];
  for (const [label, re] of checks) {
    if (re.test(html)) pass(label);
    else fail(`missing: ${label}`);
  }
}

/* ----------------------------------------------------------------- verdict */
console.log('');
if (failures) {
  console.error(`FAILED: ${failures} check(s) did not pass.`);
  process.exit(1);
}
console.log('All checks passed.');
