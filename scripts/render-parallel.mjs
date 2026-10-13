#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { isMain, run } from './process.mjs';

export function pieces(duration, piece) {
  return Array.from({ length: Math.ceil(duration / piece) }, (_, i) => [i * piece, Math.min((i + 1) * piece, duration)]);
}
function argsOf(argv) {
  const [fps, duration, out, workers = '3', piece = '12'] = argv;
  const values = [fps, duration, workers, piece].map(Number);
  if (!out || values.some(v => !Number.isFinite(v) || v <= 0) || !Number.isInteger(values[2])) throw new Error('Usage: render-parallel <fps> <duration_s> <out.mp4> [workers=3] [piece_s=12]');
  return { fps: values[0], duration: values[1], out: resolve(out), workers: Math.floor(values[2]), piece: values[3] };
}
async function renderPiece(index, [start, end], fps, temp) {
  const video = join(temp, `p${index}.mp4`), log = join(temp, `p${index}.log`);
  const output = createWriteStream(log);
  const child = spawn(process.execPath, ['export.mjs', String(fps), video], {
    env: { ...process.env, START: String(start), END: String(end) },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  child.stdout.pipe(output, { end: false });
  child.stderr.pipe(output, { end: false });
  const result = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  }).finally(() => output.end());
  if (result.code === 0) return;
  const tail = (await readFile(log, 'utf8').catch(() => '')).slice(-600).replace(/\r/g, '\n').split('\n').filter(line => !line.startsWith('frame=')).slice(-8).join('\n');
  throw new Error(`piece ${index} failed (exit ${result.code ?? result.signal})${tail ? `:\n${tail}` : ''}`);
}
export async function render(argv) {
  const { fps, duration, out, workers, piece } = argsOf(argv);
  const ranges = pieces(duration, piece), parent = dirname(out);
  await mkdir(parent, { recursive: true });
  const temp = await mkdtemp(join(parent, `.${basename(out, extname(out))}.pieces-`));
  try {
    let next = 0, failure = null;
    await Promise.all(Array.from({ length: Math.min(workers, ranges.length) }, async () => {
      while (!failure && next < ranges.length) {
        const i = next++;
        try { await renderPiece(i, ranges[i], fps, temp); } catch (error) { failure ||= error; }
      }
    }));
    if (failure) throw failure;
    const list = ranges.map((_, i) => `file 'p${i}.mp4'`).join('\n') + '\n';
    await writeFile(join(temp, 'list.txt'), list);
    for (let i = 0; i < ranges.length; i++) await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(temp, `p${i}.mp4`)], { capture: true });
    await run('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(temp, 'list.txt'), '-c', 'copy', out]);
    const gotText = (await run('ffprobe', ['-v', 'error', '-count_packets', '-select_streams', 'v', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', out], { capture: true })).stdout.trim();
    const got = Number(gotText), want = Math.floor(duration * fps);
    console.log(`wrote ${out}: ${gotText} frames (expected about ${want})`);
    if (!Number.isFinite(got) || got < want - 2) throw new Error(`frame count is short: a piece stopped early, read its log in ${temp}`);
    await rm(temp, { recursive: true, force: true });
  } catch (error) {
    if (!error.message.includes(temp)) error.message += `\nintermediate pieces and logs kept in ${temp}`;
    throw error;
  }
}
if (isMain(import.meta.url)) render(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
