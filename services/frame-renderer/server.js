import { renderNativeImage } from './images.js';
import http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { chromium } from 'playwright';
import { createFrameRenderer } from './renderer.js';

const token = process.env.CASTBOARD_RENDERER_TOKEN;
if (!token || token.length < 32) throw new Error('CASTBOARD_RENDERER_TOKEN must contain at least 32 characters');
const appOrigin = process.env.CASTBOARD_APP_ORIGIN;
if (!appOrigin || !['http:', 'https:'].includes(new URL(appOrigin).protocol)) throw new Error('Set CASTBOARD_APP_ORIGIN to the Castboard server origin');
const digest = value => createHash('sha256').update(value).digest();
const browser = await chromium.launch({ headless: true, ...(process.env.CASTBOARD_CHROMIUM_PATH ? { executablePath: process.env.CASTBOARD_CHROMIUM_PATH } : {}) });
const renderer = createFrameRenderer({ browser, appOrigin, maxSessions: Math.max(1, Math.min(32, Number(process.env.CASTBOARD_RENDERER_LIMIT) || 8)) });
let pendingImages=0;
const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!timingSafeEqual(digest(req.headers.authorization || ''), digest(`Bearer ${token}`))) { res.writeHead(401); res.end(); return; }
  if (req.url === '/health' && req.method === 'GET') { res.writeHead(200); res.end('{"ok":true}'); return; }
  if (!['/render','/image'].includes(req.url) || req.method !== 'POST') { res.writeHead(404); res.end(); return; }
  try {
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw Object.assign(new Error('JSON required'), { statusCode: 415 });
    let raw = '', bytes = 0;
    for await (const chunk of req) { bytes += chunk.length; if (bytes > 8192) throw Object.assign(new Error('Request too large'), { statusCode: 413 }); raw += chunk; }
    let input;
    try { input = JSON.parse(raw); } catch { throw Object.assign(new Error('Invalid JSON'), { statusCode: 400 }); }
    let frame;
    if(req.url==='/image'){
      if(pendingImages>=4)throw Object.assign(new Error('Image converter is busy; retry shortly'),{statusCode:503});
      pendingImages++;try{frame=await renderNativeImage(input,appOrigin);}finally{pendingImages--;}
    }else frame=await renderer.render(input);
    res.writeHead(200, { 'Content-Type': frame.format === 'jpeg' ? 'image/jpeg' : 'application/octet-stream', 'Content-Length': frame.buffer.length, 'X-Frame-Id': frame.frameId, 'X-Frame-Width': frame.width, 'X-Frame-Height': frame.height, 'X-Frame-Format': frame.format });
    res.end(frame.buffer);
  } catch (error) {
    res.writeHead(error.statusCode || 502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: error.statusCode ? error.message : 'Image rendering failed. Check the renderer connection and assigned screen.' } }));
  }
});
server.requestTimeout = 45000;
server.listen(Number(process.env.PORT) || 8791, process.env.HOST || '127.0.0.1');
const shutdown = async () => { server.close(); server.closeAllConnections(); await renderer.dispose(); await browser.close(); };
process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
