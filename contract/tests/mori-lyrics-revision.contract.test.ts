import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const contractPath = resolve(process.cwd(), "contract/openapi/mori-lyrics-revision.v1.json")

describe("Mori lyrics revision OpenAPI contract", () => {
  it("publishes a version-bound idempotent revision command", () => {
    const document = readContract()
    expect(document.openapi).toBe("3.1.0")

    const paths = recordValue(document.paths, "paths")
    const path = recordValue(paths["/api/v1/mori/versions/{version_ref}/lyrics_revisions"], "Lyrics revision path")
    const post = recordValue(path.post, "Lyrics revision POST")
    expect(post.operationId).toBe("createLyricsRevision")

    const parameters = arrayValue(post.parameters, "parameters").map((value) => recordValue(value, "parameter"))
    expect(parameters.find((parameter) => parameter.name === "Idempotency-Key")).toMatchObject({ in: "header", required: true })
    const responses = recordValue(post.responses, "responses")
    expect(responses["202"]).toBeDefined()
    expect(responses["409"]).toBeDefined()
    expect(responses["422"]).toBeDefined()
  })

  it("locks direction, scope, and lyrical constraints to provider-neutral values", () => {
    const schemas = contractSchemas(readContract())
    const input = recordValue(schemas.LyricsRevisionInput, "LyricsRevisionInput")
    const properties = recordValue(input.properties, "LyricsRevisionInput properties")
    expect(recordValue(properties.direction, "direction").enum).toEqual(["rewrite", "continue", "rhyme", "restructure"])
    expect(recordValue(properties.constraints, "constraints").items).toMatchObject({
      enum: ["meaning", "cadence", "rhyme_scheme", "section_length"],
    })

    const scope = recordValue(schemas.LyricsRevisionInputScope, "LyricsRevisionInputScope")
    expect(recordValue(scope.discriminator, "scope discriminator").propertyName).toBe("type")
    const scopeVariants = arrayValue(scope.oneOf, "scope variants").map((value) =>
      stringValue(recordValue(value, "scope variant").$ref, "scope ref"),
    )
    expect(scopeVariants).toEqual([
      "#/components/schemas/LyricsSectionScopeInput",
      "#/components/schemas/WholeLyricsScopeInput",
    ])
  })

  it("publishes durable snapshot, replay, and cancellation resources", () => {
    const document = readContract()
    const paths = recordValue(document.paths, "paths")
    expect(recordValue(recordValue(paths["/api/v1/mori/lyrics_revisions/{lyrics_revision_ref}"], "snapshot path").get, "snapshot GET").operationId).toBe("getLyricsRevision")
    expect(recordValue(recordValue(paths["/api/v1/mori/lyrics_revisions/{lyrics_revision_ref}/events"], "events path").get, "events GET").operationId).toBe("getLyricsRevisionEvents")
    expect(recordValue(recordValue(paths["/api/v1/mori/lyrics_revisions/{lyrics_revision_ref}/cancel"], "cancel path").post, "cancel POST").operationId).toBe("cancelLyricsRevision")

    const schemas = contractSchemas(document)
    const snapshot = recordValue(schemas.LyricsRevisionSnapshot, "LyricsRevisionSnapshot")
    const required = arrayValue(snapshot.required, "snapshot required")
    expect(required).toEqual(expect.arrayContaining([
      "instruction",
      "constraints",
      "output_count",
      "source_digest",
      "suggestions",
      "status",
      "progress",
    ]))
    const suggestion = recordValue(schemas.LyricsSuggestion, "LyricsSuggestion")
    expect(arrayValue(suggestion.required, "suggestion required")).toEqual(["suggestion_ref", "text"])
  })

  it("keeps the contract snake_case and free of caller-supplied identity or provider fields", () => {
    const propertyKeys = collectPropertyKeys(readContract())
    expect(propertyKeys.filter((key) => /[A-Z]/u.test(key))).toEqual([])
    expect(propertyKeys.filter((key) => key.includes("provider") || key.includes("tenant") || key.includes("subject") || key.includes("actor"))).toEqual([])
  })
})

function readContract(): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(contractPath, "utf8"))
  return recordValue(value, "OpenAPI document")
}

function contractSchemas(document: Record<string, unknown>): Record<string, unknown> {
  return recordValue(recordValue(document.components, "components").schemas, "schemas")
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
  const properties = isRecord(value.properties) ? Object.keys(value.properties) : []
  return [...properties, ...Object.values(value).flatMap(collectPropertyKeys)]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
