"use client"

import { ArrowLeft, AudioLines, AudioWaveform, Download, FileText, Play, Share2, Sparkles } from "lucide-react"
import Link from "next/link"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import {
  createLyricsRevisionRequest,
  createStemSeparationRequest,
  createStudioChangeRequest,
  type LyricsRevisionSnapshot,
  type MixRevisionInput,
  type MoriApi,
  type MoriCandidate,
  type MoriExportInput,
  type MoriExportSnapshot,
  type MoriExportStatus,
  type MoriMixRevision,
  type StemSeparationSnapshot,
  type StudioCoverGenerationInput,
  type StudioCoverGenerationSnapshot,
  type StudioChangeGenerationSnapshot,
  type StudioRestyleGenerationInput,
  type StudioRestyleGenerationSnapshot,
} from "@/lib/mori-api"
import { createMoriApiClient, MoriApiRequestError } from "@/lib/mori-api-client"
import type { Candidate } from "./domain"
import { MoriStudioShell } from "./components/mori-studio-shell"
import { StudioAiComposer, type StudioAiRunState } from "./components/studio-ai-composer"
import { StudioExportDialog } from "./components/studio-export-dialog"
import { StudioFinishDialog } from "./components/studio-finish-dialog"
import { StudioLyricsEditor, type StudioLyricsRunState } from "./components/studio-lyrics-editor"
import { StudioStemsEditor, type StudioStemSeparationRunState } from "./components/studio-stems-editor"
import { StudioTimeline } from "./components/studio-timeline"
import { useMoriApp } from "./components/mori-app-provider"
import { Waveform } from "./components/waveform"
import { previewCandidates, previewProject, previewSongPlan } from "./preview-data"
import { buildStudioTimelineSections, isActiveStudioChangeStatus, type StudioChangePlan, type StudioTimelineSection } from "./studio-change"
import { createStudioLyricsRevisionDraft, isActiveLyricsRevisionStatus, studioLyricsScopeLabel, type StudioLyricsPlan } from "./studio-lyrics"
import { isStudioRemasterPlan, isStudioRemasterSnapshot } from "./studio-remaster"
import { createStudioStemSeparationDraft, isActiveStemSeparationStatus, stemSeparationSnapshotMatchesPlan, type StudioStemSeparationPlan } from "./studio-stems"
import { createHtmlStemPlaybackController, type StemPlaybackFactory } from "./stem-playback"
import { useStudioReleaseWorkflow } from "./use-studio-release-workflow"
import styles from "./mori-workspace.module.css"

type StudioTool = "arrangement" | "lyrics" | "stems"

type StudioPageContentProps = {
  candidate: Candidate
  projectRef?: string
  versionRef?: string
  api?: Partial<Pick<MoriApi, "createExport" | "getExport" | "getProject" | "listCandidates" | "createStudioChange" | "getGeneration" | "getGenerationEvents" | "cancelGeneration" | "createLyricsRevision" | "getLyricsRevision" | "getLyricsRevisionEvents" | "cancelLyricsRevision" | "createStemSeparation" | "getStemSeparation" | "getStemSeparationEvents" | "cancelStemSeparation" | "createArtworkGeneration" | "getArtworkGeneration" | "getArtworkGenerationEvents" | "cancelArtworkGeneration" | "getReleaseDraft" | "putReleaseDraft" | "createMixRevision">>
  stemPlaybackFactory?: StemPlaybackFactory
}

type TrackedStudioChange = {
  generationRef: string
  sourceVersionRef: string
  plan: StudioChangePlan
}

type TrackedLyricsRevision = {
  lyricsRevisionRef: string
  sourceVersionRef: string
  plan: StudioLyricsPlan
}

type TrackedStemSeparation = {
  stemSeparationRef: string
  sourceVersionRef: string
  plan: StudioStemSeparationPlan
}

type TrackedExport = {
  exportRef: string
  projectRef: string
  sourceVersionRef: string
  input: MoriExportInput
  commandEpoch: number
}

type PendingExportCommand = {
  projectRef: string
  sourceVersionRef: string
  input: MoriExportInput
  idempotencyKey: string
}

const idleStudioChangeRun: StudioAiRunState = {
  status: "idle",
  progress: 0,
  resultCount: 0,
  plan: null,
  message: null,
}

const idleLyricsRevisionRun: StudioLyricsRunState = {
  status: "idle",
  progress: 0,
  plan: null,
  suggestions: [],
  sourceDigest: null,
  message: null,
}

const idleStemSeparationRun: StudioStemSeparationRunState = {
  status: "idle",
  sourceVersionRef: null,
  stemSeparationRef: null,
  progress: 0,
  plan: null,
  stems: [],
  midiAssetRef: null,
  sourceAudioDigest: null,
  message: null,
}

