# Studio Layer Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reviewable Add Vocals and Add Instrumental workflows inside the current Version's Stems workspace, with non-destructive results entering Take Lanes.

**Architecture:** Keep Mori's four stable Studio operations. Both workflows are typed variants of `add_part` with `whole_version` scope, so the existing version-bound generation lifecycle, cancellation, refresh, and Take Lanes remain authoritative. A focused layer-plan module owns intent-to-contract mapping; a focused composer owns progressive UI; `StudioPageContent` only orchestrates the existing generation run.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict mode, CSS Modules, Vitest, Testing Library, OpenAPI 3.1.

## Global Constraints

- Modify only `kokoro-mori`; do not modify BFF, Root, `kokoro-app`, or another subrepository.
- Keep the default light Mori gradient language and the existing fixed Rail / canvas / Player shell.
- Add Vocals and Add Instrumental stay contextual to the current Version; they do not become global navigation entries.
- Every request is reviewable before submission, keeps the current Version untouched, and sends results to Take Lanes.
- Public JSON is `snake_case`, provider-neutral, version-bound, and idempotent.
- No fake playable audio or synthetic success fallback when the same-origin API is unavailable.
- Write and observe a failing test before every production behavior change.

---

### Task 1: Extend the typed `add_part` contract for whole-Version layers

**Files:**
- Modify: `contract/openapi/mori-studio-change.v1.json`
- Modify: `contract/tests/mori-studio-change.contract.test.ts`
- Modify: `src/lib/mori-api.ts`
- Modify: `src/lib/mori-api-client.test.ts`

**Interfaces:**
- Produces: `StudioLayerKind = "vocals" | "instrumental"`.
- Produces: `MoriStudioChangeDraft` whole-Version `add_part` variant with `partKind`, `lyrics`, and `voiceRef`.
- Produces: `StudioChangeGenerationInput` whole-Version `add_part` payload with `part_kind`, `lyrics`, and `voice_ref`.
- Keeps: insertion-point `add_part` payload unchanged.

- [ ] **Step 1: Write failing request-builder tests**

```ts
expect(createStudioChangeRequest({
  operation: "add_part",
  scope: { type: "whole_version" },
  partKind: "vocals",
  instruction: "Keep the delivery close and unhurried.",
  lyrics: "Meet me where the streetlights fade.",
  voiceRef: "voice_preview_mira",
  preserve: ["melody", "tempo", "structure"],
  outputCount: 2,
})).toEqual({
  operation: "add_part",
  scope: { type: "whole_version" },
  part_kind: "vocals",
  instruction: "Keep the delivery close and unhurried.",
  lyrics: "Meet me where the streetlights fade.",
  voice_ref: "voice_preview_mira",
  preserve: ["melody", "tempo", "structure"],
  reference_asset_refs: [],
  output_count: 2,
})
```

- [ ] **Step 2: Run the focused test and confirm it fails because the whole-Version `add_part` variant is absent**

Run: `pnpm vitest run src/lib/mori-api-client.test.ts --reporter=dot`

- [ ] **Step 3: Implement the discriminated TypeScript input and validation**

Require non-empty lyrics for `partKind: "vocals"`; normalize optional `voiceRef`; force `lyrics: null` and `voice_ref: null` for `partKind: "instrumental"`; preserve insertion-point behavior.

- [ ] **Step 4: Add failing OpenAPI assertions, then update the schema**

`AddPartGenerationInput` becomes a `oneOf` wrapper around the existing insertion-point command and a strict whole-Version layer command. The layer command requires `part_kind`, `lyrics`, and `voice_ref`, rejects provider/caller identity fields, and reuses the current generation receipt and snapshot.

- [ ] **Step 5: Run contract and builder tests**

Run: `pnpm vitest run contract/tests/mori-studio-change.contract.test.ts src/lib/mori-api-client.test.ts --reporter=dot`

### Task 2: Build layer plans independently from the React surface

**Files:**
- Create: `src/features/mori/studio-layers.ts`
- Create: `src/features/mori/studio-layers.test.ts`

**Interfaces:**
- Produces: `StudioLayerMode`, `StudioLayerPlan`, `buildStudioLayerPlan()`.
- Produces a `StudioLayerPlan` structurally compatible with `StudioChangePlan`, carrying the layer mode,
  `scopeLabel: "Whole song"`, and a whole-Version `add_part` draft.

- [ ] **Step 1: Write failing plan tests**

Assert that vocals preserve melody/tempo/structure and carry lyrics/voice identity; instrumental layers preserve melody/lyrics/vocal identity/tempo/structure and carry no lyrics or voice ref.

