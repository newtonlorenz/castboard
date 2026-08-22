import { spawn } from 'node:child_process';

export function runCommand(executable, args = [], { cwd, env, timeoutMs = 10000, maxBytes = 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, env, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    const collect = (chunks, field) => chunk => {
      if (settled) return;
      const next = field === 'stdout' ? stdoutBytes + chunk.length : stderrBytes + chunk.length;
      if (next > maxBytes) {
        child.kill('SIGTERM');
        finish(reject, new Error(`Command ${field} exceeded ${maxBytes} bytes`));
        return;
      }
      if (field === 'stdout') stdoutBytes = next;
      else stderrBytes = next;
      chunks.push(chunk);
    };
    child.stdout.on('data', collect(stdout, 'stdout'));
    child.stderr.on('data', collect(stderr, 'stderr'));
    child.once('error', error => finish(reject, error));
    child.once('exit', (code, signal) => {
      const result = { code, signal, stdout: Buffer.concat(stdout).toString('utf8').trim(), stderr: Buffer.concat(stderr).toString('utf8').trim() };
      if (code === 0) finish(resolve, result);
      else finish(reject, Object.assign(new Error(result.stderr || `${executable} exited with code ${code}`), { result }));
    });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish(reject, new Error(`${executable} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}
