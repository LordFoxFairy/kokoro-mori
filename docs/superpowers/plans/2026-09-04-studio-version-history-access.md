# Studio Version History Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Project Version history reachable at 1280px and mobile widths without narrowing the Studio canvas or moving Versions into global navigation.

**Architecture:** Extract the existing history rows into one focused component, retain the persistent complementary rail above 1360px, and reuse the same rows inside a portal-based right drawer below that breakpoint. `StudioPageContent` owns drawer visibility while the component owns focus, Escape, backdrop, navigation dismissal, and body-scroll lifecycle.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict mode, CSS Modules, Testing Library, Vitest.

## Global Constraints

- Modify only `kokoro-mori`; no BFF, root, sibling repository, or API contract changes.
- Keep Open, Playing, Selected, and Current states distinct.
- Preserve the existing Project/Candidate projection and current-version command behavior.
- Use Mori's light paper, violet, peach, thin-border visual language; do not copy Suno branding.
- Run TDD red-green for each behavior and finish with the complete repository gate.

---

### Task 1: Shared Version history surface

**Files:**
- Create: `src/features/mori/components/studio-version-history.tsx`
- Create: `src/features/mori/components/studio-version-history.module.css`
- Create: `src/features/mori/components/studio-version-history.test.tsx`
- Modify: `src/features/mori/mori-workspace.module.css`

**Interfaces:**
- Consumes: `Candidate[]`, `projectRef`, `openVersionRef`, and confirmed `currentVersionRef`.
- Produces: `StudioVersionHistoryRail` and `StudioVersionHistoryDrawer`.

- [ ] Write failing component tests proving the rail labels Current and Open independently and builds encoded Project Version links.
- [ ] Write failing drawer tests for dialog semantics, initial close-button focus, Tab/Shift+Tab trapping, Escape/backdrop close, focus restoration, body scroll lock, and navigation dismissal.
- [ ] Run `pnpm exec vitest run src/features/mori/components/studio-version-history.test.tsx`; confirm failure because the component does not exist.
- [ ] Implement one shared item renderer plus the persistent rail and portal drawer. Keep Version title, lifecycle label, Open label, duration, and artwork cue scannable.
- [ ] Move Version-specific row/header styling out of `mori-workspace.module.css` into the focused component stylesheet; leave only Studio-grid placement hooks in the workspace stylesheet.
- [ ] Re-run the focused test and `pnpm typecheck`; commit the component slice.

### Task 2: Studio integration and Current synchronization

**Files:**
- Modify: `src/features/mori/studio-page.tsx`
- Modify: `src/features/mori/studio-page.test.tsx`
- Modify: `src/features/mori/mori-workspace.module.css`

**Interfaces:**
- Consumes: `StudioVersionHistoryRail`, `StudioVersionHistoryDrawer`, existing `studioCandidates`, `activeProjectRef`, `activeCandidate.versionRef`, and `currentVersionRef`.
- Produces: responsive `Open version history` header action with `aria-expanded` and `aria-controls`.

- [ ] Add failing Studio tests proving the header action opens the drawer with hydrated live-project Versions and closes through its explicit close action.
- [ ] Add a failing test proving a successful `Use take` updates Current labels in both persistent history and the drawer while Open remains explicit.
- [ ] Run `pnpm exec vitest run src/features/mori/studio-page.test.tsx`; confirm the new assertions fail because the trigger/drawer is absent.
- [ ] Integrate drawer state, trigger semantics, shared rail, and close-on-Version-navigation without changing generation, playback, or current-version command flows.
- [ ] Add responsive trigger/grid CSS: persistent rail above 1360px, drawer trigger at or below 1360px, icon-only trigger under 700px.
- [ ] Re-run Studio/component tests, lint, and typecheck; commit the integration slice.

### Task 3: Browser inspection and documentation

**Files:**
- Modify: `docs/PRODUCT_SHAPE.md`
- Modify: `docs/MUSIC_CAPABILITIES.md`
- Modify: `ACCEPTANCE.md`
- Modify: `docs/superpowers/plans/2026-09-04-studio-version-history-access.md`

**Interfaces:**
- Consumes: completed responsive Version history implementation.
- Produces: verified product and acceptance record.

- [ ] Start `pnpm dev --hostname 127.0.0.1 --port 3004` and inspect Studio at 1440×900, 1280×720, and 390×844.
- [ ] Verify the wide persistent rail, medium/mobile drawer, Current/Open labels, focus return, fixed Player layering, and `documentElement.clientWidth === documentElement.scrollWidth` at narrow width.
- [ ] Update product/capability/acceptance docs with the responsive history rule and observed evidence.
- [ ] Run `git diff --check && pnpm lint && pnpm typecheck && pnpm test && pnpm build` and record exact test counts.
- [ ] Restore generated files, stop the server, check every plan item, commit docs, and confirm a clean worktree.
