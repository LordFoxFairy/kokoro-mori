import type { GenerationStatus } from "./domain"
import { createGenerationRequest, type GenerationCreateInput, type GenerationReceipt, type MoriApi, type MoriGenerationDraft } from "@/lib/mori-api"
import type { MoriRef } from "./domain"

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

export function createGenerationController(api: Pick<MoriApi, "createGeneration">, projectRef: MoriRef): GenerationController {
  let state = idleState

  return {
    getState: () => state,
    async submit(draft, idempotencyKey) {
      state = { ...state, status: "preparing", errorCode: null }
      try {
        const response = await api.createGeneration(projectRef, createGenerationRequest(draft), idempotencyKey)
        state = receiptState(response.data, response.meta.request_id)
      } catch {
        state = { ...state, status: "failed", errorCode: "generation_request_failed" }
      }
      return state
    },
  }
}

function receiptState(receipt: GenerationReceipt, requestId: string): GenerationControllerState {
  return {
    status: receipt.status,
    requestId,
    generationRef: receipt.generation_ref,
    errorCode: null,
  }
}

export const previewMoriApi: MoriApi = {
  async createGeneration(_projectRef: MoriRef, _input: GenerationCreateInput, idempotencyKey: string) {
    return {
      data: {
        generation_ref: "generation_preview_first_light_next",
        status: "queued",
      },
      meta: {
        request_id: `preview-request-${idempotencyKey}`,
      },
    }
  },
  async listLibrary() {
    return {
      data: {
        items: [],
        next_cursor: null,
      },
      meta: {
        request_id: "preview-library-request",
      },
    }
  },
  async createExport(_versionRef: MoriRef, _format: "mp3" | "wav", idempotencyKey: string) {
    return {
      data: {
        export_ref: `export_${idempotencyKey}`,
        status: "queued" as const,
      },
      meta: {
        request_id: `preview-export-request-${idempotencyKey}`,
      },
    }
  },
  async getExport(exportRef: MoriRef) {
    return {
      data: {
        export_ref: exportRef,
        project_ref: "project_preview_first_light",
        version_ref: "version_preview_first_light_a",
        format: "mp3" as const,
        status: "queued" as const,
        download_url: null,
        created_at: "2026-09-02T12:00:00.000Z",
      },
      meta: {
        request_id: "preview-export-status-request",
      },
    }
  },
}
