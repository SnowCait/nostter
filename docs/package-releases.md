# Package releases

This process releases `@nostter/nostr-kit` and `@nostter/nostr-protocol` independently. It does not release the web application. The existing `0.1.0` versions and their package-specific tags are the starting points; do not republish or move them.

## One-time setup

Merge the release workflows before running them. Keep the existing `CI` and `Protect` rulesets in place.

### npm Trusted Publishers

In **each package's** npm settings, add a GitHub Actions Trusted Publisher:

| Field                | Value                       |
| -------------------- | --------------------------- |
| Organization or user | `SnowCait`                  |
| Repository           | `nostter`                   |
| Workflow filename    | `publish-package.yml`       |
| Environment          | Leave empty                 |
| Allowed actions      | Enable direct `npm publish` |

Both packages need their own publisher configuration. No npm access token is used. The workflow uses GitHub-hosted runners, Node.js 24, and npm 11.19.0 (above the required npm 11.5.1). Trusted Publishing automatically generates provenance; do not disable it.

Current npm configurations must complete their first publish within two days of creation. Set up the publishers when ready to release; recreate an expired configuration if necessary. See the [official Trusted Publishing documentation](https://docs.npmjs.com/trusted-publishers/).

### GitHub App

The Release App must be installed on this repository with **Contents: read and write** (and the implicit Metadata read permission). It needs no Actions or Workflows write permission. The preparation job requests a repository-scoped token only after validation, then uses it for the version commit and tag pushes. Its pushes trigger the publishing workflow, unlike pushes made with `GITHUB_TOKEN`.

The existing repository variable `RELEASE_APP_CLIENT_ID` and secret `RELEASE_APP_PRIVATE_KEY` supply the credentials. Keep this App on the `CI` ruleset's always-bypass list, and do not add it to `Protect`. A concurrent main update causes the ordinary push to fail; the workflow never force-pushes, rebases, or disables protections.

### Package tag rulesets (required before publishing)

Create two **active tag rulesets**, both targeting `nostr-kit/v*` and `nostr-protocol/v*`:

1. **Package tag creation**: enable **Restrict creations**, with only the Release App allowed to bypass, in **Always** mode. Do not give users, repository roles, or other Apps a bypass.
2. **Package tag immutability**: enable **Restrict updates** and **Restrict deletions**, with **no bypass actors**, including the Release App.

These are separate rulesets so the App can create tags without being able to move or delete them. Leave the existing web release tags and branch rulesets unchanged. The publishing workflow requires a protected tag and a main-reachable release commit linked to a preparation workflow run. The creation ruleset prevents manual tag pushes from bypassing the preparation operation; its configuration is part of the release security boundary. See [GitHub's ruleset documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).

## Release a package

Open **Actions → Prepare package release → Run workflow**, select **main**, choose `nostr-kit` or `nostr-protocol`, and choose `patch`, `minor`, or `major`.

For example, selecting `nostr-kit` and `patch` at `0.1.0` prepares `0.1.1` and the tag `nostr-kit/v0.1.1`.

The preparation workflow:

- Fetches the latest main, uses `npm version` for the selected workspace, and updates the root lockfile through npm.
- Builds, tests, lints, and packs the selected package, checking that the new npm version and tag do not exist.
- Pushes a version commit to main through the App, then creates the package tag on that commit.

The tag starts **Publish package**, which validates the tag, main ancestry, preparation run, and package metadata, then rebuilds, tests, lints, and packs the tagged source. It publishes that exact tarball through OIDC. Only after publication is verified does a separate job create the GitHub Release, using `--latest=false`.

Release notes select commits affecting the chosen package since its previous package Release, including the existing `0.1.0` tags. Version-only commits are omitted. Dependencies changed in package.json remain eligible for the notes. Normal version updates do not create PRs or require another manual action.

All preparations share one concurrency group because they update the same lockfile and main branch. Publishing is serialized per package, including GitHub Release creation. Both use `cancel-in-progress: false` and [`queue: max`](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency) (up to 100 pending runs). A package with an unfinished current release cannot be bumped again; recover that release first. Another package can still be released.

## Recovery

Prefer **Re-run failed jobs** on the original run. Do not start another version bump to recover an existing version, delete or move a tag, or run `npm publish` locally.

| Failure point                                                                  | Recovery                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before the version commit reaches main, including a main update conflict       | Inspect main and the failed run to confirm no release commit was pushed, then start a new preparation run. A rerun without a persisted commit deliberately stops rather than selecting a potentially different version. |
| After the version commit reaches main, before the tag is pushed                | Rerun the same preparation run. Its run ID in the commit identifies the original version and commit even if main has advanced. It validates that source again and creates only the missing tag.                         |
| After the tag is pushed                                                        | Rerun the publishing run for that tag. A preparation rerun verifies the existing tag and does not move it or bump again.                                                                                                |
| npm publish failed before publication                                          | Rerun the publishing run. Registry errors other than an explicit 404 stop the workflow; they are never interpreted as an unpublished version.                                                                           |
| npm accepted publication but the job lost its response, or a later step failed | Rerun the publishing run. It skips npm publish only after verifying the existing publication as described below.                                                                                                        |
| Only the GitHub Release job failed                                             | Rerun failed jobs. The successful publishing job is retained; only the idempotent GitHub Release job runs again.                                                                                                        |

If a tag push did not produce a workflow run, recover on the existing tag without another push:

```sh
gh workflow run publish-package.yml --ref nostr-kit/v0.1.1
```

Use the actual tag. This manual recovery entry accepts only validated package tags, not main or arbitrary branch refs, and does not change any version. Preparation reruns must retain their original run ID; a new dispatch is a new release request. If the original preparation run record is no longer available, stop and investigate rather than inventing replacement release metadata.

For an existing npm version, the workflow compares its SHA-512 integrity to the tarball rebuilt from the tagged source. It also uses the pinned official [`@sigstore/cli`](https://github.com/sigstore/sigstore-js/tree/main/packages/cli) verifier to verify the provenance signature, certificate issuer and workflow/tag identity, then checks the signed statement's package, digest, repository, workflow, tag, and source commit. Missing provenance, mismatched bytes, an unrelated publisher, or unverifiable source causes a stop. Matching a version number or an unverified `gitHead` alone is insufficient. This verifier is an execution-time release tool; it is not added to either package's dependencies.

Builds that cease to reproduce the published tarball also stop for investigation. Do not bypass this by republishing or treating an unverified npm version as success. Existing GitHub Releases are checked and left unchanged. npm publication is immutable and precedes GitHub Release creation, so a Release-only retry does not need to republish the package. The web application's Latest Release is never promoted by these workflows.
