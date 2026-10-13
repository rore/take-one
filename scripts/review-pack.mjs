#!/usr/bin/env node
import { access, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { run } from './process.mjs';

const number = String.raw`[0-9]+(?:\.[0-9]+)?`;
export function parseArgs(args) {
  if (args.length < 2) throw new Error('Usage: review-pack <cut.mp4> <pack_dir> [--beats times] [--strips ranges] [--text times]');
  const [video, pack, ...rest] = args, options = { video, pack, beats: '', strips: '', text: '' };
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i], value = rest[i + 1];
    if (!['--beats', '--strips', '--text'].includes(key) || value === undefined) throw new Error(`unknown or incomplete option ${key}`);
    options[key.slice(2)] = value;
  }
  for (const key of ['beats', 'text']) {
    if (options[key] && !new RegExp(`^${number}(?:,${number})*$`).test(options[key])) throw new Error(`--${key} takes times in seconds, like 0,1.5,4.8`);
  }
  if (options.strips && !new RegExp(`^${number}-${number}(?:,${number}-${number})*$`).test(options.strips)) throw new Error('--strips takes ranges in seconds, like 9.2-11.6,66.0-67.2');
  const ranges = options.strips ? options.strips.split(',').map(r => r.split('-').map(Number)) : [];
  if (ranges.some(([a, b]) => b <= a)) throw new Error('--strips ranges must end after they start');
  return { ...options, ranges };
}
async function emptyOrNewDirectory(path) {
  try {
    const entries = await readdir(path);
    if (entries.length) throw new Error(`${path} holds other files; give a new or empty folder for the pack`);
  } catch (error) { if (error.code !== 'ENOENT') throw error; await mkdir(path, { recursive: true }); }
}
export async function buildPack(args) {
  const { video, pack, beats: beatArg, text: textArg, ranges } = parseArgs(args);
  try { await access(video); } catch { throw new Error(`no such film: ${video}`); }
  await emptyOrNewDirectory(pack);
  const duration = Number((await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video], { capture: true })).stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('could not read film duration');
  const temp = await mkdtemp(join(tmpdir(), 'take-one-review-'));
  try {
    const D = Math.floor(duration);
    for (let start = 0, part = 1; start < D; start += 40, part++) {
      await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(start), '-t', '39.9', '-i', video, '-vf', 'fps=1,scale=400:-1,tile=8x5:padding=4:color=gray', '-frames:v', '1', resolve(pack, `sheet_1fps_part${part}.png`)]);
    }
    const beats = beatArg || Array.from({ length: 36 }, (_, i) => (duration * i / 35.5).toFixed(1)).join(',');
    const beatTimes = beats.split(',');
    for (let i = 0; i < beatTimes.length; i++) {
      const time = beatTimes[i];
      await run('ffmpeg', ['-v', 'error', '-y', '-ss', time, '-i', video, '-frames:v', '1', '-vf', 'scale=640:-1', join(temp, `b${String(i).padStart(3, '0')}.png`)]);
      if (i % 5 === 0) await run('ffmpeg', ['-v', 'error', '-y', '-ss', time, '-i', video, '-frames:v', '1', resolve(pack, `full_t${time}.png`)]);
    }
    for (let start = 0, group = 1; start < beatTimes.length; start += 9, group++) {
      await run('ffmpeg', ['-v', 'error', '-y', '-start_number', String(start), '-i', join(temp, 'b%03d.png'), '-frames:v', '9', '-vf', 'tile=3x3', '-frames:v', '1', resolve(pack, `beats_grid${group}.png`)]);
    }
    for (const [a, b] of ranges) {
      const len = b - a;
      await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(a), '-t', String(len), '-i', video, '-vf', `fps=12/${len},scale=480:-1,tile=4x3:padding=3:color=gray`, '-frames:v', '1', resolve(pack, `strip_${a}-${b}.png`)]);
    }
    const textTimes = (textArg || beats).split(',').slice(0, 20);
    for (let i = 0; i < textTimes.length; i++) await run('ffmpeg', ['-v', 'error', '-y', '-ss', textTimes[i], '-i', video, '-frames:v', '1', '-vf', 'scale=360:-1', join(temp, `p${String(i).padStart(3, '0')}.png`)]);
    await run('ffmpeg', ['-v', 'error', '-y', '-i', join(temp, 'p%03d.png'), '-vf', `tile=5x${Math.ceil(textTimes.length / 5)}`, '-frames:v', '1', resolve(pack, 'phone_360px.png')]);
    await writeFile(resolve(pack, 'WORDS-AND-SOUND.md'), `# The film: ${Math.floor(duration)} s. FILL IN: format, where it posts.\nAudience: FILL IN (who it is for). It will often be seen muted, on a phone, once.\n\n## Words spoken or sung, with film times\nFILL IN, one line per phrase:  <time>  <words>\n\n## Sound report (the reviewer cannot hear it)\nFILL IN from scripts/audio-check.mjs and scripts/songmap.py: loudness and true peak; where the music is quiet, where it hits hardest; any sound effects and where they land.\n\n## Beat times in beats_grid*.png, in order\n${beats}\n\n## Files\nsheet_1fps_part*.png (one frame per second), beats_grid*.png (9 per grid, times above), full_t*.png (full size), strip_*.png (12 frames across a fast move, range in the name), phone_360px.png (frames with words at phone width). The film itself: ${basename(video)}.\n`);
    console.log(`pack in ${pack}: ${(await readdir(pack)).length} files. Fill in WORDS-AND-SOUND.md before handing it over.`);
  } finally { await rm(temp, { recursive: true, force: true }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) buildPack(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
