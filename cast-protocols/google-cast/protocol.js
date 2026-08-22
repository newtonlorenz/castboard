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
        child.once('error', reject);
        child.once('exit', code => code === 0 ? resolve({ device, url }) : reject(new Error(`catt exited with code ${code}`)));
      });
    },
  };
}
