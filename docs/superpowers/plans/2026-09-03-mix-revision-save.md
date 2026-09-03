# Mix Revision Save Implementation Plan

> **Goal:** Turn audition-only Stem mixer choices into a durable, non-destructive Mix Revision while keeping Solo as a monitoring control and Current Version unchanged.

## Boundary decisions

- `kokoro-mori` owns this browser contract and UI seam; no BFF or sibling repository changes.
- Save Mix is a fast metadata command, not an AI render job: `POST` returns `201` with the immutable saved revision.
- The path Version and `source_stem_separation_ref` bind the settings to returned, version-owned stems.
- Persist every track as `stem_ref + gain + muted`; `solo` remains preview-only and is never serialized.
- A second changed save creates a new immutable revision. An unchanged saved state disables duplicate saving.
- The owner must verify the track set against the separation snapshot. The browser never submits identity or provider data.

## Task 1 — Establish RED tests

**Files**

- Create: `contract/tests/mori-mix-revision.contract.test.ts`
- Modify: `src/lib/mori-api-client.test.ts`
- Modify: `src/features/mori/components/studio-stem-mixer.test.tsx`
- Modify: `src/features/mori/studio-page.test.tsx`

Assert an idempotent version-scoped `201` command, exact `snake_case` body, immutable `GET` resource, runtime rejection of duplicate/invalid tracks, Save Mix UI states, preserved settings on failure, no serialized Solo, and successful Studio wiring.

Run the focused suite and observe RED before production changes.

## Task 2 — Add the browser contract and client

**Files**

- Create: `contract/openapi/mori-mix-revision.v1.json`
- Modify: `contract/README.md`
- Modify: `src/lib/mori-api.ts`
- Modify: `src/lib/mori-api-validation.ts`
- Modify: `src/lib/mori-api-client.ts`

Define `MixRevisionInput`, `MixTrack`, and immutable `MixRevision`; add `createMixRevision` and `getMixRevision`; normalize names, unique tracks, two-decimal gains, and idempotency headers; parse all external responses from `unknown`.

## Task 3 — Complete Save Mix in Studio

**Files**

- Modify: `src/features/mori/components/studio-stem-mixer.tsx`
- Modify: `src/features/mori/components/studio-stem-mixer.module.css`
- Modify: `src/features/mori/components/studio-stems-editor.tsx`
- Modify: `src/features/mori/studio-page.tsx`

Carry the successful separation ref into result state. Add a compact Mix name + Save control below the tracks, saved/dirty/failure feedback, and exact request mapping. Validate returned Version and separation context before declaring success. Keep audition and save state local to this successful separation surface.

## Task 4 — Document and verify

**Files**

- Modify: `docs/MUSIC_CAPABILITIES.md`
- Modify: `docs/PRODUCT_SHAPE.md`

Document immutable Mix Revision semantics and the future render/export relation. Run focused tests, full quality gates, and 1280x720 visual QA for default, dirty, saved, and failed states. Restore generated files, remove browser artifacts, stop local servers, and commit.
