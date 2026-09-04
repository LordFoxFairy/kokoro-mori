import { describe, expect, it } from "vitest"
import { parseStudioEntry } from "./studio-entry"

describe("Mori Studio entry", () => {
  it("accepts only known project continuation surfaces and intents", () => {
    expect(parseStudioEntry({ surface: "lyrics" })).toEqual({ surface: "lyrics", intent: null })
    expect(parseStudioEntry({ surface: "stems" })).toEqual({ surface: "stems", intent: null })
    expect(parseStudioEntry({ surface: "finish" })).toEqual({ surface: "finish", intent: null })
    expect(parseStudioEntry({ surface: "arrangement", intent: "transform" })).toEqual({ surface: "arrangement", intent: "transform" })
  })

  it("falls back to the default workspace for unknown or conflicting values", () => {
    expect(parseStudioEntry({ surface: "tools", intent: "transform" })).toEqual({ surface: "arrangement", intent: null })
    expect(parseStudioEntry({ surface: "lyrics", intent: "transform" })).toEqual({ surface: "lyrics", intent: null })
    expect(parseStudioEntry({ surface: ["finish", "lyrics"] })).toEqual({ surface: "finish", intent: null })
  })
})
