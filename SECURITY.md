# Security policy

## Reporting a vulnerability

Please report security issues privately to the repository maintainers. Do not include secrets or private camera/feed URLs in a public issue.

## Deployment guidance

Castboard is a LAN application. Do not expose it directly to the public internet. Use a firewall or trusted reverse proxy if access crosses network boundaries.

- Keep secrets in environment variables, not tracked configuration.
- Docker builds exclude `.env` and `castboard.config.json`; keep those entries in `.dockerignore` if you customize the image.
- Treat configured HTTP endpoints and local files as trusted administrator input.
- Use read-only integration credentials where possible.
- Camera streams and media-control endpoints are proxied to avoid exposing credentials to the display, but anyone who can reach Castboard may still view or control enabled integrations.
- Cast protocol settings, receiver addresses, webhook headers, and display names remain server-side. Treat custom protocol drivers as trusted executable code and review them before installation.
- Castboard Studio is local-only by default. If `admin.allowLan` is enabled, configure `admin.token` from an environment variable and use the editor only on a trusted network. The studio API exposes a design projection rather than the raw configuration; atomic saves merge private targets, protocols, provider settings, and raw environment placeholders without returning them to the browser.
- The server rejects unrecognized DNS Host headers to prevent rebinding attacks. Direct IPs, localhost, single-label names, `.local`, `.home.arpa`, the hostname in `server.publicUrl`, and explicit `server.allowedHosts` entries are accepted.
- Plugin action routes require JSON, which forces a browser preflight for ordinary cross-origin requests. This is a LAN safeguard, not a substitute for authentication on an internet-facing deployment.
- The server sets restrictive browser security headers; broaden them only for a specific integration.

Supported releases receive security fixes on the latest minor version.
