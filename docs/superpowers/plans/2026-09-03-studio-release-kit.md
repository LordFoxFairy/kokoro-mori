# Studio Release Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` while implementing each task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Studio Finish with a release-draft workflow that keeps sound finishing, AI artwork, release metadata, visibility, and remix permission explicit and non-destructive.

**Architecture:** `StudioFinishDialog` becomes a two-view Finish Center: the existing Remaster view remains backed by Version-scoped Studio Generations, while Release uses a separate asynchronous Artwork Generation resource and a synchronous optimistic Release Draft resource. Both workflows stay inside the open Project/Version, use provider-neutral same-origin contracts, and never publish or change Current Version automatically.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, CSS Modules, Vitest, Testing Library, OpenAPI 3.1.

## Global Constraints

- Modify only `kokoro-mori`; Root, BFF, shared packages, and sibling repositories remain unchanged.
- Keep `Finish` as the only Studio entry; do not add Release, Cover, MV, or Artwork to the global Rail.
- Keep Remaster and artwork generation as different resources: Remaster returns audio Takes, artwork generation returns square image candidates.
- External JSON stays `snake_case`; browser TypeScript stays `camelCase` outside wire models.
- Artwork generation always uses `aspect_ratio: "1:1"`, `text_policy: "no_text"`, and `output_count: 4`.
- Release visibility defaults to `private`; `allow_remix` is a separate explicit boolean and never follows visibility implicitly.
- The final action is `Save release draft`; this slice adds no publish endpoint and must state that public visibility is only the saved intent.
- Unsaved Release fields and active Artwork work survive Finish tab switches and dialog close/reopen for the same Version.
- Switching Version clears stale artwork, release form, save result, and tracked resource context.
- Every AI artwork command is reviewed before execution, cancellable while active, and accepted only when its snapshot echoes the exact Version and plan.
- Generated images use the existing opaque same-origin asset-content URL; no Storage URL or provider field reaches the browser.

---

### Task 1: Lock Artwork Generation and Release Draft contracts with RED tests

**Files:**
- Create: `contract/tests/mori-artwork-generation.contract.test.ts`
- Create: `contract/tests/mori-release-draft.contract.test.ts`
- Create: `src/features/mori/studio-release.test.ts`
- Modify: `contract/tests/mori-media-access.contract.test.ts`
- Modify: `src/lib/mori-api-client.test.ts`
- Create: `contract/openapi/mori-artwork-generation.v1.json`
- Create: `contract/openapi/mori-release-draft.v1.json`
- Create: `src/features/mori/studio-release.ts`
- Modify: `contract/openapi/mori-media-access.v1.json`
- Modify: `src/lib/mori-api.ts`
- Modify: `src/lib/mori-api-validation.ts`
- Modify: `src/lib/mori-api-client.ts`

**Interfaces:**
- Produces: `ArtworkStyle`, `ArtworkPalette`, `ArtworkGenerationInput`, `ArtworkGenerationSnapshot`, `MoriArtworkCandidate`, `MoriArtworkGenerationEvent`, and create/get/events/cancel methods on `MoriApi`.
- Produces: `ReleaseVisibility`, `ReleaseArtwork`, `ReleaseDraftInput`, `MoriReleaseDraft`, and get/put methods on `MoriApi`.
- Produces: `StudioArtworkPlan`, `StudioReleaseDraft`, `StudioArtworkRunState`, `StudioReleaseSaveState`, `createInitialStudioReleaseDraft`, `buildStudioArtworkPlan`, `createArtworkGenerationRequest`, `createReleaseDraftRequest`, `artworkSnapshotMatchesPlan`, and `releaseDraftMatchesInput`.

- [x] **Step 1: Write failing OpenAPI tests** asserting four artwork styles, four palettes, fixed square/no-text/four-output constraints, Version-scoped idempotent creation, durable snapshot/SSE/cancel paths, image asset refs, release GET/PUT, optimistic `expected_revision`, independent visibility/remix fields, draft-only state, and provider/caller-neutral `snake_case` properties.
- [x] **Step 2: Write failing helper and client tests** asserting trimmed request serialization, invalid prompt/title/revision rejection, exact snapshot-plan matching, exact release-response matching, request URLs/headers/bodies, SSE `Last-Event-ID`, cancel behavior, strict parser rejection, and media `200` support for both `audio/*` and `image/*`.
- [x] **Step 3: Run RED** with `pnpm test -- contract/tests/mori-artwork-generation.contract.test.ts contract/tests/mori-release-draft.contract.test.ts contract/tests/mori-media-access.contract.test.ts src/features/mori/studio-release.test.ts src/lib/mori-api-client.test.ts` and confirm failures come from the missing contracts/types/functions.
- [x] **Step 4: Implement the minimum contracts and typed seams** with artwork endpoints `POST /versions/{version_ref}/artwork_generations`, `GET /artwork_generations/{ref}`, `GET /events`, `POST /cancel`; release endpoints `GET|PUT /versions/{version_ref}/release_draft`; and image support on the existing asset-content contract.
- [x] **Step 5: Run GREEN** with the same focused test command and confirm all tests pass.
- [x] **Step 6: Commit** with `git add contract src/features/mori/studio-release.ts src/features/mori/studio-release.test.ts src/lib && git commit -m "feat: model studio release kit contracts"`.

### Task 2: Build the Release view inside Finish with RED tests

