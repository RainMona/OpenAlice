# Desktop ASAR packaging

Status: implemented and verified on `codex/desktop-asar`; held for maintainer
inspection before opening or merging a PR. Related issues: none.

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
remain relative to the archive. An afterPack hook writes minimal runtime
metadata from the archive. Native modules and macOS dugite Git are unpacked;
Windows uses its existing external Git arrangement. Keep Electron's RunAsNode
support: managed Pi and backend children depend on it. No user-state migration
or release publication is in scope.

Packaged Electron reuses the existing internal bootstrap role to inject the
archive's Git executor into physical Workspace templates. This avoids copying
a dependency tree or adding a resolver environment variable.

Windows platform file selection uses a FileSet with a positive `package.json`
anchor and the dugite Git exclusion. A pure exclusion causes the real builder
walker to add an implicit all-files pattern, duplicating external resources
and admitting source/docs. Regression coverage instantiates the actual builder
walker as well as its config merger and matchers. Archive inspection normalizes
native paths and rejects duplicated resource files while allowing empty parent
directory entries.

## Acceptance

- [x] Establish a clean branch from current dev and inspect runtime ownership.
- [x] Verify Electron Node-mode ASAR ESM support with a disposable archive.
- [x] Capture an unsigned baseline package and measure physical files/bytes.
- [x] Implement split resources, archive assertions and regression coverage.
- [x] Run focused tests, owning typechecks and full hermetic suite.
- [x] Exercise real dev Electron PTY and packaged Workspace/toolchain paths.
- [x] Compare package files/bytes and retain a candidate for review.
- [x] Verify native Windows package/toolchain and previous-version state upgrade.
- [ ] Maintainer acceptance of the held branch.

Local unsigned acceptance and Windows unpacked-package upgrade do not establish
signing, notarization, signed installer replacement or native Intel macOS
behavior. Release publication remains outside this experiment.

## Package comparison (macOS arm64)

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

## Local evidence

- `pnpm electron:build`, root/desktop/UI typechecks passed.
- Final complete hermetic suite: 754 files, 6,734 passed, 3 skipped.
- Final package inspector, metadata hook and toolchain focused suite: 20 passed;
  workflow contracts: 92 passed. Workspace bootstrap regression also passed.
- Candidate package assertion and toolchain smoke passed.
- Source/dev Electron PTY smoke passed.
- Packaged Workspace smoke passed all 12 receipt checks, including Git, PTY,
  every CLI, scheduling, managed Pi structured output/compaction and the actual
  CLI side effect. A second run from a path containing spaces and Chinese
  characters passed toolchain and all 12 checks; its temporary copy was cleaned.
- Packaged trading-mode smoke: lite -> readonly -> lite starts and stops
  archived UTA against isolated data with no configured broker accounts.
- Archived Connector starts, serves healthy with no adapters, and shuts down
  against a disposable home.
- Real candidate window was inspected through the native UI; Initialize Ask
  Alice created the durable Chat Workspace and reached the task composer.
  The held preview uses a temporary business-data home; this does not imply
  isolation of Electron's separate userData profile.

## Native Windows evidence

[Desktop package smoke run 34194348097](https://github.com/TraderAlice/OpenAlice/actions/runs/34194348097)
passed against implementation commit `be9b5275`. Preflight, Windows Broker Pack
acceptance and Windows package acceptance all succeeded.

The package job passed native inspector tests, build, Guardian takeover and
existing-owner checks, package assertions, toolchain smoke, packaged Workspace
acceptance and desktop previous-version state upgrade. Workspace receipt checks
were 12/12 true (25,336 ms).

The desktop upgrade receipt used the published `v0.91.1-beta.1` application and
candidate `0.91.1` as an unpacked package. All 11 checks passed: previous
Workspace and metadata preservation, browser-state preservation, post-upgrade
writes, and persistence of both old/new state after candidate restart. This
verifies application state continuity, not signed NSIS installer replacement.
