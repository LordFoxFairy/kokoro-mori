import type { MoriRef } from "@/features/mori/domain"
import {
  createMutationHeaders,
  type ApiError,
  type ApiSuccess,
  type GenerationCreateInput,
  type LyricsRevisionInput,
  type MoriGenerationEvent,
  type MoriApi,
  type MoriLyricsRevisionEvent,
  type StudioChangeGenerationInput,
} from "./mori-api"
import {
  parseApiError,
  parseApiSuccess,
  parseGenerationCancelReceipt,
  parseGenerationEventData,
  parseGenerationReceipt,
  parseGenerationSnapshot,
  parseLyricsRevisionCancelReceipt,
  parseLyricsRevisionEventData,
  parseLyricsRevisionReceipt,
  parseLyricsRevisionSnapshot,
  parseMoriCandidatePage,
  parseMoriExportReceipt,
  parseMoriExportSnapshot,
  parseMoriLibraryPage,
  parseMoriProject,
  parseMoriProjectPage,
  parseMoriSongPlan,
} from "./mori-api-validation"

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
      return parseSuccessResponse(response, payload, parseMoriProjectPage)
    },
    async createProject(input, idempotencyKey) {
      const response = await fetchImpl(`${apiBasePath}/projects`, {
        method: "POST",
        headers: createMutationHeaders(idempotencyKey),
        body: JSON.stringify(input),
      })
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseMoriProject)
    },
    async getProject(projectRef: MoriRef) {
      const response = await fetchImpl(`${apiBasePath}/projects/${encodeURIComponent(projectRef)}`)
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseMoriProject)
    },
    async createSongPlan(projectRef, input, idempotencyKey) {
      const response = await fetchImpl(
        `${apiBasePath}/projects/${encodeURIComponent(projectRef)}/song_plans`,
        {
          method: "POST",
          headers: createMutationHeaders(idempotencyKey),
          body: JSON.stringify(input),
        },
      )
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseMoriSongPlan)
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
      return parseSuccessResponse(response, payload, parseGenerationReceipt)
    },
    async createStudioChange(versionRef: MoriRef, input: StudioChangeGenerationInput, idempotencyKey: string) {
      const response = await fetchImpl(
        `${apiBasePath}/versions/${encodeURIComponent(versionRef)}/generations`,
        {
          method: "POST",
          headers: createMutationHeaders(idempotencyKey),
          body: JSON.stringify(input),
        },
      )
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseGenerationReceipt)
    },
    async createLyricsRevision(versionRef: MoriRef, input: LyricsRevisionInput, idempotencyKey: string) {
      const response = await fetchImpl(
        `${apiBasePath}/versions/${encodeURIComponent(versionRef)}/lyrics_revisions`,
        {
          method: "POST",
          headers: createMutationHeaders(idempotencyKey),
          body: JSON.stringify(input),
        },
      )
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseLyricsRevisionReceipt)
    },
    async getLyricsRevision(lyricsRevisionRef: MoriRef) {
      const response = await fetchImpl(`${apiBasePath}/lyrics_revisions/${encodeURIComponent(lyricsRevisionRef)}`)
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseLyricsRevisionSnapshot)
    },
    async getLyricsRevisionEvents(lyricsRevisionRef: MoriRef, lastEventId = null) {
      const headers: HeadersInit = { Accept: "text/event-stream" }
      if (lastEventId !== null && lastEventId.trim() !== "") headers["Last-Event-ID"] = lastEventId
      const response = await fetchImpl(`${apiBasePath}/lyrics_revisions/${encodeURIComponent(lyricsRevisionRef)}/events`, { headers })
      const body = await response.text()
      if (!response.ok) throwEventStreamError(response, body, "Mori lyrics revision event stream")
      if (!(response.headers.get("content-type") || "").toLowerCase().startsWith("text/event-stream")) {
        throw invalidEventStreamResponse("Mori lyrics revision event stream returned an invalid content type", response.status)
      }
      const events = parseLyricsRevisionEvents(body)
      if (events === null) {
        throw invalidEventStreamResponse("Mori lyrics revision event stream returned an invalid response", response.status)
      }
      return events
    },
    async cancelLyricsRevision(lyricsRevisionRef: MoriRef, idempotencyKey: string) {
      const response = await fetchImpl(`${apiBasePath}/lyrics_revisions/${encodeURIComponent(lyricsRevisionRef)}/cancel`, {
        method: "POST",
        headers: createMutationHeaders(idempotencyKey),
      })
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseLyricsRevisionCancelReceipt)
    },
    async getGeneration(generationRef: MoriRef) {
      const response = await fetchImpl(`${apiBasePath}/generations/${encodeURIComponent(generationRef)}`)
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseGenerationSnapshot)
    },
    async getGenerationEvents(generationRef: MoriRef, lastEventId = null) {
      const headers: HeadersInit = { Accept: "text/event-stream" }
      if (lastEventId !== null && lastEventId.trim() !== "") headers["Last-Event-ID"] = lastEventId
      const response = await fetchImpl(`${apiBasePath}/generations/${encodeURIComponent(generationRef)}/events`, { headers })
      const body = await response.text()
      if (!response.ok) {
        const payload = parseJson(body)
        const apiError = parseApiError(payload)
        if (apiError !== null) throw new MoriApiRequestError(apiError.error, apiError.meta.request_id, response.status)
        throw new MoriApiRequestError(
          { code: "invalid_api_response", message: "Mori event stream returned an invalid response", retryable: response.status >= 500, details: null },
          null,
          response.status,
        )
      }
      if (!(response.headers.get("content-type") || "").toLowerCase().startsWith("text/event-stream")) {
        throw new MoriApiRequestError(
          { code: "invalid_api_response", message: "Mori event stream returned an invalid content type", retryable: false, details: null },
          null,
          response.status,
        )
      }
      const events = parseGenerationEvents(body)
      if (events === null) {
        throw new MoriApiRequestError(
          { code: "invalid_api_response", message: "Mori event stream returned an invalid response", retryable: response.status >= 500, details: null },
          null,
          response.status,
        )
      }
      return events
    },
    async listCandidates(projectRef: MoriRef) {
      const response = await fetchImpl(`${apiBasePath}/projects/${encodeURIComponent(projectRef)}/candidates`)
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseMoriCandidatePage)
    },
    async cancelGeneration(generationRef: MoriRef, idempotencyKey: string) {
      const response = await fetchImpl(`${apiBasePath}/generations/${encodeURIComponent(generationRef)}/cancel`, {
        method: "POST",
        headers: createMutationHeaders(idempotencyKey),
      })
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseGenerationCancelReceipt)
    },
    async listLibrary(kind = "all") {
      const response = await fetchImpl(`${apiBasePath}/library?kind=${encodeURIComponent(kind)}`)
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseMoriLibraryPage)
    },
    async createExport(versionRef, format, idempotencyKey) {
      const response = await fetchImpl(`${apiBasePath}/versions/${encodeURIComponent(versionRef)}/exports`, {
        method: "POST",
        headers: createMutationHeaders(idempotencyKey),
        body: JSON.stringify({ format }),
      })
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseMoriExportReceipt)
    },
    async getExport(exportRef) {
      const response = await fetchImpl(`${apiBasePath}/exports/${encodeURIComponent(exportRef)}`)
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseMoriExportSnapshot)
    },
  }
}

