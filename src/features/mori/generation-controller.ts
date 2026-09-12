import type { GenerationStatus } from "./domain"
import { createGenerationRequest, type ArtworkGenerationInput, type CurrentSongPlanInput, type CurrentVersionInput, type GenerationCreateInput, type GenerationReceipt, type LyricsDraftInput, type LyricsRevisionInput, type MixRevisionInput, type MoriApi, type MoriCreativeSourceUploadInput, type MoriCreativeSourceUploadStatus, type MoriExportInput, type MoriGenerationDraft, type MoriProjectCreateInput, type MoriProjectWorkspaceOpenVersion, type MoriProjectWorkspaceProjection, type MoriReleaseDraft, type MoriShare, type ProjectWorkspaceOpenVersionInput, type ReleaseDraftInput, type SongPlanCreateInput, type StemSeparationInput, type StudioChangeGenerationInput } from "@/lib/mori-api"
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
const previewArtworkGenerations = new Map<MoriRef, { versionRef: MoriRef; input: ArtworkGenerationInput }>()
const previewReleaseDrafts = new Map<MoriRef, MoriReleaseDraft>()
const previewShares = new Map<MoriRef, MoriShare>()
const previewCurrentSongPlans = new Map<MoriRef, MoriProjectWorkspaceProjection["current_song_plan"]>()
const previewLyricsDrafts = new Map<MoriRef, MoriProjectWorkspaceProjection["latest_lyrics_draft"]>()
const previewOpenVersions = new Map<MoriRef, MoriProjectWorkspaceOpenVersion>()

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
  async getProjectWorkspace(projectRef: MoriRef) {
    return {
      data: previewProjectWorkspace(projectRef),
      meta: { request_id: `preview-project-workspace-request-${projectRef}` },
    }
  },
  async putCurrentVersion(projectRef: MoriRef, input: CurrentVersionInput, idempotencyKey: string) {
    return {
      data: {
        project_ref: projectRef,
        current_version_ref: input.version_ref,
        source_candidate_ref: input.candidate_ref,
        previous_version_ref: input.expected_current_version_ref,
        selected_at: "2026-09-03T19:55:00.000Z",
      },
      meta: {
        request_id: `preview-current-version-request-${idempotencyKey}`,
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
  async putCurrentSongPlan(projectRef: MoriRef, input: CurrentSongPlanInput, idempotencyKey: string) {
    const previous = previewCurrentSongPlans.get(projectRef)
    previewCurrentSongPlans.set(projectRef, {
      song_plan_ref: previous?.song_plan_ref ?? `song_plan_preview_${projectRef}`,
      project_ref: projectRef,
      revision: (previous?.revision ?? 0) + 1,
      prompt: input.prompt,
      mood: input.mood,
      tempo_bpm: input.tempo_bpm,
      structure: input.structure,
      instruments: input.instruments,
      vocal_direction: input.vocal_direction,
      lyrics_intent: input.lyrics_intent,
      created_at: "2026-09-04T18:10:00.000Z",
    })
    return { data: previewProjectWorkspace(projectRef), meta: { request_id: `preview-song-plan-save-request-${idempotencyKey}` } }
  },
  async putLyricsDraft(versionRef: MoriRef, input: LyricsDraftInput, idempotencyKey: string) {
    const projectRef = "project_preview_first_light"
    const previous = previewLyricsDrafts.get(versionRef)
    previewLyricsDrafts.set(versionRef, {
      lyrics_draft_ref: previous?.lyrics_draft_ref ?? `lyrics_draft_preview_${versionRef}`,
      project_ref: projectRef,
      version_ref: versionRef,
      revision: (previous?.revision ?? 0) + 1,
      text: input.text,
      source_digest: `preview-lyrics-digest-${(previous?.revision ?? 0) + 1}`,
      updated_at: "2026-09-04T18:11:00.000Z",
    })
    previewOpenVersions.set(projectRef, previewOpenVersion(projectRef, versionRef))
    return { data: previewProjectWorkspace(projectRef), meta: { request_id: `preview-lyrics-draft-save-request-${idempotencyKey}` } }
  },
  async putProjectWorkspaceOpenVersion(projectRef: MoriRef, input: ProjectWorkspaceOpenVersionInput, idempotencyKey: string) {
    previewOpenVersions.set(projectRef, previewOpenVersion(projectRef, input.version_ref))
    return { data: previewProjectWorkspace(projectRef), meta: { request_id: `preview-open-version-save-request-${idempotencyKey}` } }
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
  async createArtworkGeneration(versionRef: MoriRef, input: ArtworkGenerationInput, idempotencyKey: string) {
    const artworkGenerationRef = `artwork_generation_preview_${idempotencyKey}`
    previewArtworkGenerations.set(artworkGenerationRef, { versionRef, input })
    return {
      data: { artwork_generation_ref: artworkGenerationRef, status: "queued" as const },
      meta: { request_id: `preview-artwork-request-${idempotencyKey}` },
    }
  },
  async getArtworkGeneration(artworkGenerationRef: MoriRef) {
    const tracked = previewArtworkGenerations.get(artworkGenerationRef)
    const input = tracked?.input ?? {
      prompt: "Warm dawn through a train window",
      style: "editorial" as const,
      palette: "warm_dawn" as const,
      aspect_ratio: "1:1" as const,
      text_policy: "no_text" as const,
      output_count: 4 as const,
    }
    return {
      data: {
        artwork_generation_ref: artworkGenerationRef,
        version_ref: tracked?.versionRef ?? "version_preview_first_light_a",
        status: "succeeded" as const,
        progress: 100,
        ...input,
        candidates: Array.from({ length: 4 }, (_, index) => ({
          artwork_candidate_ref: `artwork_candidate_preview_${index + 1}`,
          image_asset_ref: `asset_artwork_preview_${index + 1}`,
          thumbnail_asset_ref: `asset_artwork_preview_thumb_${index + 1}`,
          alt_text: `Warm abstract dawn artwork concept ${index + 1}`,
        })),
        created_at: "2026-09-03T12:02:00.000Z",
      },
      meta: { request_id: "preview-artwork-status-request" },
    }
  },
  async getArtworkGenerationEvents() {
    return []
  },
  async cancelArtworkGeneration(artworkGenerationRef: MoriRef) {
    return {
      data: { artwork_generation_ref: artworkGenerationRef, status: "cancelled" as const },
      meta: { request_id: "preview-artwork-cancel-request" },
    }
  },
  async getReleaseDraft(versionRef: MoriRef) {
    const saved = previewReleaseDrafts.get(versionRef)
    return {
      data: saved ?? {
        release_draft_ref: `release_draft_preview_${versionRef}`,
        version_ref: versionRef,
        revision: 1,
        state: "draft" as const,
        title: "First Light",
        description: "",
        visibility: "private" as const,
        allow_remix: false,
        explicit_content: false,
        artwork: { type: "current" as const },
        updated_at: "2026-09-03T12:03:00.000Z",
      },
      meta: { request_id: "preview-release-read-request" },
    }
  },
  async putReleaseDraft(versionRef: MoriRef, input: ReleaseDraftInput, idempotencyKey: string) {
    const saved: MoriReleaseDraft = {
      release_draft_ref: previewReleaseDrafts.get(versionRef)?.release_draft_ref ?? `release_draft_preview_${versionRef}`,
      version_ref: versionRef,
      revision: (input.expected_revision ?? 0) + 1,
      state: "draft",
      title: input.title,
      description: input.description,
      visibility: input.visibility,
      allow_remix: input.allow_remix,
      explicit_content: input.explicit_content,
      artwork: input.artwork,
      updated_at: "2026-09-03T12:04:00.000Z",
    }
    previewReleaseDrafts.set(versionRef, saved)
    return { data: saved, meta: { request_id: `preview-release-save-request-${idempotencyKey}` } }
  },
  async publishRelease(versionRef: MoriRef, input, idempotencyKey) {
    return { data: { release_ref: `release_preview_${idempotencyKey}`, version_ref: versionRef, status: "published" as const, public_url: `https://mori.local/release/${idempotencyKey}`, created_at: "2026-09-05T12:00:00.000Z" }, meta: { request_id: `preview-release-publish-${idempotencyKey}` } }
  },
  async getRelease(releaseRef) {
    return { data: { release_ref: releaseRef, version_ref: "version_preview_first_light_a", release_draft_ref: "release_draft_preview", status: "published" as const, public_url: `https://mori.local/release/${releaseRef}`, created_at: "2026-09-05T12:00:00.000Z", updated_at: "2026-09-05T12:00:00.000Z" }, meta: { request_id: `preview-release-${releaseRef}` } }
  },
  async unpublishRelease(releaseRef) {
    return { data: { release_ref: releaseRef, version_ref: "version_preview_first_light_a", release_draft_ref: "release_draft_preview", status: "unpublished" as const, public_url: null, created_at: "2026-09-05T12:00:00.000Z", updated_at: "2026-09-05T12:00:00.000Z" }, meta: { request_id: `preview-release-unpublish-${releaseRef}` } }
  },
  async createShare(versionRef, input, idempotencyKey) {
    const existing = previewShares.get(versionRef)
    const share: MoriShare = {
      share_ref: existing?.share_ref ?? `share_preview_${idempotencyKey}`,
      version_ref: versionRef,
      release_draft_ref: input.release_draft_ref,
      status: "active",
      share_url: `https://mori.local/share/${existing?.share_ref ?? `share_preview_${idempotencyKey}`}`,
      created_at: "2026-09-12T12:00:00.000Z",
      updated_at: "2026-09-12T12:00:00.000Z",
    }
    previewShares.set(versionRef, share)
    return { data: share, meta: { request_id: `preview-share-create-${idempotencyKey}` } }
  },
  async getShare(shareRef) {
    const share = [...previewShares.values()].find((candidate) => candidate.share_ref === shareRef) ?? {
      share_ref: shareRef,
      version_ref: "version_preview_first_light_a",
      release_draft_ref: "release_draft_preview",
      status: "active" as const,
      share_url: `https://mori.local/share/${shareRef}`,
      created_at: "2026-09-12T12:00:00.000Z",
      updated_at: "2026-09-12T12:00:00.000Z",
    }
    return { data: share, meta: { request_id: `preview-share-read-${shareRef}` } }
  },
  async revokeShare(shareRef) {
    const current = [...previewShares.entries()].find(([, share]) => share.share_ref === shareRef)
    const share: MoriShare = {
      share_ref: shareRef,
      version_ref: current?.[1].version_ref ?? "version_preview_first_light_a",
      release_draft_ref: current?.[1].release_draft_ref ?? "release_draft_preview",
      status: "revoked",
      share_url: null,
      created_at: current?.[1].created_at ?? "2026-09-12T12:00:00.000Z",
      updated_at: "2026-09-12T12:00:00.000Z",
    }
    if (current !== undefined) previewShares.set(current[0], share)
    return { data: share, meta: { request_id: `preview-share-revoke-${shareRef}` } }
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
          { stem_ref: "stem_preview_vocals", gain: 1, muted: false, pan: 0 },
          { stem_ref: "stem_preview_backing", gain: 1, muted: false, pan: 0 },
          { stem_ref: "stem_preview_drums", gain: 1, muted: false, pan: 0 },
          { stem_ref: "stem_preview_bass", gain: 1, muted: false, pan: 0 },
          { stem_ref: "stem_preview_other", gain: 1, muted: false, pan: 0 },
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
        output_count: 2,
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
  async listCreativeSources() {
    return {
      data: {
        sources: [],
        next_cursor: null,
      },
      meta: {
        request_id: "preview-creative-sources-request",
      },
    }
  },
  async getCreativeSource() {
    throw new Error("preview_creative_source_not_found")
  },
  async createCreativeSourceUpload(_input: MoriCreativeSourceUploadInput, idempotencyKey: string) {
    return { data: { upload_ref: `upload_preview_${idempotencyKey}`, status: "creating" as const, expires_at: "2026-09-06T12:00:00.000Z" }, meta: { request_id: `preview-upload-create-${idempotencyKey}` } }
  },
  async uploadCreativeSourceContent(uploadRef, body, _contentType, _signal) {
    void _contentType
    void _signal
    const byteSize = typeof body === "string" ? body.length : body instanceof ArrayBuffer ? body.byteLength : 1
    return { data: { upload_ref: uploadRef, source_kind: "audio" as const, status: "ready" as MoriCreativeSourceUploadStatus, bytes_received: byteSize, byte_size: Math.max(1, byteSize), asset_ref: `asset_${uploadRef}`, source_ref: `source_${uploadRef}`, error: null, created_at: "2026-09-05T12:00:00.000Z", updated_at: "2026-09-05T12:00:01.000Z", expires_at: "2026-09-06T12:00:00.000Z" }, meta: { request_id: `preview-upload-content-${uploadRef}` } }
  },
  async getCreativeSourceUpload(uploadRef) {
    return { data: { upload_ref: uploadRef, source_kind: "audio" as const, status: "ready" as const, bytes_received: 1, byte_size: 1, asset_ref: `asset_${uploadRef}`, source_ref: `source_${uploadRef}`, error: null, created_at: "2026-09-05T12:00:00.000Z", updated_at: "2026-09-05T12:00:01.000Z", expires_at: "2026-09-06T12:00:00.000Z" }, meta: { request_id: `preview-upload-status-${uploadRef}` } }
  },
  async cancelCreativeSourceUpload(uploadRef, _idempotencyKey) {
    void _idempotencyKey
    return { data: { upload_ref: uploadRef, source_kind: "audio" as const, status: "cancelled" as const, bytes_received: 0, byte_size: 1, asset_ref: null, source_ref: null, error: null, created_at: "2026-09-05T12:00:00.000Z", updated_at: "2026-09-05T12:00:01.000Z", expires_at: "2026-09-06T12:00:00.000Z" }, meta: { request_id: `preview-upload-cancel-${uploadRef}` } }
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
  async createCompositionRevision(versionRef, _input, idempotencyKey) {
    return {
      data: { version_ref: versionRef, revision: 1, tracks: [] },
      meta: { request_id: `preview-composition-request-${idempotencyKey}` },
    }
  },
  async getCompositionRevision(versionRef) {
    return {
      data: { version_ref: versionRef, revision: 1, tracks: [] },
      meta: { request_id: `preview-composition-load-request-${versionRef}` },
    }
  },
}

function previewProjectWorkspace(projectRef: MoriRef): MoriProjectWorkspaceProjection {
  const knownProject = projectRef === "project_preview_first_light"
  const openVersion = previewOpenVersions.get(projectRef) ?? (knownProject ? previewOpenVersion(projectRef, "version_preview_first_light_a") : null)
  const currentSongPlan = previewCurrentSongPlans.get(projectRef) ?? (knownProject
    ? {
        song_plan_ref: "song_plan_preview_first_light",
        project_ref: projectRef,
        revision: 1,
        prompt: "A warm, late-night track for the drive home, slowly opening into sunrise.",
        mood: "Warm · hopeful",
        tempo_bpm: 102,
        structure: ["Intro", "Verse", "Lift", "Chorus", "Outro"],
        instruments: ["Soft synth", "Muted guitar", "Brush drums"],
        vocal_direction: "Intimate lead vocal with a gentle lift in the chorus",
        lyrics_intent: "Small moments becoming a reason to keep going",
        created_at: "2026-09-04T18:00:00.000Z",
      }
    : null)
  const latestLyricsDraft = openVersion === null ? null : previewLyricsDrafts.get(openVersion.version_ref) ?? (knownProject && openVersion.version_ref === "version_preview_first_light_a"
    ? {
        lyrics_draft_ref: "lyrics_draft_preview_first_light_a",
        project_ref: projectRef,
        version_ref: openVersion.version_ref,
        revision: 1,
        text: "Meet me where the streetlights fade\nWe can carry daylight home",
        source_digest: "preview-lyrics-digest-first-light-a-1",
        updated_at: "2026-09-04T18:01:00.000Z",
      }
    : null)
  return {
    project: {
      project_ref: projectRef,
      title: knownProject ? "First Light" : "Project",
      description: knownProject ? "A bright, patient song about finding your way home." : "Project workspace preview.",
      current_version_ref: knownProject ? "version_preview_first_light_a" : null,
      candidate_count: knownProject ? 2 : 0,
      last_activity_at: "2026-09-04T18:12:00.000Z",
    },
    current_song_plan: currentSongPlan,
    open_version: openVersion,
    latest_lyrics_draft: latestLyricsDraft,
    latest_mix_revision: openVersion?.version_ref === "version_preview_first_light_a"
      ? {
          mix_revision_ref: "mix_revision_preview_first_light_a",
          version_ref: openVersion.version_ref,
          revision: 1,
          name: "First Light · base mix",
          track_count: 5,
          created_at: "2026-09-04T18:02:00.000Z",
        }
      : null,
    active_tasks: [],
    revision_cursor: `preview-workspace-${projectRef}-${openVersion?.revision ?? 0}-${currentSongPlan?.revision ?? 0}`,
    observed_at: "2026-09-04T18:12:00.000Z",
  }
}

function previewOpenVersion(projectRef: MoriRef, versionRef: MoriRef): MoriProjectWorkspaceOpenVersion {
  const previous = previewOpenVersions.get(projectRef)
  return {
    project_ref: projectRef,
    version_ref: versionRef,
    revision: (previous?.revision ?? 0) + 1,
    updated_at: "2026-09-04T18:12:00.000Z",
  }
}
