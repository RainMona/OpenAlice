# Desktop ASAR packaging

Status: implementing on `codex/desktop-asar`, held for maintainer inspection
before opening or merging a PR. Related issues: none.

Owner guides: [[docs/managed-workspace-runtime.md]],
[[docs/development-workflow.md]], [[docs/testing.md]].

## Scope and decisions

Reduce expanded application files and Windows long-path exposure while keeping
the real packaged Workspace toolchain functional. Electron main/preload,
Alice/UTA/Connector JavaScript and ordinary dependencies live in `app.asar`.
Electron 39.8.10 Node mode was experimentally verified to execute an ESM entry
and read an adjacent package.json inside an ASAR archive.

`Resources/runtime` contains the resources used by external tools: vendor,
Workspace CLI/templates, default assets, UI assets and product metadata.
`OPENALICE_APP_HOME` names this physical resource root; application entrypoints
remain relative to the archive. Native modules and dugite Git are explicitly
unpacked. Keep Electron's RunAsNode support: managed Pi and backend children
depend on it. No user-state migration or release publication is in scope.

## Ordered acceptance

- [x] Establish a clean branch from current dev and inspect runtime ownership.
- [x] Verify Electron Node-mode ASAR ESM support with a disposable archive.
- [x] Capture an unsigned baseline package and measure physical files/bytes.
- [x] Implement split resources, archive assertions and regression coverage.
- [x] Run focused tests, owning typechecks and full hermetic suite.
- [x] Exercise real dev Electron PTY and packaged Workspace/toolchain paths.
- [x] Compare package files/bytes and retain an isolated candidate for review.
- [ ] Verify native Windows upgrade/toolchain acceptance before promotion.

Completion requires maintainer acceptance of the branch and applicable native
platform evidence. Local unsigned acceptance cannot establish signing,
notarization or Windows installer behavior.

## First candidate evidence (macOS arm64)

Baseline: current dev `3258dc72`, unsigned directory package, same Electron and
vendor inputs. Candidate output: `/tmp/openalice-asar-candidate-0689`.

| Measurement | Loose baseline | ASAR plus resource filtering |
| --- | ---: | ---: |
| Physical regular files (whole app, excluding symlinks) | 29,332 | 10,693 |
| Logical file bytes (whole app) | 1,054,639,724 | 1,016,646,735 |
| Physical resource files | 29,076 | 10,437 |
| Longest app-relative physical path (characters) | 194 | 192 |

File count falls 63.5%; logical bytes fall 3.6%. These are installed-tree
measurements, not compressed installer size or startup benchmarks. ASAR alone
is not compression. Resource filtering additionally removes vendor maps/types.
Native dependencies and the Pi/toolchain tree remain physical, so this does
not establish elimination of Windows long-path failures.

The first Workspace run caught physical templates resolving `dugite` outside
the archive. Packaged Electron now reuses the existing internal bootstrap role
and injects the archive's Git executor; no copied dependency tree or new
resolver environment variable is needed.

Passed locally:
- `pnpm electron:build`, root/desktop/UI typechecks.
- Focused package, metadata hook and Workspace bootstrap specs (28 tests).
- Final complete hermetic suite: 754 files, 6,731 passed, 3 skipped.
- `electron:assert-package` and `electron:smoke-toolchain` on the candidate.
- `electron:smoke:pty --skip-build` in source/dev Electron.
- `electron:smoke:workspace --skip-build --skip-pack --package-root ...`:
  all 12 receipt checks passed, including Git, PTY, every CLI, scheduling,
  managed Pi structured output/compaction and the actual CLI side effect.
- Packaged `--trading-mode`: lite -> readonly -> lite starts and stops archived
  UTA against isolated data with no configured broker accounts.
- Archived Connector starts, serves healthy with no adapters, and shuts down
  against a disposable home.

- Real candidate window was inspected through the native UI; Initialize Ask
  Alice created the durable Chat Workspace and reached the task composer.

Windows native package/toolchain and N-1 acceptance is running at
https://github.com/TraderAlice/OpenAlice/actions/runs/34191057511
against implementation commit `70ca7064`; preflight passed. Signing,
notarization and installer publication were not exercised.


## Windows verification follow-up

Run 34191057511 generated the Windows ASAR package successfully after source
Guardian/PTY and existing-owner acceptance. Its package assertion failed before
runtime acceptance: `@electron/asar` looks up nested directories using the
host path separator, while the assertion supplied slash-separated manifest
paths. Normalize those queries before `statFile`; the existing archive fixture
spec exercises nested entries and now runs on native hosts before the expensive
build. This is a verifier correction, not evidence of a successful Windows
Workspace or upgrade. A new native run must complete those gates.

The macOS candidate also passed toolchain and all 12 Workspace receipt checks
from a path containing both spaces and Chinese characters; its temporary copy
was cleaned via the package-artifact ownership helper. The held preview uses a
temporary business-data home and contains a manually initialized Chat Workspace.


Run 34191866368 passed the native inspector fixtures and rebuilt the Windows
package, then the payload check rejected the `default` directory entry before
examining its contents. Empty parent entries left by resource exclusion are
valid ASAR structure; inspect leaf files for duplication instead. Fixtures now
include empty external-resource directories and separately reject a duplicated
resource file (18 focused tests pass). Windows runtime acceptance remains open
until the updated verifier reaches and passes it.


Run 34192586050 reached the leaf-file check and exposed a real Windows duplicate:
`default/alice-harness.json`. The underlying builder behavior was reproduced
locally with its actual `doMergeConfigs` and `getMainFileMatchers`: the preexisting
bare-string `win.files` exclusion becomes a separate default all-files matcher
beside the normalized global whitelist. It admitted source, docs and vendor
resources as well as app code. Use a FileSet for the platform exclusion instead.
The real builder regression now checks macOS and Windows allowlists plus the
platform-specific dugite binary exclusion (20 focused tests pass). This fixes
the selection boundary rather than weakening the duplicate-payload assertion.
