import { describe, expect, it } from "vitest"
import { MORI_TOKENS } from "./mori-tokens"

describe("Mori visual tokens", () => {
  it("uses a light-first surface and cool-warm gradient palette", () => {
    expect(MORI_TOKENS.background).toBe("#FBFAF8")
    expect(MORI_TOKENS.lavender).toBe("#EDE9FE")
    expect(MORI_TOKENS.peach).toBe("#FDE7DA")
    expect(MORI_TOKENS.mint).toBe("#E7F6EF")
  })
})
