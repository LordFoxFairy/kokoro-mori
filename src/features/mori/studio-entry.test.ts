import { describe, expect, it } from "vitest"
import { parseStudioEntry } from "./studio-entry"

describe("Mori Studio entry", () => {
  it("accepts only known project continuation surfaces and intents", () => {
    expect(parseStudioEntry({ surface: "lyrics" })).toEqual({ surface: "lyrics", intent: null, generationRef: null })
    expect(parseStudioEntry({ surface: "stems" })).toEqual({ surface: "stems", intent: null, generationRef: null })
    expect(parseStudioEntry({ surface: "finish" })).toEqual({ surface: "finish", intent: null, generationRef: null })
    expect(parseStudioEntry({ surface: "arrangement", intent: "transform" })).toEqual({ surface: "arrangement", intent: "transform", generationRef: null })
    expect(parseStudioEntry({ surface: "arrangement", intent: "cover" })).toEqual({ surface: "arrangement", intent: "cover", generationRef: null })
  })

  it("falls back to the default workspace for unknown or conflicting values", () => {
    expect(parseStudioEntry({ surface: "tools", intent: "transform" })).toEqual({ surface: "arrangement", intent: null, generationRef: null })
    expect(parseStudioEntry({ surface: "lyrics", intent: "transform" })).toEqual({ surface: "lyrics", intent: null, generationRef: null })
    expect(parseStudioEntry({ surface: "stems", intent: "cover" })).toEqual({ surface: "stems", intent: null, generationRef: null })
    expect(parseStudioEntry({ surface: ["finish", "lyrics"] })).toEqual({ surface: "finish", intent: null, generationRef: null })
  })

  it("keeps one bounded generation reference for an exact queue continuation", () => {
    expect(parseStudioEntry({ generation_ref: "  generation_live_1  " })).toEqual({
      surface: "arrangement",
      intent: null,
      generationRef: "generation_live_1",
    })
    expect(parseStudioEntry({ generation_ref: "" }).generationRef).toBeNull()
    expect(parseStudioEntry({ generation_ref: "g".repeat(201) }).generationRef).toBeNull()
  })
})
