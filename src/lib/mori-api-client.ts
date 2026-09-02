import type { MoriRef } from "@/features/mori/domain"
import {
  createMutationHeaders,
  type ApiError,
  type ApiSuccess,
  type GenerationCreateInput,
  type GenerationReceipt,
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
  const apiBasePath = (options.apiBasePath ?? "/api/v1").replace(/\/$/, "")
  const fetchImpl = options.fetchImpl ?? fetch

  return {
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
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
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
