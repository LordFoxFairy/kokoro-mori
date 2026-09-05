"use client"

import { useEffect, useRef, useState } from "react"
import type { MoriApi, ReleaseDraftInput } from "@/lib/mori-api"
import { MoriApiRequestError } from "@/lib/mori-api-client"
import {
  artworkSnapshotMatchesPlan,
  createArtworkGenerationRequest,
  createInitialStudioReleaseDraft,
  createReleaseDraftRequest,
  idleStudioArtworkRun,
  idleStudioReleaseSave,
  isActiveArtworkGenerationStatus,
  releaseDraftMatchesInput,
  studioReleaseDraftFromSnapshot,
  type StudioArtworkDraft,
  type StudioFinishView,
  type StudioArtworkPlan,
  type StudioArtworkRunState,
  type StudioReleaseDraft,
  type StudioReleaseSaveState,
  idleStudioReleasePublish,
  type StudioReleasePublishState,
  type TrackedArtworkGeneration,
} from "./studio-release"

type StudioReleaseApi = Pick<
  MoriApi,
  | "createArtworkGeneration"
  | "getArtworkGeneration"
  | "getArtworkGenerationEvents"
  | "cancelArtworkGeneration"
  | "getReleaseDraft"
  | "putReleaseDraft"
  | "publishRelease"
  | "getRelease"
  | "unpublishRelease"
>

type PendingReleaseCommand = {
  versionRef: string
  input: ReleaseDraftInput
  idempotencyKey: string
}
const releasePublishRecoveryKey = "mori-release-publish-recovery-v1"

type UseStudioReleaseWorkflowInput = {
  versionRef: string | null
  versionTitle: string
  api: StudioReleaseApi
}

export type StudioReleaseWorkflow = {
  finishView: StudioFinishView
  setFinishView: (view: StudioFinishView) => void
  releaseDraft: StudioReleaseDraft
  artworkDraft: StudioArtworkDraft
  artworkRun: StudioArtworkRunState
  releaseSave: StudioReleaseSaveState
  releasePublish: StudioReleasePublishState
  active: boolean
  activityDescription: string | null
  updateReleaseDraft: (draft: StudioReleaseDraft) => void
  updateArtworkDraft: (draft: StudioArtworkDraft) => void
  generateArtwork: (plan: StudioArtworkPlan) => Promise<void>
  cancelArtwork: () => Promise<void>
  resetArtwork: () => void
  saveReleaseDraft: (draft: StudioReleaseDraft) => Promise<void>
  publishRelease: () => Promise<void>
  unpublishRelease: () => Promise<void>
}

