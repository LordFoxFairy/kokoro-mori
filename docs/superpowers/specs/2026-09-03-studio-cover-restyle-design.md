# Studio Cover / Restyle Design

**Status:** Approved direction for implementation  
**Date:** 2026-09-03  
**Owner:** `kokoro-mori`

## 1. Product decision

Mori absorbs two useful relationships from the reference products without copying their page structure:

- Suno's useful idea is production continuity: transformations belong to the open song and create new versions instead of sending the user to a disconnected tool.
- Tad's useful idea is explicit AI intent: users should be able to choose **Restyle** or **Cover** before writing a direction and understand what each action preserves.
- Mori keeps one stable Studio entry, **Transform**. Restyle and Cover are contextual intents inside it, not new global navigation items.

The result remains a light, warm-gradient Mori surface. The Current Version is the implicit source, every request is reviewed before execution, and every result enters Take Lanes. Nothing replaces Current until the user explicitly chooses a take.

## 2. Intent model

### Restyle

Restyle changes arrangement, genre, texture, or performance character while retaining chosen musical anchors.

- Scope: selected section/range or whole song.
- User input: one editable direction.
- Controls: Melody, Lyrics, Voice, Tempo, Structure anchors and 1/2/4 alternatives.
- Source: the open Version; optional reference assets remain provider-neutral.
- Result: one to four Takes.

### Cover

Cover creates a new performance of the open Version. It means an **audio cover**, never release artwork.

- Scope: always whole song.
- Modes:
  - **Vocal cover:** preserves Melody, Lyrics, and Structure; may use one reusable Voice profile.
  - **Instrumental cover:** preserves Melody and Structure; has no Voice profile.
- User input: the target arrangement/performance direction.
- Source: the open Version; the user does not upload it again.
- Result: exactly two Takes.

Cover intentionally does not preserve `vocal_identity`: a cover re-performs the source rather than pretending to keep the same vocalist.

## 3. Studio flow

1. User selects **Transform** beside Add part, Replace section, and Extend.
2. A compact intent switch appears with Restyle selected by default and Cover as the second choice.
3. The surface explains the selected intent in one sentence before the prompt.
4. Restyle exposes existing scope, anchor, and alternative controls. Cover exposes Vocal/Instrumental and an optional Voice profile only for Vocal.
5. **Review change** creates a readable plan. The plan names Restyle or Cover, not the generic Transform transport operation.
6. User explicitly starts generation. Active, failed, cancelled, expired, and successful states reuse the existing Studio Generation lifecycle.
7. Successful candidates appear in Take Lanes. Current remains unchanged until **Use take**.

Changing intent, cover mode, Voice, scope, anchors, output count, prompt, or selection invalidates an unsubmitted reviewed plan. A running plan remains page-owned and visible after moving between Studio tools.

## 4. Provider-neutral contract

The existing top-level operation remains `operation: "transform"`. Transform becomes an explicit tagged union instead of an untyped generic branch.

### Restyle input

```json
{
  "operation": "transform",
  "intent": "restyle",
  "scope": { "type": "time_range", "start_ms": 42000, "end_ms": 96000 },
  "instruction": "Turn this passage into an intimate live-room arrangement.",
  "preserve": ["melody", "lyrics"],
  "reference_asset_refs": [],
  "output_count": 2
}
```

Invariants:

- `scope` is `time_range` or `whole_version`.
- `output_count` is 1–4.
- Existing instruction, preserve, and reference limits remain in force.

### Cover input

```json
{
  "operation": "transform",
  "intent": "cover",
  "scope": { "type": "whole_version" },
  "cover_mode": "vocal",
  "voice_ref": "voice_preview_mira",
  "instruction": "Re-perform this as a close, warm acoustic duet.",
  "preserve": ["melody", "lyrics", "structure"],
  "reference_asset_refs": [],
  "output_count": 2
}
```

Invariants:

- Scope is exactly `whole_version` and output count is exactly `2`.
- Vocal preserve set is exactly Melody, Lyrics, Structure; `voice_ref` is nullable.
- Instrumental preserve set is exactly Melody, Structure; `voice_ref` must be null.
- `reference_asset_refs` is empty because the source is already the path-bound Version.

Remaster remains a third typed Transform intent in Finish and is not shown in the inline Transform intent switch.

## 5. Durable snapshots and stale-result protection

Transform snapshots echo the complete reviewed context required to attach candidates safely:

- Restyle: `intent`, `scope`, `instruction`, `preserve`, `reference_asset_refs`, and `output_count`.
- Cover: the Restyle fields plus `cover_mode` and `voice_ref`.
- Remaster: the existing `source` and `variation_strength` contract remains unchanged.

The browser accepts a Transform snapshot only when generation ref, source Version, operation, intent, and all intent-specific fields exactly match the tracked plan. Arrays use ordered, de-duplicated values produced by the request builder. Partial intent metadata is invalid rather than silently degrading to a generic Transform.

Standard Studio snapshots remain for Add part, Replace section, Extend, and whole-Version layer additions. They no longer represent Transform.

## 6. UI composition

- Keep the current four-operation strip; do not increase global or Studio navigation depth.
- Render Restyle/Cover as two quiet, full-width intent cards directly under the operation strip.
- Use a subtle split waveform/performance motif as the only new signature visual move.
- Keep the prompt and Review action visually dominant; advanced controls remain progressive disclosure.
- For Cover, show a compact source note: **Uses the open Version · no re-upload** and a clarification: **Audio cover, not release artwork**.
- Plan facts follow a stable reading order: Intent, Scope, Mode/Voice when applicable, Keep, Result, Destination.
- Existing warm violet/peach surfaces, restrained borders, and light default theme remain authoritative.

## 7. Accessibility and responsive behavior

- Intent and mode controls use labelled groups and `aria-pressed` states.
- Every input has a programmatic label; selected Voice details are available as text.
- Busy state disables plan-changing controls while preserving cancel.
- Status and plan changes remain announced through existing live regions.
- Focus is visibly styled and returns to the prompt on Edit request.
- At 390px, intent cards, prompt action, plan facts, and footer actions stack to one column without horizontal scrolling.
- Motion remains subtle and respects `prefers-reduced-motion`.

## 8. Error and recovery behavior

- Invalid local combinations fail before reaching the API with stable error codes.
- Snapshot mismatch presents intent-specific copy and attaches no candidates.
- Network failure retains the reviewed plan and offers Retry with a fresh command identity.
- Cancel keeps the plan readable and retryable.
- No provider error body, secret, or internal identifier is exposed in UI copy.

## 9. Testing and verification

- OpenAPI tests lock tagged unions, fixed Cover invariants, strict snapshots, `snake_case`, and provider neutrality.
- Builder/parser tests lock trimming, exact field serialization, invalid combinations, and partial snapshot rejection.
- Component tests lock intent discovery, progressive controls, review invalidation, plan language, and accessible state.
- Studio integration tests lock exact requests, exact snapshot matching, Take Lane destination, Current preservation, cancel/retry, and Studio-tool continuity.
- Final gate: `git diff --check && pnpm lint && pnpm typecheck && pnpm test && pnpm build` plus desktop 1280×720 and mobile 390×844 visual inspection.

## 10. Non-goals

- No global Cover or Restyle page.
- No BFF, provider adapter, database, billing, publishing, or shared-package change.
- No voice cloning or voice enrollment flow.
- No release artwork changes; musical Cover and artwork remain distinct concepts.
- No automatic replacement of Current Version.
