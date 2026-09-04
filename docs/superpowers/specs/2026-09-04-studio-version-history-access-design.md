# Studio Version History Access Design

## Problem

Mori already renders Project history as a right rail, but CSS removes that rail at every viewport up to 1360px. At the
1280px desktop size used for normal review—and on mobile—the user has no way to reopen an older Version. That breaks the
Suno-like loop of generate, compare, commit, revisit, and continue editing.

## Decision

Keep the current three-column Studio at wide widths and add a responsive Version history drawer when the persistent rail
is hidden. This preserves canvas space without turning history into a global navigation item or a centered modal.

Rejected alternatives:

- Always squeeze the right rail into 1280px: makes the timeline and AI controls materially narrower.
- Move Versions into the global Mori rail: loses Project context and conflicts with the existing information architecture.
- Use a generic centered dialog: hides the spatial relationship between Studio and its Project history.

## Interaction

- A `Versions` action appears in the Studio header at widths where the persistent history rail is hidden.
- Activating it opens a right-side drawer titled `Version history` with the same ordered Version list as the wide rail.
- Current and Open remain independent: `Current` comes from the confirmed Project pointer; `Open` controls
  `aria-current="page"` and the highlighted row.
- The trigger reports `aria-expanded` and references the drawer with `aria-controls`.
- The drawer receives focus, traps Tab/Shift+Tab, closes on Escape, backdrop, close button, or Version navigation, and
  restores focus to the launcher when dismissed without navigation.
- Opening the drawer locks background scrolling. The temporary overlay sits above Studio and the Global Player so the
  focus model matches its modal semantics.

## Visual Direction

Use Mori's light paper surface, muted violet selection, warm peach accent, thin borders, and restrained shadow. The
drawer is a structural workspace surface—not a floating glass card. Rows remain compact enough to scan title, state,
duration, and artwork cue without competing with the Studio canvas.

## Components

- `StudioVersionHistoryList`: one semantic list renderer shared by persistent rail and drawer.
- `StudioVersionHistoryDrawer`: portal-based responsive overlay and focus lifecycle.
- `StudioPageContent`: owns only drawer open state and supplies Project, Version, and Current context.

The existing Candidate projection remains the input for this slice because every rendered item already has a stable
`version_ref`. A dedicated paginated Version projection is a separate contract slice; this change does not alter BFF or
owner boundaries.

## Responsive Rules

- Above 1360px: persistent right rail visible; header trigger hidden.
- 701–1360px: two-column Studio plus right-side drawer on demand.
- Up to 700px: single-column Studio plus a drawer capped to the viewport width; header action becomes icon-only through
  the existing mobile header rule.

## Verification

- Component tests cover shared Current/Open labels, open/close paths, focus entry/trap/restore, body scroll lock, and
  navigation dismissal.
- Studio integration tests prove the trigger receives hydrated Project history and remains correct after `Use take`.
- Browser inspection covers 1440px persistent rail, 1280px drawer, and 390px drawer with no horizontal overflow or
  collision with the Global Player.
- Full gate remains `git diff --check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

## Scope

Only `kokoro-mori` changes. No BFF, root, sibling repository, API contract, generation behavior, or provider field is
added in this slice.
