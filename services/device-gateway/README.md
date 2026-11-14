# Optional embedded-device gateway

Castboard already authenticates embedded displays by their per-device connection
key, not their IP address. This optional narrow gateway is useful when the main
application should remain behind a separate network boundary. It accepts only
receiver configuration, scene, image, frame, touch and event routes, and checks
the current canonical device configuration before forwarding. Castboard checks
the same key and scope again upstream. Disabled devices and rotated keys take
effect on subsequent requests without restarting the gateway.

The gateway does not expose admin pages, plugin routes, firmware staging, or
arbitrary proxy destinations. It does not support browser/Cast receivers.

## Configuration

Run from the repository root with Node 20 or newer:

```sh
CASTBOARD_GATEWAY_CONFIG=/path/to/castboard.config.json \
CASTBOARD_GATEWAY_UPSTREAM=http://127.0.0.1:8787 \
node services/device-gateway/gateway.js
```

By default it listens only on `127.0.0.1:8896` and accepts loopback peers. To make
it reachable on your LAN, explicitly configure `CASTBOARD_GATEWAY_HOST` and
`CASTBOARD_GATEWAY_CIDRS` (comma-separated IPv4/IPv6 CIDRs for your trusted device
network). `CASTBOARD_GATEWAY_PORT` overrides the listener port. Those are access
control changes: review the network scope before deploying. Do not expose this
HTTP listener to the public Internet. Use a trusted LAN, or terminate TLS in front
of it and configure receivers with a trusted CA. Bearer keys over plain HTTP are
not protected against an observer on that network.

Set `embedded.publicUrl` in Castboard to the stable gateway origin used by your
receivers. DHCP can change a receiver's address within the permitted network
without changing its key. The server address must still be resolvable: use a
stable DNS name supported by the firmware, or a DHCP reservation for the server.
This service does not configure routers, DNS, TLS, or device firmware for you.

The canonical configuration file must be readable by the gateway process and
contain current `devices` records. Do not make a second stale copy or commit
private configuration. An unreadable or malformed file fails closed.

Run `node --test test/device-gateway.test.js` for route, network, key rotation,
revocation, cross-device and request-size tests. These tests use synthetic keys
and documentation-only network ranges; they do not change a deployment.
