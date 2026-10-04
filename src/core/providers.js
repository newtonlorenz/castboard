import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const MAX_PROVIDER_BYTES = 1024 * 1024;

export function validateProviderConfig(pluginId, config, providers) {
  if (!config.provider || !providers.includes(config.provider)) throw new Error(`Plugin ${pluginId} requires provider: ${providers.join(', ')}`);
  if (config.timeoutMs !== undefined && (!Number.isFinite(Number(config.timeoutMs)) || Number(config.timeoutMs) < 1)) throw new Error(`Plugin ${pluginId} timeoutMs must be positive`);
  if (config.provider === 'http-json') {
    if (!config.url) throw new Error(`Plugin ${pluginId} http-json provider requires url`);
    validateHttpUrl(config.url);
  }
  if (config.provider === 'file-json' && !config.path) throw new Error(`Plugin ${pluginId} file-json provider requires path`);
}

export async function readTextFile(filePath, maxBytes = MAX_PROVIDER_BYTES) {
  const file = await fs.open(filePath, 'r').catch(() => { throw new Error('Provider file cannot be opened. Check its path and permissions.'); });
  try {
    // Bound allocation even when a file grows after the stat or is a special file.
    const data = Buffer.alloc(maxBytes + 1);
    let length = 0;
    while (length < data.length) {
      const { bytesRead } = await file.read(data, length, data.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > maxBytes) throw new Error(`Provider file exceeds ${maxBytes} bytes`);
    return data.subarray(0, length).toString('utf8');
  } finally { await file.close(); }
}

async function withTimeout(timeoutMs, externalSignal, operation) {
  const controller = new AbortController();
  const abort = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) abort();
  else externalSignal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error(`Provider timed out after ${timeoutMs}ms`)), timeoutMs);
  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', abort);
  }
}

async function readResponseBody(response, maxBytes) {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new Error(`Provider response exceeds ${maxBytes} bytes`);
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new Error(`Provider response exceeds ${maxBytes} bytes`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, length).toString('utf8');
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  return withTimeout(timeoutMs, options.signal, signal => fetch(url, { ...options, signal }));
}

export async function fetchText(url, options = {}, timeoutMs = 8000, maxBytes = MAX_PROVIDER_BYTES) {
  return withTimeout(timeoutMs, options.signal, async signal => {
    const response = await fetch(url, { ...options, signal });
    const text = await readResponseBody(response, maxBytes);
    return { response, text };
  });
}

export async function fetchJson(url, options = {}, timeoutMs = 8000, maxBytes = MAX_PROVIDER_BYTES) {
  const { response, text } = await fetchText(url, {
    ...options,
    headers: { Accept: 'application/json', ...(options.headers || {}) },
  }, timeoutMs, maxBytes);
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Provider returned invalid JSON (${response.status})`);
  }
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  return body;
}

export async function readJsonSource(config, context) {
  if (config.provider === 'http-json') {
    if (!config.url) throw new Error('http-json provider requires url');
    return fetchJson(config.url, { headers: config.headers || {} }, config.timeoutMs || 8000);
  }
  if (config.provider === 'file-json') {
    if (!config.path) throw new Error('file-json provider requires path');
    const filePath = path.resolve(context.configDir, config.path);
    return JSON.parse(await readTextFile(filePath));
  }
  throw new Error(`Unsupported JSON provider: ${config.provider}`);
}

export function getPath(value, selector, fallback = undefined) {
  if (!selector) return value;
  const result = String(selector).split('.').reduce((current, key) => current?.[key], value);
  return result === undefined ? fallback : result;
}

export function mapObject(value, mapping = {}) {
  if (!mapping || !Object.keys(mapping).length) return value;
  return Object.fromEntries(Object.entries(mapping).map(([target, source]) => [target, getPath(value, source, null)]));
}

export function jsonResponse(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

export async function proxyStream(url, req, res, { headers = {}, timeoutMs = 12000, ranges = true } = {}) {
  const controller = new AbortController();
  let completed = false;
  const abort = () => { if (!completed) controller.abort(); };
  req.once('aborted', abort);
  res.once('close', abort);
  try {
    const response = await fetchWithTimeout(url, {
      headers: { Accept: req.headers.accept || '*/*', ...(ranges && req.headers.range ? { Range: req.headers.range } : {}), ...headers },
      signal: controller.signal,
    }, timeoutMs);
    if ((!response.ok && response.status !== 416) || !response.body) throw new Error(`Stream provider returned HTTP ${response.status}`);
    const rangeHeaders = {};
    for (const key of ['content-length', 'content-range', 'accept-ranges']) if (response.headers.has(key)) rangeHeaders[key] = response.headers.get(key);
    res.writeHead(response.status, {
      'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Connection: 'keep-alive',
      ...rangeHeaders,
    });
    await pipeline(Readable.fromWeb(response.body), res);
    completed = true;
  } catch (error) {
    if (!controller.signal.aborted || (!req.aborted && !res.destroyed)) throw error;
  } finally {
    req.removeListener('aborted', abort);
    res.removeListener('close', abort);
  }
}

export function demoTimestamp() {
  return new Date().toISOString();
}

// Configured sources may use a local network. Credentials belong in headers,
// and bridge prefixes must not contain a query or fragment.
export function validateHttpUrl(value, { base = false } = {}) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Enter a valid HTTP or HTTPS source URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use HTTP or HTTPS and put authentication in headers');
  if (base && (url.search || url.hash)) throw new Error('Service URL must not include a query or fragment');
  return url.href.replace(/\/$/, '');
}
