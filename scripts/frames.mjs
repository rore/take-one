// Render review frames of film.html (served over local http) + a contact sheet.
// Usage: node frames.mjs <portrait 0|1> <t1,t2,...>     env: FILM=film.html W=1920 H=1080
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve } from './serve.mjs';
const portrait = process.argv[2] === '1';
const times = (process.argv[3] || '0,1,2,3,4,5').split(',').map(Number);
if (!times.every(t => Number.isFinite(t) && t >= 0)) throw new Error('frame times must be non-negative numbers');
const FILM = process.env.FILM || 'film.html';
const W = Number(process.env.W || (portrait ? 1080 : 1920)), H = Number(process.env.H || (portrait ? 1350 : 1080));
const dir = (FILM === 'film.html' ? 'review/' : 'review-' + FILM.replace('.html', '') + '/') + (portrait ? 'portrait' : 'square');
fs.mkdirSync(dir, { recursive: true });
const { srv, url } = await serve('.');
let browser;
const errs = [], frames = [];
try {
browser = await chromium.launch({ channel: 'chrome', headless: true, args: process.platform === 'darwin' ? ['--use-angle=metal', '--ignore-gpu-blocklist'] : [] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location()?.url ?? '')) errs.push(m.text()); });
await page.goto(url + '/' + FILM + (portrait ? '?portrait=1' : ''));
await page.waitForFunction(() => typeof window.renderFrame === 'function' && window.READY === true, null, { timeout: 120000 });
for (const t of times) {
  const b64 = await page.evaluate(async (t) => { await window.renderFrame(t); const c = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0]; return c.toDataURL('image/png').split(',')[1]; }, t);
  const file = `${dir}/t${t.toFixed(2).padStart(5, '0')}.png`;
  fs.writeFileSync(file, Buffer.from(b64, 'base64')); frames.push(file);
}
} finally { try { await browser?.close(); } finally { srv.close(); } }
const cols = 6, rows = Math.max(1, Math.ceil(frames.length / cols));
// Numbered inputs work on Windows builds without glob support and exclude stale frames.
const sheet = fs.mkdtempSync(path.join(dir, '.sheet-'));
try {
  frames.forEach((file, i) => fs.copyFileSync(file, path.join(sheet, `f${String(i).padStart(6, '0')}.png`)));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(sheet, 'f%06d.png'), '-vf', `scale=360:-1,tile=${cols}x${rows}:padding=6:color=gray`, '-frames:v', '1', `${dir}/sheet.png`], { windowsHide: true });
} finally { fs.rmSync(sheet, { recursive: true, force: true }); }
console.log(errs.length ? 'CONSOLE ERRORS:\n' + errs.join('\n') : 'no console errors', '\nframes + sheet:', dir);
if (errs.length) process.exitCode = 1;
