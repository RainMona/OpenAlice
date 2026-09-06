# Plan: Web conversation surface for every structured Agent runtime

**Status:** active  
**Owner guides:** [[docs/web-conversation-surface.md]], [[docs/ui-interaction-and-motion.md]], [[docs/workspace-manager.md]]  
**Delivery:** serial PR to `dev` (`area:workspace`, `area:ui`).

## Goal

WebPi proved that a browser conversation over a long-lived structured CLI
process is a better product surface than a PTY for many tasks. It shipped as a
Pi-only special case: the host spoke Pi's RPC protocol, the routes checked
`agent === 'pi'`, and the UI gated every affordance on the same literal.

This plan turns "WebPi" into one Web surface that any Agent runtime can join by
declaring a wire protocol. The browser keeps the adapter-neutral conversation
presentation from PR #1385; Alice gains a transport layer that normalizes each
runtime's live protocol into one message model, one phase model, and one
permission-request model.

## Alternatives considered

1. **One native host per runtime** (the WebPi approach repeated N times).
   Closest fit to each CLI, but N protocol parsers and N snapshot shapes, and
   the browser would need N presenters. Rejected as the primary structure.
2. **Everything through ACP** (Agent Client Protocol). One client covers
   cursor, grok, opencode, omp natively; claude, codex, and pi need an extra
   npm adapter package, agy has no trustworthy implementation, and ACP is the
   lowest common denominator (no compaction, model, or thinking controls
   without vendor `_meta`). Rejected as the only path, adopted as one transport.
3. **Hybrid (chosen):** a neutral `WebSessionHost` with pluggable transports.
   `pi-rpc` reuses the existing code for pi and omp; `acp` covers the three
   runtimes whose own binary speaks ACP; `claude-stream-json` and
   `codex-app-server` use the vendor protocols that are richer than ACP and
   need no extra install. Pi's minimal message shape becomes the neutral
   model because every other protocol maps onto it losslessly enough for
   presentation, and the browser presenter already understands it.

## Decisions

- The neutral model is presentation-grade, not a persisted store. Each
  runtime's own transcript remains the durable conversation; Alice keeps one
  live process per Session record, exactly as WebPi did.
- `SessionRecord.surface: 'webpi'` is a shipped persisted value (migration
  0040) and stays. It now means "structured web conversation" for any agent.
  HTTP paths move from `/webpi/*` to `/web/*` because UI and server ship
  together; no compatibility alias.
- Adapters opt in with `capabilities.web = { wire }` plus `composeWebCommand`.
  The UI reads the capability from `/api/workspaces/agents`; no runtime id
  literal decides whether a Web button exists.
- Permission prompts become first-class: transports surface
  `session/request_permission` (ACP), `can_use_tool` control requests
  (Claude), and `item/*/requestApproval` (Codex) as neutral requests with
  options; the browser answers through `POST .../web/respond`. Pi and omp
  keep launch-time approval (`--approve` / `--auto-approve`) because their RPC
  modes have no per-tool prompt.
- Fresh Web sessions are allowed for runtimes that create sessions in-band
  (ACP `session/new`, Codex `thread/start`, Claude `--session-id`, omp fresh
  RPC). The transport reports the native id and Alice binds it to the
  `resumeId` the same way PTY discovery does.
- agy stays TUI-only: its new `--input-format stream-json` has no permission
  round-trip and no native ACP; revisit when either lands.
- Workspace Manager keeps its Pi-only WebPi quick start; other runtimes still
  need a manager-contract injection path before they can join it.

## UI design decision

Alternatives for permission prompts: (a) inline as a transcript item, (b) a
modal dialog, (c) a card pinned above the composer. (c) is chosen: it keeps
the transcript an audit trail, does not steal focus from a user who is typing
a follow-up, and matches the compaction status treatment already pinned in
the same slot. Options render as buttons in the order the runtime supplies;
allow-style options are primary, reject-style are outline. Reduced motion is
inherited from the shared primitives.

## Work

- [ ] Neutral message/request/snapshot model and transport contract
- [ ] `WebSessionHost` with process supervision shared by all transports
- [ ] `pi-rpc` transport (pi, omp) extracted from `WebPiSessionHost`
- [ ] `acp` transport (cursor, grok, opencode) with permission requests
- [ ] `claude-stream-json` transport with `can_use_tool` and interrupt
- [ ] `codex-app-server` transport with approvals and `turn/interrupt`
- [ ] Adapter capability declarations and `composeWebCommand` per runtime
- [ ] Service/routes: `/web/*`, `respond`, native-id binding, capability checks
- [ ] UI: generic hook/presenter/view, permission cards, capability gating, demo
- [ ] Owner guide + doc updates
- [ ] Live acceptance against each installed runtime (see verification)

## Verification

- `npx tsc --noEmit`, `pnpm test`, `cd ui && npx tsc -b`.
- Transport specs drive fake child processes over stdio for every wire.
- Demo route (`pnpm -F open-alice-ui dev:demo`) walks open → prompt →
  permission request → respond → stop for a non-Pi runtime.
- Live runtimes are not available in the authoring environment. Before
  promotion, open one Session per installed runtime, send a prompt that needs
  a tool, answer the permission card, stop mid-turn, and reopen the same
  Session in the TUI to confirm the native transcript is shared.

## Completion

Delete this file and its [[PLANS.md]] bullet when the live acceptance is
recorded and the PR is accepted.
