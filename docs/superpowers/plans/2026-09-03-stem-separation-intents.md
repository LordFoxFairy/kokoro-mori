# Stem Separation Intents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Mori's obsolete two-mode separation choice with a reviewable, provider-neutral Isolate part / Auto split / Custom stems workflow inside the current Version.

**Architecture:** Keep one version-scoped Stem Separation resource and its existing snapshot, SSE, cancel, and result lifecycle. Encode the requested intent as a discriminated `mode + target_kinds[]` command: one target for `isolate_part`, none for `auto_stems`, and two to ten for `custom_stems`. A focused domain module owns labels, validation, and request mapping; the Stems surface only owns progressive selection and review.

**Tech Stack:** Next.js App Router, React 19, strict TypeScript, CSS Modules, Vitest, Testing Library, OpenAPI 3.1.

## Global Constraints

- Modify only `kokoro-mori`; do not modify BFF, Root, `kokoro-app`, or another subrepository.
- Keep separation contextual to the current immutable Version inside Voice & stems; do not add global navigation.
- Use Mori names and provider-neutral wire values rather than Suno plan names or provider instrument IDs.
- Preserve Review before run, non-destructive results, durable snapshot/SSE recovery, cancellation, and actual-asset-only rendering.
- Public JSON stays strict `snake_case`, idempotent, and free of caller identity or provider fields.
- Keep the light Mori gradient language and make the fast path the default.
- Write and observe a failing test before every production behavior change.

---

### Task 1: Model three separation intents in the domain and browser contract

**Files:**
- Create: `src/features/mori/studio-stems.test.ts`
- Modify: `src/features/mori/studio-stems.ts`
- Modify: `src/lib/mori-api-client.test.ts`
- Modify: `src/lib/mori-api.ts`
- Modify: `contract/tests/mori-stem-separation.contract.test.ts`
- Modify: `contract/openapi/mori-stem-separation.v1.json`

**Interfaces:**
- Produces: `StemSeparationMode = "isolate_part" | "auto_stems" | "custom_stems"`.
- Produces: `StemTargetKind` for vocals, backing vocals, drums, bass, guitar, keys, strings, wind, synth, and percussion.
- Produces: `StemSeparationInput` and `StemSeparationSnapshot` with mode-specific `target_kinds` cardinality.
- Produces: `buildStudioStemSeparationPlan(selection, includeMidi)` and `createStudioStemSeparationDraft(plan)`.

- [x] **Step 1: Write failing domain and request-builder tests**

Assert that Isolate vocals maps to one target and two outputs, Auto split maps to no targets and up to twelve outputs, and Custom stems maps a unique two-to-ten target selection. Assert exact `snake_case` request bodies and invalid target-count errors.

- [x] **Step 2: Run focused tests and observe failures from the absent modes and target field**

Run: `pnpm vitest run src/features/mori/studio-stems.test.ts src/lib/mori-api-client.test.ts --reporter=dot`

- [x] **Step 3: Implement the discriminated domain and request builder**

Use one `target_kinds` array on the wire. Require exactly one item for `isolate_part`, zero for `auto_stems`, and two through ten unique items for `custom_stems`; reject unknown values.

- [x] **Step 4: Write failing OpenAPI assertions and update the schema**

Add `StemTargetKind`, the three modes, conditional target cardinality for command and snapshot, and isolate-success output invariants. Keep all existing resource paths, idempotency, replay, cancel, and identity boundaries.

- [x] **Step 5: Run domain, builder, and contract tests**

Run: `pnpm vitest run src/features/mori/studio-stems.test.ts src/lib/mori-api-client.test.ts contract/tests/mori-stem-separation.contract.test.ts --reporter=dot`

### Task 2: Validate and recover exact separation intent

**Files:**
- Modify: `src/lib/mori-api-client.test.ts`
- Modify: `src/lib/mori-api-validation.ts`
- Modify: `src/features/mori/studio-page.test.tsx`
- Modify: `src/features/mori/studio-page.tsx`
- Modify: `src/features/mori/generation-controller.ts`

**Interfaces:**
- Consumes: discriminated `StemSeparationSnapshot` and `StudioStemSeparationPlan`.
- Produces: runtime rejection of invalid mode/target/result combinations.
- Preserves: exact target intent when matching a durable snapshot to a tracked command.

- [x] **Step 1: Write failing parser and lifecycle tests**

Verify Isolate snapshots require one requested target and exactly two results including that target; Auto snapshots require no targets; Custom snapshots require two-to-ten unique targets. Verify a snapshot with the right mode but different targets is rejected by the Studio lifecycle.

- [x] **Step 2: Run focused tests and observe the missing target validation**

Run: `pnpm vitest run src/lib/mori-api-client.test.ts src/features/mori/studio-page.test.tsx --reporter=dot`

- [x] **Step 3: Implement runtime parsing and exact snapshot matching**

Parse `target_kinds`, validate mode-specific cardinality, preserve the field in returned snapshots, and compare normalized target sets with the tracked plan before attaching assets.

- [x] **Step 4: Update preview fixtures and run the focused tests**

Run: `pnpm vitest run src/lib/mori-api-client.test.ts src/features/mori/studio-page.test.tsx --reporter=dot`

### Task 3: Build the progressive Stems selector

**Files:**
- Modify: `src/features/mori/studio-page.test.tsx`
- Modify: `src/features/mori/components/studio-stems-editor.tsx`
- Modify: `src/features/mori/components/studio-stems-editor.module.css`

**Interfaces:**
- Consumes: `StemTargetKind`, target labels, and `buildStudioStemSeparationPlan()`.
- Produces: fast Isolate part setup, no-configuration Auto split, and multi-select Custom stems setup.

- [x] **Step 1: Write failing interaction tests**

Verify Isolate part is the default with vocals selected, changing the target changes review output and the submitted command, Auto split needs no targets, and Custom stems disables Review until at least two unique targets are selected.

- [x] **Step 2: Run the Studio tests and observe the absent controls**

Run: `pnpm vitest run src/features/mori/studio-page.test.tsx --reporter=dot`

- [x] **Step 3: Implement progressive controls and review facts**

Use three compact intent cards. Show a single target picker only for Isolate part, a checkable target grid with count feedback only for Custom stems, and keep MIDI as the shared optional setting. Review must state Source, Requested parts, Output, and non-destructive behavior.

- [x] **Step 4: Run the Studio interaction tests**

Run: `pnpm vitest run src/features/mori/studio-page.test.tsx --reporter=dot`

### Task 4: Document, inspect, verify, and commit

**Files:**
- Modify: `contract/README.md`
- Modify: `docs/MUSIC_CAPABILITIES.md`
- Modify: `docs/PRODUCT_SHAPE.md`
- Modify: `ACCEPTANCE.md`

- [x] **Step 1: Document the capability and contract boundary**

Record Isolate part as one requested part plus remaining mix, Auto split as up to twelve detected parts, and Custom stems as a two-to-ten target request. Link Suno's current official separation explanation and retain Tad's simple source → mode → result lesson.

- [x] **Step 2: Inspect desktop rendering and browser logs**

Run `pnpm dev --hostname 127.0.0.1 --port 3004`; inspect all three setup and Review states at 1280×720, verify target selection remains understandable, and confirm no browser runtime errors.

- [x] **Step 3: Run the full repository gate**

Run: `git diff --check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`

- [x] **Step 4: Restore generated noise and commit**

Restore `next-env.d.ts`, remove `.playwright-cli` and `output/playwright`, stop the server, verify a clean diff, and commit with `feat: refine stem separation intents`.
