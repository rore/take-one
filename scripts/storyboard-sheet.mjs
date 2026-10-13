#!/usr/bin/env node
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isMain, run } from './process.mjs';

export async function storyboard(dir, out, columns = 4) {
  if (!dir || !out) throw new Error('Usage: storyboard-sheet <folder of frames> <out.png> [columns=4]');
  columns = Number(columns);
  if (!Number.isInteger(columns) || columns < 1) throw new Error('columns must be a positive integer');
  const files = (await readdir(dir, { withFileTypes: true }))
    .filter(entry => entry.isFile() && /\.(png|jpe?g|webp)$/i.test(entry.name))
    .map(entry => entry.name).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!files.length) throw new Error(`no frames in ${dir}`);
  const temp = await mkdtemp(join(tmpdir(), 'take-one-storyboard-'));
  try {
    for (let i = 0; i < files.length; i++) {
      const target = join(temp, `s${String(i).padStart(3, '0')}.png`);
      await run('ffmpeg', ['-v', 'error', '-y', '-i', join(dir, files[i]), '-vf', 'scale=480:270:force_original_aspect_ratio=decrease,pad=480:270:(ow-iw)/2:(oh-ih)/2:color=0x101010', target]);
    }
    const rows = Math.ceil(files.length / columns);
    await run('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', join(temp, 's%03d.png'), '-vf', `tile=${columns}x${rows}:padding=6:margin=6:color=0x202020`, '-frames:v', '1', out]);
    console.log(`storyboard sheet: ${out} (${files.length} shots, read left to right, top to bottom)`);
  } finally { await rm(temp, { recursive: true, force: true }); }
}
if (isMain(import.meta.url)) storyboard(...process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
