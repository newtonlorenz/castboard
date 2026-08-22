# Publishing Castboard on GitHub

The working tree is already a Git repository. Before the first public push, review the history and confirm that no private receiver names, household URLs, coordinates, tokens, or local configuration were ever committed.

Authenticate GitHub CLI and create the public repository:

```sh
gh auth login --hostname github.com
gh repo create castboard --public --source=. --remote=origin --push
```

Then replace the placeholder clone URL in `README.md` with the repository’s HTTPS URL and add matching `repository`, `homepage`, and `bugs` fields to `package.json`. Do not publish those links before the repository exists; dead badges and clone commands make first-run trust worse.

## First release checklist

1. Run `npm test` and `npm run check` on a clean checkout.
2. Run `npm run init` twice and confirm the second invocation preserves the local config.
3. Open `/setup`, `/admin`, and every starter screen at representative display sizes.
4. Confirm the example config contains no real targets or credentials.
5. Enable GitHub branch protection and require the Node 20/22 CI job.
6. Create a signed `v0.6.1` tag and a GitHub release using `CHANGELOG.md`.
