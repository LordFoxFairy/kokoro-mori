import type { GenerationStatus } from "./domain"
import { createGenerationRequest, type GenerationCreateInput, type GenerationReceipt, type MoriApi, type MoriGenerationDraft, type MoriProjectCreateInput, type SongPlanCreateInput } from "@/lib/mori-api"
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
  async listProjects() {
    return {
      data: {
        projects: [],
        next_cursor: null,
      },
      meta: {
        request_id: "preview-projects-request",
      },
    }
  },
  async createProject(input: MoriProjectCreateInput, idempotencyKey: string) {
    return {
      data: {
        project_ref: `project_preview_${idempotencyKey}`,
        title: input.title,
        description: input.description,
        current_version_ref: null,
        candidate_count: 0,
        last_activity_at: "2026-09-02T12:00:00.000Z",
      },
      meta: {
        request_id: `preview-project-create-request-${idempotencyKey}`,
      },
    }
  },
  async getProject() {
    return {
      data: {
        project_ref: "project_preview_first_light",
        title: "First Light",
        description: "A bright, patient song about finding your way home.",
        current_version_ref: "version_preview_first_light_a",
        candidate_count: 2,
        last_activity_at: "2026-09-02T12:00:00.000Z",
      },
      meta: {
        request_id: "preview-project-request",
      },
    }
  },
  async createSongPlan(projectRef: MoriRef, input: SongPlanCreateInput, idempotencyKey: string) {
    return {
      data: {
        ...input,
        song_plan_ref: `song_plan_preview_${idempotencyKey}`,
        project_ref: projectRef,
        created_at: "2026-09-02T12:00:00.000Z",
      },
      meta: {
        request_id: `preview-song-plan-request-${idempotencyKey}`,
      },
    }
  },
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
  async getGeneration(generationRef: MoriRef) {
    return {
      data: {
        generation_ref: generationRef,
        project_ref: "project_preview_first_light",
        song_plan_ref: "song_plan_preview_first_light",
        mode: "smart" as const,
        status: "queued" as const,
        progress: 0,
        candidate_refs: [],
        created_at: "2026-09-02T12:00:00.000Z",
      },
      meta: {
        request_id: "preview-generation-status-request",
      },
    }
  },
  async getGenerationEvents() {
    return []
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
  async listCandidates() {
    return {
      data: {
        candidates: [],
        next_cursor: null,
      },
      meta: {
        request_id: "preview-candidates-request",
      },
    }
  },
  async cancelGeneration(generationRef: MoriRef) {
    return {
      data: {
        generation_ref: generationRef,
        status: "cancelled" as const,
      },
      meta: {
        request_id: "preview-generation-cancel-request",
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
