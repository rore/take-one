#!/usr/bin/env node
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { run, commandPath, isMain } from './process.mjs';

const required = [];
const ok = (name, detail = '') => console.log(`  ok       ${name.padEnd(18)} ${detail}`);
const missing = (name, detail) => { console.log(`  MISSING  ${name.padEnd(18)} ${detail}`); required.push(name); };
const opt = (name, detail) => console.log(`  optional ${name.padEnd(18)} ${detail}`);
async function probe(command, args) {
  try {
    const result = await run(command, args, { capture: true, timeout: 15000 });
    return result.stdout.trim() || result.stderr.trim();
  } catch { return null; }
}
export async function findPython(runProbe = probe, preferred = process.env.PYTHON, windows = process.platform === 'win32', find = commandPath) {
  const choices = [];
  if (preferred) choices.push([preferred, []]);
  for (const name of windows ? ['python', 'python3', 'py'] : ['python3', 'python']) {
    const executable = find(name);
    if (executable && !choices.some(([path]) => path === executable)) choices.push([executable, name === 'py' ? ['-3'] : []]);
  }
  for (const [executable, prefix] of choices) {
    const version = await runProbe(executable, [...prefix, '--version']);
    if (!version) continue;
    const imports = await runProbe(executable, [...prefix, '-c', 'import numpy, scipy, PIL; print("numpy + scipy + Pillow")']);
    if (imports) return { version: version.replace(/^Python\s+/, ''), imports };
  }
  return null;
}
export function loadPlaywright(cwd = process.cwd()) {
  for (const load of [createRequire(resolve(cwd, 'package.json')), createRequire(import.meta.url)]) {
    try { return load('playwright-core'); } catch {}
  }
  return null;
}
async function main() {
  console.log('Take One: machine check\nRequired (every film):');
  const node = await probe(process.execPath, ['--version']);
  const major = Number(node?.replace(/^v/, '').split('.')[0]);
  if (major >= 20) ok('node', node); else missing('node', node ? `found ${node}, needs 20 or later` : 'install Node 20 or later (nodejs.org)');
  const npm = commandPath('npm');
  if (npm) {
    const v = await probe(process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : npm, process.platform === 'win32' ? ['/d', '/s', '/c', 'npm.cmd --version'] : ['--version']);
    v ? ok('npm', v) : missing('npm', 'could not execute npm');
  } else missing('npm', 'comes with Node; installs playwright-core in each film project');

  for (const name of ['ffmpeg', 'ffprobe']) {
    const path = commandPath(name), version = path && await probe(path, ['-version']);
    if (version) ok(name, name === 'ffmpeg' ? version.split(/\r?\n/)[0].split(' ').slice(1, 3).join(' ') : 'available');
    else missing(name, name === 'ffprobe' ? 'ships with ffmpeg' : 'joins the frames and mixes the sound');
  }

  const playwright = loadPlaywright();
  if (playwright) {
    let browser;
    try {
      browser = await playwright.chromium.launch({ channel: 'chrome', headless: true, timeout: 15000 });
      ok('Google Chrome', browser.version());
      ok('playwright-core', 'launched Chrome successfully');
    } catch (error) {
      ok('playwright-core', 'loaded successfully');
      missing('Google Chrome', `could not launch through Playwright (${error.message.split('\n')[0]})`);
    } finally { await browser?.close().catch(() => {}); }
  } else {
    missing('playwright-core', 'run npm install in the film project');
    opt('Google Chrome', 'not checked because playwright-core is unavailable');
  }

  console.log('Optional (only some films):');
  const python = await findPython();
  if (python) {
    ok('python3', python.version);
    ok('numpy + scipy + Pillow', 'available for music mapping, image analysis and video helpers');
  } else {
    opt('python3', 'needed for music mapping, voice cutting and video clips');
    opt('numpy + scipy + Pillow', 'needed by songmap.py and some image/video helpers; install with python -m pip install numpy scipy Pillow');
  }
  const whisper = commandPath('whisper-cli');
  whisper && await probe(whisper, ['--help']) ? ok('whisper-cli', 'available') : opt('whisper-cli', 'checks a recorded voice against the script (whisper.cpp)');
  if (process.platform === 'darwin') {
    const swift = commandPath('swift'); swift && await probe(swift, ['--version']) ? ok('swift', 'available for cut-outs') : opt('swift', 'needed for cut-outs; comes with Xcode command line tools');
  } else opt('swift', 'cut-outs work on macOS only; other routes are unaffected');
  console.log('Not checked here: paid services (pictures, video, voice, music). The skill asks before it uses any, and works without them.');
  if (required.length) { console.log('Not ready: install what is marked MISSING, then run this again.'); process.exitCode = 1; }
  else console.log('Ready: the code-only route will run on this machine.');
}
if (isMain(import.meta.url)) main();
