# Security policy

## Reporting a vulnerability

Please report security issues privately to the repository maintainers. Do not include secrets or private camera/feed URLs in a public issue.

## Deployment guidance

Castboard is a LAN application. Do not expose it directly to the public internet. Use a firewall or trusted reverse proxy if access crosses network boundaries.

- Keep secrets in environment variables, not tracked configuration.
- Treat configured HTTP endpoints and local files as trusted administrator input.
- Use read-only integration credentials where possible.
- Camera streams and media-control endpoints are proxied to avoid exposing credentials to the display, but anyone who can reach Castboard may still view or control enabled integrations.
- The server sets restrictive browser security headers; broaden them only for a specific integration.

Supported releases receive security fixes on the latest minor version.
