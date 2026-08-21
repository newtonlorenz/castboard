# Contributing

Thanks for helping improve Castboard.

1. Discuss substantial UI, provider, or plugin-contract changes in an issue first.
2. Keep the core dependency-free unless a dependency removes significantly more risk than it adds.
3. Never commit credentials, private feed URLs, household coordinates, account IDs, or device addresses.
4. Add or update tests for config, routing, normalization, and security-sensitive behavior.
5. Run `npm test` and `npm run check` before opening a pull request.

Plugins should fail soft: a missing backend should produce a useful unavailable state without taking down a screen.
