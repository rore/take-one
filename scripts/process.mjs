import { spawn } from 'node:child_process';
import { accessSync, constants } from 'node:fs';

export function run(command, args = [], options = {}) {
  const { capture = false, ...spawnOptions } = options;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...spawnOptions,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    let stdout = '', stderr = '';
    if (capture) {
      child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
      child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    }
    child.once('error', reject);
    child.once('close', (code, signal) => code === 0
      ? resolve({ stdout, stderr })
      : reject(new Error(`${command} exited ${code ?? signal}${stderr ? `: ${stderr.trim()}` : ''}`)));
  });
}

export function commandPath(name) {
  const envPath = process.env.PATH || '';
  const extensions = process.platform === 'win32' && !/\.[^\\/]+$/.test(name)
    ? ['', ...(process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';')] : [''];
  for (const dir of envPath.split(process.platform === 'win32' ? ';' : ':')) {
    for (const ext of extensions) {
      const candidate = `${dir}${process.platform === 'win32' ? '\\' : '/'}${name}${ext}`;
      try { accessSync(candidate, constants.F_OK); return candidate; } catch {}
    }
  }
  return null;
}
