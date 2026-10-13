// Append-only, per-film measurements. Never infer billing from a subscription or unavailable token counts.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const [action, ledger, ...args] = process.argv.slice(2);
function validate(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('record must be a JSON object');
  if (typeof entry.kind !== 'string' || !entry.kind.trim()) throw new Error('record needs a kind');
  if (!['actual', 'estimate', 'unavailable'].includes(entry.status)) throw new Error('status must be actual, estimate or unavailable');
  if (entry.status === 'unavailable') {
    if (entry.value !== undefined) throw new Error('unavailable measurements cannot have a value');
  } else if (!Number.isFinite(entry.value) || entry.value < 0 || typeof entry.unit !== 'string' || !entry.unit.trim()) {
    throw new Error('actual/estimate records need a non-negative finite value and a unit');
  }
  return entry;
}
function append(entry) {
  validate(entry);
  fs.mkdirSync(path.dirname(path.resolve(ledger)), { recursive: true });
  fs.appendFileSync(ledger, JSON.stringify({ ...entry, at: new Date().toISOString() }) + '\n');
}
try {
  if (!ledger) throw new Error('usage: cost.mjs run <ledger.jsonl> <stage> -- <executable> [args...] | record <ledger.jsonl> <JSON> | report <ledger.jsonl>');
  if (action === 'record') {
    if (args.length !== 1) throw new Error('record requires one JSON object argument');
    append(JSON.parse(args[0]));
  } else if (action === 'run') {
    const [stage, separator, command, ...commandArgs] = args;
    if (!stage || separator !== '--' || !command) throw new Error('run requires <stage> -- <executable> [args...]');
    // Ensure the ledger is writable before starting potentially costly work. Arguments may contain secrets, so do not log them.
    fs.mkdirSync(path.dirname(path.resolve(ledger)), { recursive: true });
    fs.closeSync(fs.openSync(ledger, 'a'));
    const start = performance.now();
    const child = spawn(command, commandArgs, { stdio: 'inherit', windowsHide: true });
    const result = await new Promise(resolve => {
      child.once('error', error => resolve({ exitCode: null, error: error.message }));
      child.once('close', (exitCode, signal) => resolve({ exitCode, signal }));
    });
    append({ kind: 'execution', status: 'actual', stage, value: (performance.now() - start) / 1000, unit: 'seconds', executable: path.basename(command), ...result });
    process.exitCode = result.exitCode === 0 ? 0 : (result.exitCode || 1);
  } else if (action === 'report') {
    const entries = fs.readFileSync(ledger, 'utf8').split(/\r?\n/).filter(line => line.trim()).map(line => validate(JSON.parse(line)));
    const totals = new Map();
    for (const entry of entries) {
      if (entry.status === 'unavailable') continue;
      const key = JSON.stringify([entry.status, entry.kind, entry.unit, entry.provider || '', entry.model || '']);
      totals.set(key, (totals.get(key) || 0) + entry.value);
    }
    console.log('Totals (actual and estimate kept separate; execution seconds are summed command time, not elapsed production time):');
    for (const [key, value] of totals) {
      const [status, kind, unit, provider, model] = JSON.parse(key);
      console.log(`${status} | ${kind} | ${Number(value.toFixed(4))} ${unit}${provider ? ` | ${provider}` : ''}${model ? ` | ${model}` : ''}`);
    }
    for (const entry of entries.filter(e => e.status === 'unavailable')) console.log(`unavailable | ${entry.kind}${entry.provider ? ` | ${entry.provider}` : ''}${entry.note ? ` | ${entry.note}` : ''}`);
    const failures = entries.filter(e => e.kind === 'execution' && e.exitCode !== 0).length;
    console.log(`${entries.length} records; ${failures} failed command(s). Missing metrics are unknown, not zero. Storage entries should be additions, not repeated cumulative snapshots.`);
  } else throw new Error(`unknown action: ${action}`);
} catch (error) { console.error(`cost: ${error.message}`); process.exitCode = 1; }
