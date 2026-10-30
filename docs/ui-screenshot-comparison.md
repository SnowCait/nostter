# UI screenshot comparison

The Test workflow runs on PRs and main pushes. Its successful E2E job records PNG hashes and the runner image OS/version and Playwright version alongside `ui-screenshots`. The complete Test workflow must succeed before its main artifact can become a baseline.

The UI screenshot differences workflow runs after a PR's Test workflow finishes. It uses the latest successful main push run without rebuilding main. It records that run's ID and commit SHA in the notification and includes `changes.json` alongside `before/`, `after/`, and `diff/` feature directories in the difference artifact. Added images have only After; deleted images have only Before. Changed images also have Diff, with smaller images padded transparently when dimensions differ.

Comparison requires intact manifests and matching rendering environment identifiers. Missing, expired, incomplete, incompatible, or undecodable artifacts fail the comparison job; they never produce a clean result or delete an existing notification. The first baseline is available only after this change lands on main and Test succeeds. Runner or Playwright upgrades require a new main baseline. The notification workflow must also exist on the default branch before GitHub triggers it.

Pixelmatch uses its default perceptual color threshold of 0.1, and ignores antialiasing differences. No changed-pixel count or area allowance is applied: any remaining changed pixel or dimension change is reported. Capture retains en-US, light theme, fixed desktop/mobile projects and disabled animations. Matching environment identifiers reduces renderer variation but does not guarantee identical hardware rendering.

Only the comparison job downloads artifacts and executes trusted default-branch code, with read-only permissions. The notification job has no checkout and executes only the workflow's inline API calls, with Actions read and pull-request write permissions. Its branch-level concurrency group serializes results; it checks the current PR head and newer Test runs before mutating the marker-tagged bot comment. Fork PRs use the same post-run path without granting their test jobs write permissions.

Run focused checks with `node --test .github/scripts/*.test.mjs`.
