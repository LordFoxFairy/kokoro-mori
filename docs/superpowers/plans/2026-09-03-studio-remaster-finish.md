# Studio Remaster Finish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` while implementing each task.

**Goal:** Add a reviewable, mix-aware Remaster workflow to Studio that creates two non-destructive Takes from the open Version or its latest saved Mix Revision.

**Architecture:** Remaster remains the typed `remaster` intent of the existing Version-scoped `transform + whole_version` Studio Generation lifecycle. The browser sends provider-neutral source and strength fields, verifies that the durable snapshot echoes the same context, and merges successful Candidates into existing Take Lanes; no new job system, BFF work, global navigation item, or direct Current Version mutation is introduced.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, CSS Modules, Vitest, Testing Library, OpenAPI 3.1.

## Global Constraints

- Modify only `kokoro-mori`; Root, BFF, shared packages, and sibling repositories remain unchanged.
- Keep the four top-level Studio operations: `add_part`, `replace_section`, `extend`, and `transform`.
- External JSON stays `snake_case`; browser TypeScript stays `camelCase` outside wire models.
- Remaster source is the open Version or its latest saved Mix Revision; switching Version clears stale Mix context.
- Strength is exactly `subtle | balanced | bold`, defaults to `balanced`, and is echoed by the snapshot.
- Structure, lyrics, melody, vocal identity, and tempo stay protected; the result is always two Candidate Takes.
- Every submission is reviewed before execution, is cancellable while active, and never replaces Current Version automatically.

---

### Task 1: Lock the Remaster intent and wire contract with RED tests

**Files:**
- Create: `src/features/mori/studio-remaster.test.ts`
- Modify: `contract/tests/mori-studio-change.contract.test.ts`
- Modify: `src/lib/mori-api-client.test.ts`

**Interfaces:**
- Produces: `StudioRemasterStrength`, `StudioRemasterSource`, `MoriStudioRemasterDraft`, `StudioRemasterPlan`, `buildStudioRemasterPlan`, and `isStudioRemasterPlan`.
- Extends: the existing Studio Change request and snapshot unions without adding an endpoint or operation.

- [ ] Write tests asserting the three strengths, exact protected anchors, two outputs, Version/Mix source serialization, and snapshot source/strength parsing.
- [ ] Run `pnpm test -- src/features/mori/studio-remaster.test.ts contract/tests/mori-studio-change.contract.test.ts src/lib/mori-api-client.test.ts` and confirm failures are caused by the missing Remaster types and behavior.
- [ ] Add the minimum typed helper, OpenAPI variants, request builder branch, and strict runtime parser needed to pass.
- [ ] Re-run the focused tests and confirm they pass.

### Task 2: Build the review-first Finish dialog with RED tests

**Files:**
- Create: `src/features/mori/components/studio-finish-dialog.test.tsx`
- Create: `src/features/mori/components/studio-finish-dialog.tsx`
- Create: `src/features/mori/components/studio-finish-dialog.module.css`

**Interfaces:**
- Consumes: Version identity, optional latest Mix Revision, shared `StudioAiRunState`, and `StudioRemasterPlan` callbacks.
- Produces: setup, reviewed, queued/generating, failed/cancelled, and Takes-ready states in one accessible portal dialog.

- [ ] Write component tests for the balanced default, Mix preference, changing strength, explicit review, exact submit plan, edit, cancel, retry, Review Takes, Escape, focus trap, body scroll lock, and focus restoration.
- [ ] Run `pnpm test -- src/features/mori/components/studio-finish-dialog.test.tsx` and confirm the missing component causes RED.
- [ ] Implement a restrained light-gradient dialog whose single signature move is a three-step waveform-strength selector; keep source, scope, protected anchors, output count, and destination visible in the plan.
- [ ] Re-run the component tests and confirm they pass without console warnings.

### Task 3: Connect Finish to Studio and existing Take Lanes with RED tests

**Files:**
- Modify: `src/features/mori/studio-page.test.tsx`
- Modify: `src/features/mori/studio-page.tsx`
- Modify: `src/features/mori/mori-workspace.module.css`

**Interfaces:**
- Consumes: `generateStudioChange`, `cancelStudioChange`, `resetStudioChange`, latest Mix Revision, and the existing Candidate merge path.
- Produces: a contextual `Finish` header action with activity feedback and a `Review takes` transition back to Arrangement.

- [ ] Write an integration test that opens Finish, selects a Mix Revision and bold strength, reviews, submits the exact `transform + whole_version + remaster` request, receives a matching snapshot, and finds the returned Takes without changing the existing Current Version.
- [ ] Write a test that rejects a snapshot with a mismatched source or strength and preserves the reviewed plan for retry.
- [ ] Run the focused Studio page tests and observe RED.
- [ ] Wire the dialog into the header and shared generation lifecycle; compare typed Remaster snapshot context before accepting results and keep an active Remaster reachable after closing the dialog.
- [ ] Re-run the focused Studio page tests and confirm GREEN.

### Task 4: Document, visually inspect, and verify

**Files:**
- Modify: `ACCEPTANCE.md`
- Modify: `contract/README.md`
- Modify: `docs/MUSIC_CAPABILITIES.md`
- Modify: `docs/PRODUCT_SHAPE.md`

- [ ] Document Remaster as a contextual Finish capability, its typed source/strength fields, and its Candidate destination.
- [ ] Run `git diff --check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- [ ] Inspect the Studio and Finish dialog at 1280×720 and a narrow mobile viewport; verify no horizontal overflow, one primary action per state, readable source/strength hierarchy, keyboard focus, and unobscured global Player.
- [ ] Restore generated `next-env.d.ts`, remove browser artifacts, stop local servers, and commit the cohesive implementation.
