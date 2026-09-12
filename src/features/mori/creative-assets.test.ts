import { describe, expect, it } from "vitest"
import { resolvePreviewCreativeSource } from "./creative-assets"

describe("Mori creative assets", () => {
  it("resolves only known source kind and ref pairs", () => {
    expect(resolvePreviewCreativeSource("voice", "voice_preview_mira")).toEqual({ kind: "voice", ref: "voice_preview_mira" })
    expect(resolvePreviewCreativeSource("inspiration", "style_preview_open_road")).toEqual({ kind: "inspiration", ref: "style_preview_open_road" })
    expect(resolvePreviewCreativeSource("audio", "source_preview_city_lights")).toEqual({ kind: "audio", ref: "source_preview_city_lights" })
    expect(resolvePreviewCreativeSource("voice", "style_preview_open_road")).toBeUndefined()
    expect(resolvePreviewCreativeSource("provider", "voice_preview_mira")).toBeUndefined()
  })
})
