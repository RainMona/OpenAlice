# AliceProject workspace setup

Status: verified, preparing delivery, serial interactive delivery. No related issue.
Owners: docs/alice-project.md, docs/cli-supervisor.md, docs/workspace-lifecycle.md.

New projects select durable workspaces (Chat default; Quant and Prediction optional).
TUI creates and starts the project. Scripted creation records the same selection for
first startup. The backend alone materializes workspaces before exposing its UI;
it does not launch Agent Sessions. Existing homes without a setup request are unchanged.
Failures retain the request for restart recovery and existing web setup offers manual retry.
No shipped state is replaced: this is an additive new-project intent file.
TUI retains keyboard navigation, uses its existing foundry at narrow/wide sizes;
web uses existing Harness landing/setup primitives and responsive behavior.

- [x] Shared create selection and durable intent
- [x] Backend preparation using canonical resolvers and preferences
- [x] TUI selection, progress, create/start and CLI flags/prompts
- [x] Unit tests, full typechecks and hermetic suite
- [x] Real isolated CLI/TUI/browser and onboarding Electron acceptance
- [ ] Serial dev delivery

Acceptance: 736 hermetic files / 6606 tests passed, 3 skips. Root, CLI, UI and
desktop typechecks passed. Packaged onboarding reports ready/launcher-vault
and reaches broker setup. Real source UI Setup created Chat/Quant/Prediction
without Sessions; isolated onboarding uses mock credentials and recovers an
interrupted Quant checkpoint through Retry. Demo route and 390px layout checked.
TUI PTY verifies creation/selection/start and the 80-column foundry.

Discovered and repaired: registration is also used by transfers, so setup intent
is written only by explicit new-project callers. First-run provider setup needed
a visible dialog layer, explicit Chat provider binding, and removal of an
async transition using stale readiness.
