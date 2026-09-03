import type { GenerationStatus } from "./domain"
import { createGenerationRequest, type GenerationCreateInput, type GenerationReceipt, type LyricsRevisionInput, type MixRevisionInput, type MoriApi, type MoriExportInput, type MoriGenerationDraft, type MoriProjectCreateInput, type SongPlanCreateInput, type StemSeparationInput, type StudioChangeGenerationInput } from "@/lib/mori-api"
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

const previewExports = new Map<MoriRef, { versionRef: MoriRef; input: MoriExportInput }>()

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
  async createStudioChange(_versionRef: MoriRef, _input: StudioChangeGenerationInput, idempotencyKey: string) {
    return {
      data: {
        generation_ref: "generation_preview_first_light_change",
        status: "queued" as const,
      },
      meta: {
        request_id: `preview-change-request-${idempotencyKey}`,
      },
    }
  },
  async createLyricsRevision(_versionRef: MoriRef, _input: LyricsRevisionInput, idempotencyKey: string) {
    return {
      data: {
        lyrics_revision_ref: "lyrics_revision_preview_first_light",
        status: "queued" as const,
      },
      meta: {
        request_id: `preview-lyrics-revision-request-${idempotencyKey}`,
      },
    }
  },
  async getLyricsRevision(lyricsRevisionRef: MoriRef) {
    return {
      data: {
        lyrics_revision_ref: lyricsRevisionRef,
        version_ref: "version_preview_first_light_a",
        status: "succeeded" as const,
        progress: 100,
        direction: "rewrite" as const,
        scope: { type: "section" as const, section_label: "Chorus", start_line: 2, end_line: 4 },
        instruction: "Make the image more vivid while keeping the cadence.",
        constraints: ["meaning" as const, "cadence" as const],
        output_count: 2,
        source_digest: "preview-lyrics-source-digest",
        suggestions: [
          { suggestion_ref: "lyrics_suggestion_preview_1", text: "Every road becomes a rhythm\npulling open daylight into view" },
          { suggestion_ref: "lyrics_suggestion_preview_2", text: "Every mile opens into morning\nand carries all the daylight through" },
        ],
        created_at: "2026-09-03T12:00:00.000Z",
      },
      meta: {
        request_id: "preview-lyrics-revision-status-request",
      },
    }
  },
  async getLyricsRevisionEvents() {
    return []
  },
  async cancelLyricsRevision(lyricsRevisionRef: MoriRef) {
    return {
      data: {
        lyrics_revision_ref: lyricsRevisionRef,
        status: "cancelled" as const,
      },
      meta: {
        request_id: "preview-lyrics-revision-cancel-request",
      },
    }
  },
  async createStemSeparation(_versionRef: MoriRef, _input: StemSeparationInput, idempotencyKey: string) {
    return {
      data: {
        stem_separation_ref: "stem_separation_preview_first_light",
        status: "queued" as const,
      },
      meta: {
        request_id: `preview-stem-separation-request-${idempotencyKey}`,
      },
    }
  },
  async getStemSeparation(stemSeparationRef: MoriRef) {
    return {
      data: {
        stem_separation_ref: stemSeparationRef,
        version_ref: "version_preview_first_light_a",
        status: "succeeded" as const,
        progress: 100,
        mode: "auto_stems" as const,
        target_kinds: [],
        include_midi: true,
        source_audio_digest: "preview-stem-source-digest",
        stems: [
          { stem_ref: "stem_preview_vocals", kind: "vocals" as const, label: "Lead vocal", audio_asset_ref: "asset_preview_vocals", waveform_asset_ref: "waveform_preview_vocals", duration_seconds: 182 },
          { stem_ref: "stem_preview_backing", kind: "backing_vocals" as const, label: "Backing vocals", audio_asset_ref: "asset_preview_backing", waveform_asset_ref: "waveform_preview_backing", duration_seconds: 182 },
          { stem_ref: "stem_preview_drums", kind: "drums" as const, label: "Drums", audio_asset_ref: "asset_preview_drums", waveform_asset_ref: "waveform_preview_drums", duration_seconds: 182 },
          { stem_ref: "stem_preview_bass", kind: "bass" as const, label: "Bass", audio_asset_ref: "asset_preview_bass", waveform_asset_ref: "waveform_preview_bass", duration_seconds: 182 },
          { stem_ref: "stem_preview_other", kind: "other" as const, label: "Other", audio_asset_ref: "asset_preview_other", waveform_asset_ref: "waveform_preview_other", duration_seconds: 182 },
        ],
        midi_asset_ref: "asset_preview_midi",
        created_at: "2026-09-03T12:00:00.000Z",
      },
      meta: {
        request_id: "preview-stem-separation-status-request",
      },
    }
  },
  async getStemSeparationEvents() {
    return []
  },
  async cancelStemSeparation(stemSeparationRef: MoriRef) {
    return {
      data: {
        stem_separation_ref: stemSeparationRef,
        status: "cancelled" as const,
      },
      meta: {
        request_id: "preview-stem-separation-cancel-request",
      },
    }
  },
  async createMixRevision(versionRef: MoriRef, input: MixRevisionInput, idempotencyKey: string) {
    return {
      data: {
        mix_revision_ref: `mix_revision_preview_${idempotencyKey}`,
        version_ref: versionRef,
        source_stem_separation_ref: input.source_stem_separation_ref,
        name: input.name,
        revision: 1,
        tracks: input.tracks,
        created_at: "2026-09-03T12:01:00.000Z",
      },
      meta: {
        request_id: `preview-mix-revision-request-${idempotencyKey}`,
      },
    }
  },
  async getMixRevision(mixRevisionRef: MoriRef) {
    return {
      data: {
        mix_revision_ref: mixRevisionRef,
        version_ref: "version_preview_first_light_a",
        source_stem_separation_ref: "stem_separation_preview_first_light",
        name: "Stem mix",
        revision: 1,
        tracks: [
          { stem_ref: "stem_preview_vocals", gain: 1, muted: false },
          { stem_ref: "stem_preview_backing", gain: 1, muted: false },
          { stem_ref: "stem_preview_drums", gain: 1, muted: false },
          { stem_ref: "stem_preview_bass", gain: 1, muted: false },
          { stem_ref: "stem_preview_other", gain: 1, muted: false },
        ],
        created_at: "2026-09-03T12:01:00.000Z",
      },
      meta: {
        request_id: "preview-mix-revision-status-request",
      },
    }
  },
  async getGeneration(generationRef: MoriRef) {
    return {
      data: {
        generation_ref: generationRef,
        generation_kind: "new_song" as const,
        project_ref: "project_preview_first_light",
        song_plan_ref: "song_plan_preview_first_light",
        mode: "smart" as const,
        source_version_ref: null,
        operation: null,
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
  async createExport(versionRef: MoriRef, input: MoriExportInput, idempotencyKey: string) {
    const exportRef = `export_${idempotencyKey}`
    previewExports.set(exportRef, { versionRef, input })
    return {
      data: {
        export_ref: exportRef,
        status: "queued" as const,
      },
      meta: {
        request_id: `preview-export-request-${idempotencyKey}`,
      },
    }
  },
  async getExport(exportRef: MoriRef) {
    const tracked = previewExports.get(exportRef)
    return {
      data: {
        export_ref: exportRef,
        project_ref: "project_preview_first_light",
        version_ref: tracked?.versionRef ?? "version_preview_first_light_a",
        source: tracked?.input.source ?? { type: "version" as const },
        scope: tracked?.input.scope ?? { type: "full_song" as const },
        format: tracked?.input.format ?? "mp3" as const,
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
