# Mix-aware Export Implementation Plan

> **Goal:** Replace the one-click MP3 shortcut with an explicit, accessible export flow that renders either the current Version or its latest saved Mix Revision without exposing unfinished range or multitrack controls.

## Boundary decisions

- `kokoro-mori` owns this UI and browser contract slice; BFF, Root, and sibling repositories stay unchanged.
- Export remains an asynchronous, idempotent render command under one Version.
- The request explicitly names `source`, `scope`, and `format`; this slice supports `version | mix_revision`, `full_song`, and `mp3 | wav`.
- A successful Mix Revision save becomes the preferred export source for that Version. Switching Version clears that contextual source.
- The durable export snapshot echoes source and scope so polling cannot attach a result from another context.
- Selected-range and multitrack exports remain roadmap items until real timeline selection and track-delivery contracts exist; the UI does not show dead options.

## Task 1 — Establish RED tests

**Files**

- Create: `contract/tests/mori-export.contract.test.ts`
- Create: `src/features/mori/components/studio-export-dialog.test.tsx`
- Modify: `src/lib/mori-api-client.test.ts`
- Modify: `src/features/mori/studio-page.test.tsx`

Assert the idempotent Version-scoped `202` command, explicit provider-neutral request body, runtime snapshot validation, dialog focus/Escape behavior, Version and Mix Revision source choices, MP3/WAV formats, retry with preserved selection, and completed download behavior. Run the focused suite and observe RED before production changes.

## Task 2 — Add the browser contract and client

**Files**

- Create: `contract/openapi/mori-export.v1.json`
- Modify: `contract/README.md`
- Modify: `src/lib/mori-api.ts`
- Modify: `src/lib/mori-api-validation.ts`
- Modify: `src/lib/mori-api-client.ts`

Define `ExportInput`, source and full-song scope unions, receipt, and durable snapshot. Add a request builder, exact `snake_case` POST body, idempotency header, and strict parsing of source/scope/status/download invariants.

## Task 3 — Build the export workflow

**Files**

- Create: `src/features/mori/components/studio-export-dialog.tsx`
- Create: `src/features/mori/components/studio-export-dialog.module.css`
- Modify: `src/features/mori/studio-page.tsx`
- Modify: `src/features/mori/generation-controller.ts`

Open a focused light-gradient modal from Studio. Let the user choose a real source and format, explain full-song rendering, start the async job, show queued/processing/failure states in context, and expose the completed download without replacing the main Studio action. Capture the latest successful Mix Revision and reject mismatched export snapshots.

## Task 4 — Document and verify

**Files**

- Modify: `ACCEPTANCE.md`
- Modify: `docs/MUSIC_CAPABILITIES.md`
- Modify: `docs/PRODUCT_SHAPE.md`

Run focused tests, `git diff --check`, lint, typecheck, all tests, build, then 1280x720 visual QA for Version source, Mix Revision default, WAV, queued, success, and failure/retry. Restore generated files, remove browser artifacts, stop local servers, and commit the cohesive implementation.
