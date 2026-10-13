// A short synthetic film exercises the native pipeline; requires npm ci, Chrome, ffmpeg and ffprobe.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
fs.mkdirSync(path.join(root, '.local'), { recursive: true });
const dir = fs.mkdtempSync(path.join(root, '.local', 'smoke with spaces-'));
const env = { ...process.env, W: '480', H: '270', GATE_TMP: dir };
const started = Date.now();
function run(command, args, expected = 0) {
  const result = spawnSync(command, args, { cwd: dir, env, encoding: 'utf8', timeout: 120000, windowsHide: true });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, expected, `${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
const node = (script, args = [], expected = 0) => run(process.execPath, [path.join(root, 'scripts', script), ...args], expected);
const probe = file => JSON.parse(run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]));

console.log(`Smoke test artifacts: ${dir}`);
// The scaffold must preserve unrelated existing files and requires explicit dependency installation.
node('new-canvas-project.mjs', ['film project']);
const project = path.join(dir, 'film project');
for (const name of ['serve.mjs', 'frames.mjs', 'export.mjs', 'springs.js']) fs.copyFileSync(path.join(project, name), path.join(dir, name));
fs.writeFileSync(path.join(dir, 'film.html'), `<!doctype html><html><body style="margin:0"><canvas id="c" width="480" height="270"></canvas><script>
const g=document.getElementById('c').getContext('2d');window.FILM_DURATION=3;
window.renderFrame=t=>{g.fillStyle='#081018';g.fillRect(0,0,480,270);g.fillStyle='#e8b84b';g.fillRect(30+t*85,100,110,100);window.__hits=[];window.__shot=1;};window.READY=true;
</script></body></html>`);
run(process.execPath, ['export.mjs', '12', 'silent.mp4']);
assert.equal(probe('silent.mp4').streams[0].nb_frames, '36');
run(process.execPath, ['frames.mjs', '0', '0,1,2']);
assert.ok(fs.statSync(path.join(dir, 'review/square/sheet.png')).size > 0);
assert.match(node('gate.mjs', ['film.html', '--mp4', 'silent.mp4']), /GATE: PASS/);
node('text-audit.mjs', ['film.html']);
node('audit-faces.mjs', ['0', '0.5']);
node('render-parallel.mjs', ['12', '3', 'parallel.mp4', '2', '1']);
assert.equal(probe('parallel.mp4').streams[0].nb_frames, '36');
run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', 'sound.wav']);
node('mux-audio.mjs', ['silent.mp4', 'sound.wav', 'finished.mp4']);
assert.deepEqual(probe('finished.mp4').streams.map(s => s.codec_type).sort(), ['audio', 'video']);
node('contact-sheet.mjs', ['finished.mp4', 'contact sheet']);
node('storyboard-sheet.mjs', ['review/square', 'storyboard.png']);
node('review-pack.mjs', ['finished.mp4', 'review pack', '--beats', '0,1,2', '--strips', '1-2', '--text', '0,1']);
assert.ok(fs.existsSync(path.join(dir, 'review pack/WORDS-AND-SOUND.md')));
// A failed encoder must fail the export rather than reporting success or hanging.
const badExport = spawnSync(process.execPath, ['export.mjs', '12', 'missing/output.mp4'], { cwd: dir, env, encoding: 'utf8', timeout: 30000, windowsHide: true });
assert.equal(badExport.error, undefined, badExport.error?.message);
assert.notEqual(badExport.status, 0);
assert.doesNotMatch(badExport.stdout, /wrote missing/);

const server = spawn(process.execPath, [path.join(root, 'scripts/review-room/server.mjs'), dir, '0'], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
try {
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('review room did not start')), 10000);
    let output = '';
    server.stdout.on('data', data => { output += data; const match = output.match(/localhost:(\d+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`review room exited ${code}`)); });
  });
  const base = `http://127.0.0.1:${port}`;
  assert.equal((await fetch(base)).status, 200);
  const cuts = await (await fetch(`${base}/api/cuts`)).json();
  assert.ok(cuts.some(c => c.name === 'finished.mp4'));
  assert.equal((await fetch(`${base}/video/finished.mp4`, { headers: { Range: 'bytes=0-15' } })).status, 206);
  assert.equal((await fetch(`${base}/api/notes`, { method: 'POST', headers: { Origin: 'http://other.test' }, body: '{}' })).status, 403);
  assert.equal((await fetch(`${base}/api/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cut: 'finished.mp4', t: 1, text: 'Synthetic smoke test' }) })).status, 200);
  assert.equal((await (await fetch(`${base}/api/notes`)).json()).notes[0].text, 'Synthetic smoke test');
} finally { server.kill(); }
console.log(`PASS: render, frames, gate, parallel export, sound, review images, review room and encoder failure (${((Date.now() - started) / 1000).toFixed(1)}s).`);
