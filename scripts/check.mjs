#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './process.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
async function modules(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') files.push(...await modules(path));
    else if (entry.isFile() && entry.name.endsWith('.mjs')) files.push(path);
  }
  return files;
}
try {
  const files = [...await modules(join(root, 'scripts')), ...await modules(join(root, 'assets', 'previews-src'))];
  for (const file of files) await run(process.execPath, ['--check', file]);
  for (const [name, target] of Object.entries({
    'doctor.sh': 'doctor.mjs', 'new-canvas-project.sh': 'new-canvas-project.mjs',
    'render-parallel.sh': 'render-parallel.mjs', 'mux-audio.sh': 'mux-audio.mjs',
    'storyboard-sheet.sh': 'storyboard-sheet.mjs', 'contact-sheet.sh': 'contact-sheet.mjs', 'review-pack.sh': 'review-pack.mjs',
  })) {
    const source = await readFile(join(root, 'scripts', name), 'utf8');
    if (!source.includes(`exec node "$(dirname "$0")/${target}" "$@"`)) throw new Error(`${name} must forward arguments to ${target}`);
  }
  console.log('all JavaScript modules parse');
} catch (error) { console.error(error.message); process.exitCode = 1; }
