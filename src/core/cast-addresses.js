import { isIP } from 'node:net';
import { runCommand } from './command.js';
import { targetProtocol } from './delivery.js';

// Only a pinned Cast UUID can authorize an automatic receiver address change.
export async function refreshCastAddresses(config, resolved = config, scan = async () => {
  const executable = process.env.CATT_BIN || resolved.casting?.protocols?.['google-cast']?.executable || 'catt';
  const { stdout } = await runCommand(executable, ['scan', '--json-output'], { timeoutMs: 15000, maxBytes: 128 * 1024 });
  return Object.values(JSON.parse(stdout));
}) {
  const pinnedTargets = Object.entries(config.screens).flatMap(([id, screen]) =>
    (screen.targets || []).flatMap((target, index) => {
      const runtimeScreen = resolved.screens[id];
      const runtimeTarget = runtimeScreen.targets?.[index];
      return target?.uuid && isIP(target.address || '') && targetProtocol(resolved, runtimeScreen, runtimeTarget) === 'google-cast'
        ? [{ id, index, uuid: runtimeTarget.uuid }] : [];
    }));
  if (!pinnedTargets.length) return null;
  const devices = await scan();
  const next = structuredClone(config);
  let changed = false;
  for (const { id, index, uuid } of pinnedTargets) {
    const target = next.screens[id].targets[index];
    const matches = devices.filter(device => device?.uuid && String(device.uuid).toLowerCase() === String(uuid).toLowerCase());
    if (matches.length !== 1) continue;
    const address = matches[0].host || matches[0].address;
    if (!isIP(address || '') || address === target.address) continue;
    target.address = address;
    changed = true;
  }
  return changed ? next : null;
}
