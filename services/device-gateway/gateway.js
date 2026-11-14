import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { authenticateDevice } from '../../src/core/devices.js';

// No device-specific network addresses: the connection key is its identity.
export function peerPolicy(cidrs = []) {
  const block = new BlockList();
  block.addAddress('127.0.0.1', 'ipv4'); block.addAddress('::1', 'ipv6');
  for (const cidr of cidrs) {
    const [address, prefix, extra] = cidr.split('/');
    const version = isIP(address), bits = Number(prefix);
    if (extra || !version || !/^\d+$/.test(prefix || '') || bits < 0 || bits > (version === 4 ? 32 : 128)) throw new Error('Invalid gateway network range');
    block.addSubnet(address, bits, version === 4 ? 'ipv4' : 'ipv6');
  }
  return address => {
    const peer = String(address || '').replace(/^::ffff:/, '');
    const version = isIP(peer);
    return Boolean(version && block.check(peer, version === 4 ? 'ipv4' : 'ipv6'));
  };
}

export function receiverRoute(method, rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.length > 4096) return null;
  const match = rawUrl.match(/^\/api\/devices\/([a-z][a-z0-9-]{0,63})\/(config|scene|frame|images\/[0-9]{1,2}|events|touch)(?:\?[^#\s]*)?$/);
  if (!match) return null;
  const [, id, operation] = match;
  if (method === 'GET' && /^(config|scene|frame|images\/)/.test(operation) || method === 'POST' && ['events', 'touch'].includes(operation)) return id;
  return null;
}

export function createDeviceGateway({ upstream, getConfig, allowPeer = peerPolicy() }) {
  const target = new URL(upstream);
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.pathname !== '/' || target.search || target.hash) throw new Error('Gateway upstream must be an HTTP(S) origin without credentials');
  const transport = target.protocol === 'https:' ? https : http;
  const server = http.createServer(async (req, res) => {
    const fail = (status, message) => { if (!res.headersSent) { res.writeHead(status, {'Content-Type':'text/plain', 'Cache-Control':'no-store'}); res.end(message); } else res.destroy(); };
    const id = receiverRoute(req.method, req.url);
    if (!id || !allowPeer(req.socket.remoteAddress)) return fail(403, 'Display access denied');
    try { authenticateDevice(await getConfig(), id, req.headers.authorization); }
    catch { return fail(403, 'Display access denied'); }
    const chunks = []; let size = 0;
    try {
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 65536) return fail(413, 'Display request too large');
        chunks.push(chunk);
      }
    } catch { return fail(400, 'Invalid display request'); }
    const body = Buffer.concat(chunks);
    const headers = {host:target.host, authorization:req.headers.authorization, 'content-length':body.length};
    for (const name of ['content-type', 'if-none-match', 'accept']) if (req.headers[name]) headers[name] = req.headers[name];
    // Never forward client-supplied proxy/admin headers or cookies.
    const proxy = transport.request(target, {method:req.method, path:req.url, headers}, reply => {
      const responseHeaders = {'Cache-Control':'no-store'};
      for (const name of ['content-type','content-length','etag','x-frame-id','x-frame-width','x-frame-height','x-frame-format']) if (reply.headers[name]) responseHeaders[name] = reply.headers[name];
      reply.on('aborted', () => res.destroy());
      reply.on('error', () => res.destroy());
      reply.on('close', () => { if (!reply.complete) res.destroy(); });
      res.writeHead(reply.statusCode, responseHeaders); reply.pipe(res);
    });
    proxy.setTimeout(45000, () => proxy.destroy());
    proxy.on('error', () => fail(502, 'Display service unavailable'));
    res.on('close', () => proxy.destroy());
    proxy.end(body);
  });
  server.requestTimeout = 50000; server.headersTimeout = 10000;
  return server;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const configPath = process.env.CASTBOARD_GATEWAY_CONFIG;
  if (!configPath) throw new Error('Set CASTBOARD_GATEWAY_CONFIG to the canonical Castboard config file');
  const server = createDeviceGateway({
    upstream:process.env.CASTBOARD_GATEWAY_UPSTREAM || 'http://127.0.0.1:8787',
    getConfig:async () => JSON.parse(await fs.readFile(configPath, 'utf8')),
    allowPeer:peerPolicy((process.env.CASTBOARD_GATEWAY_CIDRS || '').split(',').map(value=>value.trim()).filter(Boolean)),
  });
  const port = Number(process.env.CASTBOARD_GATEWAY_PORT || 8896);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid gateway port');
  server.listen(port, process.env.CASTBOARD_GATEWAY_HOST || '127.0.0.1');
  for (const signal of ['SIGTERM','SIGINT']) process.once(signal, () => {server.close(); server.closeAllConnections();});
}