- [ ] **Step 2: Run and observe the missing-module failure**

Run: `pnpm vitest run src/features/mori/studio-layers.test.ts --reporter=dot`

- [ ] **Step 3: Implement the smallest plan builder**

The builder trims fields, fixes output count at two initial alternatives, labels the destination Take Lanes, and does not synthesize audio or API state.

- [ ] **Step 4: Run the plan tests**

Run: `pnpm vitest run src/features/mori/studio-layers.test.ts --reporter=dot`

### Task 3: Add a progressive layer composer to Stems

**Files:**
- Create: `src/features/mori/components/studio-layer-composer.tsx`
- Create: `src/features/mori/components/studio-layer-composer.module.css`
- Modify: `src/features/mori/components/studio-stems-editor.tsx`
- Modify: `src/features/mori/studio-page.test.tsx`

**Interfaces:**
- Consumes: preview voice profiles, `StudioLayerPlan`, and existing `StudioAiRunState`.
- Produces: reviewed plans through `onGenerate(plan)`; requests navigation through `onReviewTakes()`.

- [ ] **Step 1: Write failing interaction tests**

Verify three contextual Stems intents—Add vocals, Add instrumental, Separate mix—without adding global navigation. For Add vocals, require lyrics, allow a Voice profile, show Whole song / Take lanes / current-Version safety facts, and expose Generate 2 takes only after Review.

- [ ] **Step 2: Run and confirm the controls are absent**

Run: `pnpm vitest run src/features/mori/studio-page.test.tsx --reporter=dot`

- [ ] **Step 3: Implement semantic structure and restrained styling**

Use a compact workflow selector at the top of Stems. Keep separation as the default. Add Vocals exposes lyrics, optional Voice profile, and vocal direction; Add Instrumental exposes one arrangement-direction field. Reuse existing Mori tokens, visible focus, and responsive layout.

- [ ] **Step 4: Run the focused UI tests**

Run: `pnpm vitest run src/features/mori/studio-page.test.tsx --reporter=dot`

### Task 4: Connect layers to the existing generation lifecycle and Take Lanes

**Files:**
- Modify: `src/features/mori/studio-page.tsx`
- Modify: `src/features/mori/components/studio-stems-editor.tsx`
- Modify: `src/features/mori/studio-page.test.tsx`

**Interfaces:**
- Reuses: `generateStudioChange`, snapshot/event recovery, cancellation, candidate projection, and `studioCandidates`.
- Produces: successful layer candidates in the existing Arrangement Take Lanes; no automatic Current Version mutation.

- [ ] **Step 1: Write a failing end-to-end component test**

Submit Add Vocals, assert the exact `snake_case` command, return one generated candidate, verify the Stems status offers `Review takes in Arrangement`, then verify navigation reveals the generated Take without promoting it.

- [ ] **Step 2: Run and observe the missing orchestration failure**

Run: `pnpm vitest run src/features/mori/studio-page.test.tsx --reporter=dot`

- [ ] **Step 3: Pass the existing Studio run and handlers into Stems**

Keep one active version-scoped generation state. Layer plans use the existing command path; switching Studio tools preserves active work. `Review takes in Arrangement` changes the local Studio tool only.

- [ ] **Step 4: Run all focused tests**

Run: `pnpm vitest run src/features/mori/studio-layers.test.ts src/features/mori/studio-page.test.tsx src/lib/mori-api-client.test.ts contract/tests/mori-studio-change.contract.test.ts --reporter=dot`

### Task 5: Product documentation, visual QA, and full gate

**Files:**
- Modify: `docs/MUSIC_CAPABILITIES.md`
- Modify: `docs/PRODUCT_SHAPE.md`
- Modify: `ACCEPTANCE.md`

- [ ] **Step 1: Document the capability boundary**

Record that Add Vocals / Add Instrumental are whole-Version `add_part` variants in Stems, not global tools; their output goes to Take Lanes and requires explicit promotion.

- [ ] **Step 2: Inspect desktop rendering and the browser console**

Run `pnpm dev --hostname 127.0.0.1 --port 3004`, inspect Stems separation, Add Vocals setup/review, Add Instrumental setup/review, and successful Review Takes state at 1280×720. Confirm no browser error logs.

- [ ] **Step 3: Run the full repository gate**

Run: `git diff --check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`

- [ ] **Step 4: Restore generated noise and commit**

Restore `next-env.d.ts`, remove `.playwright-cli` and `output/playwright`, stop the server, verify a clean diff, and commit with `feat: add contextual Studio layers`.
