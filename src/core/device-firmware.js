import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const MAX_FIRMWARE_BYTES = 3 * 1024 * 1024;
const ID = /^[a-z][a-z0-9-]{0,63}$/;

function firmwareError(message, statusCode = 422) {
  return Object.assign(new Error(message), { statusCode });
}

function directory(configDir) { return path.join(configDir, 'device-firmware'); }
function files(configDir, id) {
  if (!ID.test(id)) throw firmwareError('Invalid display ID');
  return { image: path.join(directory(configDir), `${id}.bin`), manifest: path.join(directory(configDir), `${id}.json`) };
}

export async function firmwareManifest(configDir, id, tokenHash) {
  const target = files(configDir, id);
  try {
    const record = JSON.parse(await fs.readFile(target.manifest, 'utf8'));
    if (!/^[a-f0-9]{64}$/.test(tokenHash || '') || record.tokenHash !== tokenHash) return null;
    if (!/^[a-f0-9]{64}$/.test(record.sha256) || !Number.isInteger(record.size) || record.size < 1024 || record.size > MAX_FIRMWARE_BYTES) throw new Error('Invalid firmware record');
    return { id: record.sha256, sha256: record.sha256, size: record.size };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function firmwareImage(configDir, id, tokenHash) {
  const manifest = await firmwareManifest(configDir, id, tokenHash);
  if (!manifest) throw firmwareError('No firmware is staged for this display', 404);
  const data = await fs.readFile(files(configDir, id).image);
  if (data.length !== manifest.size || createHash('sha256').update(data).digest('hex') !== manifest.sha256) throw firmwareError('Staged firmware failed its integrity check', 503);
  return { manifest, data };
}

const pending = new Map();
export async function stageFirmware(configDir, id, data, tokenHash) {
  const key=files(configDir,id).image;
  const previous=pending.get(key) || Promise.resolve();
  const current=previous.catch(()=>{}).then(()=>writeFirmware(configDir,id,data,tokenHash));
  pending.set(key,current);
  try { return await current; } finally { if(pending.get(key)===current)pending.delete(key); }
}

async function writeFirmware(configDir, id, data, tokenHash) {
  const target = files(configDir, id);
  if (!Buffer.isBuffer(data) || data.length < 1024 || data.length > MAX_FIRMWARE_BYTES || data[0] !== 0xe9) throw firmwareError('Upload an ESP32 application firmware .bin smaller than 3 MB');
  const sha256 = createHash('sha256').update(data).digest('hex');
  if (!/^[a-f0-9]{64}$/.test(tokenHash || '')) throw firmwareError('Firmware staging requires a current display key');
  const record = { sha256, size: data.length, tokenHash };
  await fs.mkdir(directory(configDir), { recursive: true, mode: 0o700 });
  const temporary = `${target.image}.${randomUUID()}.tmp`;
  const manifestTemporary = `${target.manifest}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, data, { mode: 0o600, flag: 'wx' });
    await fs.writeFile(manifestTemporary, JSON.stringify(record), { mode: 0o600, flag: 'wx' });
    await fs.rename(temporary, target.image);
    await fs.rename(manifestTemporary, target.manifest);
  } finally { await Promise.all([fs.rm(temporary, { force: true }),fs.rm(manifestTemporary, { force: true })]); }
  return { id: sha256, sha256, size: data.length };
}
