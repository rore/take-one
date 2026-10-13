// Export film.html to MP4 frame by frame via window.renderFrame(t).
// Usage: node export.mjs [fps=60] [out=film.mp4]     env: FILM=film.html W=1920 H=1080 SLOW=1 (time-stretch)
// START/END (seconds, output time): render only that range, for re-rendering changed shots and splicing (see pipeline.md)
// SUB=N: subframe motion blur. Renders N subframes per output frame (t + k/(fps*N), k=0..N-1) and averages them
//        in ffmpeg (tmix). Default off (1). SUB=8 for the final master of smooth-motion styles; never for stepped
//        art (pixel, pencil test, crayon boil), where the hold IS the look. Costs N x the render time.
// ALPHA=1: the page draws a transparent overlay (HUD) instead of a full frame; writes ProRes 4444 with alpha (use out=hud.mov)
//          then composite: ffmpeg -i footage.mp4 -i hud.mov -filter_complex overlay -c:v libx264 -crf 14 -pix_fmt yuv420p final.mp4
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { serve } from './serve.mjs';
const fps = Number(process.argv[2] || 60), out = process.argv[3] || 'film.mp4';
const W = Number(process.env.W || 1920), H = Number(process.env.H || 1080), SLOW = Number(process.env.SLOW || 1);
const SUB = Math.max(1, Math.round(Number(process.env.SUB || 1)));
const FILM = process.env.FILM || 'film.html';
if (![fps, W, H, SLOW, SUB].every(n => Number.isFinite(n) && n > 0)) throw new Error('fps, W, H, SLOW and SUB must be positive numbers');
const { srv, url } = await serve('.');
let browser, ff;
try {
browser = await chromium.launch({ channel: 'chrome', headless: true, args: process.platform === 'darwin' ? ['--use-angle=metal', '--ignore-gpu-blocklist'] : [] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.goto(url + '/' + FILM + (H > W ? '?portrait=1' : ''));
await page.waitForFunction(() => typeof window.renderFrame === 'function' && window.READY === true, null, { timeout: 120000 });
const duration = await page.evaluate(() => window.FILM_DURATION || 30);
const T0 = Number(process.env.START || 0), T1 = Number(process.env.END || duration * SLOW);
if (!Number.isFinite(T0) || !Number.isFinite(T1) || T0 < 0 || T1 <= T0) throw new Error('START/END must describe a positive duration');
const f0 = Math.round(T0 * fps), frames = Math.round(T1 * fps);
const enc = process.env.ALPHA ? ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le'] : ['-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
// SUB > 1: input runs at fps*SUB; tmix averages each run of SUB, select keeps the last of each group (= one whole group), setpts re-times to fps
const blur = SUB > 1 ? `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/(${fps}*TB),` : '';
ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(fps * SUB), '-i', '-', '-vf', `${blur}scale=${W}:${H}:flags=lanczos`, '-r', String(fps), ...enc, out], { stdio: ['pipe', 'ignore', 'inherit'], windowsHide: true });
const encoded = new Promise((resolve, reject) => {
  ff.once('error', reject);
  ff.once('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)));
});
async function* pngFrames() {
for (let i = f0; i < frames; i++) {
  for (let k = 0; k < SUB; k++) {
    const b64 = await page.evaluate(async (t) => { await window.renderFrame(t); const c = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0]; return c.toDataURL('image/png').split(',')[1]; }, (i + k / SUB) / fps / SLOW);
    yield Buffer.from(b64, 'base64');
  }
  if (i % fps === 0) process.stdout.write(`\r${(i / fps).toFixed(0)}s / ${(duration * SLOW).toFixed(1)}s${SUB > 1 ? `  (SUB=${SUB})` : ''}`);
}
}
await Promise.all([pipeline(Readable.from(pngFrames()), ff.stdin), encoded]);
console.log(`\nwrote ${out}`);
} finally {
  if (ff && ff.exitCode === null) ff.kill();
  try { await browser?.close(); } finally { srv.close(); }
}
