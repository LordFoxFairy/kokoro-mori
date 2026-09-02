import type { MoriRef } from "@/features/mori/domain"
import {
  createMutationHeaders,
  type ApiError,
  type ApiSuccess,
  type GenerationCreateInput,
  type GenerationCancelReceipt,
  type GenerationReceipt,
  type GenerationSnapshot,
  type MoriGenerationEvent,
  type MoriExportReceipt,
  type MoriExportSnapshot,
  type MoriCandidate,
  type MoriLibraryItem,
  type MoriProjectPage,
  type MoriApi,
} from "./mori-api"

export type MoriApiClientOptions = {
  apiBasePath?: string
  fetchImpl?: typeof fetch
}

export class MoriApiRequestError extends Error {
  readonly code: string
  readonly retryable: boolean
  readonly requestId: string | null
  readonly status: number

  constructor(error: ApiError["error"], requestId: string | null, status: number) {
    super(error.message)
    this.name = "MoriApiRequestError"
    this.code = error.code
    this.retryable = error.retryable
    this.requestId = requestId
    this.status = status
  }
}

export function createMoriApiClient(options: MoriApiClientOptions = {}): MoriApi {
  const apiBasePath = (options.apiBasePath ?? "/api/v1/mori").replace(/\/$/, "")
  const fetchImpl = options.fetchImpl ?? fetch

  return {
    async listProjects(options = {}) {
      const query = new URLSearchParams()
      if (options.limit !== undefined) query.set("limit", String(options.limit))
      if (options.cursor !== undefined && options.cursor !== null && options.cursor.trim() !== "") query.set("cursor", options.cursor)
      const response = await fetchImpl(`${apiBasePath}/projects${query.size > 0 ? `?${query.toString()}` : ""}`)
      const payload = await readJson(response)
      if (!response.ok || isApiError(payload)) {
        throwRequestError(response, payload)
      }
      return payload as ApiSuccess<MoriProjectPage>
    },
    async getProject(projectRef: MoriRef) {
      const response = await fetchImpl(`${apiBasePath}/projects/${encodeURIComponent(projectRef)}`)
      const payload = await readJson(response)
      if (!response.ok || isApiError(payload)) {
        throwRequestError(response, payload)
      }
      return payload as ApiSuccess<import("./mori-api").MoriProject>
    },
    async createGeneration(projectRef: MoriRef, input: GenerationCreateInput, idempotencyKey: string) {
      const response = await fetchImpl(
        `${apiBasePath}/projects/${encodeURIComponent(projectRef)}/generations`,
        {
          method: "POST",
          headers: createMutationHeaders(idempotencyKey),
          body: JSON.stringify(input),
        },
      )
      const payload = await readJson(response)

      if (!response.ok || isApiError(payload)) {
        if (isApiError(payload)) {
          throw new MoriApiRequestError(payload.error, payload.meta.request_id, response.status)
        }
        throw new MoriApiRequestError(
          { code: "invalid_api_response", message: "Mori API returned an invalid response", retryable: response.status >= 500, details: null },
          null,
          response.status,
        )
      }

      return payload as ApiSuccess<GenerationReceipt>
    },
    async getGeneration(generationRef: MoriRef) {
      const response = await fetchImpl(`${apiBasePath}/generations/${encodeURIComponent(generationRef)}`)
      const payload = await readJson(response)
      if (!response.ok || isApiError(payload)) {
        throwRequestError(response, payload)
      }
      return payload as ApiSuccess<GenerationSnapshot>
    },
    async getGenerationEvents(generationRef: MoriRef, lastEventId = null) {
      const headers: HeadersInit = { Accept: "text/event-stream" }
      if (lastEventId !== null && lastEventId.trim() !== "") headers["Last-Event-ID"] = lastEventId
      const response = await fetchImpl(`${apiBasePath}/generations/${encodeURIComponent(generationRef)}/events`, { headers })
      const body = await response.text()
      if (!response.ok) {
        const payload = parseJson(body)
        if (isApiError(payload)) throw new MoriApiRequestError(payload.error, payload.meta.request_id, response.status)
        throw new MoriApiRequestError(
          { code: "invalid_api_response", message: "Mori event stream returned an invalid response", retryable: response.status >= 500, details: null },
          null,
          response.status,
        )
      }
      return parseGenerationEvents(body)
    },
    async listCandidates(projectRef: MoriRef) {
      const response = await fetchImpl(`${apiBasePath}/projects/${encodeURIComponent(projectRef)}/candidates`)
      const payload = await readJson(response)
      if (!response.ok || isApiError(payload)) {
        throwRequestError(response, payload)
      }
      return payload as ApiSuccess<{ candidates: MoriCandidate[]; next_cursor: string | null }>
    },
    async cancelGeneration(generationRef: MoriRef, idempotencyKey: string) {
      const response = await fetchImpl(`${apiBasePath}/generations/${encodeURIComponent(generationRef)}/cancel`, {
        method: "POST",
        headers: createMutationHeaders(idempotencyKey),
      })
      const payload = await readJson(response)
      if (!response.ok || isApiError(payload)) {
        throwRequestError(response, payload)
      }
      return payload as ApiSuccess<GenerationCancelReceipt>
    },
    async listLibrary(kind = "all") {
      const response = await fetchImpl(`${apiBasePath}/library?kind=${encodeURIComponent(kind)}`)
      const payload = await readJson(response)
      if (!response.ok || isApiError(payload)) {
        throwRequestError(response, payload)
      }
      return payload as ApiSuccess<{ items: MoriLibraryItem[]; next_cursor: string | null }>
    },
    async createExport(versionRef, format, idempotencyKey) {
      const response = await fetchImpl(`${apiBasePath}/versions/${encodeURIComponent(versionRef)}/exports`, {
        method: "POST",
        headers: createMutationHeaders(idempotencyKey),
        body: JSON.stringify({ format }),
      })
      const payload = await readJson(response)
      if (!response.ok || isApiError(payload)) {
        throwRequestError(response, payload)
      }
      return payload as ApiSuccess<MoriExportReceipt>
    },
    async getExport(exportRef) {
      const response = await fetchImpl(`${apiBasePath}/exports/${encodeURIComponent(exportRef)}`)
      const payload = await readJson(response)
      if (!response.ok || isApiError(payload)) {
        throwRequestError(response, payload)
      }
      return payload as ApiSuccess<MoriExportSnapshot>
    },
  }
}

