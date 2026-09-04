import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("Mori player layout contract", () => {
  it("reserves the shared player height below the compact generation drawer", () => {
    const css = readFileSync(resolve(process.cwd(), "src/features/mori/mori-workspace.module.css"), "utf8")
    const drawerRules = [...css.matchAll(/\.drawerLayer \.inspector\s*\{(?<body>[^}]*)\}/gu)]

    expect(drawerRules).toHaveLength(2)
    for (const rule of drawerRules) {
      expect(rule.groups?.body).toMatch(/bottom:\s*var\(--mori-player-height\);/u)
    }
  })
})
