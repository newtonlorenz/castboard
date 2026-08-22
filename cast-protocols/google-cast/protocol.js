import { spawn } from 'node:child_process';

export function createProtocol({ config }) {
  return {
    id: 'google-cast',
    name: 'Google Cast via catt',
    cast({ target, url }) {
      const device = target.device || target.name;
      if (!device) throw new Error('google-cast target requires device or name');
      return new Promise((resolve, reject) => {
        const executable = process.env.CATT_BIN || config.executable || 'catt';
        const child = spawn(executable, ['-d', device, 'cast_site', url], { stdio: 'inherit' });
        const timeoutMs = Number(target.timeoutMs || config.timeoutMs || 60000);
        let settled = false;
        const finish = (callback, value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          callback(value);
        };
        const timer = setTimeout(() => {
          child.kill('SIGTERM');
          finish(reject, new Error(`catt timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        child.once('error', error => finish(reject, error));
        child.once('exit', code => code === 0 ? finish(resolve, { device, url }) : finish(reject, new Error(`catt exited with code ${code}`)));
      });
    },
  };
}
