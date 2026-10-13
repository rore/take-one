#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { run } from './process.mjs';

export async function contactSheet(video, out = `./ref-${basename(video || 'video', extname(video || 'video'))}`) {
  if (!video) throw new Error('Usage: contact-sheet <video> [outdir]');
  const durationText = (await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video], { capture: true })).stdout.trim();
  const duration = Number(durationText);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`invalid video duration: ${durationText}`);
  await mkdir(out, { recursive: true });
  await run('ffmpeg', ['-y', '-v', 'error', '-i', video, '-vf', `fps=24/${duration},scale=480:-1,tile=6x4:padding=4`, '-frames:v', '1', resolve(out, 'sheet.png')]);
  for (const fraction of [0.15, 0.5, 0.8]) {
    const time = duration * fraction;
    await run('ffmpeg', ['-y', '-v', 'error', '-ss', String(time), '-i', video, '-frames:v', '1', '-vf', 'scale=1280:-1', resolve(out, `frame-${fraction}.png`)]);
  }
  await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height,r_frame_rate:format=duration', '-of', 'default=nw=1', video]);
  console.log(`wrote ${resolve(out, 'sheet.png')} and 3 frames`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) contactSheet(process.argv[2], process.argv[3]).catch(error => { console.error(error.message); process.exitCode = 1; });
