#!/usr/bin/env node
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { run, commandPath } from './process.mjs';

const required = [];
const ok = (name, detail = '') => console.log(`  ok       ${name.padEnd(18)} ${detail}`);
const missing = (name, detail, list = required) => { console.log(`  MISSING  ${name.padEnd(18)} ${detail}`); list.push(name); };
const opt = (name, detail) => { console.log(`  optional ${name.padEnd(18)} ${detail}`); };
async function probe(command, args) {
  try { return (await run(command, args, { capture: true })).stdout.trim(); } catch { return null; }
}
async function main() {
  console.log('Take One: machine check\nRequired (every film):');
  const node = await probe(process.execPath, ['--version']);
  const major = Number(node?.replace(/^v/, '').split('.')[0]);
  if (major >= 20) ok('node', node); else missing('node', node ? `found ${node}, needs 20 or later` : 'install Node 20 or later (nodejs.org)');
  const npm = commandPath(process.platform === 'win32' ? 'npm' : 'npm');
  if (npm) {
    const v = await probe(process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : npm, process.platform === 'win32' ? ['/d', '/s', '/c', 'npm.cmd --version'] : ['--version']);
    v ? ok('npm', v) : missing('npm', 'could not execute npm');
  }
  else missing('npm', 'comes with Node; installs playwright-core in each film project');

  for (const name of ['ffmpeg', 'ffprobe']) {
    const path = commandPath(name), v = path && await probe(path, name === 'ffmpeg' ? ['-version'] : ['-version']);
    if (v) ok(name, name === 'ffmpeg' ? v.split(/\r?\n/)[0].split(' ').slice(1, 3).join(' ') : 'available');
    else missing(name, name === 'ffprobe' ? 'ships with ffmpeg' : 'joins the frames and mixes the sound');
  }

  const chromeCandidates = [
    join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe'),
    join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
    join(homedir(), 'AppData/Local/Google/Chrome/Application/chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'google-chrome', 'google-chrome-stable',
  ];
  let chrome = null, chromeVersion = '';
  for (const name of chromeCandidates) {
    const candidate = commandPath(name) || (name.includes('/') || name.includes('\\') ? name : null);
    if (!candidate || !awaitProbe(candidate)) continue;
    const version = await probe(candidate, ['--version']);
    if (/\b(?:Google Chrome|Chromium)\b/i.test(version || '')) { chrome = candidate; chromeVersion = version; break; }
  }
  if (chrome) ok('Google Chrome', chromeVersion);
  else missing('Google Chrome', 'the frames are drawn in Chrome; install it (google.com/chrome)');

  let playwright = null;
  try { playwright = createRequire(resolve(process.cwd(), 'package.json'))('playwright-core'); } catch {}
  if (playwright) ok('playwright-core', 'loaded successfully');
  else missing('playwright-core', 'run npm install in the film project');

  console.log('Optional (only some films):');
  const py = commandPath(process.platform === 'win32' ? 'python' : 'python3') || commandPath('python');
  if (py) {
    const version = await probe(py, ['--version']);
    version ? ok('python3', version.replace(/^Python\s+/, '')) : opt('python3', 'found but could not execute');
    const imports = await probe(py, ['-c', 'import numpy, scipy, PIL; print("numpy + scipy + Pillow")']);
    imports ? ok('numpy + scipy + Pillow', 'available for music mapping, image analysis and video helpers') : opt('numpy + scipy + Pillow', 'needed by songmap.py and some image/video helpers; install with python -m pip install numpy scipy Pillow');
  } else opt('python3', 'needed for music mapping, voice cutting and video clips');
  const whisper = commandPath('whisper-cli');
  whisper && await probe(whisper, ['--help']) ? ok('whisper-cli', 'available') : opt('whisper-cli', 'checks a recorded voice against the script (whisper.cpp)');
  if (process.platform === 'darwin') {
    const swift = commandPath('swift'); swift && await probe(swift, ['--version']) ? ok('swift', 'available for cut-outs') : opt('swift', 'needed for cut-outs; comes with Xcode command line tools');
  } else opt('swift', 'cut-outs work on macOS only; other routes are unaffected');
  console.log('Not checked here: paid services (pictures, video, voice, music). The skill asks before it uses any, and works without them.');
  if (required.length) { console.log('Not ready: install what is marked MISSING, then run this again.'); process.exitCode = 1; }
  else console.log('Ready: the code-only route will run on this machine.');
}
function awaitProbe(path) {
  try { return requireAccess(path); } catch { return false; }
}
import { accessSync, constants } from 'node:fs';
function requireAccess(path) { accessSync(path, constants.F_OK); return true; }
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
