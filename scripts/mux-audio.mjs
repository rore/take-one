#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { run } from './process.mjs';

export async function mux(video, audio, out) {
  if (!video || !audio || !out) throw new Error('Usage: mux-audio <video.mp4> <audio.wav|mp3> <out.mp4>');
  await run('ffmpeg', ['-y', '-v', 'error', '-i', video, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out]);
  console.log(`wrote ${out}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) mux(...process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
