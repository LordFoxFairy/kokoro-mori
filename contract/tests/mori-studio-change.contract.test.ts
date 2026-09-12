import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const contractPath = resolve(process.cwd(), "contract/openapi/mori-studio-change.v1.json")

describe("Mori Studio change OpenAPI contract", () => {
  it("publishes a version-bound idempotent generation command", () => {
    const document = readContract()
    expect(document.openapi).toBe("3.1.0")

    const paths = recordValue(document.paths, "paths")
    const path = recordValue(paths["/api/v1/mori/versions/{version_ref}/generations"], "Studio generation path")
    const post = recordValue(path.post, "Studio generation POST")
    expect(post.operationId).toBe("createStudioChange")

    const parameters = arrayValue(post.parameters, "parameters").map((value) => recordValue(value, "parameter"))
    const idempotencyHeader = parameters.find((parameter) => parameter.name === "Idempotency-Key")
    expect(idempotencyHeader).toMatchObject({ in: "header", required: true })

    const responses = recordValue(post.responses, "responses")
    expect(responses["202"]).toBeDefined()
    expect(responses["400"]).toBeDefined()
    expect(responses["409"]).toBeDefined()
  })

  it("covers Create, replay, and cancel on the shared Generation lifecycle", () => {
    const document = readContract()
    const paths = recordValue(document.paths, "paths")

    const createPath = recordValue(paths["/api/v1/mori/projects/{project_ref}/generations"], "Create generation path")
    const create = recordValue(createPath.post, "Create generation POST")
    expect(create.operationId).toBe("createGeneration")
    const createParameters = arrayValue(create.parameters, "Create generation parameters").map((value) => recordValue(value, "Create generation parameter"))
    expect(createParameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "project_ref", in: "path", required: true }),
      expect.objectContaining({ name: "Idempotency-Key", in: "header", required: true }),
    ]))
    const createBody = recordValue(create.requestBody, "Create generation body")
    const createContent = recordValue(createBody.content, "Create generation content")
    expect(recordValue(recordValue(createContent["application/json"], "Create generation JSON").schema, "Create generation schema").$ref).toBe("#/components/schemas/GenerationCreateInput")
    const schemas = contractSchemas(document)
    const input = recordValue(schemas.GenerationCreateInput, "GenerationCreateInput")
    expect(arrayValue(input.required, "Create generation required fields")).toContain("output_count")
    expect(recordValue(recordValue(input.properties, "Create generation properties").output_count, "Create generation output count")).toMatchObject({ type: "integer", const: 2 })

    const eventsPath = recordValue(paths["/api/v1/mori/generations/{generation_ref}/events"], "Generation events path")
    const events = recordValue(eventsPath.get, "Generation events GET")
    expect(events.operationId).toBe("getGenerationEvents")
    const eventParameters = arrayValue(events.parameters, "Generation event parameters").map((value) => recordValue(value, "Generation event parameter"))
    expect(eventParameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Last-Event-ID", in: "header", required: false }),
    ]))
    const eventResponse = recordValue(recordValue(events.responses, "Generation event responses")["200"], "Generation event response")
    const eventContent = recordValue(eventResponse.content, "Generation event content")
    expect(eventContent["text/event-stream"]).toBeDefined()

    const cancelPath = recordValue(paths["/api/v1/mori/generations/{generation_ref}/cancel"], "Generation cancel path")
    const cancel = recordValue(cancelPath.post, "Generation cancel POST")
    expect(cancel.operationId).toBe("cancelGeneration")
    const cancelParameters = arrayValue(cancel.parameters, "Generation cancel parameters").map((value) => recordValue(value, "Generation cancel parameter"))
    expect(cancelParameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Idempotency-Key", in: "header", required: true }),
    ]))
    const cancelResponse = recordValue(recordValue(cancel.responses, "Generation cancel responses")["202"], "Generation cancel response")
    const cancelContent = recordValue(cancelResponse.content, "Generation cancel content")
    expect(recordValue(recordValue(cancelContent["application/json"], "Generation cancel JSON").schema, "Generation cancel schema").$ref).toBe("#/components/schemas/ApiGenerationCancelReceipt")
  })

  it("publishes an opaque-cursor candidate projection for Project playback", () => {
    const document = readContract()
    const paths = recordValue(document.paths, "paths")
    const path = recordValue(paths["/api/v1/mori/projects/{project_ref}/candidates"], "Candidate list path")
    const get = recordValue(path.get, "Candidate list GET")
    expect(get.operationId).toBe("listCandidates")
    const parameters = arrayValue(get.parameters, "Candidate list parameters").map((value) => recordValue(value, "Candidate list parameter"))
    expect(parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "project_ref", in: "path", required: true }),
      expect.objectContaining({ name: "cursor", in: "query", required: false }),
      expect.objectContaining({ name: "limit", in: "query", required: false }),
      expect.objectContaining({ name: "generation_ref", in: "query", required: false }),
    ]))
    const response = recordValue(recordValue(get.responses, "Candidate list responses")["200"], "Candidate list response")
    const content = recordValue(response.content, "Candidate list content")
    expect(recordValue(recordValue(content["application/json"], "Candidate list JSON").schema, "Candidate list schema").$ref).toBe("#/components/schemas/ApiCandidatePage")
    const schemas = contractSchemas(document)
    const candidatePage = recordValue(schemas.CandidatePage, "CandidatePage")
    const properties = recordValue(candidatePage.properties, "CandidatePage properties")
    expect(recordValue(properties.next_cursor, "Candidate next cursor").oneOf).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "null" }),
    ]))
  })

  it("locks the four UI operations to explicit scope schemas", () => {
    const schemas = contractSchemas(readContract())
    const input = recordValue(schemas.StudioChangeGenerationInput, "StudioChangeGenerationInput")
    const variantNames = arrayValue(input.oneOf, "Studio change variants").map((value) => {
      const ref = stringValue(recordValue(value, "variant").$ref, "variant ref")
      return ref.split("/").at(-1) ?? ""
    })

    expect(variantNames).toEqual([
      "AddPartGenerationInput",
      "ReplaceSectionGenerationInput",
      "ExtendGenerationInput",
      "TransformGenerationInput",
    ])

    const operations = variantNames.map((name) => {
      const schemaName = name === "AddPartGenerationInput"
        ? "InsertPartGenerationInput"
        : name === "TransformGenerationInput"
          ? "RestyleGenerationInput"
          : name
      const schema = recordValue(schemas[schemaName], schemaName)
      const properties = recordValue(schema.properties, `${name} properties`)
      return recordValue(properties.operation, `${name} operation`).const
    })
    expect(operations).toEqual(["add_part", "replace_section", "extend", "transform"])
  })

  it("models Restyle, Cover, and Remaster as typed transforms instead of new top-level operations", () => {
    const schemas = contractSchemas(readContract())
    const transform = recordValue(schemas.TransformGenerationInput, "TransformGenerationInput")
    const variants = arrayValue(transform.oneOf, "Transform variants").map((value) => {
      const ref = stringValue(recordValue(value, "Transform variant").$ref, "Transform variant ref")
      return ref.split("/").at(-1) ?? ""
    })
    expect(variants).toEqual(["RestyleGenerationInput", "CoverGenerationInput", "RemasterGenerationInput"])

    const restyle = recordValue(schemas.RestyleGenerationInput, "RestyleGenerationInput")
    expect(arrayValue(restyle.required, "Restyle required fields")).toEqual(expect.arrayContaining([
      "intent",
      "scope",
      "instruction",
      "preserve",
      "reference_asset_refs",
      "output_count",
    ]))
    const restyleProperties = recordValue(restyle.properties, "Restyle properties")
    expect(recordValue(restyleProperties.operation, "Restyle operation").const).toBe("transform")
    expect(recordValue(restyleProperties.intent, "Restyle intent").const).toBe("restyle")
    expect(arrayValue(recordValue(restyleProperties.scope, "Restyle scope").oneOf, "Restyle scopes")).toHaveLength(2)

    const cover = recordValue(schemas.CoverGenerationInput, "CoverGenerationInput")
    expect(arrayValue(cover.required, "Cover required fields")).toEqual(expect.arrayContaining([
      "intent",
      "cover_mode",
      "voice_ref",
      "scope",
      "preserve",
      "reference_asset_refs",
      "output_count",
    ]))
    const coverProperties = recordValue(cover.properties, "Cover properties")
    expect(recordValue(coverProperties.operation, "Cover operation").const).toBe("transform")
    expect(recordValue(coverProperties.intent, "Cover intent").const).toBe("cover")
    expect(recordValue(coverProperties.scope, "Cover scope").$ref).toBe("#/components/schemas/WholeVersionScope")
    expect(recordValue(coverProperties.cover_mode, "Cover mode").enum).toEqual(["vocal", "instrumental"])
    expect(recordValue(coverProperties.output_count, "Cover output count").const).toBe(2)
    expect(recordValue(coverProperties.reference_asset_refs, "Cover references").maxItems).toBe(0)
    expect(arrayValue(cover.allOf, "Cover mode invariants")).toHaveLength(2)

    const remaster = recordValue(schemas.RemasterGenerationInput, "RemasterGenerationInput")
    expect(arrayValue(remaster.required, "Remaster required fields")).toEqual(expect.arrayContaining([
      "intent",
      "source",
      "variation_strength",
    ]))
    const properties = recordValue(remaster.properties, "Remaster properties")
    expect(recordValue(properties.operation, "Remaster operation").const).toBe("transform")
    expect(recordValue(properties.scope, "Remaster scope").$ref).toBe("#/components/schemas/WholeVersionScope")
    expect(recordValue(properties.intent, "Remaster intent").const).toBe("remaster")
    expect(recordValue(properties.variation_strength, "Remaster strength").enum).toEqual(["subtle", "balanced", "bold"])
    expect(recordValue(properties.output_count, "Remaster output count").const).toBe(2)

    const source = recordValue(schemas.RemasterSource, "RemasterSource")
    expect(arrayValue(source.oneOf, "Remaster sources")).toHaveLength(2)
  })

  it("models whole-version vocal and instrumental layers as typed add-part variants", () => {
    const schemas = contractSchemas(readContract())
    const addPart = recordValue(schemas.AddPartGenerationInput, "AddPartGenerationInput")
    const variants = arrayValue(addPart.oneOf, "Add part variants").map((value) => {
      const ref = stringValue(recordValue(value, "Add part variant").$ref, "Add part variant ref")
      return ref.split("/").at(-1) ?? ""
    })
    expect(variants).toEqual(["InsertPartGenerationInput", "WholeVersionLayerGenerationInput"])

    const layer = recordValue(schemas.WholeVersionLayerGenerationInput, "WholeVersionLayerGenerationInput")
    const required = arrayValue(layer.required, "Whole-Version layer required fields")
    expect(required).toEqual(expect.arrayContaining(["part_kind", "lyrics", "voice_ref"]))
    const properties = recordValue(layer.properties, "Whole-Version layer properties")
    expect(recordValue(properties.scope, "Whole-Version layer scope").$ref).toBe("#/components/schemas/WholeVersionScope")
    expect(recordValue(properties.part_kind, "Whole-Version layer kind").enum).toEqual(["vocals", "instrumental"])
  })

  it("publishes refresh-safe generation snapshots for both creation paths", () => {
    const document = readContract()
    const paths = recordValue(document.paths, "paths")
    const path = recordValue(paths["/api/v1/mori/generations/{generation_ref}"], "Generation snapshot path")
    const get = recordValue(path.get, "Generation snapshot GET")
    expect(get.operationId).toBe("getGeneration")

    const responses = recordValue(get.responses, "responses")
    const ok = recordValue(responses["200"], "Generation snapshot response")
    const content = recordValue(ok.content, "Generation snapshot content")
    const json = recordValue(content["application/json"], "Generation snapshot JSON")
    expect(recordValue(json.schema, "Generation snapshot envelope").$ref).toBe("#/components/schemas/ApiGenerationSnapshot")

    const schemas = contractSchemas(document)
    const snapshot = recordValue(schemas.GenerationSnapshot, "GenerationSnapshot")
    expect(recordValue(snapshot.discriminator, "GenerationSnapshot discriminator").propertyName).toBe("generation_kind")
    const variants = arrayValue(snapshot.oneOf, "Generation snapshot variants").map((value) =>
      stringValue(recordValue(value, "Generation snapshot variant").$ref, "Generation snapshot variant ref"),
    )
    expect(variants).toEqual([
      "#/components/schemas/NewSongGenerationSnapshot",
      "#/components/schemas/StudioChangeGenerationSnapshot",
    ])

    const newSongSnapshot = recordValue(schemas.NewSongGenerationSnapshot, "NewSongGenerationSnapshot")
    expect(arrayValue(newSongSnapshot.required, "New song snapshot required fields")).toContain("output_count")
    expect(recordValue(recordValue(newSongSnapshot.properties, "New song snapshot properties").output_count, "New song snapshot output count")).toMatchObject({ type: "integer", const: 2 })

    const studioSnapshot = recordValue(schemas.StudioChangeGenerationSnapshot, "StudioChangeGenerationSnapshot")
    const studioVariants = arrayValue(studioSnapshot.oneOf, "Studio snapshot variants").map((value) => {
      const ref = stringValue(recordValue(value, "Studio snapshot variant").$ref, "Studio snapshot variant ref")
      return ref.split("/").at(-1) ?? ""
    })
    expect(studioVariants).toEqual([
      "StandardStudioChangeGenerationSnapshot",
      "StudioRestyleGenerationSnapshot",
      "StudioCoverGenerationSnapshot",
      "StudioRemasterGenerationSnapshot",
    ])

    const standardStudioSnapshot = recordValue(schemas.StandardStudioChangeGenerationSnapshot, "StandardStudioChangeGenerationSnapshot")
    const studioProperties = recordValue(standardStudioSnapshot.properties, "Studio snapshot properties")
    expect(recordValue(studioProperties.generation_kind, "Studio generation kind").const).toBe("studio_change")
    expect(recordValue(studioProperties.operation, "Studio operation").enum).toEqual([
      "add_part",
      "replace_section",
      "extend",
    ])

    const restyleSnapshot = recordValue(schemas.StudioRestyleGenerationSnapshot, "StudioRestyleGenerationSnapshot")
    expect(arrayValue(restyleSnapshot.required, "Restyle snapshot required fields")).toEqual(expect.arrayContaining([
      "intent",
      "scope",
      "instruction",
      "preserve",
      "reference_asset_refs",
      "output_count",
    ]))

    const coverSnapshot = recordValue(schemas.StudioCoverGenerationSnapshot, "StudioCoverGenerationSnapshot")
    expect(arrayValue(coverSnapshot.required, "Cover snapshot required fields")).toEqual(expect.arrayContaining([
      "intent",
      "cover_mode",
      "voice_ref",
      "scope",
      "instruction",
      "preserve",
      "reference_asset_refs",
      "output_count",
    ]))

    const remasterSnapshot = recordValue(schemas.StudioRemasterGenerationSnapshot, "StudioRemasterGenerationSnapshot")
    expect(arrayValue(remasterSnapshot.required, "Remaster snapshot required fields")).toEqual(expect.arrayContaining([
      "intent",
      "source",
      "variation_strength",
    ]))
  })

  it("keeps the browser contract snake_case and provider-neutral", () => {
    const propertyKeys = collectPropertyKeys(readContract())
    expect(propertyKeys.filter((key) => /[A-Z]/u.test(key))).toEqual([])
    expect(propertyKeys.filter((key) => key.includes("provider") || key.includes("tenant") || key.includes("subject"))).toEqual([])
  })
})

function readContract(): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(contractPath, "utf8"))
  return recordValue(value, "OpenAPI document")
}

function contractSchemas(document: Record<string, unknown>): Record<string, unknown> {
  const components = recordValue(document.components, "components")
  return recordValue(components.schemas, "schemas")
}

function recordValue(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`)
  return value
}

function arrayValue(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  return value
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string" || value === "") throw new Error(`${label} must be a string`)
  return value
}

function collectPropertyKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectPropertyKeys)
  if (!isRecord(value)) return []
  const ownProperties = recordValueOrNull(value.properties)
  return [
    ...(ownProperties === null ? [] : Object.keys(ownProperties)),
    ...Object.values(value).flatMap(collectPropertyKeys),
  ]
}

function recordValueOrNull(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
