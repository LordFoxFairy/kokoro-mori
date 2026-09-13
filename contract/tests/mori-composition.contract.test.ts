import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const contract = JSON.parse(readFileSync(resolve(process.cwd(), "contract/openapi/mori-composition.v1.json"), "utf8")) as { paths: Record<string, unknown>; components: { schemas: Record<string, unknown> } }

describe("Mori composition contract", () => {
  it("keeps the version-scoped revision endpoint and all deterministic commands", () => {
    expect(contract.paths["/api/v1/mori/versions/{version_ref}/composition"]).toBeDefined()
    expect(contract.components.schemas).toEqual(expect.objectContaining({ MoveClip: expect.any(Object), TrimClip: expect.any(Object), SplitClip: expect.any(Object), CropClip: expect.any(Object), InsertClip: expect.any(Object), SetFades: expect.any(Object), SetTrackMix: expect.any(Object), RemoveClip: expect.any(Object) }))
    for (const schemaName of ["MoveClip", "TrimClip", "SplitClip", "CropClip", "InsertClip", "SetFades", "SetTrackMix", "RemoveClip"]) {
      const schema = contract.components.schemas[schemaName] as { required?: string[] }
      expect(schema.required).toContain("track_ref")
    }
    expect((contract.components.schemas.SetTrackMix as { required?: string[] }).required).toEqual(expect.arrayContaining(["gain", "pan", "muted"]))
    expect((contract.components.schemas.CompositionCommand as { oneOf?: { $ref?: string }[] }).oneOf).toEqual(expect.arrayContaining([{ $ref: "#/components/schemas/SetTrackMix" }]))
    expect(contract.components.schemas.CompositionTrack).toEqual(expect.objectContaining({ required: expect.arrayContaining(["track_ref", "kind", "name", "clips"]) }))
    expect(contract.components.schemas.ApiCompositionRevision).toEqual(expect.objectContaining({ required: expect.arrayContaining(["data", "meta"]) }))
  })

  it("makes cross-track moves explicit while preserving in-track moves", () => {
    const moveClip = contract.components.schemas.MoveClip as { required?: string[]; properties?: Record<string, unknown> }
    expect(moveClip.required).not.toContain("target_track_ref")
    expect(moveClip.properties?.target_track_ref).toEqual(expect.objectContaining({ type: "string", minLength: 1 }))
  })
})
