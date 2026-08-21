import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

export async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(url, options = {}, timeoutMs = 8000) {
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: { Accept: 'application/json', ...(options.headers || {}) },
  }, timeoutMs);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Provider returned invalid JSON (${response.status})`);
  }
  if (!response.ok) throw new Error(body?.error?.message || body?.error || `Provider returned HTTP ${response.status}`);
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
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
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

export async function proxyStream(url, req, res, { headers = {}, timeoutMs = 12000 } = {}) {
  const response = await fetchWithTimeout(url, {
    headers: { Accept: req.headers.accept || '*/*', ...headers },
  }, timeoutMs);
  if (!response.ok || !response.body) throw new Error(`Stream provider returned HTTP ${response.status}`);
  res.writeHead(200, {
    'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Connection: 'keep-alive',
  });
  Readable.fromWeb(response.body).pipe(res);
}

export function demoTimestamp() {
  return new Date().toISOString();
}

export function escapeXml(value = '') {
  return String(value).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
