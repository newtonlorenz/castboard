import path from 'node:path';
import { writableConfigPath, writeConfigAtomic } from './admin-config.js';
import { resolveRuntimeConfig } from './config.js';
import { disposePlugins } from './plugin-registry.js';

export function createConfigTransactions({ env, current, prepare, activate }) {
  let pending;
  let closed = false;

  async function save(raw, { dryRun = false, reload = 'none', onResolve } = {}) {
    const previous = current();
    const configPath = writableConfigPath(previous.configPath, path.dirname(previous.configPath));
    const config = resolveRuntimeConfig(raw, env);
    onResolve?.(config);
    const candidate = { ...previous, raw, config, configPath };
    let committed = false;
    try {
      await prepare(candidate, reload);
      if (!dryRun) {
        if (closed) throw new Error('Castboard is shutting down');
        await writeConfigAtomic(configPath, raw);
        // All fallible preparation is complete. Publish the new state synchronously.
        activate(candidate);
        committed = true;
      }
      return candidate;
    } finally {
      const [discard, retain] = committed
        ? [previous.plugins, candidate.plugins]
        : [candidate.plugins, previous.plugins];
      if (discard !== retain) await disposePlugins(discard.filter(plugin => !retain.includes(plugin)));
    }
  }

  return {
    get busy() { return Boolean(pending); },
    async run(work) {
      if (pending || closed) throw new Error('Configuration changes are unavailable');
      pending = Promise.resolve().then(() => work(save));
      try { return await pending; }
      finally { pending = undefined; }
    },
    async close() {
      closed = true;
      await pending?.catch(() => {});
    },
  };
}
