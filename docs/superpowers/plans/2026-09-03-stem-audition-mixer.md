# Stem Audition Mixer Implementation Plan

> **Goal:** Turn successful Stem Separation results into a real, synchronized audition surface with per-track mixing and downloads, without changing the current Version.

## Product decisions

- Follow Suno Studio's track-first model: one shared transport, aligned tracks, direct Mute / Solo / Level controls, and no second global tool page.
- Follow Tad's short output workflow: a successful separation immediately exposes usable outputs and a clear download action.
- Keep Mori's stronger review boundary: only API-returned, version-bound stem assets are playable; local mix choices remain non-destructive and do not imply a saved Mix Revision.
- Starting a stem audition pauses the global song player; starting global playback suspends the stem audition so two transports never compete.

## Architecture and ownership

- **Owner:** `kokoro-mori` owns the browser interaction, same-origin media projection contract, and web proxy behavior in this slice.
- **Target directories:** `src/features/mori`, `src/lib`, `src/app/api/v1/mori`, `contract`, and `docs` inside this repository only.
- **Dependency direction:** UI -> playback port/controller + media URL builder; browser media access -> same-origin `/api/v1/mori/assets/{asset_ref}/content` -> existing BFF proxy. No provider URLs or Storage SDK types enter the UI.
- **Deletion:** remove the staged/fake mix note and arbitrary waveform progress from successful stem results.
- **Contract change:** add a Mori media-access OpenAPI contract for authenticated inline/range playback and attachment download; keep Stem Separation snapshots unchanged because `audio_asset_ref` is already the stable fact.
- **Behavior preserved:** separation setup/review/SSE/cancel/retry, Add Vocals/Add Instrumental, returned-assets-only rendering, global player, and all Version immutability rules.

## Task 1 — Lock media access and mixer behavior with failing tests

**Files**

- Create: `src/lib/mori-media.test.ts`
- Create: `src/features/mori/components/studio-stem-mixer.test.tsx`
- Create: `src/app/api/v1/mori/[...path]/route.test.ts`
- Create: `contract/tests/mori-media-access.contract.test.ts`

**Assertions**

- Asset refs become URL-encoded, same-origin inline or attachment URLs; empty refs are rejected.
- The mixer loads only returned assets, owns one shared Play/Pause + seek transport, applies Mute/Solo/Level immediately, exposes one download per track, reports playback failure honestly, and disposes its controller.
- The Next proxy forwards `Range` and `If-Range` and preserves `206`, `Content-Range`, `Accept-Ranges`, and the audio content type.
- The OpenAPI path declares inline/attachment disposition, byte ranges, `200`/`206`, authorization failures, and binary audio without caller identity or provider fields.

Run the focused suite and observe RED before production code.

## Task 2 — Implement the real browser playback seam

**Files**

- Create: `src/lib/mori-media.ts`
- Create: `src/features/mori/stem-playback.ts`
- Modify: `src/app/api/v1/mori/[...path]/route.ts`
- Create: `contract/openapi/mori-media-access.v1.json`
- Modify: `contract/README.md`

Implement an injected `StemPlaybackController` port and an HTMLMediaElement adapter. Build one element per returned stem, align every track to the same seek position before play, use the first track as the clock, apply effective gain after Mute/Solo, and stop all tracks on any playback error. Never synthesize audio or substitute preview assets.

## Task 3 — Replace staged result rows with a coherent mixer

**Files**

- Create: `src/features/mori/components/studio-stem-mixer.tsx`
- Create: `src/features/mori/components/studio-stem-mixer.module.css`
- Modify: `src/features/mori/components/studio-stems-editor.tsx`
- Modify: `src/features/mori/components/studio-stems-editor.module.css`
- Modify: `src/features/mori/studio-page.tsx`
- Modify: `src/features/mori/studio-page.test.tsx`

Render a compact transport above aligned track rows. Each row shows identity, waveform progress, duration, level, Mute, Solo, and Download. Pause the global player before stem playback and pause the mixer when global playback starts. Preserve responsive, keyboard, focus, and light-gradient behavior.

## Task 4 — Document, visually verify, and close the slice

**Files**

- Modify: `docs/MUSIC_CAPABILITIES.md`
- Modify: `docs/PRODUCT_SHAPE.md`

Document the same-origin asset boundary, synchronized audition behavior, current local-only mix state, and the next explicit `Mix Revision` save contract. Run focused tests, then:

```bash
git diff --check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run the app at 1280x720 and inspect successful Stem results, mixer controls, failure feedback, overflow, focus, and browser logs. Restore `next-env.d.ts`, remove `.playwright-cli` and `output/playwright`, stop the server, and commit the cohesive implementation.
