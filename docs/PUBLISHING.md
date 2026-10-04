# Publishing Castboard on GitHub

The public repository is [newtonlorenz/castboard](https://github.com/newtonlorenz/castboard).
Use a release branch to collect related work while preserving active local
checkouts and private installations.

## Review the release

1. Review the complete change against the public default branch, including new files and commit history. Exclude credentials, private feeds, device keys, receiver backups, household addresses and local configuration.
2. Update `package.json`, `CHANGELOG.md`, affected guides and examples. The core and optional renderer have separate version/dependency metadata.
3. Run `npm test` and `npm run check`. Run `npm run init` twice in a disposable checkout and verify the second run preserves its configuration.
4. Install the renderer's locked dependencies, run `npm audit --audit-level=high` there, and run the [browser tests](../CONTRIBUTING.md#browser-and-receiver-checks). Check `/setup`, `/admin`, plugin management, Displays and representative screen sizes using demonstration data.
5. Run the [ESP32 compile and image-format checks](embedded-displays.md#4-receiver-library) when receiver code changes. Record separately which physical boards were tested; software tests cannot establish touch or legibility on other hardware.
6. Open a pull request with a concise change summary and validation evidence. Require the Node 20/22, embedded-browser and esp32-compile checks to pass before merging.

## Publish

After the reviewed change is merged, fetch the default branch and verify that its
version and commit match the intended release. Create an annotated
`v<package-version>` tag at that commit and push the tag. Sign it when a maintainer
signing key is configured. Create a GitHub release using the reviewed changelog
entry, including compatibility notes and any hardware limitations. Verify the
public release URL, target commit and final CI results.

Publish source code and generic examples. Do not attach locally provisioned
firmware, configuration exports or screenshots containing private data. A public
release does not deploy, reconfigure or retire an existing household installation.

If the project is transferred or renamed, update README badges and the
`repository`, `homepage` and `bugs` fields in `package.json` together.
