# Studio Cover / Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` while implementing each task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Studio Transform into a clear Restyle / Cover workflow that keeps the open Version as source, reviews every command, returns non-destructive Takes, and reuses Mori's existing generation lifecycle.

**Architecture:** Keep `transform` as the stable transport operation and add typed `restyle`, `cover`, and existing `remaster` intent branches. Inline Studio exposes Restyle and Cover; Finish owns Remaster. Page-owned tracked plans use exact intent-specific snapshots before attaching candidates. No global tool, provider field, BFF, or second task state machine is added.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, CSS Modules, Vitest, Testing Library, OpenAPI 3.1.

## Global constraints

- Modify only `kokoro-mori`; do not change Root, BFF, `kokoro-web-shared`, or sibling repositories.
- Preserve the top-level Add part / Replace section / Extend / Transform operation model.
- Keep Restyle and Cover inside Studio Transform; keep Remaster inside Finish.
- Current Version is the implicit Restyle/Cover source and never changes automatically.
- Restyle supports selected range or whole song, chosen anchors, references, and 1/2/4 alternatives.
- Cover is whole song, fixed two alternatives, empty references, and exact mode-specific anchors.
- Vocal Cover may use one Voice profile; Instrumental Cover must serialize `voice_ref: null`.
- External JSON is `snake_case`; browser drafts use `camelCase`; no provider-private fields.
- Transform snapshots must echo and exactly match the reviewed intent context.
- Preserve existing Studio generation cancel/retry/SSE/polling and Take Lane behavior.

---

### Task 1: Lock typed Restyle / Cover contracts with RED tests

**Files:**
- Modify: `contract/tests/mori-studio-change.contract.test.ts`
- Modify: `contract/openapi/mori-studio-change.v1.json`
- Modify: `src/lib/mori-api-client.test.ts`
- Modify: `src/lib/mori-api.ts`
- Modify: `src/lib/mori-api-validation.ts`

**Interfaces:**
- Produces: `StudioTransformIntent`, `StudioCoverMode`, `StudioRestyleGenerationInput`, `StudioCoverGenerationInput`, `StudioRestyleGenerationSnapshot`, `StudioCoverGenerationSnapshot`, `MoriStudioRestyleDraft`, and `MoriStudioCoverDraft`.
- Updates: `StudioChangeGenerationInput`, `StudioChangeGenerationSnapshot`, `MoriStudioChangeDraft`, `createStudioChangeRequest`, and generation snapshot parsing.

- [ ] **Step 1: Write failing OpenAPI tests** asserting Transform variants are Restyle, Cover, and Remaster; Standard snapshots exclude Transform; Cover has whole-Version/fixed-two/typed-mode fields; Restyle has explicit intent; and typed snapshots require the full reviewed context.
- [ ] **Step 2: Write failing builder/parser tests** for range and whole-song Restyle, Vocal and Instrumental Cover, trimming/de-duplication, exact anchors, fixed outputs/references, invalid scope/mode/Voice/anchor combinations, exact snapshot parsing, and partial metadata rejection.
- [ ] **Step 3: Run RED** with `pnpm test -- contract/tests/mori-studio-change.contract.test.ts src/lib/mori-api-client.test.ts` and confirm failures describe missing typed intent behavior.
- [ ] **Step 4: Implement the minimum OpenAPI, TypeScript unions, request builder validation, and strict parser branches** without changing unrelated generation contracts.
- [ ] **Step 5: Run GREEN** with the focused test command and then `pnpm typecheck`.
- [ ] **Step 6: Commit** with `git add contract src/lib && git commit -m "feat: model studio cover and restyle contracts"`.

### Task 2: Model intent-aware plans and build the inline Transform UI with RED tests

**Files:**
- Modify: `src/features/mori/studio-change.ts`
- Modify: `src/features/mori/studio-change.test.ts`
- Create: `src/features/mori/components/studio-ai-composer.test.tsx`
- Modify: `src/features/mori/components/studio-ai-composer.tsx`
- Modify: `src/features/mori/components/studio-ai-composer.module.css`
- Reuse: `src/features/mori/creative-assets.ts`

