import { spawn } from 'node:child_process';

export function createProtocol({ config }) {
  return {
    id: 'google-cast',
    name: 'Google Cast via catt',
    async cast({ target, url }) {
      const device = target.address || target.device || target.name;
      if (!device) throw new Error('google-cast target requires address, device or name');
      const candidates = [...new Set([device, target.device, target.name].filter(Boolean))];
      const attempts = Math.min(5, Math.max(1, Number(target.attempts || config.attempts || 2)));
      const timeoutMs = Number(target.timeoutMs || config.timeoutMs || 60000);
      const executable = process.env.CATT_BIN || config.executable || 'catt';
      function invoke(selected, command) {
        return new Promise((resolve, reject) => {
          const child = spawn(executable, ['-d', selected, ...command], { stdio: 'inherit' });
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
          child.once('exit', code => code === 0 ? finish(resolve, { device: selected, url }) : finish(reject, new Error(`catt exited with code ${code}`)));
        });
      }
      let failure;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const selected = candidates[Math.min(attempt, candidates.length - 1)];
        try {
          // Opt in for receivers whose existing DashCast session retains a
          // stale transport. Other protocols and normal Cast behavior are unchanged.
          if (target.resetBeforeCast ?? config.resetBeforeCast) {
            await invoke(selected, ['stop']);
            const delay = Math.min(10000, Math.max(0, Number(target.resetDelayMs ?? config.resetDelayMs ?? 3000)));
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          return await invoke(selected, ['cast_site', url]);
        } catch (error) { failure = error; }
      }
      throw failure;
    },
  };
}
