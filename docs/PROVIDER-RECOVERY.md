# Provider recovery

Dashboard startup retries after an initial configuration/network failure. Widgets continue refreshing on their configured cadence; a temporary upstream error does not require reloading the display. Camera Resources preserves Clearcam's HTTP 503 health response when it explicitly reports `status: "degraded"` with a `cameras` array. The camera panel uses the frame ages to choose its fallback. Unexpected errors still fail. Vehicle Status reports unavailable when every configured measurement is unusable, while keeping partial readings.

Some external clients can remain stuck after connectivity returns. Trusted host/service adapters can use `RecoveryLoop` from `src/core/provider-recovery.js` to coordinate recovery. This is an opt-in library: the app does not automatically restart external services or reload Home Assistant integrations. The adapter supplies health checks, scoped recovery actions, state storage and lifecycle ownership.

## Adapter contract

```js
import { RecoveryLoop } from '../src/core/provider-recovery.js';

const loop = new RecoveryLoop({
  tasks: [{
    id: 'example-source',
    async probe() {
      const health = await client.checkHealth({ timeoutMs: 8000 });
      return health.connected
        ? { healthy: true, reason: 'connected' }
        : { healthy: false, reason: 'client-disconnected', action: 'reconnect' };
    },
    async recover(result) {
      // Recheck before reconnecting: the client may already have recovered.
      if (!(await client.checkHealth({ timeoutMs: 8000 })).connected) {
        await client.reconnect({ timeoutMs: 10000 });
      }
    },
  }],
  state: await storage.load(),
  save: state => storage.replaceAtomically(state),
  log: (id, action, status) => logger.info({ id, action, status }),
});
loop.start();
// Call loop.stop() when disposing the owning host adapter.
```

`client`, `storage` and `logger` are adapter-owned dependencies in this example. Every probe and action must enforce its own I/O deadline. The scheduler waits for in-flight work; it does not terminate a hung callback. `stop()` prevents new polling and future recovery starts but cannot undo an action already running. Intervals are unreferenced so they do not keep a shutdown process alive.

Only return `action` when a scoped repair is appropriate. An offline speaker, asleep vehicle or unavailable camera source may simply need more time; an authentication error requires renewed authorization. Do not replay playback or vehicle-control commands as recovery. Keep tokens, raw upstream errors and secret-bearing URLs out of returned diagnostic labels and logs.

## Timing and persistence

- Poll every 30 seconds by default; `intervalMs` can override the polling interval.
- Require at least three failed observations spanning 60 seconds before an action.
- A probe can return `minFailureMs` to allow longer model/client startup, with 60 seconds as the minimum.
- Back off action attempts from two minutes to at most thirty minutes.
- Require three successful observations to clear backoff after a flapping connection.
- Confirm health through later successful probes; a completed recovery command does not mark a source healthy.
- Coalesce overlapping `tick()` calls. Different tasks can probe independently.

State is keyed by task ID and includes health counters, timestamps, last action and action outcome. Load only trusted state and preserve stable task IDs. Persist an atomic snapshot through `save`; the cooldown is saved before a side effect. A save failure prevents that action. A no-op default `save` is suitable only for transient in-memory use; persistence is necessary to preserve cooldown across host restarts.

Do not put deployment-specific service names, household addresses or credentials in an adapter shipped with Castboard. Configure them outside the repository. The scheduler itself makes no service commands or authenticated requests.