export function StudioPageContent({ candidate, projectRef, versionRef, api, stemPlaybackFactory = createHtmlStemPlaybackController }: StudioPageContentProps) {
  const { playerCandidate, playing, positionSeconds, seekPlayer, selectPlayerCandidate, setPlaying } = useMoriApp()
  const exportStatusDescriptionId = useId()
  const finishStatusDescriptionId = useId()
  const defaultApi = useMemo(() => createMoriApiClient(), [])
  const studioApi = useMemo(() => ({ ...defaultApi, ...(api ?? {}) }), [api, defaultApi])
  const initialCandidate = resolveInitialCandidate(candidate, projectRef, versionRef)
  const activeProjectRef = projectRef?.trim() || previewProject.projectRef
  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(() => initialCandidate)
  const [studioCandidates, setStudioCandidates] = useState(() => initialCandidate === null ? [] : [initialCandidate, ...previewCandidates.filter((item) => item.versionRef !== initialCandidate.versionRef)])
  const [currentVersionRef, setCurrentVersionRef] = useState(() => previewCandidates.find((item) => item.isCurrent)?.versionRef ?? candidate.versionRef)
  const [projectTitle, setProjectTitle] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<StudioTool>("arrangement")
  const [shareFeedback, setShareFeedback] = useState(false)
  const [finishDialogOpen, setFinishDialogOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportFeedback, setExportFeedback] = useState<"idle" | MoriExportStatus>("idle")
  const [exportInput, setExportInput] = useState<MoriExportInput | null>(null)
  const [exportSnapshot, setExportSnapshot] = useState<MoriExportSnapshot | null>(null)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [trackedExport, setTrackedExport] = useState<TrackedExport | null>(null)
  const [latestMixRevision, setLatestMixRevision] = useState<MoriMixRevision | null>(null)
  const [studioChangeRun, setStudioChangeRun] = useState<StudioAiRunState>(idleStudioChangeRun)
  const [trackedStudioChange, setTrackedStudioChange] = useState<TrackedStudioChange | null>(null)
  const [lyricsRevisionRun, setLyricsRevisionRun] = useState<StudioLyricsRunState>(idleLyricsRevisionRun)
  const [trackedLyricsRevision, setTrackedLyricsRevision] = useState<TrackedLyricsRevision | null>(null)
  const [stemSeparationRun, setStemSeparationRun] = useState<StudioStemSeparationRunState>(idleStemSeparationRun)
  const [trackedStemSeparation, setTrackedStemSeparation] = useState<TrackedStemSeparation | null>(null)
  const activeVersionRef = activeCandidate?.versionRef ?? null
  const releaseWorkflow = useStudioReleaseWorkflow({
    versionRef: activeVersionRef,
    versionTitle: activeCandidate?.title ?? "",
    api: studioApi,
  })
  const activeVersionRefRef = useRef(activeVersionRef)
  const activeProjectRefRef = useRef(activeProjectRef)
  const exportCommandEpochRef = useRef(0)
  const exportFeedbackRef = useRef<"idle" | MoriExportStatus>("idle")
  const pendingExportCommandRef = useRef<PendingExportCommand | null>(null)
  const stemSeparationCommandEpochRef = useRef(0)
  const ignoredStemSeparationsRef = useRef(new Set<string>())
  const activeStemEventRequestRef = useRef<{ stemSeparationRef: string; controller: AbortController } | null>(null)
  activeVersionRefRef.current = activeVersionRef
  activeProjectRefRef.current = activeProjectRef

  useEffect(() => {
    stemSeparationCommandEpochRef.current += 1
    exportCommandEpochRef.current += 1
    pendingExportCommandRef.current = null
    setTrackedStemSeparation((current) => {
      if (current === null || current.sourceVersionRef === activeVersionRef) return current
      ignoredStemSeparationsRef.current.add(current.stemSeparationRef)
      const eventRequest = activeStemEventRequestRef.current
      if (eventRequest?.stemSeparationRef === current.stemSeparationRef) eventRequest.controller.abort()
      return null
    })
    setStemSeparationRun((current) => (
      current.sourceVersionRef === null || current.sourceVersionRef === activeVersionRef
        ? current
        : idleStemSeparationRun
    ))
    setLatestMixRevision((current) => current?.version_ref === activeVersionRef ? current : null)
    setTrackedExport(null)
    exportFeedbackRef.current = "idle"
    setExportFeedback("idle")
    setExportInput(null)
    setExportSnapshot(null)
    setExportMessage(null)
    setFinishDialogOpen(false)
    setExportDialogOpen(false)
  }, [activeProjectRef, activeVersionRef])

  useEffect(() => {
    const requestedProjectRef = projectRef?.trim()
    if (!requestedProjectRef) return

    const getProject = studioApi.getProject
    const listCandidates = studioApi.listCandidates
    let disposed = false

    if (getProject) {
      void getProject(requestedProjectRef).then((response) => {
        if (!disposed) setProjectTitle(response.data.title)
      }).catch(() => {
        // Keep the deterministic project title visible while the BFF is unavailable.
      })
    }

    if (listCandidates) {
      void listCandidates(requestedProjectRef).then((response) => {
        if (disposed) return
        const nextCandidates = response.data.candidates.map(toDomainCandidate)
        const requestedVersionRef = versionRef?.trim()
        const nextActiveCandidate = requestedVersionRef
          ? nextCandidates.find((item) => item.versionRef === requestedVersionRef)
          : nextCandidates[0]
        setStudioCandidates(nextCandidates)
        setActiveCandidate(nextActiveCandidate ?? null)
        setCurrentVersionRef(nextCandidates.find((item) => item.isCurrent)?.versionRef ?? nextActiveCandidate?.versionRef ?? "")
      }).catch(() => {
        if (initialCandidate === null) {
          setStudioCandidates([])
          setActiveCandidate(null)
          setCurrentVersionRef("")
        }
        // Keep the deterministic fixture visible for the known preview route.
      })
    }

    return () => {
      disposed = true
    }
  }, [initialCandidate, projectRef, studioApi, versionRef])

  const generateStudioChange = async (plan: StudioChangePlan) => {
    if (activeCandidate === null || isActiveStudioChangeStatus(studioChangeRun.status)) return
    const sourceVersionRef = activeCandidate.versionRef
    setTrackedStudioChange(null)
    setStudioChangeRun({ status: "preparing", progress: 4, resultCount: 0, plan, message: null })
    try {
      const response = await studioApi.createStudioChange(
        sourceVersionRef,
        createStudioChangeRequest(plan.draft),
        `mori-studio-change-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      )
      setStudioChangeRun({
        status: response.data.status,
        progress: response.data.status === "queued" ? 0 : 12,
        resultCount: 0,
        plan,
        message: null,
      })
      setTrackedStudioChange({
        generationRef: response.data.generation_ref,
        sourceVersionRef,
        plan,
      })
    } catch (error) {
      setStudioChangeRun({
        status: "failed",
        progress: 0,
        resultCount: 0,
        plan,
        message: studioChangeFailureMessage(error),
      })
    }
  }

  useEffect(() => {
    if (trackedStudioChange === null) return
    let disposed = false
    let timer: number | undefined
    let lastEventId: string | null = null

    const sync = async () => {
      try {
        const snapshot = await studioApi.getGeneration(trackedStudioChange.generationRef)
        if (disposed) return
        if (snapshot.data.generation_kind !== "studio_change") throw new Error("studio_change_snapshot_context_mismatch")
        if (!studioChangeSnapshotMatchesPlan(snapshot.data, trackedStudioChange)) {
          throw new Error(studioChangeSnapshotMismatchCode(trackedStudioChange.plan))
        }

        let status = snapshot.data.status
        let progress = snapshot.data.progress
        let candidateRefs = snapshot.data.candidate_refs

        if (studioApi.getGenerationEvents !== undefined) {
          try {
            const events = await studioApi.getGenerationEvents(trackedStudioChange.generationRef, lastEventId)
            const latest = events.at(-1)
            if (latest !== undefined) {
              lastEventId = latest.id
              status = latest.data.status
              progress = latest.data.progress
              candidateRefs = latest.data.candidate_refs
            }
          } catch {
            // Durable snapshot polling remains the recovery path when event replay is unavailable.
          }
        }

        setStudioChangeRun((current) => ({ ...current, status, progress, message: null }))

        if (status === "succeeded") {
          const candidateResponse = await studioApi.listCandidates(snapshot.data.project_ref)
          if (disposed) return
          const generatedCandidates = candidateResponse.data.candidates
            .filter((item) => candidateRefs.includes(item.candidate_ref))
            .map((item, index) => toDomainCandidate(item, index + 47))
          setStudioCandidates((current) => mergeStudioCandidates(current, generatedCandidates))
          setStudioChangeRun((current) => ({
            ...current,
            status: "succeeded",
            progress: 100,
            resultCount: generatedCandidates.length,
            message: generatedCandidates.length === 0 ? "Rendering finished, but no playable takes were returned." : null,
          }))
          setTrackedStudioChange(null)
          return
        }

        if (status === "failed" || status === "cancelled" || status === "expired") {
          setTrackedStudioChange(null)
          return
        }
        timer = window.setTimeout(() => { void sync() }, 900)
      } catch (error) {
        if (!disposed) {
          setStudioChangeRun((current) => ({
            ...current,
            status: "failed",
            message: studioChangeFailureMessage(error),
          }))
          setTrackedStudioChange(null)
        }
      }
    }

    void sync()
    return () => {
      disposed = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [studioApi, trackedStudioChange])

  const cancelStudioChange = async () => {
    if (trackedStudioChange === null) return
    const generationRef = trackedStudioChange.generationRef
    setStudioChangeRun((current) => ({ ...current, message: "Stopping after the current render step…" }))
    try {
      const response = await studioApi.cancelGeneration(
        generationRef,
        `mori-studio-cancel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      )
      setTrackedStudioChange(null)
      setStudioChangeRun((current) => ({
        ...current,
        status: response.data.status,
        progress: Math.min(current.progress, 99),
        message: null,
      }))
    } catch {
      setStudioChangeRun((current) => ({ ...current, message: "Cancellation did not complete. Rendering is still being tracked." }))
    }
  }

  const resetStudioChange = () => {
    if (isActiveStudioChangeStatus(studioChangeRun.status)) return
    setTrackedStudioChange(null)
    setStudioChangeRun(idleStudioChangeRun)
  }

  const generateLyricsRevision = async (plan: StudioLyricsPlan) => {
    if (activeCandidate === null || isActiveLyricsRevisionStatus(lyricsRevisionRun.status)) return
    const sourceVersionRef = activeCandidate.versionRef
    setTrackedLyricsRevision(null)
    setLyricsRevisionRun({
      status: "preparing",
      progress: 4,
      plan,
      suggestions: [],
      sourceDigest: null,
      message: null,
    })
    try {
      const response = await studioApi.createLyricsRevision(
        sourceVersionRef,
        createLyricsRevisionRequest(createStudioLyricsRevisionDraft(plan)),
        `mori-lyrics-revision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      )
      setLyricsRevisionRun({
        status: response.data.status,
        progress: response.data.status === "queued" ? 0 : 12,
        plan,
        suggestions: [],
        sourceDigest: null,
        message: null,
      })
      setTrackedLyricsRevision({
        lyricsRevisionRef: response.data.lyrics_revision_ref,
        sourceVersionRef,
        plan,
      })
    } catch (error) {
      setLyricsRevisionRun({
        status: "failed",
        progress: 0,
        plan,
        suggestions: [],
        sourceDigest: null,
        message: lyricsRevisionFailureMessage(error),
      })
    }
  }

  useEffect(() => {
    if (trackedLyricsRevision === null) return
    let disposed = false
    let timer: number | undefined
    let lastEventId: string | null = null

    const sync = async () => {
      try {
        const response = await studioApi.getLyricsRevision(trackedLyricsRevision.lyricsRevisionRef)
        if (disposed) return
        const snapshot = response.data
        if (!lyricsRevisionSnapshotMatches(snapshot, trackedLyricsRevision)) {
          throw new Error("lyrics_revision_snapshot_context_mismatch")
        }

        if (snapshot.status === "succeeded") {
          setLyricsRevisionRun({
            status: "succeeded",
            progress: 100,
            plan: trackedLyricsRevision.plan,
            suggestions: snapshot.suggestions,
            sourceDigest: snapshot.source_digest,
            message: null,
          })
          setTrackedLyricsRevision(null)
          return
        }

        if (snapshot.status === "failed" || snapshot.status === "cancelled" || snapshot.status === "expired") {
          setLyricsRevisionRun({
            status: snapshot.status,
            progress: snapshot.progress,
            plan: trackedLyricsRevision.plan,
            suggestions: [],
            sourceDigest: snapshot.source_digest,
            message: lyricsRevisionTerminalMessage(snapshot.status),
          })
          setTrackedLyricsRevision(null)
          return
        }

        let status = snapshot.status
        let progress = snapshot.progress
        try {
          const events = await studioApi.getLyricsRevisionEvents(trackedLyricsRevision.lyricsRevisionRef, lastEventId)
          const latest = events.at(-1)
          if (
            latest !== undefined
            && latest.data.lyrics_revision_ref === trackedLyricsRevision.lyricsRevisionRef
            && latest.data.version_ref === trackedLyricsRevision.sourceVersionRef
            && (latest.data.status === "queued" || latest.data.status === "generating")
          ) {
            lastEventId = latest.id
            status = latest.data.status
            progress = latest.data.progress
          }
        } catch {
          // The durable snapshot remains authoritative if event replay is unavailable.
        }

        setLyricsRevisionRun((current) => ({ ...current, status, progress, message: null }))
        timer = window.setTimeout(() => { void sync() }, 800)
      } catch (error) {
        if (!disposed) {
          setLyricsRevisionRun((current) => ({
            ...current,
            status: "failed",
            message: lyricsRevisionFailureMessage(error),
          }))
          setTrackedLyricsRevision(null)
        }
      }
    }

    void sync()
    return () => {
      disposed = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [studioApi, trackedLyricsRevision])

  const cancelLyricsRevision = async () => {
    if (trackedLyricsRevision === null) return
    const lyricsRevisionRef = trackedLyricsRevision.lyricsRevisionRef
    setLyricsRevisionRun((current) => ({ ...current, message: "Stopping after the current writing step…" }))
    try {
      const response = await studioApi.cancelLyricsRevision(
        lyricsRevisionRef,
        `mori-lyrics-cancel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      )
      const status = response.data.status
      const stopped = status === "failed" || status === "cancelled" || status === "expired"
      if (stopped) setTrackedLyricsRevision(null)
      setLyricsRevisionRun((current) => ({
        ...current,
        status: status === "succeeded" ? current.status : status,
        progress: Math.min(current.progress, 99),
        message: stopped
          ? lyricsRevisionTerminalMessage(status)
          : status === "succeeded"
            ? "Revision finished while cancellation was requested. Loading suggestions…"
            : null,
      }))
    } catch {
      setLyricsRevisionRun((current) => ({ ...current, message: "Cancellation did not complete. This revision is still being tracked." }))
    }
  }

  const resetLyricsRevision = () => {
    if (isActiveLyricsRevisionStatus(lyricsRevisionRun.status)) return
    setTrackedLyricsRevision(null)
    setLyricsRevisionRun(idleLyricsRevisionRun)
  }

  const generateStemSeparation = async (plan: StudioStemSeparationPlan) => {
    if (activeCandidate === null || isActiveStemSeparationStatus(stemSeparationRun.status)) return
    const sourceVersionRef = activeCandidate.versionRef
    const commandEpoch = stemSeparationCommandEpochRef.current + 1
    stemSeparationCommandEpochRef.current = commandEpoch
    setTrackedStemSeparation(null)
    setStemSeparationRun({
      status: "preparing",
      sourceVersionRef,
      stemSeparationRef: null,
      progress: 4,
      plan,
      stems: [],
      midiAssetRef: null,
      sourceAudioDigest: null,
      message: null,
    })
    try {
      const response = await studioApi.createStemSeparation(
        sourceVersionRef,
        createStemSeparationRequest(createStudioStemSeparationDraft(plan)),
        `mori-stem-separation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      )
      if (commandEpoch !== stemSeparationCommandEpochRef.current || activeVersionRefRef.current !== sourceVersionRef) return
      ignoredStemSeparationsRef.current.delete(response.data.stem_separation_ref)
      setStemSeparationRun({
        status: response.data.status,
        sourceVersionRef,
        stemSeparationRef: response.data.stem_separation_ref,
        progress: response.data.status === "queued" ? 0 : 12,
        plan,
        stems: [],
        midiAssetRef: null,
        sourceAudioDigest: null,
        message: null,
      })
      setTrackedStemSeparation({
        stemSeparationRef: response.data.stem_separation_ref,
        sourceVersionRef,
        plan,
      })
    } catch (error) {
      if (commandEpoch !== stemSeparationCommandEpochRef.current || activeVersionRefRef.current !== sourceVersionRef) return
      setStemSeparationRun({
        status: "failed",
        sourceVersionRef,
        stemSeparationRef: null,
        progress: 0,
        plan,
        stems: [],
        midiAssetRef: null,
        sourceAudioDigest: null,
        message: stemSeparationFailureMessage(error),
      })
    }
  }

  useEffect(() => {
    if (trackedStemSeparation === null) return
    const tracked = trackedStemSeparation
    let disposed = false
    let timer: number | undefined
    let eventTimeout: number | undefined
    let eventController: AbortController | null = null
    let lastEventId: string | null = null
    const isCurrent = () => !disposed
      && activeVersionRefRef.current === tracked.sourceVersionRef
      && !ignoredStemSeparationsRef.current.has(tracked.stemSeparationRef)

    const sync = async () => {
      if (!isCurrent()) return
      try {
        const response = await studioApi.getStemSeparation(tracked.stemSeparationRef)
        if (!isCurrent()) return
        const snapshot = response.data
        if (!stemSeparationSnapshotMatches(snapshot, tracked)) {
          throw new Error("stem_separation_snapshot_context_mismatch")
        }

        if (snapshot.status === "succeeded") {
          setStemSeparationRun({
            status: "succeeded",
            sourceVersionRef: tracked.sourceVersionRef,
            stemSeparationRef: tracked.stemSeparationRef,
            progress: 100,
            plan: tracked.plan,
            stems: snapshot.stems,
            midiAssetRef: snapshot.midi_asset_ref,
            sourceAudioDigest: snapshot.source_audio_digest,
            message: null,
          })
          setTrackedStemSeparation(null)
          return
        }

        if (snapshot.status === "failed" || snapshot.status === "cancelled" || snapshot.status === "expired") {
          setStemSeparationRun({
            status: snapshot.status,
            sourceVersionRef: tracked.sourceVersionRef,
            stemSeparationRef: tracked.stemSeparationRef,
            progress: snapshot.progress,
            plan: tracked.plan,
            stems: [],
            midiAssetRef: null,
            sourceAudioDigest: snapshot.source_audio_digest,
            message: stemSeparationTerminalMessage(snapshot.status),
          })
          setTrackedStemSeparation(null)
          return
        }

        let status = snapshot.status
        let progress = snapshot.progress
        try {
          eventController = new AbortController()
          activeStemEventRequestRef.current = { stemSeparationRef: tracked.stemSeparationRef, controller: eventController }
          eventTimeout = window.setTimeout(() => eventController?.abort(), 650)
          const events = await studioApi.getStemSeparationEvents(tracked.stemSeparationRef, lastEventId, eventController.signal)
          if (!isCurrent()) return
          const latest = events.at(-1)
          if (
            latest !== undefined
            && latest.data.stem_separation_ref === tracked.stemSeparationRef
            && latest.data.version_ref === tracked.sourceVersionRef
            && (latest.data.status === "queued" || latest.data.status === "separating")
          ) {
            lastEventId = latest.id
            status = latest.data.status
            progress = latest.data.progress
          }
        } catch {
          // The durable snapshot remains authoritative if event replay is unavailable.
        } finally {
          if (eventTimeout !== undefined) window.clearTimeout(eventTimeout)
          eventTimeout = undefined
          if (activeStemEventRequestRef.current?.controller === eventController) activeStemEventRequestRef.current = null
          eventController = null
        }

        if (!isCurrent()) return
        setStemSeparationRun((current) => ({ ...current, status, progress, message: null }))
        timer = window.setTimeout(() => { void sync() }, 800)
      } catch (error) {
        if (isCurrent()) {
          setStemSeparationRun((current) => ({
            ...current,
            status: "failed",
            message: stemSeparationFailureMessage(error),
          }))
          setTrackedStemSeparation(null)
        }
      }
    }

    void sync()
    return () => {
      disposed = true
      if (timer !== undefined) window.clearTimeout(timer)
      if (eventTimeout !== undefined) window.clearTimeout(eventTimeout)
      eventController?.abort()
      if (activeStemEventRequestRef.current?.controller === eventController) activeStemEventRequestRef.current = null
    }
  }, [studioApi, trackedStemSeparation])

  const cancelStemSeparation = async () => {
    if (trackedStemSeparation === null) return
    const tracked = trackedStemSeparation
    const stemSeparationRef = tracked.stemSeparationRef
    ignoredStemSeparationsRef.current.add(stemSeparationRef)
    const eventRequest = activeStemEventRequestRef.current
    if (eventRequest?.stemSeparationRef === stemSeparationRef) eventRequest.controller.abort()
    setStemSeparationRun((current) => ({ ...current, message: "Stopping after the current separation step…" }))
    try {
      const response = await studioApi.cancelStemSeparation(
        stemSeparationRef,
        `mori-stem-cancel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      )
      if (activeVersionRefRef.current !== tracked.sourceVersionRef) return
      const status = response.data.status
      const stopped = status === "failed" || status === "cancelled" || status === "expired"
      if (stopped) setTrackedStemSeparation(null)
      else {
        ignoredStemSeparationsRef.current.delete(stemSeparationRef)
        setTrackedStemSeparation((current) => current?.stemSeparationRef === stemSeparationRef ? { ...current } : current)
      }
      setStemSeparationRun((current) => ({
        ...current,
        status: status === "succeeded" ? current.status : status,
        progress: Math.min(current.progress, 99),
        message: stopped
          ? stemSeparationTerminalMessage(status)
          : status === "succeeded"
            ? "Separation finished while cancellation was requested. Loading stems…"
            : null,
      }))
    } catch {
      if (activeVersionRefRef.current !== tracked.sourceVersionRef) return
      ignoredStemSeparationsRef.current.delete(stemSeparationRef)
      setTrackedStemSeparation((current) => current?.stemSeparationRef === stemSeparationRef ? { ...current } : current)
      setStemSeparationRun((current) => ({ ...current, message: "Cancellation did not complete. This separation is still being tracked." }))
    }
  }

  const resetStemSeparation = () => {
    if (isActiveStemSeparationStatus(stemSeparationRun.status)) return
    stemSeparationCommandEpochRef.current += 1
    if (trackedStemSeparation !== null) ignoredStemSeparationsRef.current.add(trackedStemSeparation.stemSeparationRef)
    setTrackedStemSeparation(null)
    setStemSeparationRun(idleStemSeparationRun)
  }

  const saveMixRevision = async (input: MixRevisionInput): Promise<MoriMixRevision> => {
    const versionRef = activeVersionRefRef.current
    if (versionRef === null) throw new Error("mix_revision_version_required")
    const response = await studioApi.createMixRevision(
      versionRef,
      input,
      `mori-mix-revision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    )
    const revision = response.data
    if (
      activeVersionRefRef.current !== versionRef
      || revision.version_ref !== versionRef
      || !mixRevisionMatchesInput(revision, input)
    ) throw new Error("mix_revision_context_mismatch")
    setLatestMixRevision(revision)
    if (exportFeedbackRef.current === "failed" || exportFeedbackRef.current === "succeeded") resetExport()
    return revision
  }

  const preview = () => {
    if (activeCandidate === null) return
    if (playerCandidate?.versionRef === activeCandidate.versionRef) {
      setPlaying(!playing)
      return
    }
    selectPlayerCandidate(activeCandidate)
    setPlaying(true)
  }

  const selectTake = (take: Candidate) => {
    setActiveCandidate(take)
  }

  const previewTake = (take: Candidate) => {
    if (playerCandidate?.versionRef === take.versionRef) {
      setPlaying(!playing)
      return
    }
    selectPlayerCandidate(take)
    setPlaying(true)
  }

  const seekTimeline = (take: Candidate, nextPositionSeconds: number) => {
    if (playerCandidate?.versionRef === take.versionRef) {
      seekPlayer(nextPositionSeconds)
      return
    }
    selectPlayerCandidate(take, nextPositionSeconds)
  }

  const promoteTake = (take: Candidate) => {
    setCurrentVersionRef(take.versionRef)
    setActiveCandidate(take)
  }

  const share = () => {
    const clipboardWrite = navigator.clipboard?.writeText(window.location.href)
    if (clipboardWrite !== undefined) void clipboardWrite.catch(() => undefined)
    setShareFeedback(true)
    window.setTimeout(() => setShareFeedback(false), 1800)
  }

  const startExport = async (input: MoriExportInput) => {
    const sourceVersionRef = activeVersionRefRef.current
    if (sourceVersionRef === null) return
    const sourceProjectRef = activeProjectRefRef.current
    const previousCommand = pendingExportCommandRef.current
    const idempotencyKey = previousCommand !== null
      && previousCommand.projectRef === sourceProjectRef
      && previousCommand.sourceVersionRef === sourceVersionRef
      && exportInputsMatch(previousCommand.input, input)
      ? previousCommand.idempotencyKey
      : `mori-export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const commandEpoch = exportCommandEpochRef.current + 1
    exportCommandEpochRef.current = commandEpoch
    pendingExportCommandRef.current = { projectRef: sourceProjectRef, sourceVersionRef, input, idempotencyKey }
    exportFeedbackRef.current = "queued"
    setExportFeedback("queued")
    setTrackedExport(null)
    setExportInput(input)
    setExportSnapshot(null)
    setExportMessage(null)
    try {
      const response = await studioApi.createExport(sourceVersionRef, input, idempotencyKey)
      if (
        exportCommandEpochRef.current !== commandEpoch
        || activeProjectRefRef.current !== sourceProjectRef
        || activeVersionRefRef.current !== sourceVersionRef
      ) return
      pendingExportCommandRef.current = null
      setTrackedExport({
        exportRef: response.data.export_ref,
        projectRef: sourceProjectRef,
        sourceVersionRef,
        input,
        commandEpoch,
      })
      const nextStatus = response.data.status === "processing" ? "processing" : "queued"
      exportFeedbackRef.current = nextStatus
      setExportFeedback(nextStatus)
    } catch {
      if (
        exportCommandEpochRef.current !== commandEpoch
        || activeProjectRefRef.current !== sourceProjectRef
        || activeVersionRefRef.current !== sourceVersionRef
      ) return
      exportFeedbackRef.current = "failed"
      setExportFeedback("failed")
      setExportMessage("Mori could not confirm the export start. Retry will safely resume the same request.")
    }
  }

  useEffect(() => {
    const getExport = studioApi.getExport
    if (trackedExport === null || getExport === undefined) return
    const tracked = trackedExport
    let disposed = false
    let timer: number | undefined
    let retryDelayMs = 360
    const isCurrent = () => !disposed
      && exportCommandEpochRef.current === tracked.commandEpoch
      && activeProjectRefRef.current === tracked.projectRef
      && activeVersionRefRef.current === tracked.sourceVersionRef

    const syncExport = async () => {
      try {
        const response = await getExport(tracked.exportRef)
        if (!isCurrent()) return
        const snapshot = response.data
        if (
          snapshot.export_ref !== tracked.exportRef
          || snapshot.project_ref !== tracked.projectRef
          || snapshot.version_ref !== tracked.sourceVersionRef
          || !exportSnapshotMatchesInput(snapshot, tracked.input)
        ) throw new Error("export_snapshot_context_mismatch")

        retryDelayMs = 360
        setExportSnapshot(snapshot)
        setExportMessage(null)
        if (snapshot.status === "succeeded") {
          exportFeedbackRef.current = "succeeded"
          setExportFeedback("succeeded")
          setTrackedExport(null)
          return
        }
        if (snapshot.status === "failed") {
          exportFeedbackRef.current = "failed"
          setExportFeedback("failed")
          setExportMessage("The export did not finish. Your choices are still here.")
          setTrackedExport(null)
          return
        }
        exportFeedbackRef.current = snapshot.status
        setExportFeedback(snapshot.status)
        timer = window.setTimeout(() => { void syncExport() }, 220)
      } catch (error) {
        if (!isCurrent()) return
        if (error instanceof Error && error.message === "export_snapshot_context_mismatch") {
          exportFeedbackRef.current = "failed"
          setExportFeedback("failed")
          setExportMessage("The export result did not match this Version. Your choices are still here.")
          setTrackedExport(null)
          return
        }
        setExportMessage("Mori is reconnecting to this export. The render is still being tracked.")
        timer = window.setTimeout(() => { void syncExport() }, retryDelayMs)
        retryDelayMs = Math.min(retryDelayMs * 2, 2_000)
      }
    }

    void syncExport()
    return () => {
      disposed = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [studioApi, trackedExport])

  function resetExport() {
    exportCommandEpochRef.current += 1
    pendingExportCommandRef.current = null
    setTrackedExport(null)
    exportFeedbackRef.current = "idle"
    setExportFeedback("idle")
    setExportInput(null)
    setExportSnapshot(null)
    setExportMessage(null)
  }

  const activeProjectTitle = projectTitle ?? (activeProjectRef === previewProject.projectRef ? previewProject.title : "Project")
  const remasterRun = isStudioRemasterPlan(studioChangeRun.plan)
  const remasterActive = remasterRun && isActiveStudioChangeStatus(studioChangeRun.status)
  const finishActive = remasterActive || releaseWorkflow.active

  return (
    <MoriStudioShell candidate={activeCandidate} playerCandidates={studioCandidates}>
      <header className={styles.studioHeader}>
          <div className={styles.studioHeaderLeft}><Link className={styles.studioBack} href={`/projects/${activeProjectRef}`}><ArrowLeft size={15} /> {activeProjectTitle}</Link><span>/</span><strong>Studio</strong></div>
          <div className={styles.studioHeaderActions}>
            <button className={styles.ghostButton} type="button" onClick={share}><Share2 size={14} /> {shareFeedback ? "Link copied" : "Share"}</button>
          {activeCandidate !== null ? <>
            <button
              className={`${styles.ghostButton} ${styles.finishButton}`}
              type="button"
              aria-label="Finish"
              aria-describedby={finishStatusDescriptionId}
              data-finish-status={studioChangeRun.status}
              onClick={() => setFinishDialogOpen(true)}
            >
              <Sparkles size={14} /> Finish
              {finishActive ? <span className={styles.studioActionActivity} aria-hidden="true" /> : null}
            </button>
            <span className={styles.srOnly} id={finishStatusDescriptionId} aria-live="polite">{finishStatusDescription(studioChangeRun, releaseWorkflow.activityDescription)}</span>
            <button className={styles.ghostButton} type="button" aria-label="Export" aria-describedby={exportStatusDescriptionId} data-export-status={exportFeedback} onClick={() => setExportDialogOpen(true)}><Download size={14} /> Export{exportFeedback === "queued" || exportFeedback === "processing" ? <span className={styles.exportActivity} aria-hidden="true" /> : null}</button>
            <span className={styles.srOnly} id={exportStatusDescriptionId} aria-live="polite">{exportStatusDescription(exportFeedback)}</span>
          </> : null}
        </div>
      </header>
      {activeCandidate === null ? <section className={styles.studioUnavailable} aria-label="Studio version unavailable">
        <div className={styles.studioUnavailableIcon}><Sparkles size={20} /></div>
        <h1>This version is not available yet</h1>
        <p>Mori could not find a playable version for this project. Return to the project and choose another direction.</p>
        <Link className={styles.generateButton} href={`/projects/${activeProjectRef}`}><ArrowLeft size={14} /> Back to projects</Link>
      </section> : <div className={styles.studioLayout}>
        <aside className={styles.studioSidebar} aria-label="Studio tools">
          <div className={styles.studioArtwork}><span>01</span></div>
          <div className={styles.studioSidebarCopy}><span>Current version</span><h1>{activeCandidate.title}</h1><p>{activeCandidate.subtitle}</p></div>
          <div className={styles.studioToolList}>
            <button className={activeTool === "arrangement" ? styles.studioToolActive : ""} type="button" aria-pressed={activeTool === "arrangement"} onClick={() => setActiveTool("arrangement")}><AudioLines size={15} /> Arrangement</button>
            <button className={activeTool === "lyrics" ? styles.studioToolActive : ""} type="button" aria-pressed={activeTool === "lyrics"} onClick={() => setActiveTool("lyrics")}><FileText size={15} /> Lyrics</button>
            <button className={activeTool === "stems" ? styles.studioToolActive : ""} type="button" aria-pressed={activeTool === "stems"} onClick={() => setActiveTool("stems")}><AudioWaveform size={15} /> Stems</button>
          </div>
          <div className={styles.studioSidebarBottom}><span>Version</span><strong>{activeCandidate.versionRef}</strong></div>
        </aside>
        <section className={styles.studioCanvas} aria-label="Studio editor">
          <div className={styles.studioCanvasTop}><div><span className={styles.eyebrow}><span className={styles.eyebrowDot} />Editing with intention</span><h2>Shape the feeling.</h2></div><button className={styles.generateButton} type="button" onClick={preview}><Play size={14} fill="currentColor" /> {playerCandidate?.versionRef === activeCandidate.versionRef && playing ? "Pause" : "Preview"}</button></div>
          {activeTool === "arrangement" ? <ArrangementEditor candidate={activeCandidate} takes={studioCandidates} currentVersionRef={currentVersionRef} playerVersionRef={playerCandidate?.versionRef ?? ""} positionSeconds={playerCandidate?.versionRef === activeCandidate.versionRef ? positionSeconds : 0} playing={playerCandidate?.versionRef === activeCandidate.versionRef && playing} studioChangeRun={studioChangeRun} onSeekTimeline={(nextPositionSeconds) => seekTimeline(activeCandidate, nextPositionSeconds)} onGenerateStudioChange={(plan) => { void generateStudioChange(plan) }} onCancelStudioChange={() => { void cancelStudioChange() }} onResetStudioChange={resetStudioChange} onSelectTake={selectTake} onPreviewTake={previewTake} onPromoteTake={promoteTake} /> : null}
          {activeTool === "lyrics" ? <StudioLyricsEditor key={activeCandidate.versionRef} versionRef={activeCandidate.versionRef} run={lyricsRevisionRun} onGenerate={(plan) => { void generateLyricsRevision(plan) }} onCancel={() => { void cancelLyricsRevision() }} onReset={resetLyricsRevision} /> : null}
          {activeTool === "stems" ? <StudioStemsEditor key={activeVersionRef ?? "no-version"} durationSeconds={activeCandidate.durationSeconds} run={stemSeparationRun} layerRun={studioChangeRun} onSeparate={(plan) => { void generateStemSeparation(plan) }} onCancel={() => { void cancelStemSeparation() }} onReset={resetStemSeparation} onSaveMix={saveMixRevision} onGenerateLayer={(plan) => { void generateStudioChange(plan) }} onCancelLayer={() => { void cancelStudioChange() }} onResetLayer={resetStudioChange} onReviewTakes={() => setActiveTool("arrangement")} playbackFactory={stemPlaybackFactory} /> : null}
        </section>
        <aside className={styles.versionRail} aria-label="Version history"><div className={styles.versionRailHeader}><div><span>Project history</span><h2>Versions</h2></div></div>{studioCandidates.map((item, index) => <Link className={`${styles.versionItem} ${item.versionRef === activeCandidate.versionRef ? styles.versionItemActive : ""}`} href={`/projects/${activeProjectRef}/studio/${item.versionRef}`} key={item.versionRef}><div className={`${styles.versionThumb} ${index === 1 ? styles.versionThumbAlt : ""}`}><Play size={12} fill="currentColor" /></div><div><strong>{item.title}</strong><span>{index === 0 ? "Current" : "Draft"} · {Math.floor(item.durationSeconds / 60)}:{String(item.durationSeconds % 60).padStart(2, "0")}</span></div></Link>)}</aside>
      </div>}
      {exportDialogOpen && activeCandidate !== null ? <StudioExportDialog
        versionRef={activeCandidate.versionRef}
        versionTitle={activeCandidate.title}
        latestMixRevision={latestMixRevision}
        status={exportFeedback}
        activeInput={exportInput}
        snapshot={exportSnapshot}
        message={exportMessage}
        onClose={() => setExportDialogOpen(false)}
        onReset={resetExport}
        onSubmit={(input) => { void startExport(input) }}
      /> : null}
      {finishDialogOpen && activeCandidate !== null ? <StudioFinishDialog
        versionRef={activeCandidate.versionRef}
        versionTitle={activeCandidate.title}
        durationSeconds={activeCandidate.durationSeconds}
        latestMixRevision={latestMixRevision}
        run={studioChangeRun}
        view={releaseWorkflow.finishView}
        onViewChange={releaseWorkflow.setFinishView}
        release={{
          versionRef: activeCandidate.versionRef,
          draft: releaseWorkflow.releaseDraft,
          artworkDraft: releaseWorkflow.artworkDraft,
          artworkRun: releaseWorkflow.artworkRun,
          saveState: releaseWorkflow.releaseSave,
          onDraftChange: releaseWorkflow.updateReleaseDraft,
          onArtworkDraftChange: releaseWorkflow.updateArtworkDraft,
          onGenerateArtwork: (plan) => { void releaseWorkflow.generateArtwork(plan) },
          onCancelArtwork: () => { void releaseWorkflow.cancelArtwork() },
          onResetArtwork: releaseWorkflow.resetArtwork,
          onSave: (draft) => { void releaseWorkflow.saveReleaseDraft(draft) },
        }}
        onClose={() => setFinishDialogOpen(false)}
        onReset={resetStudioChange}
        onSubmit={(plan) => { void generateStudioChange(plan) }}
        onCancel={() => { void cancelStudioChange() }}
        onReviewTakes={() => {
          setActiveTool("arrangement")
          setFinishDialogOpen(false)
        }}
      /> : null}
    </MoriStudioShell>
  )
}

function resolveInitialCandidate(candidate: Candidate, projectRef?: string, versionRef?: string): Candidate | null {
  const requestedProjectRef = projectRef?.trim()
  const requestedVersionRef = versionRef?.trim()
  if (requestedProjectRef !== undefined && requestedProjectRef !== "" && requestedProjectRef !== previewProject.projectRef) return null
  if (requestedVersionRef !== undefined && requestedVersionRef !== "" && requestedVersionRef !== candidate.versionRef) return null
  return candidate
}

function toDomainCandidate(candidate: MoriCandidate, index: number): Candidate {
  const tags = candidate.style_tags.length > 0 ? candidate.style_tags : ["new direction"]
  return {
    candidateRef: candidate.candidate_ref,
    versionRef: candidate.version_ref,
    generationRef: candidate.generation_ref,
    title: candidate.title,
    subtitle: tags.join(" · "),
    durationSeconds: candidate.duration_seconds,
    mood: tags[0] ?? "new direction",
    waveformSeed: index + 13,
    isCurrent: index === 0,
  }
}

function mergeStudioCandidates(current: Candidate[], generated: Candidate[]): Candidate[] {
  const generatedRefs = new Set(generated.map((candidate) => candidate.candidateRef))
  return [
    ...current.filter((candidate) => !generatedRefs.has(candidate.candidateRef)),
    ...generated,
  ]
}

function mixRevisionMatchesInput(revision: MoriMixRevision, input: MixRevisionInput): boolean {
  if (
    revision.source_stem_separation_ref !== input.source_stem_separation_ref
    || revision.name !== input.name
    || revision.tracks.length !== input.tracks.length
  ) return false

  const returnedTracks = new Map(revision.tracks.map((track) => [track.stem_ref, track]))
  return input.tracks.every((track) => {
    const returned = returnedTracks.get(track.stem_ref)
    return returned !== undefined && returned.gain === track.gain && returned.muted === track.muted
  })
}

function exportSnapshotMatchesInput(snapshot: MoriExportSnapshot, input: MoriExportInput): boolean {
  return exportInputsMatch({ source: snapshot.source, scope: snapshot.scope, format: snapshot.format }, input)
}

function exportInputsMatch(left: MoriExportInput, right: MoriExportInput): boolean {
  if (left.format !== right.format || left.scope.type !== right.scope.type || left.source.type !== right.source.type) return false
  return left.source.type === "version"
    || (right.source.type === "mix_revision" && left.source.mix_revision_ref === right.source.mix_revision_ref)
}

function exportStatusDescription(status: "idle" | MoriExportStatus): string {
  switch (status) {
    case "idle": return "Export options"
    case "queued": return "Export queued"
    case "processing": return "Export rendering"
    case "succeeded": return "Export ready to download"
    case "failed": return "Export needs attention"
  }
}

function finishStatusDescription(run: StudioAiRunState, releaseActivityDescription: string | null): string {
  if (releaseActivityDescription !== null) return releaseActivityDescription
  if (!isStudioRemasterPlan(run.plan) && isActiveStudioChangeStatus(run.status)) {
    return "Release remains available while the active Studio change completes"
  }
  if (!isStudioRemasterPlan(run.plan)) return "Review a non-destructive Remaster"
  switch (run.status) {
    case "idle": return "Review a non-destructive Remaster"
    case "preparing": return "Preparing Remaster"
    case "queued": return "Remaster queued"
    case "generating": return "Remastering two Takes"
    case "post_processing": return "Finishing two Remastered Takes"
    case "succeeded": return run.resultCount > 0 ? `${run.resultCount} Remastered Takes ready` : "Remaster returned no Takes"
    case "failed": return "Remaster needs attention"
    case "cancelled": return "Remaster cancelled"
    case "expired": return "Remaster expired"
  }
}

function studioChangeSnapshotMatchesPlan(snapshot: StudioChangeGenerationSnapshot, tracked: TrackedStudioChange): boolean {
  if (
    snapshot.generation_ref !== tracked.generationRef
    || snapshot.source_version_ref !== tracked.sourceVersionRef
    || snapshot.operation !== tracked.plan.operation
  ) return false

  if (isStudioRemasterPlan(tracked.plan)) {
    if (!isStudioRemasterSnapshot(snapshot)) return false
    if (snapshot.variation_strength !== tracked.plan.variationStrength) return false
    if (snapshot.source.type !== tracked.plan.source.type) return false
    return snapshot.source.type === "version"
      || (tracked.plan.source.type === "mix_revision" && snapshot.source.mix_revision_ref === tracked.plan.source.mixRevisionRef)
  }

  if (tracked.plan.draft.operation !== "transform") return snapshot.operation !== "transform"
  const expected = createStudioChangeRequest(tracked.plan.draft)
  if (expected.operation !== "transform" || expected.intent === "remaster") return false

  if (expected.intent === "restyle") {
    return snapshot.intent === "restyle" && studioTransformContextMatches(snapshot, expected)
  }
  return snapshot.intent === "cover"
    && studioTransformContextMatches(snapshot, expected)
    && snapshot.cover_mode === expected.cover_mode
    && snapshot.voice_ref === expected.voice_ref
}

function studioTransformContextMatches(
  snapshot: StudioRestyleGenerationSnapshot | StudioCoverGenerationSnapshot,
  expected: StudioRestyleGenerationInput | StudioCoverGenerationInput,
): boolean {
  return studioTransformScopesMatch(snapshot.scope, expected.scope)
    && snapshot.instruction === expected.instruction
    && orderedValuesMatch(snapshot.preserve, expected.preserve)
    && orderedValuesMatch(snapshot.reference_asset_refs, expected.reference_asset_refs)
    && snapshot.output_count === expected.output_count
}

function studioTransformScopesMatch(
  left: StudioRestyleGenerationSnapshot["scope"],
  right: StudioRestyleGenerationInput["scope"],
): boolean {
  if (left.type !== right.type) return false
  return left.type === "whole_version"
    || (right.type === "time_range" && left.start_ms === right.start_ms && left.end_ms === right.end_ms)
}

function orderedValuesMatch(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function studioChangeSnapshotMismatchCode(plan: StudioChangePlan): string {
  if (isStudioRemasterPlan(plan)) return "studio_remaster_snapshot_context_mismatch"
  if (plan.draft.operation !== "transform") return "studio_change_snapshot_context_mismatch"
  return plan.draft.intent === "cover"
    ? "studio_cover_snapshot_context_mismatch"
    : "studio_restyle_snapshot_context_mismatch"
}

function studioChangeFailureMessage(error: unknown): string {
  if (error instanceof MoriApiRequestError && error.code === "mori_bff_unavailable") {
    return "Mori is offline right now. Your reviewed change is ready to retry."
  }
  if (error instanceof Error && error.message === "studio_change_snapshot_context_mismatch") {
    return "The returned generation did not match this version. Nothing was applied."
  }
  if (error instanceof Error && error.message === "studio_remaster_snapshot_context_mismatch") {
    return "The returned Remaster did not match this source or strength. Nothing was applied."
  }
  if (error instanceof Error && error.message === "studio_restyle_snapshot_context_mismatch") {
    return "The returned Restyle did not match this scope or direction. Nothing was applied."
  }
  if (error instanceof Error && error.message === "studio_cover_snapshot_context_mismatch") {
    return "The returned Cover did not match this mode or Voice. Nothing was applied."
  }
  return "This change did not finish. Your request is preserved for retry."
}

function lyricsRevisionSnapshotMatches(snapshot: LyricsRevisionSnapshot, tracked: TrackedLyricsRevision): boolean {
  const { plan } = tracked
  const expectedConstraints = new Set(plan.constraints)
  if (
    snapshot.lyrics_revision_ref !== tracked.lyricsRevisionRef
    || snapshot.version_ref !== tracked.sourceVersionRef
    || snapshot.direction !== plan.direction
    || snapshot.instruction !== plan.instruction
    || snapshot.output_count !== plan.outputCount
    || snapshot.constraints.length !== plan.constraints.length
    || snapshot.constraints.some((constraint) => !expectedConstraints.has(constraint))
  ) return false

  if (plan.scope === "whole_lyrics") return snapshot.scope.type === "whole_lyrics"
  return snapshot.scope.type === "section"
    && snapshot.scope.section_label === studioLyricsScopeLabel(plan.scope)
    && snapshot.scope.start_line === plan.startLine
    && snapshot.scope.end_line === plan.endLine
}

function lyricsRevisionFailureMessage(error: unknown): string {
  if (error instanceof MoriApiRequestError && error.code === "mori_bff_unavailable") {
    return "Mori is offline right now. Your reviewed lyric direction is ready to retry."
  }
  if (error instanceof Error && error.message === "lyrics_revision_snapshot_context_mismatch") {
    return "The returned lyrics did not match this version or direction. Nothing was applied."
  }
  return "This lyric revision did not finish. Your direction is preserved for retry."
}

function lyricsRevisionTerminalMessage(status: "failed" | "cancelled" | "expired"): string {
  switch (status) {
    case "failed": return "Mori could not finish this revision. Your direction is ready to retry."
    case "cancelled": return "Revision cancelled. Your direction is still here."
    case "expired": return "This revision expired before completion. Your direction is ready to retry."
  }
}

function stemSeparationSnapshotMatches(snapshot: StemSeparationSnapshot, tracked: TrackedStemSeparation): boolean {
  return snapshot.stem_separation_ref === tracked.stemSeparationRef
    && snapshot.version_ref === tracked.sourceVersionRef
    && stemSeparationSnapshotMatchesPlan(snapshot, tracked.plan)
}

function stemSeparationFailureMessage(error: unknown): string {
  if (error instanceof MoriApiRequestError && error.code === "mori_bff_unavailable") {
    return "Mori is offline right now. Your separation plan is ready to retry."
  }
  if (error instanceof Error && error.message === "stem_separation_snapshot_context_mismatch") {
    return "The returned stems did not match this version or plan. Nothing was attached."
  }
  return "This separation did not finish. Your plan is preserved for retry."
}

function stemSeparationTerminalMessage(status: "failed" | "cancelled" | "expired"): string {
  switch (status) {
    case "failed": return "Mori could not separate this version. Your plan is ready to retry."
    case "cancelled": return "Separation cancelled. Your plan is still here."
    case "expired": return "This separation expired before completion. Your plan is ready to retry."
  }
}

type ArrangementEditorProps = {
  candidate: Candidate
  takes: Candidate[]
  currentVersionRef: string
  playerVersionRef: string
  positionSeconds: number
  playing: boolean
  studioChangeRun: StudioAiRunState
  onSeekTimeline: (positionSeconds: number) => void
  onGenerateStudioChange: (plan: StudioChangePlan) => void
  onCancelStudioChange: () => void
  onResetStudioChange: () => void
  onSelectTake: (take: Candidate) => void
  onPreviewTake: (take: Candidate) => void
  onPromoteTake: (take: Candidate) => void
}

function ArrangementEditor({ candidate, takes, currentVersionRef, playerVersionRef, positionSeconds, playing, studioChangeRun, onSeekTimeline, onGenerateStudioChange, onCancelStudioChange, onResetStudioChange, onSelectTake, onPreviewTake, onPromoteTake }: ArrangementEditorProps) {
  const timelineSections = useMemo(() => buildStudioTimelineSections(previewSongPlan.structure, candidate.durationSeconds), [candidate.durationSeconds])
  const defaultSection = studioChangeRun.plan?.selection
    ?? timelineSections.find((item) => item.label.toLowerCase() === "chorus")
    ?? timelineSections[0]
  const [selectionState, setSelectionState] = useState<{ versionRef: string; selection: StudioTimelineSection | undefined }>(() => ({
    versionRef: candidate.versionRef,
    selection: defaultSection,
  }))
  const selection = selectionState.versionRef === candidate.versionRef ? selectionState.selection : defaultSection
  const changeActive = isActiveStudioChangeStatus(studioChangeRun.status)

  if (selection === undefined) return null

  const selectTimelineRange = (nextSelection: StudioTimelineSection) => {
    if (changeActive) return
    onResetStudioChange()
    setSelectionState({ versionRef: candidate.versionRef, selection: nextSelection })
  }

  return (
    <section aria-label="Arrangement editor">
      <StudioTimeline candidate={candidate} sections={timelineSections} selection={selection} positionSeconds={positionSeconds} playing={playing} disabled={changeActive} onSeek={onSeekTimeline} onSelect={selectTimelineRange} />
      <StudioAiComposer selectedSection={selection} run={studioChangeRun} onGenerate={onGenerateStudioChange} onCancel={onCancelStudioChange} onReset={onResetStudioChange} />
      <section className={styles.takeLanes} id="mori-take-lanes" aria-label="Take lanes">
        <div className={styles.takeLanesHeader}>
          <div><span>Compare before committing</span><h3>Take lanes</h3></div>
          <span>{takes.length} {takes.length === 1 ? "take" : "takes"}</span>
        </div>
        <div className={styles.takeLaneList}>
          {takes.map((take, index) => {
            const isSelected = take.versionRef === candidate.versionRef
            const isCurrent = take.versionRef === currentVersionRef
            const isPlaying = take.versionRef === playerVersionRef && playing
            return (
              <article className={`${styles.takeLane} ${isSelected ? styles.takeLaneSelected : ""} ${isCurrent ? styles.takeLaneCurrent : ""}`} aria-label={`Take ${index + 1}: ${take.title}`} key={take.versionRef}>
                <button className={styles.takeLaneSelect} type="button" aria-pressed={isSelected} aria-label={`Select ${take.title} take`} onClick={() => onSelectTake(take)}>
                  <span className={styles.takeLaneIndex}>0{index + 1}</span>
                  <span className={styles.takeLaneCopy}><strong>{take.title}</strong><span>{take.subtitle}</span></span>
                </button>
                <div className={styles.takeLaneWave}><Waveform seed={take.waveformSeed} compact progress={isSelected ? 0.62 : 0.34} /></div>
                <span className={styles.takeLaneDuration}>{Math.floor(take.durationSeconds / 60)}:{String(take.durationSeconds % 60).padStart(2, "0")}</span>
                <div className={styles.takeLaneActions}>
                  <button className={styles.takeLanePreview} type="button" onClick={() => onPreviewTake(take)} aria-label={`${isPlaying ? "Pause" : "Preview"} ${take.title}`}><Play size={12} fill={isPlaying ? "currentColor" : "none"} /> {isPlaying ? "Pause" : "Preview"}</button>
                  {isCurrent ? <span className={styles.takeLaneCurrentLabel}>Current version</span> : <button className={styles.takeLanePromote} type="button" onClick={() => onPromoteTake(take)} aria-label={`Use ${take.title} as current`}>Use take</button>}
                </div>
              </article>
            )
          })}
        </div>
      </section>
      <LyricsCard />
    </section>
  )
}

function LyricsCard() {
  return <div className={styles.lyricsCard}><div className={styles.lyricsHeader}><div><span>Lyrics</span><strong>Draft 01</strong></div></div><p>We were headlights in the quiet<br />finding a little gold in the blue<br /><em>and every road became a reason<br />to carry the morning through</em></p></div>
}