**Interfaces:**
- Extends: `StudioChangePlan` with intent label/details and typed Restyle/Cover draft context.
- Extends: `StudioChangePlanOptions` with `transformIntent`, `coverMode`, and `coverVoiceRef`.
- UI: Transform reveals Restyle/Cover; Cover reveals Vocal/Instrumental and optional preview Voice; reviewed plan names the selected intent.

- [ ] **Step 1: Write failing plan tests** asserting Restyle preserves user-selected range/anchors/count and Cover enforces whole-song mode-specific anchors, fixed two Takes, nullable Voice, and intent-readable plan facts.
- [ ] **Step 2: Write failing component tests** asserting intent discovery only under Transform, Restyle default, Cover clarification/source copy, Vocal/Instrumental behavior, optional Voice, review invalidation, exact generated plans, accessible groups, and busy-state protection.
- [ ] **Step 3: Run RED** with `pnpm test -- src/features/mori/studio-change.test.ts src/features/mori/components/studio-ai-composer.test.tsx`.
- [ ] **Step 4: Implement the minimum plan model and UI** using the existing warm-light surface, compact two-card intent switch, progressive direction controls, and one-column mobile layout.
- [ ] **Step 5: Run GREEN** with the focused tests and `pnpm typecheck`; confirm no React console warnings.
- [ ] **Step 6: Commit** with `git add src/features/mori && git commit -m "feat: add studio cover and restyle controls"`.

### Task 3: Enforce exact snapshot context in Studio integration with RED tests

**Files:**
- Modify: `src/features/mori/studio-page.test.tsx`
- Modify: `src/features/mori/studio-page.tsx`

**Interfaces:**
- Consumes typed Restyle/Cover requests through existing `createStudioChange`.
- Matches each durable snapshot against generation ref, source Version, operation, intent, scope, instruction, anchors, references, output count, mode, and Voice before adding candidates.
- Keeps active plan state across Arrangement/Lyrics/Stems navigation and reuses existing cancel/retry and Take Lanes.

- [ ] **Step 1: Replace the generic Transform integration test with failing Restyle and Cover happy paths** that assert exact submitted payloads, matching snapshots, two/variable Take results, and unchanged Current.
- [ ] **Step 2: Add failing resilience tests** for wrong intent, changed Cover mode/Voice, mismatched scope/instruction/anchors/output, partial metadata, cancellation, and Studio-tool continuity.
- [ ] **Step 3: Run RED** with `pnpm test -- src/features/mori/studio-page.test.tsx` and confirm snapshot matching is the missing behavior.
- [ ] **Step 4: Implement intent-aware matching and error copy** while preserving Remaster matching and generic Add/Replace/Extend behavior.
- [ ] **Step 5: Run GREEN** with Studio page tests, then all Studio change/component/client/contract tests.
- [ ] **Step 6: Commit** with `git add src/features/mori && git commit -m "feat: connect studio cover and restyle workflow"`.

### Task 4: Document, visually inspect, and verify

**Files:**
- Modify: `ACCEPTANCE.md`
- Modify: `contract/README.md`
- Modify: `docs/MUSIC_CAPABILITIES.md`
- Modify: `docs/PRODUCT_SHAPE.md`
- Modify: `docs/superpowers/plans/2026-09-03-studio-cover-restyle.md`

- [ ] **Step 1: Document the final product boundary**: Suno-style Version continuity, Tad-style named AI intents, Mori's light contextual execution, typed snapshots, Cover versus artwork, and no new global tool.
- [ ] **Step 2: Run the complete automated gate** with `git diff --check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- [ ] **Step 3: Inspect desktop at 1280×720** and verify Transform intent hierarchy, prompt dominance, plan readability, Studio/Player separation, reachable controls, and no clipping.
- [ ] **Step 4: Inspect mobile at 390×844** and verify one-column controls, no horizontal overflow, reachable plan actions above the global Player, and no ambiguous Cover/artwork language.
- [ ] **Step 5: Update acceptance evidence and checkboxes, restore generated `next-env.d.ts`, remove visual artifacts, stop local servers, and confirm clean Git status after commits.**
- [ ] **Step 6: Commit** with `git add ACCEPTANCE.md contract/README.md docs && git commit -m "docs: record studio cover and restyle"`.
