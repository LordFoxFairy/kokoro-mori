import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("Mori settings layout contract", () => {
  it("uses a full-width mobile settings navigation with touch-sized controls", () => {
    const css = readFileSync(resolve(process.cwd(), "src/features/mori/mori-workspace.module.css"), "utf8")
    const mobileSettings = css.slice(css.indexOf("  .settingsPage {", css.indexOf("@media (max-width: 700px)")))

    expect(mobileSettings).toMatch(/\.settingsWindow\s*\{[^}]*grid-template-columns:\s*1fr;/su)
    expect(mobileSettings).toMatch(/\.settingsNavSection\s*\{[^}]*display:\s*flex;/su)
    expect(mobileSettings).toMatch(/\.settingsSearch input\s*\{[^}]*min-height:\s*44px;/su)
    expect(mobileSettings).toMatch(/\.settingsNavItem\s*\{[^}]*min-height:\s*44px;/su)
    expect(mobileSettings).toMatch(/\.settingsClose\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/su)
  })
})
