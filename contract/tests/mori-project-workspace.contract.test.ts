import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const contractPath = resolve(process.cwd(), "contract/openapi/mori-project-workspace.v1.json")

describe("Mori Project Workspace OpenAPI contract", () => {
  it("reads one coherent, browser-private recovery projection", () => {
    const document = readContract()
    expect(document.openapi).toBe("3.1.0")
    const paths = recordValue(document.paths, "paths")
    const workspacePath = recordValue(paths["/api/v1/mori/projects/{project_ref}/workspace"], "workspace path")
    const get = recordValue(workspacePath.get, "workspace GET")

    expect(get.operationId).toBe("getProjectWorkspace")
    expect(get["x-kokoro-owner"]).toBe("kokoro-bff")
    expect(get["x-kokoro-visibility"]).toBe("browser-private")
    expect(recordValue(get.responses, "workspace responses")["200"]).toBeDefined()

    const projection = recordValue(contractSchemas(document).ProjectWorkspaceProjection, "ProjectWorkspaceProjection")
    expect(arrayValue(projection.required, "projection required")).toEqual([
      "project",
      "current_song_plan",
      "open_version",
      "latest_lyrics_draft",
      "latest_mix_revision",
      "active_tasks",
      "revision_cursor",
      "observed_at",
    ])
  })

  it("makes creative saves revisioned and returns the reconciled workspace", () => {
    const document = readContract()
    const paths = recordValue(document.paths, "paths")

    expectPutCommand(paths, "/api/v1/mori/projects/{project_ref}/song_plan", "putCurrentSongPlan")
    expectPutCommand(paths, "/api/v1/mori/versions/{version_ref}/lyrics_draft", "putLyricsDraft")
    expectPutCommand(paths, "/api/v1/mori/projects/{project_ref}/workspace/open_version", "putProjectWorkspaceOpenVersion")

    const schemas = contractSchemas(document)
    const songPlanInput = recordValue(schemas.CurrentSongPlanInput, "CurrentSongPlanInput")
    expect(arrayValue(songPlanInput.required, "song plan input required")).toContain("expected_revision")
    expect(recordValue(songPlanInput.properties, "song plan input properties").expected_revision).toEqual({
      oneOf: [{ type: "null" }, { type: "integer", minimum: 1 }],
    })

    const lyricsDraftInput = recordValue(schemas.LyricsDraftInput, "LyricsDraftInput")
    expect(arrayValue(lyricsDraftInput.required, "lyrics draft input required")).toEqual(["text", "expected_revision"])

    const openVersionInput = recordValue(schemas.ProjectWorkspaceOpenVersionInput, "ProjectWorkspaceOpenVersionInput")
    expect(arrayValue(openVersionInput.required, "open version input required")).toEqual(["version_ref", "expected_revision"])
  })

  it("keeps Project Current, user Open Version, and opaque active work distinct", () => {
    const schemas = contractSchemas(readContract())
    const project = recordValue(schemas.ProjectWorkspaceProject, "ProjectWorkspaceProject")
    const openVersion = recordValue(schemas.ProjectWorkspaceOpenVersion, "ProjectWorkspaceOpenVersion")
    const activeTask = recordValue(schemas.ProjectWorkspaceActiveTask, "ProjectWorkspaceActiveTask")

    expect(recordValue(project.properties, "ProjectWorkspaceProject properties").current_version_ref).toBeDefined()
    expect(recordValue(openVersion.properties, "ProjectWorkspaceOpenVersion properties").version_ref).toBeDefined()
    expect(arrayValue(activeTask.required, "active task required")).toEqual([
      "task_ref",
      "kind",
      "project_ref",
      "version_ref",
      "status",
      "progress",
      "updated_at",
    ])

    const keys = collectPropertyKeys(readContract())
    expect(keys.filter((key) => /[A-Z]/u.test(key))).toEqual([])
    expect(keys.filter((key) => /provider|tenant|subject|actor|signed_url|storage_url/u.test(key))).toEqual([])
  })
})

function expectPutCommand(paths: Record<string, unknown>, pathName: string, operationId: string): void {
  const path = recordValue(paths[pathName], pathName)
  const put = recordValue(path.put, `${operationId} PUT`)
  const parameters = arrayValue(put.parameters, `${operationId} parameters`).map((value) => recordValue(value, "parameter"))
  const responses = recordValue(put.responses, `${operationId} responses`)

  expect(put.operationId).toBe(operationId)
  expect(put["x-kokoro-idempotency"]).toBe("required")
  expect(parameters.find((parameter) => parameter.name === "Idempotency-Key")).toMatchObject({ in: "header", required: true })
  expect(responses["200"]).toBeDefined()
  expect(responses["409"]).toBeDefined()
}

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

function collectPropertyKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectPropertyKeys)
  if (!isRecord(value)) return []
  const properties = isRecord(value.properties) ? Object.keys(value.properties) : []
  return [...properties, ...Object.values(value).flatMap(collectPropertyKeys)]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
