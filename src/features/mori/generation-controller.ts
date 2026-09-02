import type { GenerationStatus } from "./domain"
import { createGenerationRequest, type GenerationCreateInput, type GenerationReceipt, type MoriApi, type MoriGenerationDraft } from "@/lib/mori-api"

export type GenerationControllerState = {
  status: GenerationStatus
  requestId: string | null
  generationRef: string | null
  errorCode: string | null
}

export type GenerationController = {
  getState: () => GenerationControllerState
  submit: (draft: MoriGenerationDraft, idempotencyKey: string) => Promise<GenerationControllerState>
}

const idleState: GenerationControllerState = {
  status: "queued",
  requestId: null,
  generationRef: null,
  errorCode: null,
}

export function createGenerationController(api: MoriApi): GenerationController {
  let state = idleState

  return {
    getState: () => state,
    async submit(draft, idempotencyKey) {
      state = { ...state, status: "preparing", errorCode: null }
      try {
        const response = await api.createGeneration(createGenerationRequest(draft), idempotencyKey)
        state = receiptState(response.data)
      } catch {
        state = { ...state, status: "failed", errorCode: "generation_request_failed" }
      }
      return state
    },
  }
}

function receiptState(receipt: GenerationReceipt): GenerationControllerState {
  return {
    status: receipt.status,
    requestId: receipt.request_id,
    generationRef: receipt.generation_ref,
    errorCode: null,
  }
}

export const previewMoriApi: MoriApi = {
  async createGeneration(_input: GenerationCreateInput, idempotencyKey: string) {
    return {
      data: {
        request_id: `preview-request-${idempotencyKey}`,
        generation_ref: "generation_preview_first_light_next",
        status: "queued",
      },
      meta: {
        request_id: `preview-request-${idempotencyKey}`,
        received_at: "preview",
      },
    }
  },
}
