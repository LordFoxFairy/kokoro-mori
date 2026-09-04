import type { MoriRef } from "@/features/mori/domain"
import {
  createMutationHeaders,
  type ApiError,
  type ApiSuccess,
  type ArtworkGenerationInput,
  type CurrentVersionInput,
  type GenerationCreateInput,
  type LyricsRevisionInput,
  type MoriGenerationEvent,
  type MoriApi,
  type MoriCandidateListOptions,
  type MoriArtworkGenerationEvent,
  type MoriCreativeSourceListOptions,
  type MoriExportInput,
  type MoriLyricsRevisionEvent,
  type MoriStemSeparationEvent,
  type ReleaseDraftInput,
  type StemSeparationInput,
  type StudioChangeGenerationInput,
} from "./mori-api"
import {
  parseApiError,
  parseApiSuccess,
  parseArtworkGenerationCancelReceipt,
  parseArtworkGenerationEventData,
  parseArtworkGenerationReceipt,
  parseArtworkGenerationSnapshot,
  parseGenerationCancelReceipt,
  parseGenerationEventData,
  parseGenerationReceipt,
  parseGenerationSnapshot,
  parseLyricsRevisionCancelReceipt,
  parseLyricsRevisionEventData,
  parseLyricsRevisionReceipt,
  parseLyricsRevisionSnapshot,
  parseMoriCandidatePage,
  parseMoriCreativeSource,
  parseMoriCreativeSourcePage,
  parseMoriCurrentVersionSelection,
  parseMoriProjectWorkspaceProjection,
  parseMoriExportReceipt,
  parseMoriExportSnapshot,
  parseMoriLibraryPage,
  parseMoriMixRevision,
  parseMoriProject,
  parseMoriProjectPage,
  parseMoriReleaseDraft,
  parseMoriSongPlan,
  parseStemSeparationCancelReceipt,
  parseStemSeparationEventData,
  parseStemSeparationReceipt,
  parseStemSeparationSnapshot,
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

export function moriNetworkRequestError(error: unknown): MoriApiRequestError | null {
  if (!(error instanceof TypeError)) return null
  return new MoriApiRequestError({
    code: "mori_network_error",
    message: "Mori generation status could not be reached",
    retryable: true,
    details: null,
  }, null, 0)
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
    async getProjectWorkspace(projectRef: MoriRef) {
      const response = await fetchImpl(`${apiBasePath}/projects/${encodeURIComponent(projectRef)}/workspace`)
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseMoriProjectWorkspaceProjection)
    },
    async putCurrentVersion(projectRef: MoriRef, input: CurrentVersionInput, idempotencyKey: string) {
      const response = await fetchImpl(`${apiBasePath}/projects/${encodeURIComponent(projectRef)}/current_version`, {
        method: "PUT",
        headers: createMutationHeaders(idempotencyKey),
        body: JSON.stringify(input),
      })
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseMoriCurrentVersionSelection)
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
    async putCurrentSongPlan(projectRef, input, idempotencyKey) {
      const response = await fetchImpl(`${apiBasePath}/projects/${encodeURIComponent(projectRef)}/song_plan`, {
        method: "PUT",
        headers: createMutationHeaders(idempotencyKey),
        body: JSON.stringify(input),
      })
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseMoriProjectWorkspaceProjection)
    },
    async putLyricsDraft(versionRef, input, idempotencyKey) {
      const response = await fetchImpl(`${apiBasePath}/versions/${encodeURIComponent(versionRef)}/lyrics_draft`, {
        method: "PUT",
        headers: createMutationHeaders(idempotencyKey),
        body: JSON.stringify(input),
      })
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseMoriProjectWorkspaceProjection)
    },
    async putProjectWorkspaceOpenVersion(projectRef, input, idempotencyKey) {
      const response = await fetchImpl(`${apiBasePath}/projects/${encodeURIComponent(projectRef)}/workspace/open_version`, {
        method: "PUT",
        headers: createMutationHeaders(idempotencyKey),
        body: JSON.stringify(input),
      })
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseMoriProjectWorkspaceProjection)
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
    async getLyricsRevisionEvents(lyricsRevisionRef: MoriRef, lastEventId = null, signal) {
      const headers: HeadersInit = { Accept: "text/event-stream" }
      if (lastEventId !== null && lastEventId.trim() !== "") headers["Last-Event-ID"] = lastEventId
      const response = await fetchImpl(`${apiBasePath}/lyrics_revisions/${encodeURIComponent(lyricsRevisionRef)}/events`, { headers, signal })
      if (!response.ok) {
        const body = await response.text()
        throwEventStreamError(response, body, "Mori lyrics revision event stream")
      }
      if (!(response.headers.get("content-type") || "").toLowerCase().startsWith("text/event-stream")) {
        throw invalidEventStreamResponse("Mori lyrics revision event stream returned an invalid content type", response.status)
      }
      const events = await readFirstCompleteEventBatch(response, parseLyricsRevisionEvents)
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
    async createStemSeparation(versionRef: MoriRef, input: StemSeparationInput, idempotencyKey: string) {
      const response = await fetchImpl(
        `${apiBasePath}/versions/${encodeURIComponent(versionRef)}/stem_separations`,
        {
          method: "POST",
          headers: createMutationHeaders(idempotencyKey),
          body: JSON.stringify(input),
        },
      )
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseStemSeparationReceipt)
    },
    async getStemSeparation(stemSeparationRef: MoriRef) {
      const response = await fetchImpl(`${apiBasePath}/stem_separations/${encodeURIComponent(stemSeparationRef)}`)
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseStemSeparationSnapshot)
    },
    async getStemSeparationEvents(stemSeparationRef: MoriRef, lastEventId = null, signal) {
      const headers: HeadersInit = { Accept: "text/event-stream" }
      if (lastEventId !== null && lastEventId.trim() !== "") headers["Last-Event-ID"] = lastEventId
      const response = await fetchImpl(`${apiBasePath}/stem_separations/${encodeURIComponent(stemSeparationRef)}/events`, { headers, signal })
      if (!response.ok) {
        const body = await response.text()
        throwEventStreamError(response, body, "Mori stem separation event stream")
      }
      if (!(response.headers.get("content-type") || "").toLowerCase().startsWith("text/event-stream")) {
        throw invalidEventStreamResponse("Mori stem separation event stream returned an invalid content type", response.status)
      }
      const events = await readFirstCompleteEventBatch(response, parseStemSeparationEvents)
      if (events === null) {
        throw invalidEventStreamResponse("Mori stem separation event stream returned an invalid response", response.status)
      }
      return events
    },
    async cancelStemSeparation(stemSeparationRef: MoriRef, idempotencyKey: string) {
      const response = await fetchImpl(`${apiBasePath}/stem_separations/${encodeURIComponent(stemSeparationRef)}/cancel`, {
        method: "POST",
        headers: createMutationHeaders(idempotencyKey),
      })
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseStemSeparationCancelReceipt)
    },
    async createArtworkGeneration(versionRef: MoriRef, input: ArtworkGenerationInput, idempotencyKey: string) {
      const response = await fetchImpl(`${apiBasePath}/versions/${encodeURIComponent(versionRef)}/artwork_generations`, {
        method: "POST",
        headers: createMutationHeaders(idempotencyKey),
        body: JSON.stringify(input),
      })
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseArtworkGenerationReceipt)
    },
    async getArtworkGeneration(artworkGenerationRef: MoriRef) {
      const response = await fetchImpl(`${apiBasePath}/artwork_generations/${encodeURIComponent(artworkGenerationRef)}`)
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseArtworkGenerationSnapshot)
    },
    async getArtworkGenerationEvents(artworkGenerationRef: MoriRef, lastEventId = null, signal) {
      const headers: HeadersInit = { Accept: "text/event-stream" }
      if (lastEventId !== null && lastEventId.trim() !== "") headers["Last-Event-ID"] = lastEventId
      const response = await fetchImpl(`${apiBasePath}/artwork_generations/${encodeURIComponent(artworkGenerationRef)}/events`, { headers, signal })
      if (!response.ok) {
        const body = await response.text()
        throwEventStreamError(response, body, "Mori artwork generation event stream")
      }
      if (!(response.headers.get("content-type") || "").toLowerCase().startsWith("text/event-stream")) {
        throw invalidEventStreamResponse("Mori artwork generation event stream returned an invalid content type", response.status)
      }
      const events = await readFirstCompleteEventBatch(response, parseArtworkGenerationEvents)
      if (events === null) {
        throw invalidEventStreamResponse("Mori artwork generation event stream returned an invalid response", response.status)
      }
      return events
    },
    async cancelArtworkGeneration(artworkGenerationRef: MoriRef, idempotencyKey: string) {
      const response = await fetchImpl(`${apiBasePath}/artwork_generations/${encodeURIComponent(artworkGenerationRef)}/cancel`, {
        method: "POST",
        headers: createMutationHeaders(idempotencyKey),
      })
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseArtworkGenerationCancelReceipt)
    },
    async getReleaseDraft(versionRef: MoriRef) {
      const response = await fetchImpl(`${apiBasePath}/versions/${encodeURIComponent(versionRef)}/release_draft`)
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseMoriReleaseDraft)
    },
    async putReleaseDraft(versionRef: MoriRef, input: ReleaseDraftInput, idempotencyKey: string) {
      const response = await fetchImpl(`${apiBasePath}/versions/${encodeURIComponent(versionRef)}/release_draft`, {
        method: "PUT",
        headers: createMutationHeaders(idempotencyKey),
        body: JSON.stringify(input),
      })
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseMoriReleaseDraft)
    },
    async createMixRevision(versionRef, input, idempotencyKey) {
      const response = await fetchImpl(`${apiBasePath}/versions/${encodeURIComponent(versionRef)}/mix_revisions`, {
        method: "POST",
        headers: createMutationHeaders(idempotencyKey),
        body: JSON.stringify(input),
      })
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseMoriMixRevision)
    },
    async getMixRevision(mixRevisionRef) {
      const response = await fetchImpl(`${apiBasePath}/mix_revisions/${encodeURIComponent(mixRevisionRef)}`)
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseMoriMixRevision)
    },
    async getGeneration(generationRef: MoriRef) {
      const response = await fetchGenerationSnapshot(fetchImpl, `${apiBasePath}/generations/${encodeURIComponent(generationRef)}`)
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseGenerationSnapshot)
    },
    async getGenerationEvents(generationRef: MoriRef, lastEventId = null, signal?: AbortSignal) {
      const headers: HeadersInit = { Accept: "text/event-stream" }
      if (lastEventId !== null && lastEventId.trim() !== "") headers["Last-Event-ID"] = lastEventId
      const response = await fetchImpl(`${apiBasePath}/generations/${encodeURIComponent(generationRef)}/events`, { headers, signal })
      if (!response.ok) {
        const body = await response.text()
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
      const events = await readFirstCompleteEventBatch(response, parseGenerationEvents)
      if (events === null) {
        throw new MoriApiRequestError(
          { code: "invalid_api_response", message: "Mori event stream returned an invalid response", retryable: response.status >= 500, details: null },
          null,
          response.status,
        )
      }
      return events
    },
    async listCandidates(projectRef: MoriRef, options: MoriCandidateListOptions = {}) {
      const query = new URLSearchParams()
      if (options.limit !== undefined) query.set("limit", String(options.limit))
      if (options.cursor !== undefined && options.cursor !== null && options.cursor.trim() !== "") query.set("cursor", options.cursor)
      if (options.generation_ref !== undefined && options.generation_ref !== null && options.generation_ref.trim() !== "") query.set("generation_ref", options.generation_ref)
      const queryString = query.toString()
      const response = await fetchImpl(`${apiBasePath}/projects/${encodeURIComponent(projectRef)}/candidates${queryString ? `?${queryString}` : ""}`)
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
    async listLibrary(kindOrOptions = "all") {
      const options = typeof kindOrOptions === "string" ? { kind: kindOrOptions } : kindOrOptions
      const query = new URLSearchParams({ kind: options.kind ?? "all" })
      if (options.limit !== undefined) query.set("limit", String(options.limit))
      if (options.cursor !== undefined && options.cursor !== null && options.cursor.trim() !== "") query.set("cursor", options.cursor)
      const response = await fetchImpl(`${apiBasePath}/library?${query.toString()}`)
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseMoriLibraryPage)
    },
    async listCreativeSources(options: MoriCreativeSourceListOptions = {}) {
      const query = new URLSearchParams({ source_kind: options.source_kind ?? "all" })
      if (options.limit !== undefined) query.set("limit", String(options.limit))
      if (options.cursor !== undefined && options.cursor !== null && options.cursor.trim() !== "") query.set("cursor", options.cursor)
      const response = await fetchImpl(`${apiBasePath}/library/sources?${query.toString()}`)
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseMoriCreativeSourcePage)
    },
    async getCreativeSource(sourceKind, sourceRef) {
      const response = await fetchImpl(`${apiBasePath}/library/sources/${encodeURIComponent(sourceKind)}/${encodeURIComponent(sourceRef)}`)
      const payload = await readJson(response)
      return parseSuccessResponse(response, payload, parseMoriCreativeSource)
    },
    async createExport(versionRef: MoriRef, input: MoriExportInput, idempotencyKey: string) {
      const response = await fetchImpl(`${apiBasePath}/versions/${encodeURIComponent(versionRef)}/exports`, {
        method: "POST",
        headers: createMutationHeaders(idempotencyKey),
        body: JSON.stringify(input),
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

async function fetchGenerationSnapshot(fetchImpl: typeof fetch, url: string): Promise<Response> {
  try {
    return await fetchImpl(url)
  } catch (error) {
    throw moriNetworkRequestError(error) ?? error
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

function parseStemSeparationEvents(body: string): MoriStemSeparationEvent[] | null {
  return parseServerSentEvents(body, "stem_separation.", parseStemSeparationEventData)
}

function parseArtworkGenerationEvents(body: string): MoriArtworkGenerationEvent[] | null {
  return parseServerSentEvents(body, "artwork_generation.", parseArtworkGenerationEventData)
}

async function readFirstCompleteEventBatch<T>(
  response: Response,
  parser: (body: string) => T[] | null,
): Promise<T[] | null> {
  if (response.body === null) return parser(await response.text())

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const completeBatch = completeEventStreamBatch(buffer)
      if (completeBatch !== null) {
        const parsed = parser(completeBatch)
        await reader.cancel()
        return parsed
      }
      if (done) return parser(buffer)
    }
  } finally {
    reader.releaseLock()
  }
}

function completeEventStreamBatch(buffer: string): string | null {
  const boundary = /(?:\r?\n){2}/gu
  let match: RegExpExecArray | null
  let end = -1
  while ((match = boundary.exec(buffer)) !== null) end = match.index + match[0].length
  return end < 0 ? null : buffer.slice(0, end)
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
