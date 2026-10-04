import { createHash } from 'node:crypto';
import sharp from 'sharp';

const fail = (message, statusCode = 422) => Object.assign(new Error(message), { statusCode });
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 32);
export function createFrameRenderer({ browser, appOrigin, maxSessions = 8, idleMs = 300000 }) {
  const origin = new URL(appOrigin).origin;
  const sessions = new Map();
  async function close(id) {
    const session = sessions.get(id);
    if (!session || session.busy) return;
    sessions.delete(id);
    await session.context?.close();
  }
  const reaper = setInterval(() => {
    for (const [id, session] of sessions) if (Date.now() - session.lastSeen > idleMs) void close(id);
  }, 30000); reaper.unref();

  async function render(input) {
    const { id, token, width, height, format, revision } = input;
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(id || '') || !/^[A-Za-z0-9_-]{32,128}$/.test(token || '') || !Number.isInteger(width) || !Number.isInteger(height) || width < 16 || height < 16 || width > 1920 || height > 1920 || width * height > 1920 * 1080 || !['jpeg', 'rgb565'].includes(format) || typeof revision !== 'string' || revision.length > 128) throw fail('Invalid renderer request');
    const signature = hash(JSON.stringify([token, width, height, revision]));
    let session = sessions.get(id);
    if (session?.busy) throw fail('Renderer is busy; retry shortly', 409);
    if (session && session.signature !== signature) { await close(id); session = null; }
    if (!session) {
      if (sessions.size >= maxSessions) throw fail('The image renderer has reached its display limit', 503);
      session = { signature, busy: true, lastSeen: Date.now(), events: new Map() };
      sessions.set(id, session);
    } else session.busy = true;
    session.lastSeen = Date.now();
    try {
      if (!session.page) {
        session.context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block', acceptDownloads: false });
        // Only the configured Castboard origin receives the device credential.
        // No browser profiles, arbitrary URLs or remote scripts enter a session.
        await session.context.route('**/*', async route => {
          const request = route.request(), url = new URL(request.url());
          if (url.origin !== origin) return route.abort();
          const pathname = url.pathname;
          const scoped = pathname === '/api/runtime-config' || pathname === '/api/config'
            ? `/api/devices/${id}/bootstrap`
            : pathname.startsWith('/api/plugins/') ? `/api/devices/${id}/plugins/${pathname.slice('/api/plugins/'.length)}` : null;
          if (pathname.startsWith('/api/') && !scoped && !pathname.startsWith(`/api/devices/${id}/plugins/`)) return route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":{"message":"Unavailable on this display"}}' });
          if (request.isNavigationRequest() && pathname !== `/device-view/${id}`) return route.abort();
          if (scoped) url.pathname = scoped;
          await route.continue({ url: url.href, headers: { ...request.headers(), authorization: `Bearer ${token}` } });
        });
        session.page = await session.context.newPage();
        session.page.on('dialog', dialog => void dialog.dismiss());
        session.page.on('popup', page => void page.close());
        const response = await session.page.goto(`${origin}/device-view/${id}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        if (!response?.ok()) throw fail('The assigned screen could not be opened', 502);
        await session.page.waitForFunction(() => document.querySelector('#dashboard [data-mounted="true"], #dashboard .widget-unavailable'), { timeout: 20000 });
        await session.page.evaluate(() => document.fonts.ready);
      }
      if (input.event) {
        const event = input.event;
        if (!/^[A-Za-z0-9_-]{8,80}$/.test(event.eventId || '')) throw fail('Touch events need an eventId');
        const fingerprint = hash(JSON.stringify(event));
        if (session.events.has(event.eventId)) {
          if (session.events.get(event.eventId) !== fingerprint) throw fail('Event ID already used', 409);
        } else {
          if (!session.frameId || event.frameId !== session.frameId) throw fail('The display changed; fetch a fresh frame', 409);
          if (!Number.isFinite(event.x) || !Number.isFinite(event.y) || event.x < 0 || event.y < 0 || event.x >= width || event.y >= height) throw fail('Touch is outside the display');
          session.events.set(event.eventId, fingerprint);
          if (session.events.size > 128) session.events.delete(session.events.keys().next().value);
          await session.page.mouse.click(event.x, event.y);
          await session.page.waitForTimeout(100);
        }
      }
      const png = await session.page.screenshot({ type: 'png', animations: 'disabled', timeout: 10000 });
      let buffer;
      if (format === 'jpeg') buffer = await sharp(png).jpeg({ quality: 82 }).toBuffer();
      else {
        const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        buffer = Buffer.alloc(info.width * info.height * 2);
        for (let pixel = 0; pixel < info.width * info.height; pixel++) {
          const index = pixel * info.channels;
          buffer.writeUInt16LE(((data[index] & 0xf8) << 8) | ((data[index + 1] & 0xfc) << 3) | (data[index + 2] >> 3), pixel * 2);
        }
      }
      session.frameId = hash(buffer);
      return { buffer, frameId: session.frameId, width, height, format };
    } catch (error) {
      if (!session.page || session.page.isClosed() || !session.frameId && error.statusCode !== 409) {
        sessions.delete(id); await session.context?.close();
      }
      throw error;
    } finally { session.busy = false; }
  }
  return { render, async dispose() { clearInterval(reaper); await Promise.all([...sessions.values()].map(session => session.context?.close())); sessions.clear(); } };
}
