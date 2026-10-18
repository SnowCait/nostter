# Package releases

## Normal operation

Run **Actions → Prepare package release → Run workflow** on **main**, select `nostr-kit` or `nostr-protocol`, and select `patch`, `minor`, or `major`.

Preparation fetches the latest main, updates the selected package with `npm version`, and updates Web's dependency range only if it does not accept the new version. npm regenerates the lockfile. After a clean install and package build, tests, lint, and pack checks, the Release App atomically pushes the version commit and `<package>/v<version>` tag. Web's type check also runs when its dependency range changes.

The tag starts **Publish package**, which checks the protected tag, package name/version, and main ancestry, then validates and publishes only that package through npm Trusted Publishing. A separate job creates the GitHub Release after npm publish succeeds. Its notes use commits affecting that package since its previous tag, excluding version-update commits. `--latest=false` preserves the web application's Latest Release.

Preparation is serialized across packages because both update main and the lockfile. Publishing is serialized per package. Running releases are not automatically canceled. There is no version-update PR, and publishing never changes a version.

## Required configuration

- **Release App:** install on `SnowCait/nostter` with Contents read/write. Store its client ID in `RELEASE_APP_CLIENT_ID` and private key in `RELEASE_APP_PRIVATE_KEY`. Allow it to bypass `CI`, but not `Protect`. The App token is used only for the final commit/tag push so the tag triggers the publishing workflow.
- **Tag creation ruleset:** active, targeting `nostr-kit/v*` and `nostr-protocol/v*`, with Restrict creations enabled. Only the Release App may bypass, in Always mode.
- **Tag immutability ruleset:** active, targeting the same patterns, with Restrict updates and Restrict deletions enabled and no bypass actors, including the App. Keep creation and immutability in separate rulesets. Do not weaken the existing branch rulesets or change web release tags.
- **npm Trusted Publisher:** configure each package separately with Owner `SnowCait`, Repository `nostter`, Workflow `publish-package.yml`, no Environment, and direct `npm publish` allowed. Use GitHub-hosted runners, Node.js 24, and a supported npm CLI (11.5.1 or newer). No npm access token is used; automatic provenance stays enabled. Maintain publisher configurations according to the [npm documentation](https://docs.npmjs.com/trusted-publishers/).

The tag rulesets are the authorization boundary for publishing. Merely pointing a manually created tag at main is insufficient protection; package tag creation must remain limited to the Release App.

## Failures and retries

- **Preparation fails:** inspect main and the tag before starting a new preparation request. Preparation reruns stop rather than bumping again. The [atomic push](https://git-scm.com/docs/git-push#Documentation/git-push.txt---atomic) updates both refs or neither; a main conflict fails without overwriting changes. If the push result is unknown, confirm its outcome first. An unfinished current release blocks another bump.
- **Publication fails:** inspect the original run and `npm view @nostter/<package>@<version>`. If the version is absent, rerun the original publishing run on the same tag. If it exists or the result is unclear, stop for human investigation; the workflow does not treat an existing version as a successful publication. If publication is confirmed, complete the GitHub Release manually with package-specific notes rather than republishing or preparing another version.
- **Only GitHub Release creation fails:** use **Re-run failed jobs**. The successful publish job is retained, so only Release creation runs again. An existing Release is left unchanged.

Never force-push, move/delete package tags, or increment a version just to retry a failed release. Registry/GitHub errors stop the workflow; they are not evidence that a version or Release is absent.
