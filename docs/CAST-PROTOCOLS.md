# Casting protocols

Casting protocols deliver a screen URL to a target. They are independent of screen type: a fixed grid, responsive flow, or single-panel screen can use any enabled protocol.

## Configuration precedence

The protocol is resolved in this order:

1. CLI `--protocol` override.
2. Target `protocol`.
3. Screen `castProtocol`.
4. `casting.defaultProtocol`.
5. `google-cast` fallback.

Protocol configuration and target details remain server-side.

## Built-in protocols

### `google-cast`

Uses `catt cast_site` and requires a `device` or `name` on the target.

```json
{
  "casting": { "protocols": { "google-cast": { "enabled": true, "executable": "catt" } } },
  "screens": { "home": { "castProtocol": "google-cast", "targets": [{ "name": "Kitchen", "device": "Kitchen Display" }] } }
}
```

### `url`

Prints the resolved LAN URL instead of transmitting it. This is useful for wall tablets, kiosk browsers, bookmarks, QR-code workflows, and debugging.

```sh
npm run cast -- home --protocol url
```

### `http-webhook`

POSTs `{ screenId, url, target }` to an endpoint that controls a receiver or kiosk. The endpoint can be set globally on the protocol or overridden by a target. Headers may contain environment-expanded credentials.

```json
{
  "casting": {
    "protocols": {
      "http-webhook": {
        "enabled": true,
        "endpoint": "${RECEIVER_WEBHOOK}",
        "headers": { "Authorization": "Bearer ${RECEIVER_TOKEN}" }
      }
    }
  }
}
```

## Adding a protocol

Create `cast-protocols/my-protocol/protocol.js`:

```js
export function createProtocol({ config }) {
  return {
    id: 'my-protocol',
    name: 'My receiver',
    async cast({ screenId, screenType, target, url }) {
      // Deliver url to target and throw a non-sensitive Error on failure.
      return { screenId, url };
    }
  };
}
```

Add an enabled `casting.protocols.my-protocol` entry. Protocol drivers are trusted server-side code: do not install one you have not reviewed.
