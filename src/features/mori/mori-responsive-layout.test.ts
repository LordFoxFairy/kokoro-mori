import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

function mediaBlock(css: string, mediaQuery: string): string {
  const start = css.indexOf(mediaQuery)
  const end = css.indexOf("\n@media", start + mediaQuery.length)
  return css.slice(start, end === -1 ? undefined : end)
}

describe("Mori responsive layout contract", () => {
  it("keeps the compact rail toggle in the rail flow instead of covering the brand mark", () => {
    const css = readFileSync(resolve(process.cwd(), "src/features/mori/mori-workspace.module.css"), "utf8")

    expect(css).toMatch(/\.railCollapsed \.brandRow\s*\{[^}]*flex-direction:\s*column;/su)
    expect(css).toMatch(/\.railCollapsed \.railToggle\s*\{[^}]*position:\s*static;/su)
  })

  it("keeps the tablet Studio workspace single-column and tool navigation horizontal", () => {
    const css = readFileSync(resolve(process.cwd(), "src/features/mori/mori-workspace.module.css"), "utf8")
    const tablet = mediaBlock(css, "@media (min-width: 701px) and (max-width: 900px)")

    expect(tablet).toMatch(/\.appShell\[data-viewport-ready="false"\]\s*\{[^}]*grid-template-columns:\s*64px/su)
    expect(tablet).toMatch(/\.appShell\[data-viewport-ready="false"\] \.brandName,[^}]*display:\s*none;/su)
    expect(tablet).toMatch(/\.studioPage \.studioLayout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/su)
    expect(tablet).toMatch(/\.studioPage \.studioToolList\s*\{[^}]*display:\s*flex;/su)
    expect(tablet).toMatch(/\.studioPage \.studioToolList button\s*\{[^}]*flex:\s*0 0 auto;/su)
  })

  it("wraps narrow tablet Studio actions before they can clip the viewport", () => {
    const css = readFileSync(resolve(process.cwd(), "src/features/mori/mori-workspace.module.css"), "utf8")
    const narrowTablet = mediaBlock(css, "@media (min-width: 701px) and (max-width: 820px)")

    expect(narrowTablet).toMatch(/\.studioPage \.studioHeader\s*\{[^}]*flex-wrap:\s*wrap;/su)
    expect(narrowTablet).toMatch(/\.studioPage \.studioHeaderLeft\s*\{[^}]*flex:\s*1 1 100%;/su)
    expect(narrowTablet).toMatch(/\.studioPage \.studioHeaderActions\s*\{[^}]*flex-wrap:\s*wrap;/su)
  })

  it("gives the tablet Studio AI operations two readable columns", () => {
    const css = readFileSync(resolve(process.cwd(), "src/features/mori/components/studio-ai-composer.module.css"), "utf8")
    const tablet = mediaBlock(css, "@media (min-width: 701px) and (max-width: 900px)")

    expect(tablet).toMatch(/\.studioAiOperations\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/su)
    expect(tablet).toMatch(/\.studioAiOperation\s*\{[^}]*white-space:\s*normal;/su)
  })

  it("stacks the mobile timeline header so transport actions stay inside the card", () => {
    const css = readFileSync(resolve(process.cwd(), "src/features/mori/components/studio-timeline.module.css"), "utf8")
    const mobile = mediaBlock(css, "@media (max-width: 700px)")

    expect(mobile).toMatch(/\.header\s*\{[^}]*flex-direction:\s*column;/su)
    expect(mobile).toMatch(/\.headerSide\s*\{[^}]*display:\s*grid;[^}]*width:\s*100%;/su)
    expect(mobile).toMatch(/\.playbackContext\s*\{[^}]*min-width:\s*0;/su)
    expect(mobile).toMatch(/\.playbackContext\s*\{[^}]*justify-items:\s*start;/su)
    expect(mobile).toMatch(/\.playbackActions\s*\{[^}]*justify-content:\s*flex-start;/su)
  })
})
