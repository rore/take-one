import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from './process.mjs';
import { pieces } from './render-parallel.mjs';
import { parseArgs, buildPack } from './review-pack.mjs';
import { scaffold } from './new-canvas-project.mjs';

test('piece ranges include a short final piece without gaps', () => {
  assert.deepEqual(pieces(25, 12), [[0, 12], [12, 24], [24, 25]]);
});

test('review pack validates times and rejects reversed strips', () => {
  assert.equal(parseArgs(['cut.mp4', 'pack', '--beats', '0,1.5']).beats, '0,1.5');
  assert.throws(() => parseArgs(['cut.mp4', 'pack', '--beats', '1; echo nope']), /--beats takes times/);
  assert.throws(() => parseArgs(['cut.mp4', 'pack', '--strips', '4-2']), /must end after/);
});

test('review pack leaves a nonempty destination untouched', async () => {
  const root = await mkdtemp(join(tmpdir(), 'take-one-test-'));
  try {
    const video = join(root, 'dummy.mp4'), pack = join(root, 'pack with spaces');
    await writeFile(video, 'not a video'); await mkdir(pack); await writeFile(join(pack, 'keep.txt'), 'keep');
    await assert.rejects(buildPack([video, pack]), /holds other files/);
    assert.equal(await readFile(join(pack, 'keep.txt'), 'utf8'), 'keep');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('scaffold refuses a populated directory without changing it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'take-one-test-'));
  try {
    const dir = join(root, 'existing with spaces'); await mkdir(dir); await writeFile(join(dir, 'keep.txt'), 'keep');
    await assert.rejects(scaffold(dir), /already contains files/);
    assert.equal(await readFile(join(dir, 'keep.txt'), 'utf8'), 'keep');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('scaffold creates a local-dependency project at a path with spaces', async () => {
  const root = await mkdtemp(join(tmpdir(), 'take-one-test-'));
  try {
    const dir = join(root, 'new film project'); await scaffold(dir);
    const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
    assert.equal(pkg.dependencies['playwright-core'], '^1.63.0');
    assert.match(await readFile(join(dir, 'film.html'), 'utf8'), /window\.renderFrame=t=>/);
    assert.equal(await readFile(join(dir, 'springs.js'), 'utf8'), await readFile(new URL('./springs.js', import.meta.url), 'utf8'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('subprocess arguments preserve paths containing spaces', async () => {
  const value = 'a path/with spaces/file.mp4';
  const { stdout } = await run(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', value], { capture: true });
  assert.equal(stdout, value);
});
