# Package releases

## Release

From **Actions**, run **Prepare package release** on `main`, then select `nostr-kit` or `nostr-protocol` and the `patch`, `minor`, or `major` version bump. The package publication and GitHub Release follow automatically.

## Required configuration

- Install the Release GitHub App on `SnowCait/nostter` with repository Contents read/write permission. Set `RELEASE_APP_CLIENT_ID` as a repository variable and `RELEASE_APP_PRIVATE_KEY` as a repository secret. Allow the App to bypass the `CI` ruleset; do not allow it to bypass `Protect`.
- Keep active tag rulesets for `nostr-kit/v*` and `nostr-protocol/v*`: restrict creation to the Release App, and restrict updates and deletions with no bypass actors. Keep creation and immutability rules separate.
- Configure npm Trusted Publishing separately for both packages: Owner `SnowCait`, Repository `nostter`, Workflow `publish-package.yml`, and no GitHub Environment. Use GitHub-hosted runners, Node.js 24, and npm 11.5.1 or newer. Do not use an npm access token.

## Failures

Check the workflow, npm version, tag, and GitHub Release before retrying. If npm publication succeeded but Release creation failed, create the package-specific GitHub Release without publishing again. If the outcome is unclear, stop and investigate. Never bump the version to retry or move/delete a package tag.