function throwRequestError(response: Response, payload: unknown): never {
  const apiError = parseApiError(payload)
  if (apiError !== null) {
    throw new MoriApiRequestError(apiError.error, apiError.meta.request_id, response.status)
  }
  throw new MoriApiRequestError(
    { code: "invalid_api_response", message: "Mori API returned an invalid response", retryable: response.status >= 500, details: null },
    null,
    response.status,
  )
}

function parseSuccessResponse<T>(response: Response, payload: unknown, parser: (value: unknown) => T | null): ApiSuccess<T> {
  if (!response.ok || parseApiError(payload) !== null) throwRequestError(response, payload)
  const result = parseApiSuccess(payload, parser)
  if (result === null) {
    throw new MoriApiRequestError(
      { code: "invalid_api_response", message: "Mori API returned an invalid response", retryable: response.status >= 500, details: null },
      null,
      response.status,
    )
  }
  return result
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

function parseGenerationEvents(body: string): MoriGenerationEvent[] | null {
  return parseServerSentEvents(body, "generation.", parseGenerationEventData)
}

function parseLyricsRevisionEvents(body: string): MoriLyricsRevisionEvent[] | null {
  return parseServerSentEvents(body, "lyrics_revision.", parseLyricsRevisionEventData)
}

function parseServerSentEvents<T>(body: string, eventPrefix: string, parser: (value: unknown) => T | null): Array<{ id: string; event: string; data: T }> | null {
  const events: Array<{ id: string; event: string; data: T }> = []
  for (const frame of body.split(/\r?\n\r?\n/u)) {
    if (frame.trim() === "" || frame.split(/\r?\n/u).every((line) => line.startsWith(":"))) continue
    let id: string | null = null
    let event: string | null = null
    const dataLines: string[] = []
    for (const line of frame.split(/\r?\n/u)) {
      if (line.startsWith("id:")) id = line.slice(3).trim()
      else if (line.startsWith("event:")) event = line.slice(6).trim()
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart())
    }
    if (id === null || id === "" || event === null || !event.startsWith(eventPrefix) || dataLines.length === 0) return null
    const envelope = parseApiSuccess(parseJson(dataLines.join("\n")), parser)
    if (envelope === null) return null
    events.push({
      id,
      event,
      data: envelope.data,
    })
  }
  return events
}

function throwEventStreamError(response: Response, body: string, label: string): never {
  const payload = parseJson(body)
  const apiError = parseApiError(payload)
  if (apiError !== null) throw new MoriApiRequestError(apiError.error, apiError.meta.request_id, response.status)
  throw invalidEventStreamResponse(`${label} returned an invalid response`, response.status)
}

function invalidEventStreamResponse(message: string, status: number): MoriApiRequestError {
  return new MoriApiRequestError(
    { code: "invalid_api_response", message, retryable: status >= 500, details: null },
    null,
    status,
  )
}