function throwRequestError(response: Response, payload: unknown): never {
  if (isApiError(payload)) {
    throw new MoriApiRequestError(payload.error, payload.meta.request_id, response.status)
  }
  throw new MoriApiRequestError(
    { code: "invalid_api_response", message: "Mori API returned an invalid response", retryable: response.status >= 500, details: null },
    null,
    response.status,
  )
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function parseGenerationEvents(body: string): MoriGenerationEvent[] {
  return body.split(/\r?\n\r?\n/u).flatMap((frame) => {
    let id: string | null = null
    let event: string | null = null
    const dataLines: string[] = []
    for (const line of frame.split(/\r?\n/u)) {
      if (line.startsWith("id:")) id = line.slice(3).trim()
      else if (line.startsWith("event:")) event = line.slice(6).trim()
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart())
    }
    if (id === null || id === "" || event === null || event === "" || dataLines.length === 0) return []
    const envelope = parseJson(dataLines.join("\n"))
    if (!isRecord(envelope) || !isRecord(envelope.data)) return []
    const data = envelope.data
    if (
      typeof data.generation_ref !== "string"
      || typeof data.project_ref !== "string"
      || typeof data.status !== "string"
      || typeof data.progress !== "number"
      || !Number.isFinite(data.progress)
      || !Array.isArray(data.candidate_refs)
      || !data.candidate_refs.every((value): value is string => typeof value === "string")
    ) return []
    return [{
      id,
      event,
      data: {
        generation_ref: data.generation_ref,
        project_ref: data.project_ref,
        status: data.status as MoriGenerationEvent["data"]["status"],
        progress: data.progress,
        candidate_refs: [...data.candidate_refs],
      },
    }]
  })
}

function isApiError(value: unknown): value is ApiError {
  if (typeof value !== "object" || value === null || !("error" in value) || !("meta" in value)) {
    return false
  }

  const candidate = value as { error?: unknown; meta?: unknown }
  return typeof candidate.error === "object" && candidate.error !== null
    && typeof candidate.meta === "object" && candidate.meta !== null
    && "code" in candidate.error && "message" in candidate.error && "retryable" in candidate.error
    && "request_id" in candidate.meta
}
