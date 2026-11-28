import fs from 'node:fs/promises';
import path from 'node:path';
import { isIP } from 'node:net';
import { writeConfigAtomic } from './admin-config.js';
import { castTargetId, castTargetKey, screenDisplayUrl, targetProtocol } from './delivery.js';

const addressOf = target => target?.address || (isIP(target?.device || '') ? target.device : null);
const HEARTBEAT_TTL_MS = 180000;

// Recovery belongs to the app lifecycle and uses the same receiver lock as manual sends.
export async function createCastRecovery({ getConfig, getClients, send, locks, statePath, probe = async () => null, refreshTargets = async () => {}, now = Date.now, logger = console }) {
  let saved = {};
  try {
    const value = JSON.parse(await fs.readFile(statePath, 'utf8'));
    if (value && typeof value === 'object' && !Array.isArray(value)) saved = value;
  } catch {}
  const states = new Map();
  let timer, stopped = false, running = false, writes = Promise.resolve();
  const persist = () => {
    const snapshot = { ...saved };
    writes = writes.catch(() => {}).then(() => writeConfigAtomic(statePath, snapshot));
    return writes;
  };
  const transition = (key, state, result, reason) => {
    const changed = state.result !== result || state.reason !== reason;
    state.result = result;
    if (reason) state.reason = reason; else delete state.reason;
    if (!changed) return;
    const event = JSON.stringify({ at: new Date(now()).toISOString(), receiverId: castTargetId(key), screenId: state.screenId,
      result, ...(reason ? { reason } : {}), ...(state.outageSince !== undefined ? { outageSince: state.outageSince } : {}) }) + '\n';
    const journal = statePath + '.events.jsonl';
    writes = writes.catch(() => {}).then(async () => {
      await fs.mkdir(path.dirname(journal), { recursive: true });
      const size = await fs.stat(journal).then(s => s.size, () => 0);
      if (size > 128 * 1024) await fs.rename(journal, journal + '.1');
      await fs.appendFile(journal, event, { mode: 0o600 });
    }).catch(() => { logger.error('Cast recovery could not record a status transition'); });
  };
  async function remember(item) {
    const key = castTargetKey(item), id = castTargetId(key);
    saved[id] = { screenId: item.screenId };
    states.set(key, { screenId: item.screenId, attempts: 0, nextAttemptAt: now() + HEARTBEAT_TTL_MS, result: 'awaiting-heartbeat' });
    try { await persist(); } catch { logger.error('Cast recovery could not save the dashboard assignment'); }
  }
  const latestHeartbeat = (address, clients = getClients()) => clients.reduce((latest, client) => {
    const seen = Date.parse(client.lastSeenAt), age = now() - seen;
    return client.remoteAddress?.replace(/^::ffff:/, '') === address && age >= 0 && age < HEARTBEAT_TTL_MS && (latest === null || seen > latest) ? seen : latest;
  }, null);
  async function tick() {
    if (stopped || running || getConfig().casting?.recovery?.enabled !== true) return;
    running = true;
    try {
      const clients = getClients(), seen = new Set(), jobs = [];
      const before = getConfig();
      const due = Object.values(before.screens).some(screen => (screen.targets || []).some(target => {
        if (!target?.uuid || !isIP(target.address || '') || targetProtocol(before, screen, target) !== 'google-cast' || before.casting?.protocols?.['google-cast']?.enabled === false) return false;
        const key = castTargetKey({ protocol: 'google-cast', target });
        return !locks.has(key) && now() >= (states.get(key)?.nextAttemptAt || 0) && latestHeartbeat(addressOf(target), clients) === null;
      }));
      if (due) {
        try { await refreshTargets(); } catch { logger.info('Cast address discovery unavailable; retrying configured receivers'); }
      }
      const config = getConfig();
      for (const [connectionId, screen] of Object.entries(config.screens)) {
        for (const [targetIndex, entry] of (screen.targets || []).entries()) {
          const target = typeof entry === 'string' ? { device: entry } : entry;
          const protocol = targetProtocol(config, screen, target);
          if (protocol !== 'google-cast' || config.casting?.protocols?.[protocol]?.enabled === false) continue;
          // A physical address is required to distinguish receiver telemetry from browser previews.
          const address = addressOf(target);
          if (!isIP(address || '')) continue;
          const key = castTargetKey({ protocol, target });
          if (seen.has(key)) continue;
          seen.add(key);
          const state = states.get(key) || { attempts: 0, nextAttemptAt: 0, result: 'missing-heartbeat' };
          states.set(key, state);
          state.connectionId = connectionId; state.targetIndex = targetIndex;
          state.screenId ||= connectionId;
          const recent = latestHeartbeat(address, clients);
          if (recent !== null) {
            state.attempts = 0; state.failedProbes = 0; state.nextAttemptAt = 0; state.lastHeartbeatAt = recent;
            delete state.needsAttention; delete state.outageSince;
            transition(key, state, 'connected'); continue;
          }
          state.outageSince ??= now();
          if (locks.has(key) || now() < state.nextAttemptAt) continue;
          const oldKey = castTargetKey({ protocol, target: { ...target, uuid: undefined } });
          const desired = saved[castTargetId(key)]?.screenId || saved[castTargetId(oldKey)]?.screenId;
          const screenId = Object.hasOwn(config.screens, desired) ? desired : connectionId;
          const dashboard = config.screens[screenId], url = screenDisplayUrl(config, dashboard);
          if (!url) continue;
          const item = { screenId, screenType: dashboard.type, protocol, target: { ...target, attempts: 1, resetBeforeCast: true }, url };
          locks.add(key);
          jobs.push((async () => {
            state.screenId = screenId;
            try {
              let health;
              try { health = await probe({ ...target, address }); } catch { health = { reachable: false, reason: 'probe-unavailable' }; }
              // Disposal/configuration changes while a probe is pending must not send a cast.
              const current = getConfig();
              if (stopped || states.get(key) !== state || current.casting?.recovery?.enabled !== true || current.casting?.protocols?.[protocol]?.enabled === false) return;
              const currentTarget = Object.values(current.screens).flatMap(s => (s.targets || []).map(t => ({ screen:s, target:typeof t === 'string' ? {device:t} : t })))
                .find(({ screen:s, target:t }) => castTargetKey({ protocol:targetProtocol(current,s,t), target:t }) === key)?.target;
              const currentAddress = addressOf(currentTarget);
              if (currentAddress !== address || !current.screens[screenId] || screenDisplayUrl(current,current.screens[screenId]) !== url) return;
              const reconnected = latestHeartbeat(address);
              if (reconnected !== null) {
                state.attempts = 0; state.failedProbes = 0; state.nextAttemptAt = 0; state.lastHeartbeatAt = reconnected;
                delete state.needsAttention; delete state.outageSince;
                transition(key, state, 'connected'); return;
              }
              if (health) {
                state.lastProbeAt = now(); state.controlReachable = health.reachable === true;
                if (!state.controlReachable) {
                  state.failedProbes = (state.failedProbes || 0) + 1;
                  state.needsAttention = state.failedProbes >= 3 && now() - state.outageSince >= 180000;
                  const reason = ['cast-unreachable','invalid-receiver-address','probe-unavailable'].includes(health.reason) ? health.reason : 'probe-unavailable';
                  transition(key, state, state.needsAttention ? 'needs-attention' : 'waiting-for-control', reason);
                  // Watch for the service returning instead of repeatedly launching a dead Cast transport.
                  state.nextAttemptAt = now() + 30000;
                  return;
                }
                state.failedProbes = 0; delete state.needsAttention;
              }
              state.attempts += 1;
              state.lastAttemptAt = now();
              await send(item);
              transition(key, state, 'awaiting-heartbeat');
              state.nextAttemptAt = now() + HEARTBEAT_TTL_MS;
              logger.info(`Cast recovery sent dashboard ${screenId}; waiting for receiver heartbeat`);
            } catch {
              transition(key, state, 'retrying', 'cast-command-failed');
              state.nextAttemptAt = now() + Math.min(300000, 60000 * 2 ** Math.min(state.attempts - 1, 3));
              logger.info(`Cast recovery will retry dashboard ${screenId}`);
            } finally { locks.delete(key); }
          })());
        }
      }
      for (const key of states.keys()) if (!seen.has(key)) states.delete(key);
      await Promise.all(jobs);
    } finally {
      // A failed assignment write must not permanently latch the recovery loop.
      try { await writes; } catch {} finally { running = false; }
    }
  }
  return {
    tick, remember,
    flush: () => writes,
    get enabled() { return getConfig().casting?.recovery?.enabled === true; },
    status: () => ({ enabled: getConfig().casting?.recovery?.enabled === true, receivers: [...states].map(([key, state]) => ({ ...state, id: castTargetId(key) })) }),
    start() {
      if (timer || stopped) return;
      const run = async () => {
        try { await tick(); } catch { logger.error('Cast recovery check failed; will retry'); }
        if (!stopped) { timer = setTimeout(run, 30000); timer.unref?.(); }
      };
      timer = setTimeout(run, 30000); timer.unref?.();
    },
    stop() { stopped = true; clearTimeout(timer); },
  };
}
