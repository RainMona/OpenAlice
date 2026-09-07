# Alice Harness injection

Alice Project provides Workspace CLI contracts and companion Skills independently
of the Workspace Harness. Chat template versions, AutoQuant source pins, and
Auto Prediction source pins do not version this injection layer.

## Version authority

`default/alice-harness.json` declares the Project's injection release version.
Its effective revision appends a content fingerprint of the public CLI command
registry and complete owned skill trees. Bump the declared version for behavior
changes not represented in those assets. Updating these assets does not require
bumping a Chat/AQ/AP template version.

Each newly created Workspace records accepted state at
`.alice/alice-harness-version.json` (schemaVersion, template=alice-harness,
appliedVersion, appliedAt, source and optional upgrade commit). It is local
bookkeeping excluded from Workspace Git, alongside the compressed three-way
baseline and recovery journal under `.alice/alice-harness-upgrade/`.
The actual executable/tool implementation remains provided by the running
Project. The accepted revision does not pin an old binary. Status surfaces show
accepted and available revisions separately.

## Ownership

Alice Harness owns complete trees for `alice`, `alice-analysis`, `alice-uta`,
`traderhub`, and `self-scheduling`, plus removal/reconciliation of legacy
`alice-workspace` copies. `.agents/skills` is primary and `.claude/skills` is its
runtime mirror; old `.pi/skills` duplicates are included only for reconciliation.
Template-declared instructions, README and other bundled Skills remain template
owned. Existing template baselines may contain these trees, but template plans
exclude Alice-owned paths. Source upgrades remain ordinary upstream Git merges
and do not advance Alice injection metadata.

## Workspace configuration

`.alice/alice-harness-config.json` is Workspace-owned, tracked configuration.
Omitted entries are enabled. A CLI-wide disable wins over group switches:

```json
{
  "schemaVersion": 1,
  "cli": {
    "alice": { "groups": { "rss": false } },
    "alice-uta": { "enabled": false }
  }
}
```

First-version granularity is CLI and command group. The gateway reads current
configuration for both discovery and invocation, including the legacy Workspace
export. Disabled tools return 403; malformed configuration fails closed with a
configuration error. This is customization of Workspace capabilities, not a
sandbox against an Agent allowed to edit its own files. UTA permission and
trading-write authority remain unchanged.

Saving configuration does not overwrite skill files. An independent injection
preview reflects the current configuration; a wholly disabled CLI's companion
Skills are omitted from Incoming. Group-level restrictions remain discoverable
through live help even when a shared Skill discusses other groups. Customized
Skills follow ordinary three-way conflict/preservation rules.

## Independent upgrade

Workspace details → CLI → Alice Harness → Manage offers status, command
switches and a file review. The API is `/api/workspaces/:id/alice-harness`,
`PUT .../alice-harness/config`, and `GET/POST .../alice-harness-upgrade`.
The CLI offers `alice harness upgrade` and `alice harness upgrade --apply`, with
`--id` for a peer and the same per-file conflict flags as template upgrades.

The shared managed-file engine provides checkout serialization, active-Session
and staged-index blockers, exact preview digests, atomic file replacements,
Git commit, rollback and committed-transaction recovery. Configuration is part
of the preview digest and never overwritten by upgrade. Both upgrade layers
recover before scheduled work starts.

Existing Workspaces are unversioned until explicitly adopted. First preview
uses the legacy root-commit baseline; unknown or customized content is preserved
or reviewed as a conflict. No startup rewrite or bulk migration changes user
files. First successful adoption creates a missing default configuration through the same reviewed transaction and records the independent baseline and revision.
