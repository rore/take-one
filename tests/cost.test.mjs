import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('../scripts/cost.mjs', import.meta.url));
test('cost ledger separates currencies, providers, estimates and unavailable usage', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'take-one-cost-')), ledger = path.join(dir, 'costs.jsonl');
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', windowsHide: true });
  try {
    for (const entry of [
      { kind: 'money', status: 'actual', value: 2, unit: 'USD', provider: 'A' },
      { kind: 'money', status: 'actual', value: 3, unit: 'EUR', provider: 'A' },
      { kind: 'money', status: 'estimate', value: 10, unit: 'USD', provider: 'A' },
      { kind: 'credits', status: 'actual', value: 7, unit: 'credits', provider: 'B' },
      { kind: 'usage', status: 'unavailable', provider: 'Codex', note: 'Not exposed' },
    ]) assert.equal(run('record', ledger, JSON.stringify(entry)).status, 0);
    const before = fs.readFileSync(ledger, 'utf8');
    assert.notEqual(run('record', ledger, '{"kind":"usage","status":"unavailable","value":0}').status, 0);
    assert.equal(fs.readFileSync(ledger, 'utf8'), before);
    const report = run('report', ledger);
    assert.equal(report.status, 0);
    assert.match(report.stdout, /actual \| money \| 2 USD \| A/);
    assert.match(report.stdout, /actual \| money \| 3 EUR \| A/);
    assert.match(report.stdout, /estimate \| money \| 10 USD \| A/);
    assert.match(report.stdout, /unavailable \| usage \| Codex/);
    const failure = run('run', ledger, 'failed draft', '--', process.execPath, '-e', 'process.exit(7)', 'SECRET_ARGUMENT');
    assert.equal(failure.status, 7);
    const text = fs.readFileSync(ledger, 'utf8'), last = JSON.parse(text.trim().split('\n').at(-1));
    assert.equal(last.exitCode, 7);
    assert.ok(last.value >= 0);
    assert.doesNotMatch(text, /SECRET_ARGUMENT/);
    assert.match(run('report', ledger).stdout, /1 failed command/);
    assert.notEqual(run('run', ledger, 'missing executable', '--', path.join(dir, 'absent')).status, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
