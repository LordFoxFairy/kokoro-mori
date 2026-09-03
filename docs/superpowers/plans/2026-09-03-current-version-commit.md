# Current Version Commit Implementation Plan

**Goal:** Replace Studio's local `Use take` toggle with an exact, retry-safe Current Version command while keeping open, playing, selected, and Current states distinct.

**Architecture:** Add one Mori-owned browser OpenAPI contract and same-origin client method. Studio performs a non-optimistic compare-and-set command, validates the response context, reuses the idempotency key on retry, and renders command state inside Take Lanes. No BFF or sibling repository changes.

## Task 1: Lock the command contract and client

- [ ] Add failing OpenAPI tests for path, `PUT`, idempotency, CAS input, exact response, `409` / `422`, snake_case, and provider-neutral boundaries.
- [ ] Add failing client/parser tests for exact request serialization and malformed response rejection.
- [ ] Implement `mori-current-version.v1.json`, strict browser types/parser, client method, and preview API fixture.
- [ ] Run focused tests and typecheck; commit the contract slice.

## Task 2: Connect Studio with non-optimistic UX

- [ ] Replace the local-toggle test with failing pending/success assertions.
- [ ] Add failing retry, idempotency reuse, conflict, response mismatch, and Version history truth tests.
- [ ] Implement the tracked command, exact response matching, error copy, Retry / Dismiss, and pending controls.
- [ ] Run Studio tests, lint, and typecheck; commit the workflow slice.

## Task 3: Inspect and close

- [ ] Inspect desktop and mobile Take Lanes, pending/error states, fixed Player separation, and overflow.
- [ ] Update contract, capability, product-shape, and acceptance docs.
- [ ] Run `git diff --check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- [ ] Restore generated files, remove artifacts, stop servers, check all boxes, commit docs, and confirm a clean worktree.

