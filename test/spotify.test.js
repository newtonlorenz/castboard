import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createPlugin, normalizeSpotifyPlayback } from '../plugins/spotify/plugin.js';

test('Spotify playback is normalized independently of Sonos', () => {
  const result = normalizeSpotifyPlayback({
    is_playing: true,
    progress_ms: 1200,
    device: { name: 'Mac speakers', volume_percent: 42 },
    item: { name: 'Track', duration_ms: 3000, artists: [{ name: 'Artist' }], album: { name: 'Album', images: [{ url: 'https://image.test/art.jpg' }] } },
  });
  assert.deepEqual({ ...result, updatedAt: undefined }, {
    playing: true, title: 'Track', artist: 'Artist', album: 'Album', artworkUrl: 'https://image.test/art.jpg',
    device: 'Mac speakers', volume: 42, progressMs: 1200, durationMs: 3000, updatedAt: undefined,
  });
});

test('spotify-player provider reads playback and sends allowlisted CLI actions', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'castboard-spotify-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const executable = path.join(directory, 'spotify-player-fixture');
  const calls = path.join(directory, 'calls.txt');
  await fs.writeFile(executable, `#!/bin/sh\nprintf '%s\\n' "$*" >> "${calls}"\ncase "$*" in\n  *"get key playback"*) printf '%s' '{"is_playing":false,"device":{"name":"Local audio"},"item":{"name":"Quiet Song","artists":[{"name":"Test Artist"}],"album":{"name":"Test Album","images":[]}}}' ;;\nesac\n`);
  await fs.chmod(executable, 0o700);
  const plugin = createPlugin({ config: { provider: 'spotify-player', executable }, context: { configDir: directory } });
  const playback = await plugin.getData();
  assert.equal(playback.title, 'Quiet Song');
  assert.equal(playback.device, 'Local audio');
  await plugin.action({ action: 'next' });
  assert.match(await fs.readFile(calls, 'utf8'), /get key playback[\s\S]*playback next/);
  await assert.rejects(plugin.action({ action: 'arbitrary-command' }), /Unsupported Spotify action/);
});