**Files:**
- Create: `src/features/mori/components/studio-release-panel.test.tsx`
- Create: `src/features/mori/components/studio-release-panel.tsx`
- Create: `src/features/mori/components/studio-release-panel.module.css`
- Modify: `src/features/mori/components/studio-finish-dialog.test.tsx`
- Modify: `src/features/mori/components/studio-finish-dialog.tsx`
- Modify: `src/features/mori/components/studio-finish-dialog.module.css`

**Interfaces:**
- `StudioReleasePanel` consumes controlled `StudioReleaseDraft`, `StudioArtworkRunState`, and `StudioReleaseSaveState`, plus callbacks for draft changes, artwork generate/cancel/reset/select, and release save.
- `StudioFinishDialog` consumes controlled `view: "remaster" | "release"` and `onViewChange`, preserves the existing Remaster callbacks, and mounts `StudioReleasePanel` without cancelling either workflow when switching views.

- [x] **Step 1: Write failing component tests** for Remaster/Release tab semantics, retained controlled fields, private default, independent Link/Public and remix controls, required title, artwork brief/style/palette review, exact four-concept plan submission, running/cancel/failed/retry/success states, candidate selection, generated image asset URLs, explicit-content control, and `Save release draft` copy that never claims to publish.
- [x] **Step 2: Run RED** with `pnpm test -- src/features/mori/components/studio-release-panel.test.tsx src/features/mori/components/studio-finish-dialog.test.tsx` and confirm the missing Release UI causes the failure.
- [x] **Step 3: Implement the light Finish Center** using a quiet two-tab strip beneath the existing header, a desktop artwork/details split that stacks on mobile, warm dawn/violet/mint/monochrome palette previews, one square artwork stage, and a sticky footer whose sole emphasized action is `Save release draft`.
- [x] **Step 4: Preserve accessibility** with tab/tabpanel linkage, visible focus, labelled controls, `aria-live` status, image alt text, existing dialog focus trap/Escape/body-lock behavior, and reduced-motion support.
- [x] **Step 5: Run GREEN** with the focused component test command and confirm no console warnings.
- [x] **Step 6: Commit** with `git add src/features/mori/components && git commit -m "feat: add studio release finish view"`.

### Task 3: Connect Release state and resources to Studio with RED tests

**Files:**
- Modify: `src/features/mori/studio-page.test.tsx`
- Modify: `src/features/mori/studio-page.tsx`
- Modify: `src/features/mori/mori-workspace.module.css`

**Interfaces:**
- Consumes: `createArtworkGeneration`, `getArtworkGeneration`, `getArtworkGenerationEvents`, `cancelArtworkGeneration`, `getReleaseDraft`, and `putReleaseDraft` from `MoriApi`.
- Produces: Version-bound controlled release form state, tracked artwork lifecycle, strict snapshot acceptance, generated artwork selection, optimistic release save, stale-response rejection, and Finish activity feedback.

- [x] **Step 1: Write a failing happy-path integration test** that opens Finish → Release, edits metadata, reviews and starts the exact square/no-text/four-output artwork request, accepts a matching successful snapshot, selects a returned image, and sends the exact release draft with `expected_revision: null`.
- [x] **Step 2: Write failing resilience tests** for close/reopen preservation, artwork cancel/retry, wrong Version or changed plan snapshot rejection, release response mismatch rejection, and Version switch cleanup; assert Current Version and audio Take lanes remain unchanged.
- [x] **Step 3: Run RED** with `pnpm test -- src/features/mori/studio-page.test.tsx` and confirm failures describe the missing integration.
- [x] **Step 4: Implement page-owned state and lifecycle** with command epochs for stale creation responses, durable snapshot polling plus SSE replay, cancellation, exact context checks, optional release draft hydration, optimistic save revision, and clear offline/retry copy.
- [x] **Step 5: Run GREEN** with the Studio page tests, then run `pnpm test -- src/features/mori/components/studio-finish-dialog.test.tsx src/features/mori/components/studio-release-panel.test.tsx src/features/mori/studio-page.test.tsx`.
- [x] **Step 6: Commit** with `git add src/features/mori && git commit -m "feat: connect studio release workflow"`.

### Task 4: Document, visually inspect, and verify

**Files:**
- Modify: `ACCEPTANCE.md`
- Modify: `contract/README.md`
- Modify: `docs/MUSIC_CAPABILITIES.md`
- Modify: `docs/PRODUCT_SHAPE.md`
- Modify: `docs/superpowers/plans/2026-09-03-studio-release-kit.md`

- [ ] **Step 1: Document the product distinction** between Suno-style production continuity, Tad-style clear AI intent names, Mori artwork versus musical Cover/Restyle, separate remix permission, private-by-default visibility, and the deliberate absence of a publish command.
- [ ] **Step 2: Run the complete automated gate** with `git diff --check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- [ ] **Step 3: Inspect desktop at 1280×720** and verify Finish opens above the global Player, tabs do not shift the shell, the Release split has a clear reading order, every control is reachable, and no content is clipped.
- [ ] **Step 4: Inspect mobile at 390×844** and verify one-column stacking, horizontal-fit, sticky actions above the Player, keyboard focus order, scroll reachability, and no loss of Remaster/Release state when switching tabs.
- [ ] **Step 5: Mark this plan complete, update acceptance evidence with current test counts, restore generated `next-env.d.ts`, remove browser artifacts, stop local servers, and confirm `git status --short` contains only intended source/document changes.
- [ ] **Step 6: Commit** with `git add ACCEPTANCE.md contract/README.md docs && git commit -m "docs: record studio release workflow"`.