export function useStudioReleaseWorkflow({ versionRef, versionTitle, api }: UseStudioReleaseWorkflowInput): StudioReleaseWorkflow {
  const [finishView, setFinishView] = useState<StudioFinishView>("remaster")
  const [releaseDraft, setReleaseDraft] = useState<StudioReleaseDraft>(() => createInitialStudioReleaseDraft(versionTitle))
  const [artworkDraft, setArtworkDraft] = useState<StudioArtworkDraft>({ prompt: "", style: "abstract", palette: "warm_dawn" })
  const [artworkRun, setArtworkRun] = useState<StudioArtworkRunState>(idleStudioArtworkRun)
  const [trackedArtworkGeneration, setTrackedArtworkGeneration] = useState<TrackedArtworkGeneration | null>(null)
  const [releaseSave, setReleaseSave] = useState<StudioReleaseSaveState>(idleStudioReleaseSave)
  const [releasePublish, setReleasePublish] = useState<StudioReleasePublishState>(idleStudioReleasePublish)
  const activeVersionRef = useRef(versionRef)
  const versionContextEpoch = useRef(0)
  const artworkCommandEpoch = useRef(0)
  const releaseCommandEpoch = useRef(0)
  const releaseDraftDirty = useRef(false)
  const pendingReleaseCommand = useRef<PendingReleaseCommand | null>(null)
  const pendingPublishCommand = useRef<{ versionRef: string; draftRef: string; revision: number; idempotencyKey: string } | null>(null)
  const activeArtworkEventRequest = useRef<{ artworkGenerationRef: string; controller: AbortController } | null>(null)
  activeVersionRef.current = versionRef

  useEffect(() => {
    versionContextEpoch.current += 1
    artworkCommandEpoch.current += 1
    releaseCommandEpoch.current += 1
    releaseDraftDirty.current = false
    pendingReleaseCommand.current = null
    pendingPublishCommand.current = null
    activeArtworkEventRequest.current?.controller.abort()
    activeArtworkEventRequest.current = null
    setFinishView("remaster")
    setReleaseDraft(createInitialStudioReleaseDraft(versionTitle))
    setArtworkDraft({ prompt: "", style: "abstract", palette: "warm_dawn" })
    setArtworkRun(idleStudioArtworkRun)
    setTrackedArtworkGeneration(null)
    setReleaseSave(idleStudioReleaseSave)
    setReleasePublish(idleStudioReleasePublish)
  }, [versionRef, versionTitle])

  useEffect(() => {
    if (versionRef === null) return
    const sourceVersionRef = versionRef
    const contextEpoch = versionContextEpoch.current
    let disposed = false

    void api.getReleaseDraft(sourceVersionRef).then((response) => {
      if (
        disposed
        || versionContextEpoch.current !== contextEpoch
        || activeVersionRef.current !== sourceVersionRef
        || releaseDraftDirty.current
        || response.data.version_ref !== sourceVersionRef
        || response.data.state !== "draft"
      ) return
      setReleaseDraft(studioReleaseDraftFromSnapshot(response.data))
      setReleaseSave({ status: "idle", snapshot: response.data, message: null })
    }).catch(() => {
      // A release draft is optional; keep the private Version-derived draft when none exists yet.
    })

    return () => {
      disposed = true
    }
  }, [api, versionRef])

  useEffect(() => {
    if (versionRef === null || api.getRelease === undefined) return
    let disposed = false
    try {
      const stored = JSON.parse(window.localStorage.getItem(releasePublishRecoveryKey) ?? "null") as { versionRef?: string; releaseRef?: string } | null
      if (stored?.versionRef !== versionRef || stored.releaseRef === undefined) return
      void api.getRelease(stored.releaseRef).then((response) => {
        if (disposed || activeVersionRef.current !== versionRef) return
        setReleasePublish({ status: response.data.status, releaseRef: response.data.release_ref, publicUrl: response.data.public_url, message: null })
      }).catch(() => undefined)
    } catch {
      window.localStorage.removeItem(releasePublishRecoveryKey)
    }
    return () => { disposed = true }
  }, [api, versionRef])

  const generateArtwork = async (plan: StudioArtworkPlan) => {
    const sourceVersionRef = activeVersionRef.current
    if (sourceVersionRef === null || isActiveArtworkGenerationStatus(artworkRun.status)) return
    const commandEpoch = artworkCommandEpoch.current + 1
    artworkCommandEpoch.current = commandEpoch
    setTrackedArtworkGeneration(null)
    setArtworkRun({
      status: "preparing",
      artworkGenerationRef: null,
      progress: 4,
      plan,
      candidates: [],
      message: null,
    })
    try {
      const response = await api.createArtworkGeneration(
        sourceVersionRef,
        createArtworkGenerationRequest(plan),
        `mori-artwork-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      )
      if (artworkCommandEpoch.current !== commandEpoch || activeVersionRef.current !== sourceVersionRef) return
      const tracked: TrackedArtworkGeneration = {
        artworkGenerationRef: response.data.artwork_generation_ref,
        sourceVersionRef,
        plan,
      }
      setArtworkRun({
        status: response.data.status,
        artworkGenerationRef: response.data.artwork_generation_ref,
        progress: response.data.status === "queued" ? 0 : 12,
        plan,
        candidates: [],
        message: null,
      })
      setTrackedArtworkGeneration(tracked)
    } catch (error) {
      if (artworkCommandEpoch.current !== commandEpoch || activeVersionRef.current !== sourceVersionRef) return
      setArtworkRun({
        status: "failed",
        artworkGenerationRef: null,
        progress: 0,
        plan,
        candidates: [],
        message: artworkGenerationFailureMessage(error),
      })
    }
  }

  useEffect(() => {
    if (trackedArtworkGeneration === null) return
    const tracked = trackedArtworkGeneration
    const commandEpoch = artworkCommandEpoch.current
    let disposed = false
    let timer: number | undefined
    let eventTimeout: number | undefined
    let eventController: AbortController | null = null
    let lastEventId: string | null = null
    const isCurrent = () => !disposed
      && artworkCommandEpoch.current === commandEpoch
      && activeVersionRef.current === tracked.sourceVersionRef

    const syncArtwork = async () => {
      if (!isCurrent()) return
      try {
        const response = await api.getArtworkGeneration(tracked.artworkGenerationRef)
        if (!isCurrent()) return
        const snapshot = response.data
        if (!artworkSnapshotMatchesPlan(snapshot, tracked)) {
          throw new Error("artwork_generation_snapshot_context_mismatch")
        }

        if (snapshot.status === "succeeded") {
          if (snapshot.candidates.length !== tracked.plan.outputCount) {
            throw new Error("artwork_generation_snapshot_context_mismatch")
          }
          setArtworkRun({
            status: "succeeded",
            artworkGenerationRef: tracked.artworkGenerationRef,
            progress: 100,
            plan: tracked.plan,
            candidates: snapshot.candidates,
            message: null,
          })
          setTrackedArtworkGeneration(null)
          return
        }

        if (snapshot.status === "failed" || snapshot.status === "cancelled" || snapshot.status === "expired") {
          setArtworkRun({
            status: snapshot.status,
            artworkGenerationRef: tracked.artworkGenerationRef,
            progress: snapshot.progress,
            plan: tracked.plan,
            candidates: [],
            message: artworkGenerationTerminalMessage(snapshot.status),
          })
          setTrackedArtworkGeneration(null)
          return
        }

        let status = snapshot.status
        let progress = snapshot.progress
        try {
          eventController = new AbortController()
          activeArtworkEventRequest.current = { artworkGenerationRef: tracked.artworkGenerationRef, controller: eventController }
          eventTimeout = window.setTimeout(() => eventController?.abort(), 650)
          const events = await api.getArtworkGenerationEvents(tracked.artworkGenerationRef, lastEventId, eventController.signal)
          if (!isCurrent()) return
          const latest = events.at(-1)
          if (
            latest !== undefined
            && latest.data.artwork_generation_ref === tracked.artworkGenerationRef
            && latest.data.version_ref === tracked.sourceVersionRef
            && (latest.data.status === "queued" || latest.data.status === "generating" || latest.data.status === "post_processing")
          ) {
            lastEventId = latest.id
            status = latest.data.status
            progress = latest.data.progress
          }
        } catch {
          // Durable snapshot polling remains authoritative when event replay is unavailable.
        } finally {
          if (eventTimeout !== undefined) window.clearTimeout(eventTimeout)
          eventTimeout = undefined
          if (activeArtworkEventRequest.current?.controller === eventController) activeArtworkEventRequest.current = null
          eventController = null
        }

        if (!isCurrent()) return
        setArtworkRun((current) => ({ ...current, status, progress, message: null }))
        timer = window.setTimeout(() => { void syncArtwork() }, 800)
      } catch (error) {
        if (!isCurrent()) return
        setArtworkRun({
          status: "failed",
          artworkGenerationRef: tracked.artworkGenerationRef,
          progress: 0,
          plan: tracked.plan,
          candidates: [],
          message: artworkGenerationFailureMessage(error),
        })
        setTrackedArtworkGeneration(null)
      }
    }

    void syncArtwork()
    return () => {
      disposed = true
      if (timer !== undefined) window.clearTimeout(timer)
      if (eventTimeout !== undefined) window.clearTimeout(eventTimeout)
      eventController?.abort()
      if (activeArtworkEventRequest.current?.controller === eventController) activeArtworkEventRequest.current = null
    }
  }, [api, trackedArtworkGeneration])

  const cancelArtwork = async () => {
    if (trackedArtworkGeneration === null) return
    const tracked = trackedArtworkGeneration
    artworkCommandEpoch.current += 1
    const eventRequest = activeArtworkEventRequest.current
    if (eventRequest?.artworkGenerationRef === tracked.artworkGenerationRef) eventRequest.controller.abort()
    setTrackedArtworkGeneration(null)
    setArtworkRun((current) => ({ ...current, message: "Stopping after the current image step…" }))
    try {
      const response = await api.cancelArtworkGeneration(
        tracked.artworkGenerationRef,
        `mori-artwork-cancel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      )
      if (activeVersionRef.current !== tracked.sourceVersionRef) return
      const status = response.data.status
      setArtworkRun((current) => ({
        ...current,
        status,
        progress: Math.min(current.progress, 99),
        message: status === "failed" || status === "cancelled" || status === "expired"
          ? artworkGenerationTerminalMessage(status)
          : null,
      }))
      if (isActiveArtworkGenerationStatus(status)) setTrackedArtworkGeneration(tracked)
    } catch {
      if (activeVersionRef.current !== tracked.sourceVersionRef) return
      setArtworkRun((current) => ({ ...current, message: "Cancellation did not complete. This artwork set is still being tracked." }))
      setTrackedArtworkGeneration(tracked)
    }
  }

  const resetArtwork = () => {
    if (isActiveArtworkGenerationStatus(artworkRun.status)) return
    artworkCommandEpoch.current += 1
    activeArtworkEventRequest.current?.controller.abort()
    activeArtworkEventRequest.current = null
    setTrackedArtworkGeneration(null)
    setArtworkRun(idleStudioArtworkRun)
  }

  const updateReleaseDraft = (draft: StudioReleaseDraft) => {
    releaseCommandEpoch.current += 1
    releaseDraftDirty.current = true
    setReleaseDraft(draft)
    setReleaseSave((current) => ({ status: "idle", snapshot: current.snapshot, message: null }))
  }

  const saveReleaseDraft = async (draft: StudioReleaseDraft) => {
    const sourceVersionRef = activeVersionRef.current
    if (sourceVersionRef === null || releaseSave.status === "saving") return
    const expectedRevision = releaseSave.snapshot?.version_ref === sourceVersionRef ? releaseSave.snapshot.revision : null
    let input: ReleaseDraftInput
    try {
      input = createReleaseDraftRequest(draft, expectedRevision)
    } catch {
      setReleaseSave((current) => ({ ...current, status: "failed", message: "Review the required release details before saving." }))
      return
    }
    const previousCommand = pendingReleaseCommand.current
    const idempotencyKey = previousCommand !== null
      && previousCommand.versionRef === sourceVersionRef
      && releaseInputsMatch(previousCommand.input, input)
      ? previousCommand.idempotencyKey
      : `mori-release-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const commandEpoch = releaseCommandEpoch.current + 1
    releaseCommandEpoch.current = commandEpoch
    pendingReleaseCommand.current = { versionRef: sourceVersionRef, input, idempotencyKey }
    setReleaseSave((current) => ({ status: "saving", snapshot: current.snapshot, message: null }))
    try {
      const response = await api.putReleaseDraft(sourceVersionRef, input, idempotencyKey)
      if (releaseCommandEpoch.current !== commandEpoch || activeVersionRef.current !== sourceVersionRef) return
      if (!releaseDraftMatchesInput(response.data, sourceVersionRef, input)) {
        throw new Error("release_draft_context_mismatch")
      }
      pendingReleaseCommand.current = null
      releaseDraftDirty.current = false
      setReleaseDraft(studioReleaseDraftFromSnapshot(response.data))
      setReleaseSave({ status: "saved", snapshot: response.data, message: null })
    } catch (error) {
      if (releaseCommandEpoch.current !== commandEpoch || activeVersionRef.current !== sourceVersionRef) return
      setReleaseSave((current) => ({
        status: "failed",
        snapshot: current.snapshot,
        message: releaseDraftFailureMessage(error),
      }))
    }
  }

  const publishRelease = async () => {
    const sourceVersionRef = activeVersionRef.current
    const snapshot = releaseSave.snapshot
    if (sourceVersionRef === null || snapshot === null || releaseSave.status !== "saved" || api.publishRelease === undefined) return
    setReleasePublish((current) => ({ ...current, status: "publishing", message: null }))
    try {
      const previous = pendingPublishCommand.current
      const command = previous !== null && previous.versionRef === sourceVersionRef && previous.draftRef === snapshot.release_draft_ref && previous.revision === snapshot.revision
        ? previous
        : { versionRef: sourceVersionRef, draftRef: snapshot.release_draft_ref, revision: snapshot.revision, idempotencyKey: `mori-publish-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }
      pendingPublishCommand.current = command
      const response = await api.publishRelease(sourceVersionRef, { release_draft_ref: command.draftRef, expected_draft_revision: command.revision }, command.idempotencyKey)
      pendingPublishCommand.current = null
      setReleasePublish({ status: response.data.status, releaseRef: response.data.release_ref, publicUrl: response.data.public_url, message: null })
      window.localStorage.setItem(releasePublishRecoveryKey, JSON.stringify({ versionRef: sourceVersionRef, releaseRef: response.data.release_ref }))
    } catch { setReleasePublish((current) => ({ ...current, status: "failed", message: "Publish needs another try." })) }
  }

  const unpublishRelease = async () => {
    if (releasePublish.releaseRef === null || api.unpublishRelease === undefined) return
    try {
      const response = await api.unpublishRelease(releasePublish.releaseRef, `mori-unpublish-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
      setReleasePublish((current) => ({ ...current, status: response.data.status, publicUrl: response.data.public_url, message: null }))
      window.localStorage.removeItem(releasePublishRecoveryKey)
    } catch { setReleasePublish((current) => ({ ...current, status: "failed", message: "Unpublish needs another try." })) }
  }

  const active = isActiveArtworkGenerationStatus(artworkRun.status) || releaseSave.status === "saving"
  const activityDescription = isActiveArtworkGenerationStatus(artworkRun.status)
    ? "Release artwork is being created"
    : releaseSave.status === "saving"
      ? "Release draft is being saved"
      : null

  return {
    finishView,
    setFinishView,
    releaseDraft,
    artworkDraft,
    artworkRun,
    releaseSave,
    releasePublish,
    active,
    activityDescription,
    updateReleaseDraft,
    updateArtworkDraft: setArtworkDraft,
    generateArtwork,
    cancelArtwork,
    resetArtwork,
    saveReleaseDraft,
    publishRelease,
    unpublishRelease,
  }
}

function releaseInputsMatch(left: ReleaseDraftInput, right: ReleaseDraftInput): boolean {
  if (
    left.title !== right.title
    || left.description !== right.description
    || left.visibility !== right.visibility
    || left.allow_remix !== right.allow_remix
    || left.explicit_content !== right.explicit_content
    || left.expected_revision !== right.expected_revision
    || left.artwork.type !== right.artwork.type
  ) return false
  return left.artwork.type === "current"
    || (right.artwork.type === "artwork_candidate" && left.artwork.artwork_candidate_ref === right.artwork.artwork_candidate_ref)
}

function artworkGenerationFailureMessage(error: unknown): string {
  if (error instanceof MoriApiRequestError && error.code === "mori_bff_unavailable") {
    return "Mori is offline right now. Your visual plan is ready to retry."
  }
  if (error instanceof Error && error.message === "artwork_generation_snapshot_context_mismatch") {
    return "The returned artwork did not match this Version or visual plan. Nothing was attached."
  }
  return "This artwork set did not finish. Your visual plan is ready to retry."
}

function artworkGenerationTerminalMessage(status: "failed" | "cancelled" | "expired"): string {
  switch (status) {
    case "failed": return "Mori could not finish this artwork set. Your visual plan is ready to retry."
    case "cancelled": return "Artwork cancelled. Your visual plan is still here."
    case "expired": return "This artwork set expired before completion. Your visual plan is ready to retry."
  }
}

function releaseDraftFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message === "release_draft_context_mismatch") {
    return "The saved draft did not match this Version or your latest choices. Your choices are still here."
  }
  if (error instanceof MoriApiRequestError && error.code === "mori_bff_unavailable") {
    return "Mori is offline right now. Your release choices are still here and ready to retry."
  }
  return "The release draft was not saved. Your choices are still here and ready to retry."
}
