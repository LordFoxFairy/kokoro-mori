import { describe, expect, it } from "vitest"
import { previewCandidates, previewLibrary, previewProject } from "./preview-data"

describe("Mori preview model", () => {
  it("keeps a project current version linked to a candidate-derived version", () => {
    expect(previewProject.currentVersionRef).toBe(previewCandidates[0]?.versionRef)
  })

  it("exposes library items as project or version records", () => {
    expect(previewLibrary.every((item) => item.kind === "project" || item.kind === "version")).toBe(true)
  })
})
