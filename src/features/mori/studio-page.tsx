"use client"

import { AlertCircle, ArrowLeft, ArrowRight, AudioLines, AudioWaveform, Check, Download, FileText, History, Link2, LoaderCircle, Play, RotateCcw, Sparkles, X } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import {
  createLyricsRevisionRequest,
  createStemSeparationRequest,
  createStudioChangeRequest,
  type LyricsRevisionSnapshot,
  type MixRevisionInput,
  type MoriApi,
  type MoriCompositionRevisionInput,
  type MoriCompositionRevision,
  type MoriCandidate,
  type MoriCreativeSource,
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
import type { MoriCreativeLibrarySource } from "./creative-assets"
import { listAllMoriCandidates } from "./candidate-pagination"
import { reconcileGenerationQueueItemFromSnapshot, updateGenerationQueueItem, upsertGenerationQueueItem, type GenerationQueueItem } from "./generation-queue"
import { readGenerationQueueState, updateStoredGenerationQueueState } from "./generation-queue-storage"
import { getGenerationForRecovery } from "./generation-recovery"
import { MoriStudioShell } from "./components/mori-studio-shell"
import { StudioAiComposer, type StudioAiRunState } from "./components/studio-ai-composer"
import { StudioExportDialog } from "./components/studio-export-dialog"
import { StudioFinishDialog } from "./components/studio-finish-dialog"
import { StudioLyricsEditor, type StudioLyricsDraftSource, type StudioLyricsDraftState, type StudioLyricsRunState } from "./components/studio-lyrics-editor"
import { StudioStemsEditor, type StudioStemSeparationRunState } from "./components/studio-stems-editor"
import { StudioGenerationQueue } from "./components/studio-generation-queue"
import { StudioTimeline } from "./components/studio-timeline"
import type { CompositionInsertSource } from "./components/composition-lane"
import { CompositionSaveIndicator } from "./components/composition-save-indicator"
import { CompositionEditPanel } from "./components/composition-edit-panel"
import { StudioUnsavedLyricsDialog } from "./components/studio-unsaved-lyrics-dialog"
import { StudioVersionHistoryDrawer, StudioVersionHistoryRail } from "./components/studio-version-history"
import { StudioWorkspaceSaveStatus } from "./components/studio-workspace-save-status"
import { useMoriApp } from "./components/mori-app-provider"
import { Waveform } from "./components/waveform"
import { previewCandidates, previewProject, previewSongPlan } from "./preview-data"
import type { StudioEntryIntent, StudioEntrySurface } from "./studio-entry"
import type { Composition, CompositionTrack } from "./composition"
import { useCompositionEditor } from "./use-composition-editor"
import { buildStudioTimelineSections, isActiveStudioChangeStatus, type StudioChangePlan, type StudioTimelineSection } from "./studio-change"
import { createStudioLyricsRevisionDraft, defaultStudioLyrics, isActiveLyricsRevisionStatus, studioLyricsScopeLabel, type StudioLyricsPlan } from "./studio-lyrics"
import { isStudioRemasterPlan, isStudioRemasterSnapshot } from "./studio-remaster"
import { studioChangePlanFromSnapshot } from "./studio-recovery"
import { canonicalStudioHref, studioVersionRefFromPath } from "./studio-location"
import { createStudioStemSeparationDraft, isActiveStemSeparationStatus, stemSeparationSnapshotMatchesPlan, type StudioStemSeparationPlan } from "./studio-stems"
import { createHtmlStemPlaybackController, type StemPlaybackFactory } from "./stem-playback"
import { useStudioReleaseWorkflow } from "./use-studio-release-workflow"
import { useStudioProjectWorkspaceMemory } from "./use-studio-project-workspace-memory"
import {
  currentVersionCommand,
  currentVersionCommitFailure,
  currentVersionSelectionMatchesCommand,
  idleCurrentVersionCommitRun,
  type CurrentVersionCommitRun,
  type PendingCurrentVersionCommand,
} from "./current-version"
import styles from "./mori-workspace.module.css"

type StudioTool = "arrangement" | "lyrics" | "stems"
type StudioLinkCopyStatus = "idle" | "copying" | "copied" | "failed"
type StudioExportFeedback = "idle" | MoriExportStatus
type StudioVersionLoadState = "ready" | "loading" | "error"

const studioToolOrder: readonly StudioTool[] = ["arrangement", "lyrics", "stems"]

type StudioPageContentProps = {
  candidate: Candidate
  creativeSources?: readonly MoriCreativeLibrarySource[]
  projectRef?: string
  versionRef?: string
  initialSurface?: StudioEntrySurface
  initialIntent?: StudioEntryIntent
  initialGenerationRef?: string | null
  api?: Partial<Pick<MoriApi, "createExport" | "getExport" | "getProject" | "getProjectWorkspace" | "putCurrentVersion" | "putLyricsDraft" | "putProjectWorkspaceOpenVersion" | "listCandidates" | "listCreativeSources" | "createStudioChange" | "createCompositionRevision" | "getCompositionRevision" | "getGeneration" | "getGenerationEvents" | "cancelGeneration" | "createLyricsRevision" | "getLyricsRevision" | "getLyricsRevisionEvents" | "cancelLyricsRevision" | "createStemSeparation" | "getStemSeparation" | "getStemSeparationEvents" | "cancelStemSeparation" | "createArtworkGeneration" | "getArtworkGeneration" | "getArtworkGenerationEvents" | "cancelArtworkGeneration" | "getReleaseDraft" | "putReleaseDraft" | "createMixRevision">>
  stemPlaybackFactory?: StemPlaybackFactory
}

type TrackedStudioChange = {
  generationRef: string
  projectRef: string
  sourceVersionRef: string
  plan: StudioChangePlan
}

type TrackedLyricsRevision = {
  lyricsRevisionRef: string
  sourceVersionRef: string
  plan: StudioLyricsPlan
  commandEpoch: number
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

const versionHistoryDrawerId = "studio-version-history-drawer"
const wholeSongStructure = ["Whole song"] as const

function studioLinkCopyLabel(status: StudioLinkCopyStatus) {
  switch (status) {
    case "copying": return "Copying…"
    case "copied": return "Link copied"
    case "failed": return "Copy failed"
    default: return "Copy link"
  }
}

function StudioLinkCopyIcon({ status }: { status: StudioLinkCopyStatus }) {
  const icon = status === "copying"
    ? <LoaderCircle size={14} />
    : status === "copied"
      ? <Check size={14} />
      : status === "failed"
        ? <AlertCircle size={14} />
        : <Link2 size={14} />
  return <span className={styles.linkCopyIcon} data-link-copy-icon={status} aria-hidden="true">{icon}</span>
}

function studioExportButtonLabel(status: StudioExportFeedback) {
  switch (status) {
    case "queued":
    case "processing": return "Exporting"
    case "succeeded": return "Export ready"
    case "failed": return "Export needs attention"
    default: return "Export"
  }
}

function StudioExportIcon({ status }: { status: StudioExportFeedback }) {
  const icon = status === "queued" || status === "processing"
    ? <LoaderCircle size={14} />
    : status === "succeeded"
      ? <Check size={14} />
      : status === "failed"
        ? <AlertCircle size={14} />
        : <Download size={14} />
  return <span className={styles.exportStatusIcon} data-export-icon={status} aria-hidden="true">{icon}</span>
}

function studioGenerationQueueLabel(plan: StudioChangePlan): string {
  if (plan.operation === "add_part") return `Add part · ${plan.scopeLabel}`
  if (plan.operation === "replace_section") return `Replace section · ${plan.scopeLabel}`
  if (plan.operation === "extend") return `Extend · ${plan.scopeLabel}`
  if (plan.draft.operation !== "transform") return `Transform · ${plan.scopeLabel}`
  const operation = plan.draft.intent === "cover" ? "Cover" : plan.draft.intent === "remaster" ? "Remaster" : "Restyle"
  return `${operation} · ${plan.scopeLabel}`
}

export function StudioPageContent({ candidate, creativeSources, projectRef, versionRef, initialSurface = "arrangement", initialIntent = null, initialGenerationRef = null, api, stemPlaybackFactory = createHtmlStemPlaybackController }: StudioPageContentProps) {
  const { playerCandidate, playing, positionSeconds, seekPlayer, selectPlayerCandidate, setPlaying } = useMoriApp()
  const exportStatusDescriptionId = useId()
  const finishStatusDescriptionId = useId()
  const defaultApi = useMemo(() => createMoriApiClient(), [])
  const studioApi = useMemo(() => ({ ...defaultApi, ...(api ?? {}) }), [api, defaultApi])
  const sourceListApi = api === undefined ? defaultApi.listCreativeSources : api.listCreativeSources
  const [resolvedCreativeSources, setResolvedCreativeSources] = useState<readonly MoriCreativeLibrarySource[] | undefined>(() => creativeSources)
  useEffect(() => {
    if (creativeSources !== undefined) {
      setResolvedCreativeSources(creativeSources)
      return
    }
    if (sourceListApi === undefined) {
      setResolvedCreativeSources(undefined)
      return
    }
    let disposed = false
    void sourceListApi({ limit: 20 }).then((response) => {
      if (!disposed) setResolvedCreativeSources(response.data.sources.map(toStudioCreativeSource))
    }).catch(() => {
      if (!disposed) setResolvedCreativeSources(undefined)
    })
    return () => { disposed = true }
  }, [creativeSources, sourceListApi])
  const initialCandidate = resolveInitialCandidate(candidate, projectRef, versionRef)
  const activeProjectRef = projectRef?.trim() || previewProject.projectRef
  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(() => initialCandidate)
  const [versionLoadState, setVersionLoadState] = useState<StudioVersionLoadState>(() => initialCandidate === null && projectRef?.trim() ? "loading" : "ready")
  const [versionLoadAttempt, setVersionLoadAttempt] = useState(0)
  const [studioCandidates, setStudioCandidates] = useState(() => initialCandidate === null ? [] : [initialCandidate, ...previewCandidates.filter((item) => item.versionRef !== initialCandidate.versionRef)])
  const [currentVersionRef, setCurrentVersionRef] = useState(() => previewCandidates.find((item) => item.isCurrent)?.versionRef ?? candidate.versionRef)
  const [currentVersionCommitRun, setCurrentVersionCommitRun] = useState<CurrentVersionCommitRun>(idleCurrentVersionCommitRun)
  const [projectTitle, setProjectTitle] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<StudioTool>(() => studioToolFromEntrySurface(initialSurface))
  const [linkCopyStatus, setLinkCopyStatus] = useState<StudioLinkCopyStatus>("idle")
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false)
  const [finishDialogOpen, setFinishDialogOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportFeedback, setExportFeedback] = useState<StudioExportFeedback>("idle")
  const [exportInput, setExportInput] = useState<MoriExportInput | null>(null)
  const [exportSnapshot, setExportSnapshot] = useState<MoriExportSnapshot | null>(null)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [trackedExport, setTrackedExport] = useState<TrackedExport | null>(null)
  const [latestMixRevision, setLatestMixRevision] = useState<MoriMixRevision | null>(null)
  const [studioChangeRun, setStudioChangeRun] = useState<StudioAiRunState>(idleStudioChangeRun)
  const [trackedStudioChange, setTrackedStudioChange] = useState<TrackedStudioChange | null>(null)
  const [lyricsRevisionRun, setLyricsRevisionRun] = useState<StudioLyricsRunState>(idleLyricsRevisionRun)
  const [trackedLyricsRevision, setTrackedLyricsRevision] = useState<TrackedLyricsRevision | null>(null)
  const [pendingLyricsDraft, setPendingLyricsDraft] = useState<StudioLyricsDraftState | null>(null)
  const [pendingVersionSelection, setPendingVersionSelection] = useState<Candidate | null>(null)
  const [saveBeforeVersionSwitch, setSaveBeforeVersionSwitch] = useState(false)
  const [stemSeparationRun, setStemSeparationRun] = useState<StudioStemSeparationRunState>(idleStemSeparationRun)
  const [trackedStemSeparation, setTrackedStemSeparation] = useState<TrackedStemSeparation | null>(null)
  const activeVersionRef = activeCandidate?.versionRef ?? null
  const hasInjectedWorkspaceReader = api?.getProjectWorkspace !== undefined
  const shouldUseWorkspaceMemory = api === undefined
    ? activeProjectRef !== previewProject.projectRef
    : hasInjectedWorkspaceReader
  const workspaceMemoryApi = shouldUseWorkspaceMemory ? {
    getProjectWorkspace: api === undefined ? studioApi.getProjectWorkspace : api.getProjectWorkspace,
    putLyricsDraft: api === undefined ? studioApi.putLyricsDraft : api.putLyricsDraft,
    putProjectWorkspaceOpenVersion: api === undefined ? studioApi.putProjectWorkspaceOpenVersion : api.putProjectWorkspaceOpenVersion,
  } : undefined
  const projectWorkspaceMemory = useStudioProjectWorkspaceMemory({
    projectRef: activeProjectRef,
    activeVersionRef,
    api: workspaceMemoryApi,
  })
  const rememberPendingLyricsDraft = useCallback((next: StudioLyricsDraftState) => {
    setPendingLyricsDraft((current) => {
      if (!next.dirty) return current?.versionRef === next.versionRef ? null : current
      if (
        current?.versionRef === next.versionRef
        && current.revision === next.revision
        && current.text === next.text
      ) return current
      return next
    })
  }, [])
  const pendingLyricsAreDurable = pendingLyricsDraft !== null
    && pendingLyricsDraft.versionRef === activeVersionRef
    && projectWorkspaceMemory.lyricsDraft?.version_ref === activeVersionRef
    && projectWorkspaceMemory.lyricsDraft.text === pendingLyricsDraft.text
    && projectWorkspaceMemory.lyricsDraft.revision !== pendingLyricsDraft.revision
  const activePendingLyricsDraft = pendingLyricsDraft !== null
    && pendingLyricsDraft.versionRef === activeVersionRef
    && pendingLyricsDraft.dirty
    && !pendingLyricsAreDurable
    ? pendingLyricsDraft
    : null
  const releaseWorkflow = useStudioReleaseWorkflow({
    versionRef: activeVersionRef,
    versionTitle: activeCandidate?.title ?? "",
    api: studioApi,
  })
  const activeVersionRefRef = useRef(activeVersionRef)
  const activeProjectRefRef = useRef(activeProjectRef)
  const studioCandidatesRef = useRef(studioCandidates)
  const exportCommandEpochRef = useRef(0)
  const exportFeedbackRef = useRef<StudioExportFeedback>("idle")
  const pendingExportCommandRef = useRef<PendingExportCommand | null>(null)
  const pendingCurrentVersionCommandRef = useRef<PendingCurrentVersionCommand | null>(null)
  const lyricsRevisionCommandEpochRef = useRef(0)
  const stemSeparationCommandEpochRef = useRef(0)
  const studioChangeCommandEpochRef = useRef(0)
  const studioChangeObservationEpochRef = useRef(0)
  const studioChangeCancelRequestRef = useRef<string | null>(null)
  const previousStudioRecoveryRouteRef = useRef(initialGenerationRef)
  const recoveredStudioGenerationSnapshotRef = useRef<StudioChangeGenerationSnapshot | null>(null)
  const ignoredStemSeparationsRef = useRef(new Set<string>())
  const activeStemEventRequestRef = useRef<{ stemSeparationRef: string; controller: AbortController } | null>(null)
  const preserveInitialFinishEntryRef = useRef(initialSurface === "finish")
  const previousStudioContextRef = useRef({ projectRef: activeProjectRef, versionRef: activeVersionRef })
  const linkCopyResetTimerRef = useRef<number | null>(null)
  const linkCopyAttemptRef = useRef(0)
  const studioRecoveryGenerationRef = useRef<string | null>(null)

  useEffect(() => () => {
    linkCopyAttemptRef.current += 1
    if (linkCopyResetTimerRef.current !== null) window.clearTimeout(linkCopyResetTimerRef.current)
  }, [])
  activeVersionRefRef.current = activeVersionRef
  activeProjectRefRef.current = activeProjectRef
  studioCandidatesRef.current = studioCandidates

  useEffect(() => {
    const restoreVersionFromLocation = () => {
      const locationVersionRef = studioVersionRefFromPath(window.location.pathname, activeProjectRef)
      if (locationVersionRef === null || locationVersionRef === activeVersionRefRef.current) return
      const restoredCandidate = studioCandidatesRef.current.find((item) => item.versionRef === locationVersionRef)
      if (restoredCandidate === undefined) return
      setVersionHistoryOpen(false)
      setActiveCandidate(restoredCandidate)
    }
    window.addEventListener("popstate", restoreVersionFromLocation)
    return () => window.removeEventListener("popstate", restoreVersionFromLocation)
  }, [activeProjectRef])

  useEffect(() => {
    const previousContext = previousStudioContextRef.current
    const contextChanged = previousContext.projectRef !== activeProjectRef || previousContext.versionRef !== activeVersionRef
    previousStudioContextRef.current = { projectRef: activeProjectRef, versionRef: activeVersionRef }
    stemSeparationCommandEpochRef.current += 1
    lyricsRevisionCommandEpochRef.current += 1
    studioChangeCommandEpochRef.current += 1
    studioChangeObservationEpochRef.current += 1
    studioChangeCancelRequestRef.current = null
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
    if (contextChanged) {
      studioRecoveryGenerationRef.current = null
      recoveredStudioGenerationSnapshotRef.current = null
      setTrackedStudioChange(null)
      setStudioChangeRun(idleStudioChangeRun)
      setTrackedLyricsRevision(null)
      setLyricsRevisionRun(idleLyricsRevisionRun)
    }
    if (preserveInitialFinishEntryRef.current) {
      if (activeVersionRef !== null) {
        preserveInitialFinishEntryRef.current = false
        setFinishDialogOpen(true)
      }
    } else if (contextChanged) {
      setFinishDialogOpen(false)
    }
    setExportDialogOpen(false)
  }, [activeProjectRef, activeVersionRef])

  useEffect(() => {
    const requestedProjectRef = projectRef?.trim()
    if (!requestedProjectRef) return
    setVersionLoadState("loading")

    const getProject = studioApi.getProject
    const listCandidates = studioApi.listCandidates
    let disposed = false
    let projectedCurrentVersionRef: string | null | undefined
    let projectedCandidates: Candidate[] | undefined

    const applyCandidateProjection = () => {
      if (disposed || projectedCandidates === undefined) return
      const requestedVersionRef = versionRef?.trim()
      const nextActiveCandidate = requestedVersionRef
        ? projectedCandidates.find((item) => item.versionRef === requestedVersionRef)
        : projectedCandidates[0]
      const nextCurrentVersionRef = projectedCurrentVersionRef === undefined
        ? projectedCandidates.find((item) => item.isCurrent)?.versionRef ?? nextActiveCandidate?.versionRef ?? ""
        : projectedCurrentVersionRef ?? ""
      setStudioCandidates(projectedCandidates.map((item) => ({ ...item, isCurrent: item.versionRef === nextCurrentVersionRef })))
      if ((nextActiveCandidate?.versionRef ?? null) !== activeVersionRefRef.current) setVersionHistoryOpen(false)
      setActiveCandidate(nextActiveCandidate ?? null)
      setCurrentVersionRef(nextCurrentVersionRef)
      setVersionLoadState("ready")
    }

    if (getProject) {
      void getProject(requestedProjectRef).then((response) => {
        if (disposed) return
        setProjectTitle(response.data.title)
        projectedCurrentVersionRef = response.data.current_version_ref
        applyCandidateProjection()
      }).catch(() => {
        // Keep the deterministic project title visible while the BFF is unavailable.
      })
    }

    void listAllMoriCandidates({ listCandidates }, requestedProjectRef).then((candidates) => {
      if (disposed) return
      projectedCandidates = candidates.map(toDomainCandidate)
      applyCandidateProjection()
    }).catch(() => {
      if (disposed) return
      if (initialCandidate === null) {
        setVersionLoadState("error")
        setStudioCandidates([])
        setVersionHistoryOpen(false)
        setActiveCandidate(null)
        setCurrentVersionRef("")
      }
      // Keep the deterministic fixture visible for the known preview route.
    })

    return () => {
      disposed = true
    }
  }, [initialCandidate, projectRef, studioApi, versionLoadAttempt, versionRef])

  useEffect(() => {
    if (previousStudioRecoveryRouteRef.current === initialGenerationRef) return
    previousStudioRecoveryRouteRef.current = initialGenerationRef
    studioChangeCommandEpochRef.current += 1
    studioChangeObservationEpochRef.current += 1
    studioChangeCancelRequestRef.current = null
    studioRecoveryGenerationRef.current = null
    recoveredStudioGenerationSnapshotRef.current = null
    setTrackedStudioChange(null)
    setStudioChangeRun(idleStudioChangeRun)
  }, [initialGenerationRef])

  useEffect(() => {
    const requestedProjectRef = projectRef?.trim()
    const requestedVersionRef = versionRef?.trim()
    const candidateToRecover = activeCandidate
    if (
      requestedProjectRef === undefined
      || requestedProjectRef === ""
      || requestedVersionRef === undefined
      || requestedVersionRef === ""
      || candidateToRecover === null
      || candidateToRecover.versionRef !== requestedVersionRef
      || trackedStudioChange !== null
      || studioRecoveryGenerationRef.current !== null
    ) return
    const queue = readGenerationQueueState()
    const matchingItems = queue.items.filter((item) => (
      item.kind === "studio_change"
      && item.project_ref === requestedProjectRef
      && item.source_version_ref === requestedVersionRef
    ))
    const queuedItem = initialGenerationRef === null
      ? matchingItems.find((item) => isActiveGenerationQueueStatus(item.status))
      : queue.items.find((item) => item.generation_ref === initialGenerationRef)
    const generationRefToRecover = initialGenerationRef ?? queuedItem?.generation_ref
    if (generationRefToRecover === undefined) return

    studioRecoveryGenerationRef.current = generationRefToRecover
    let disposed = false
    let retryTimer: number | undefined
    let retryDelayMs = 900
    const observationEpoch = studioChangeObservationEpochRef.current

    const recoverRouteGeneration = async () => {
      try {
        const response = await getGenerationForRecovery(studioApi, generationRefToRecover)
        if (
          disposed
          || studioChangeObservationEpochRef.current !== observationEpoch
          || response.data.generation_ref !== generationRefToRecover
          || response.data.generation_kind !== "studio_change"
          || response.data.project_ref !== requestedProjectRef
          || response.data.source_version_ref !== requestedVersionRef
        ) return
        const plan = studioChangePlanFromSnapshot(response.data, candidateToRecover.durationSeconds)
        const storedContextMatches = queuedItem?.kind === "studio_change"
          && queuedItem.project_ref === response.data.project_ref
          && queuedItem.source_version_ref === response.data.source_version_ref
        const recoveredItem: GenerationQueueItem = {
          generation_ref: response.data.generation_ref,
          project_ref: response.data.project_ref,
          source_version_ref: response.data.source_version_ref,
          kind: "studio_change",
          label: storedContextMatches ? queuedItem.label : studioGenerationQueueLabel(plan),
          created_at: response.data.created_at,
          status: response.data.status,
          progress: response.data.progress,
          candidate_refs: response.data.candidate_refs,
          last_event_id: storedContextMatches ? queuedItem.last_event_id : null,
        }
        await updateStoredGenerationQueueState((current) => ({
          ...reconcileGenerationQueueItemFromSnapshot(current, recoveredItem),
          active_generation_ref: initialGenerationRef === null ? current.active_generation_ref : recoveredItem.generation_ref,
        }))
        if (disposed || studioChangeObservationEpochRef.current !== observationEpoch) return
        retryDelayMs = 900
        setStudioChangeRun({
          status: response.data.status,
          progress: response.data.progress,
          resultCount: response.data.candidate_refs.length,
          plan,
          message: null,
        })
        setTrackedStudioChange({
          generationRef: generationRefToRecover,
          projectRef: requestedProjectRef,
          sourceVersionRef: requestedVersionRef,
          plan,
        })
        recoveredStudioGenerationSnapshotRef.current = response.data
      } catch (error) {
        if (disposed || studioChangeObservationEpochRef.current !== observationEpoch) return
        if (isRetryableGenerationStatusError(error)) {
          retryTimer = window.setTimeout(() => { void recoverRouteGeneration() }, retryDelayMs)
          retryDelayMs = Math.min(retryDelayMs * 2, 4_000)
          return
        }
        studioRecoveryGenerationRef.current = null
      }
    }

    queueMicrotask(() => {
      if (!disposed) void recoverRouteGeneration()
    })
    return () => {
      disposed = true
      if (retryTimer !== undefined) window.clearTimeout(retryTimer)
      if (studioRecoveryGenerationRef.current === generationRefToRecover) studioRecoveryGenerationRef.current = null
    }
  }, [activeCandidate, activeProjectRef, initialGenerationRef, projectRef, studioApi, trackedStudioChange, versionRef])

  useEffect(() => {
    pendingCurrentVersionCommandRef.current = null
    setCurrentVersionCommitRun(idleCurrentVersionCommitRun)
  }, [activeProjectRef])

  const generateStudioChange = async (plan: StudioChangePlan) => {
    if (activeCandidate === null || isActiveStudioChangeStatus(studioChangeRun.status)) return
    const commandEpoch = studioChangeCommandEpochRef.current + 1
    studioChangeCommandEpochRef.current = commandEpoch
    studioChangeObservationEpochRef.current += 1
    studioChangeCancelRequestRef.current = null
    const sourceVersionRef = activeCandidate.versionRef
    setTrackedStudioChange(null)
    setStudioChangeRun({ status: "preparing", progress: 4, resultCount: 0, plan, message: null, cancelPending: false })
    try {
      const response = await studioApi.createStudioChange(
        sourceVersionRef,
        createStudioChangeRequest(plan.draft),
        `mori-studio-change-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      )
      if (studioChangeCommandEpochRef.current !== commandEpoch) return
      setStudioChangeRun({
        status: response.data.status,
        progress: response.data.status === "queued" ? 0 : 12,
        resultCount: 0,
        plan,
        message: null,
        cancelPending: false,
      })
      const queueItem: GenerationQueueItem = {
        generation_ref: response.data.generation_ref,
        project_ref: activeProjectRef,
        source_version_ref: sourceVersionRef,
        kind: "studio_change",
        label: studioGenerationQueueLabel(plan),
        created_at: new Date().toISOString(),
        status: response.data.status,
        progress: response.data.status === "queued" ? 0 : 12,
        candidate_refs: [],
        last_event_id: null,
      }
      await updateStoredGenerationQueueState((current) => ({
        ...upsertGenerationQueueItem(current, queueItem),
        active_generation_ref: queueItem.generation_ref,
      }))
      if (studioChangeCommandEpochRef.current !== commandEpoch) return
      setTrackedStudioChange({
        generationRef: response.data.generation_ref,
        projectRef: activeProjectRef,
        sourceVersionRef,
        plan,
      })
    } catch (error) {
      if (studioChangeCommandEpochRef.current !== commandEpoch) return
      setStudioChangeRun({
        status: "failed",
        progress: 0,
        resultCount: 0,
        plan,
        message: studioChangeFailureMessage(error),
        cancelPending: false,
      })
    }
  }

  useEffect(() => {
    if (trackedStudioChange === null) return
    let disposed = false
    let timer: number | undefined
    let lastEventId: string | null = readGenerationQueueState().items.find((item) => item.generation_ref === trackedStudioChange.generationRef)?.last_event_id ?? null
    let retryDelayMs = 900
    const eventController = new AbortController()
    const observationEpoch = studioChangeObservationEpochRef.current

    const sync = async () => {
      try {
        const recoveredSnapshot = recoveredStudioGenerationSnapshotRef.current?.generation_ref === trackedStudioChange.generationRef
          ? recoveredStudioGenerationSnapshotRef.current
          : null
        if (recoveredSnapshot !== null) recoveredStudioGenerationSnapshotRef.current = null
        const snapshot = recoveredSnapshot ?? (await studioApi.getGeneration(trackedStudioChange.generationRef)).data
        if (disposed || studioChangeObservationEpochRef.current !== observationEpoch) return
        if (
          snapshot.generation_kind !== "studio_change"
          || snapshot.project_ref !== trackedStudioChange.projectRef
        ) throw new Error("studio_change_snapshot_context_mismatch")
        if (!studioChangeSnapshotMatchesPlan(snapshot, trackedStudioChange)) {
          throw new Error(studioChangeSnapshotMismatchCode(trackedStudioChange.plan))
        }
        retryDelayMs = 900

        let status = snapshot.status
        let progress = snapshot.progress
        let candidateRefs = snapshot.candidate_refs

        if (studioApi.getGenerationEvents !== undefined) {
          try {
            const events = await studioApi.getGenerationEvents(trackedStudioChange.generationRef, lastEventId, eventController.signal)
            if (disposed || studioChangeObservationEpochRef.current !== observationEpoch) return
            const latest = events.at(-1)
            if (
              latest !== undefined
              && latest.data.generation_ref === trackedStudioChange.generationRef
              && latest.data.project_ref === trackedStudioChange.projectRef
            ) {
              lastEventId = latest.id
              status = latest.data.status
              progress = latest.data.progress
              candidateRefs = latest.data.candidate_refs
            }
          } catch {
            // Durable snapshot polling remains the recovery path when event replay is unavailable.
          }
        }

        const reconciledQueue = await updateStoredGenerationQueueState((current) => updateGenerationQueueItem(current, trackedStudioChange.generationRef, {
          status,
          progress,
          candidate_refs: candidateRefs,
          last_event_id: lastEventId,
        }))
        if (disposed || studioChangeObservationEpochRef.current !== observationEpoch) return
        const reconciledItem = reconciledQueue.items.find((item) => item.generation_ref === trackedStudioChange.generationRef)
        if (reconciledItem !== undefined) {
          status = reconciledItem.status
          progress = reconciledItem.progress
          candidateRefs = [...reconciledItem.candidate_refs]
          lastEventId = reconciledItem.last_event_id
        }
        setStudioChangeRun((current) => ({ ...current, status, progress, message: null, cancelPending: current.cancelPending }))

        if (status === "succeeded") {
          const candidateResponse = await listAllMoriCandidates(studioApi, snapshot.project_ref)
          if (disposed || studioChangeObservationEpochRef.current !== observationEpoch) return
          const generatedCandidates = candidateResponse
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
        if (!disposed && studioChangeObservationEpochRef.current === observationEpoch) {
          const queued = readGenerationQueueState()
          const queuedItem = queued.items.find((item) => item.generation_ref === trackedStudioChange.generationRef)
          if (queuedItem !== undefined && isActiveGenerationQueueStatus(queuedItem.status) && !isStudioChangeContextMismatch(error)) {
            setStudioChangeRun((current) => ({
              ...current,
              message: isRetryableGenerationStatusError(error)
                ? "Mori is reconnecting. The render is still running."
                : "Mori status is unavailable. Retrying without changing the run.",
            }))
            timer = window.setTimeout(() => { void sync() }, retryDelayMs)
            retryDelayMs = Math.min(retryDelayMs * 2, 4_000)
            return
          }
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
      eventController.abort()
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [studioApi, trackedStudioChange])

  const cancelStudioChange = async () => {
    if (trackedStudioChange === null) return
    const generationRef = trackedStudioChange.generationRef
    if (studioChangeCancelRequestRef.current === generationRef) return
    const commandEpoch = studioChangeCommandEpochRef.current
    studioChangeCancelRequestRef.current = generationRef
    setStudioChangeRun((current) => ({ ...current, cancelPending: true, message: "Stopping after the current render step…" }))
    try {
      const response = await studioApi.cancelGeneration(
        generationRef,
        `mori-studio-cancel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      )
      if (studioChangeCommandEpochRef.current !== commandEpoch) return
      if (response.data.generation_ref !== generationRef) throw new Error("studio_cancel_context_mismatch")
      const reconciledQueue = await updateStoredGenerationQueueState((current) => {
        const queuedItem = current.items.find((item) => item.generation_ref === generationRef)
        return updateGenerationQueueItem(current, generationRef, {
          status: response.data.status,
          progress: queuedItem?.progress ?? studioChangeRun.progress,
        })
      })
      if (studioChangeCommandEpochRef.current !== commandEpoch) return
      const reconciledItem = reconciledQueue.items.find((item) => item.generation_ref === generationRef)
      const status = reconciledItem?.status ?? response.data.status
      if (status === "cancelled" || status === "failed" || status === "expired") {
        studioChangeObservationEpochRef.current += 1
        setTrackedStudioChange(null)
      }
      setStudioChangeRun((current) => ({
        ...current,
        status,
        progress: reconciledItem?.progress ?? current.progress,
        message: null,
        cancelPending: false,
      }))
    } catch {
      if (studioChangeCommandEpochRef.current === commandEpoch) {
        setStudioChangeRun((current) => ({ ...current, cancelPending: false, message: "Cancellation did not complete. Rendering is still being tracked." }))
      }
    } finally {
      if (studioChangeCancelRequestRef.current === generationRef) studioChangeCancelRequestRef.current = null
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
    const commandEpoch = lyricsRevisionCommandEpochRef.current + 1
    lyricsRevisionCommandEpochRef.current = commandEpoch
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
      if (commandEpoch !== lyricsRevisionCommandEpochRef.current || activeVersionRefRef.current !== sourceVersionRef) return
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
        commandEpoch,
      })
    } catch (error) {
      if (commandEpoch !== lyricsRevisionCommandEpochRef.current || activeVersionRefRef.current !== sourceVersionRef) return
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
    const eventController = new AbortController()
    const isCurrent = () => (
      !disposed
      && trackedLyricsRevision.commandEpoch === lyricsRevisionCommandEpochRef.current
      && trackedLyricsRevision.sourceVersionRef === activeVersionRefRef.current
    )

    const sync = async () => {
      try {
        const response = await studioApi.getLyricsRevision(trackedLyricsRevision.lyricsRevisionRef)
        if (!isCurrent()) return
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
          const events = await studioApi.getLyricsRevisionEvents(trackedLyricsRevision.lyricsRevisionRef, lastEventId, eventController.signal)
          if (!isCurrent()) return
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

        if (!isCurrent()) return
        setLyricsRevisionRun((current) => ({ ...current, status, progress, message: null }))
        timer = window.setTimeout(() => { void sync() }, 800)
      } catch (error) {
        if (isCurrent()) {
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
      eventController.abort()
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [studioApi, trackedLyricsRevision])

  const cancelLyricsRevision = async () => {
    if (trackedLyricsRevision === null) return
    const tracked = trackedLyricsRevision
    const lyricsRevisionRef = tracked.lyricsRevisionRef
    setLyricsRevisionRun((current) => ({ ...current, message: "Stopping after the current writing step…" }))
    try {
      const response = await studioApi.cancelLyricsRevision(
        lyricsRevisionRef,
        `mori-lyrics-cancel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      )
      if (
        tracked.commandEpoch !== lyricsRevisionCommandEpochRef.current
        || tracked.sourceVersionRef !== activeVersionRefRef.current
      ) return
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
      if (
        tracked.commandEpoch === lyricsRevisionCommandEpochRef.current
        && tracked.sourceVersionRef === activeVersionRefRef.current
      ) setLyricsRevisionRun((current) => ({ ...current, message: "Cancellation did not complete. This revision is still being tracked." }))
    }
  }

  const resetLyricsRevision = () => {
    if (isActiveLyricsRevisionStatus(lyricsRevisionRun.status)) return
    lyricsRevisionCommandEpochRef.current += 1
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

  const completeTakeSelection = useCallback((take: Candidate) => {
    if (take.versionRef !== activeVersionRefRef.current) setVersionHistoryOpen(false)
    setActiveCandidate(take)
    const nextHref = canonicalStudioHref(window.location.href, activeProjectRefRef.current, take.versionRef)
    if (nextHref !== window.location.href) window.history.pushState(null, "", nextHref)
  }, [])

  const selectTake = useCallback((take: Candidate) => {
    if (take.versionRef === activeVersionRefRef.current) return
    if (activePendingLyricsDraft === null) {
      completeTakeSelection(take)
      return
    }
    setPendingVersionSelection(take)
    setSaveBeforeVersionSwitch(projectWorkspaceMemory.saveRun.status === "saving")
  }, [activePendingLyricsDraft, completeTakeSelection, projectWorkspaceMemory.saveRun.status])

  const stayOnCurrentVersion = useCallback(() => {
    setPendingVersionSelection(null)
    setSaveBeforeVersionSwitch(false)
  }, [])

  const discardLyricsAndOpenVersion = useCallback(() => {
    const nextVersion = pendingVersionSelection
    if (nextVersion === null) return
    setPendingLyricsDraft(null)
    setPendingVersionSelection(null)
    setSaveBeforeVersionSwitch(false)
    completeTakeSelection(nextVersion)
  }, [completeTakeSelection, pendingVersionSelection])

  const saveLyricsAndOpenVersion = useCallback(() => {
    if (pendingVersionSelection === null || pendingLyricsDraft === null) return
    setSaveBeforeVersionSwitch(true)
    if (projectWorkspaceMemory.saveRun.status === "failed" && projectWorkspaceMemory.saveRun.retryable) {
      projectWorkspaceMemory.retrySave()
      return
    }
    projectWorkspaceMemory.saveLyrics(pendingLyricsDraft.text)
  }, [pendingLyricsDraft, pendingVersionSelection, projectWorkspaceMemory])

  useEffect(() => {
    if (!saveBeforeVersionSwitch || pendingVersionSelection === null || projectWorkspaceMemory.saveRun.status !== "saved") return
    const nextVersion = pendingVersionSelection
    setPendingLyricsDraft(null)
    setPendingVersionSelection(null)
    setSaveBeforeVersionSwitch(false)
    completeTakeSelection(nextVersion)
  }, [completeTakeSelection, pendingVersionSelection, projectWorkspaceMemory.saveRun.status, saveBeforeVersionSwitch])

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

  const commitCurrentVersion = async (take: Candidate, retryCommand?: PendingCurrentVersionCommand) => {
    if (currentVersionCommitRun.status === "saving" || take.versionRef === currentVersionRef) return
    const expectedCurrentVersionRef = currentVersionRef.trim() === "" ? null : currentVersionRef
    const command = retryCommand
      ?? currentVersionCommand(
        activeProjectRef,
        take.candidateRef,
        take.versionRef,
        expectedCurrentVersionRef,
        pendingCurrentVersionCommandRef.current,
      )
    pendingCurrentVersionCommandRef.current = command
    setCurrentVersionCommitRun({
      status: "saving",
      targetVersionRef: take.versionRef,
      message: null,
      retryable: false,
    })
    try {
      const response = await studioApi.putCurrentVersion(command.projectRef, command.input, command.idempotencyKey)
      if (!currentVersionSelectionMatchesCommand(response.data, command)) {
        throw new Error("current_version_confirmation_mismatch")
      }
      setCurrentVersionRef(take.versionRef)
      setStudioCandidates((current) => current.map((item) => ({ ...item, isCurrent: item.versionRef === take.versionRef })))
      selectTake(take)
      pendingCurrentVersionCommandRef.current = null
      setCurrentVersionCommitRun({
        status: "succeeded",
        targetVersionRef: take.versionRef,
        message: `${take.title} is now the Current Version.`,
        retryable: false,
      })
    } catch (error) {
      const failure = currentVersionCommitFailure(error, "Take")
      if (!failure.retryable) pendingCurrentVersionCommandRef.current = null
      setCurrentVersionCommitRun({
        status: "failed",
        targetVersionRef: take.versionRef,
        message: failure.message,
        retryable: failure.retryable,
      })
    }
  }

  const retryCurrentVersionCommit = () => {
    const command = pendingCurrentVersionCommandRef.current
    if (command === null || !currentVersionCommitRun.retryable) return
    const take = studioCandidates.find((item) => (
      item.candidateRef === command.input.candidate_ref
      && item.versionRef === command.input.version_ref
    ))
    if (take !== undefined) void commitCurrentVersion(take, command)
  }

  const dismissCurrentVersionCommit = () => {
    pendingCurrentVersionCommandRef.current = null
    setCurrentVersionCommitRun(idleCurrentVersionCommitRun)
  }

  const copyStudioLink = async () => {
    if (linkCopyStatus === "copying") return
    const attempt = linkCopyAttemptRef.current + 1
    linkCopyAttemptRef.current = attempt
    if (linkCopyResetTimerRef.current !== null) {
      window.clearTimeout(linkCopyResetTimerRef.current)
      linkCopyResetTimerRef.current = null
    }
    setLinkCopyStatus("copying")
    try {
      if (navigator.clipboard === undefined) throw new Error("Clipboard access is unavailable")
      const versionRef = activeVersionRefRef.current
      if (versionRef === null) throw new Error("Studio Version is unavailable")
      await navigator.clipboard.writeText(canonicalStudioHref(window.location.href, activeProjectRefRef.current, versionRef))
      if (linkCopyAttemptRef.current !== attempt) return
      setLinkCopyStatus("copied")
    } catch {
      if (linkCopyAttemptRef.current !== attempt) return
      setLinkCopyStatus("failed")
    }
    if (linkCopyAttemptRef.current !== attempt) return
    linkCopyResetTimerRef.current = window.setTimeout(() => {
      if (linkCopyAttemptRef.current === attempt) setLinkCopyStatus("idle")
      linkCopyResetTimerRef.current = null
    }, 2200)
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
  const hasPreviewProjectContent = activeProjectRef === previewProject.projectRef
  const workspaceVersionIsOpen = activeVersionRef !== null
    && projectWorkspaceMemory.projection?.open_version?.version_ref === activeVersionRef
  const isRecoveringWorkspaceVersion = projectWorkspaceMemory.workspaceStatus === "ready"
    && !workspaceVersionIsOpen
    && projectWorkspaceMemory.canSyncOpenVersion
    && projectWorkspaceMemory.saveRun.status !== "failed"
  const lyricsDraftSource: StudioLyricsDraftSource = projectWorkspaceMemory.workspaceStatus === "loading" || isRecoveringWorkspaceVersion
    ? "loading"
    : projectWorkspaceMemory.workspaceStatus === "ready" && workspaceVersionIsOpen
      ? "workspace"
      : hasPreviewProjectContent
        ? "preview"
        : "unavailable"
  const durableStudioLyrics = lyricsDraftSource === "workspace"
    ? projectWorkspaceMemory.lyricsDraft?.text ?? ""
    : lyricsDraftSource === "preview"
      ? defaultStudioLyrics
      : ""
  const workspaceLyricsRevision = projectWorkspaceMemory.lyricsDraft?.revision ?? null
  const canRestorePendingLyrics = activePendingLyricsDraft !== null
    && (lyricsDraftSource !== "workspace" || activePendingLyricsDraft.revision === workspaceLyricsRevision)
  const initialStudioLyrics = canRestorePendingLyrics && activePendingLyricsDraft !== null
    ? activePendingLyricsDraft.text
    : durableStudioLyrics
  const studioLyricsKey = `${activeVersionRef ?? "no-version"}:${lyricsDraftSource}:${projectWorkspaceMemory.lyricsDraft?.revision ?? "new"}`
  const remasterRun = isStudioRemasterPlan(studioChangeRun.plan)
  const remasterActive = remasterRun && isActiveStudioChangeStatus(studioChangeRun.status)
  const finishActive = remasterActive || releaseWorkflow.active
  function navigateStudioTools(event: ReactKeyboardEvent<HTMLButtonElement>, currentTool: StudioTool) {
    const nextTool = studioToolForKey(event.key, currentTool)
    if (nextTool === null) return
    event.preventDefault()
    setActiveTool(nextTool)
    document.getElementById(`mori-studio-tool-${nextTool}`)?.focus()
  }

  return (
    <MoriStudioShell>
      <header className={styles.studioHeader}>
          <div className={styles.studioHeaderLeft}><Link className={styles.studioBack} href={`/projects/${activeProjectRef}`}><ArrowLeft size={15} /> {activeProjectTitle}</Link><span>/</span><strong>Studio</strong></div>
          <div className={styles.studioHeaderActions}>
            <StudioWorkspaceSaveStatus run={projectWorkspaceMemory.saveRun} hasCurrentDraftChanges={activePendingLyricsDraft !== null} onRetry={projectWorkspaceMemory.retrySave} onRefresh={projectWorkspaceMemory.refresh} />
            <button
              className={`${styles.ghostButton} ${styles.linkCopyButton}`}
              type="button"
              title={studioLinkCopyLabel(linkCopyStatus)}
              data-link-copy-status={linkCopyStatus}
              data-action="copy"
              disabled={linkCopyStatus === "copying"}
              onClick={() => { void copyStudioLink() }}
            >
              <StudioLinkCopyIcon status={linkCopyStatus} /> <span aria-live="polite">{studioLinkCopyLabel(linkCopyStatus)}</span>
            </button>
            <StudioGenerationQueue projectRef={activeProjectRef} activeVersionRef={activeVersionRef} />
          {activeCandidate !== null ? <>
            <button
              className={`${styles.ghostButton} ${styles.versionHistoryTrigger}`}
              type="button"
              aria-label="Open version history"
              aria-expanded={versionHistoryOpen}
              aria-controls={versionHistoryDrawerId}
              data-action="versions"
              onClick={() => setVersionHistoryOpen(true)}
            ><History size={14} /> Versions</button>
            <button
              className={`${styles.ghostButton} ${styles.finishButton}`}
              type="button"
              aria-label="Finish"
              aria-describedby={finishStatusDescriptionId}
              data-finish-status={studioChangeRun.status}
              data-action="finish"
              onClick={() => setFinishDialogOpen(true)}
            >
              <Sparkles size={14} /> Finish
              {finishActive ? <span className={styles.studioActionActivity} aria-hidden="true" /> : null}
            </button>
            <span className={styles.srOnly} id={finishStatusDescriptionId} aria-live="polite">{finishStatusDescription(studioChangeRun, releaseWorkflow.activityDescription)}</span>
            <button
              className={`${styles.ghostButton} ${styles.exportButton}`}
              type="button"
              aria-label={studioExportButtonLabel(exportFeedback)}
              aria-describedby={exportStatusDescriptionId}
              title={exportStatusDescription(exportFeedback)}
              data-export-status={exportFeedback}
              data-action="export"
              onClick={() => setExportDialogOpen(true)}
            ><StudioExportIcon status={exportFeedback} /> <span>{studioExportButtonLabel(exportFeedback)}</span></button>
            <span className={styles.srOnly} id={exportStatusDescriptionId} aria-live="polite">{exportStatusDescription(exportFeedback)}</span>
          </> : null}
        </div>
      </header>
      {activeCandidate === null ? <section className={styles.studioUnavailable} aria-label={versionLoadState === "loading" ? "Loading Studio version" : versionLoadState === "error" ? "Studio version load error" : "Studio version unavailable"}>
        <div className={styles.studioUnavailableIcon}>{versionLoadState === "loading" ? <LoaderCircle size={20} /> : <Sparkles size={20} />}</div>
        {versionLoadState === "loading" ? <>
          <h1>Loading this Version</h1>
          <p>Mori is opening the audio, timeline, and tools for this Version.</p>
        </> : versionLoadState === "error" ? <>
          <h1>Version connection needs another try</h1>
          <p>The project is still here, but this Version did not load. Try again or return to the project.</p>
          <button className={styles.generateButton} type="button" onClick={() => setVersionLoadAttempt((attempt) => attempt + 1)}><RotateCcw size={14} /> Try again</button>
        </> : <>
          <h1>This Version is not available</h1>
          <p>Mori could not find a playable Version for this project. Return to the project and choose another direction.</p>
          <Link className={styles.generateButton} href={`/projects/${activeProjectRef}`}><ArrowLeft size={14} /> Back to projects</Link>
        </>}
      </section> : <div className={styles.studioLayout}>
        <aside className={styles.studioSidebar} aria-label="Studio tools">
          <div className={styles.studioArtwork}><span>01</span></div>
          <div className={styles.studioSidebarCopy}><span>{activeCandidate.versionRef === currentVersionRef ? "Current version" : "Open take"}</span><h1>{activeCandidate.title}</h1><p>{activeCandidate.subtitle}</p></div>
          <div className={styles.studioToolList} role="tablist" aria-label="Studio workspace">
            <button className={activeTool === "arrangement" ? styles.studioToolActive : ""} id="mori-studio-tool-arrangement" type="button" role="tab" aria-selected={activeTool === "arrangement"} aria-controls="mori-studio-panel-arrangement" tabIndex={activeTool === "arrangement" ? 0 : -1} onKeyDown={(event) => navigateStudioTools(event, "arrangement")} onClick={() => setActiveTool("arrangement")}><AudioLines size={15} /> Arrangement</button>
            <button className={activeTool === "lyrics" ? styles.studioToolActive : ""} id="mori-studio-tool-lyrics" type="button" role="tab" aria-selected={activeTool === "lyrics"} aria-controls="mori-studio-panel-lyrics" tabIndex={activeTool === "lyrics" ? 0 : -1} onKeyDown={(event) => navigateStudioTools(event, "lyrics")} onClick={() => setActiveTool("lyrics")}><FileText size={15} /> Lyrics</button>
            <button className={activeTool === "stems" ? styles.studioToolActive : ""} id="mori-studio-tool-stems" type="button" role="tab" aria-selected={activeTool === "stems"} aria-controls="mori-studio-panel-stems" tabIndex={activeTool === "stems" ? 0 : -1} onKeyDown={(event) => navigateStudioTools(event, "stems")} onClick={() => setActiveTool("stems")}><AudioWaveform size={15} /> Voice &amp; stems</button>
          </div>
          <div className={styles.studioSidebarBottom}>
            <span>Version state</span>
            <strong>{activeCandidate.versionRef === currentVersionRef ? "Current · saved" : "Open take · not current"}</strong>
            <small>AI changes create new takes.</small>
          </div>
        </aside>
        <section className={styles.studioCanvas} aria-label="Studio editor">
          <div className={styles.studioCanvasTop}><div><span className={styles.eyebrow}><span className={styles.eyebrowDot} />Editing with intention</span><h2>Shape the feeling.</h2></div></div>
          <div id="mori-studio-panel-arrangement" role="tabpanel" aria-labelledby="mori-studio-tool-arrangement" hidden={activeTool !== "arrangement"}>
            {activeTool === "arrangement" ? <ArrangementEditor key={`${activeCandidate.versionRef}:${projectWorkspaceMemory.projection?.open_version?.revision ?? 0}`} compositionSave={(api !== undefined && "createCompositionRevision" in api ? api.createCompositionRevision : studioApi.createCompositionRevision) as MoriApi["createCompositionRevision"]} compositionLoad={(api !== undefined && "getCompositionRevision" in api ? api.getCompositionRevision : studioApi.getCompositionRevision) as MoriApi["getCompositionRevision"]} compositionRevision={projectWorkspaceMemory.projection?.open_version?.revision ?? 0} onRefreshWorkspace={projectWorkspaceMemory.refresh} candidate={activeCandidate} creativeSources={resolvedCreativeSources} takes={studioCandidates} structure={hasPreviewProjectContent ? previewSongPlan.structure : wholeSongStructure} lyricsPreview={initialStudioLyrics} currentVersionRef={currentVersionRef} playerVersionRef={playerCandidate?.versionRef ?? ""} positionSeconds={playerCandidate?.versionRef === activeCandidate.versionRef ? positionSeconds : 0} playing={playerCandidate?.versionRef === activeCandidate.versionRef && playing} initialIntent={initialIntent} studioChangeRun={studioChangeRun} currentVersionCommitRun={currentVersionCommitRun} onSeekTimeline={(nextPositionSeconds) => seekTimeline(activeCandidate, nextPositionSeconds)} onGenerateStudioChange={(plan) => { void generateStudioChange(plan) }} onCancelStudioChange={() => { void cancelStudioChange() }} onResetStudioChange={resetStudioChange} onSelectTake={selectTake} onPreviewTake={previewTake} onPromoteTake={(take) => { void commitCurrentVersion(take) }} onRetryCurrentVersion={retryCurrentVersionCommit} onDismissCurrentVersion={dismissCurrentVersionCommit} onOpenLyrics={() => {
              setActiveTool("lyrics")
              window.requestAnimationFrame(() => document.getElementById("mori-studio-tool-lyrics")?.focus())
            }} /> : null}
          </div>
          <div id="mori-studio-panel-lyrics" role="tabpanel" aria-labelledby="mori-studio-tool-lyrics" hidden={activeTool !== "lyrics"}>
            {activeTool === "lyrics" ? <StudioLyricsEditor key={studioLyricsKey} versionRef={activeCandidate.versionRef} initialLyrics={initialStudioLyrics} baselineLyrics={durableStudioLyrics} draftRevision={workspaceLyricsRevision} draftSource={lyricsDraftSource} draftSaveRun={projectWorkspaceMemory.saveRun} canSaveDraft={projectWorkspaceMemory.canSaveLyrics} run={lyricsRevisionRun} onGenerate={(plan) => { void generateLyricsRevision(plan) }} onCancel={() => { void cancelLyricsRevision() }} onReset={resetLyricsRevision} onSaveDraft={projectWorkspaceMemory.saveLyrics} onRefreshDraft={projectWorkspaceMemory.refresh} onDraftStateChange={rememberPendingLyricsDraft} /> : null}
          </div>
          <div id="mori-studio-panel-stems" role="tabpanel" aria-labelledby="mori-studio-tool-stems" hidden={activeTool !== "stems"}>
            {activeTool === "stems" ? <StudioStemsEditor key={activeVersionRef ?? "no-version"} durationSeconds={activeCandidate.durationSeconds} run={stemSeparationRun} layerRun={studioChangeRun} onSeparate={(plan) => { void generateStemSeparation(plan) }} onCancel={() => { void cancelStemSeparation() }} onReset={resetStemSeparation} onSaveMix={saveMixRevision} onGenerateLayer={(plan) => { void generateStudioChange(plan) }} onCancelLayer={() => { void cancelStudioChange() }} onResetLayer={resetStudioChange} onReviewTakes={() => setActiveTool("arrangement")} playbackFactory={stemPlaybackFactory} /> : null}
          </div>
        </section>
        <StudioVersionHistoryRail
          className={styles.versionHistorySlot}
          candidates={studioCandidates}
          projectRef={activeProjectRef}
          openVersionRef={activeCandidate.versionRef}
          currentVersionRef={currentVersionRef}
          onSelectVersion={selectTake}
        />
      </div>}
      {versionHistoryOpen && activeCandidate !== null ? <StudioVersionHistoryDrawer
        id={versionHistoryDrawerId}
        candidates={studioCandidates}
        projectRef={activeProjectRef}
        openVersionRef={activeCandidate.versionRef}
        currentVersionRef={currentVersionRef}
        onSelectVersion={selectTake}
        onClose={() => setVersionHistoryOpen(false)}
      /> : null}
      {pendingVersionSelection !== null && activeCandidate !== null ? <StudioUnsavedLyricsDialog
        currentVersionTitle={activeCandidate.title}
        targetVersionTitle={pendingVersionSelection.title}
        canSave={projectWorkspaceMemory.canSaveLyrics}
        canRefreshWorkspace={lyricsDraftSource === "unavailable"}
        saveRun={projectWorkspaceMemory.saveRun}
        onStay={stayOnCurrentVersion}
        onDiscard={discardLyricsAndOpenVersion}
        onSave={saveLyricsAndOpenVersion}
        onRefresh={projectWorkspaceMemory.refresh}
      /> : null}
      {exportDialogOpen && activeCandidate !== null ? <StudioExportDialog
        versionTitle={activeCandidate.title}
        durationSeconds={activeCandidate.durationSeconds}
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
          publishState: releaseWorkflow.releasePublish,
          onPublish: () => { void releaseWorkflow.publishRelease() },
          onUnpublish: () => { void releaseWorkflow.unpublishRelease() },
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

function studioToolForKey(key: string, currentTool: StudioTool): StudioTool | null {
  if (key === "Home") return studioToolOrder[0] ?? null
  if (key === "End") return studioToolOrder.at(-1) ?? null
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key)) return null

  const currentIndex = studioToolOrder.indexOf(currentTool)
  const direction = key === "ArrowRight" || key === "ArrowDown" ? 1 : -1
  return studioToolOrder[(currentIndex + direction + studioToolOrder.length) % studioToolOrder.length] ?? null
}

function studioToolFromEntrySurface(surface: StudioEntrySurface): StudioTool {
  return surface === "lyrics" || surface === "stems" ? surface : "arrangement"
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
    audioAssetRef: candidate.audio_asset_ref,
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

function exportStatusDescription(status: StudioExportFeedback): string {
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

function isStudioChangeContextMismatch(error: unknown): boolean {
  return error instanceof Error && [
    "studio_change_snapshot_context_mismatch",
    "studio_remaster_snapshot_context_mismatch",
    "studio_restyle_snapshot_context_mismatch",
    "studio_cover_snapshot_context_mismatch",
  ].includes(error.message)
}

function isActiveGenerationQueueStatus(status: GenerationQueueItem["status"]): boolean {
  return status === "queued" || status === "preparing" || status === "generating" || status === "post_processing"
}

function isRetryableGenerationStatusError(error: unknown): boolean {
  return error instanceof MoriApiRequestError && error.retryable
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
  compositionSave: MoriApi["createCompositionRevision"]
  compositionLoad: MoriApi["getCompositionRevision"]
  compositionRevision: number
  onRefreshWorkspace: () => void
  candidate: Candidate
  creativeSources?: readonly MoriCreativeLibrarySource[]
  takes: Candidate[]
  structure: readonly string[]
  lyricsPreview: string
  currentVersionRef: string
  playerVersionRef: string
  positionSeconds: number
  playing: boolean
  initialIntent: StudioEntryIntent
  studioChangeRun: StudioAiRunState
  currentVersionCommitRun: CurrentVersionCommitRun
  onSeekTimeline: (positionSeconds: number) => void
  onGenerateStudioChange: (plan: StudioChangePlan) => void
  onCancelStudioChange: () => void
  onResetStudioChange: () => void
  onSelectTake: (take: Candidate) => void
  onPreviewTake: (take: Candidate) => void
  onPromoteTake: (take: Candidate) => void
  onRetryCurrentVersion: () => void
  onDismissCurrentVersion: () => void
  onOpenLyrics: () => void
}

function compositionFromOwnerRevision(revision: MoriCompositionRevision): Composition {
  return {
    tracks: revision.tracks.map((track) => ({
      trackRef: track.track_ref,
      kind: track.kind,
      name: track.name,
      clips: track.clips.map((clip) => ({
        clipRef: clip.clip_ref,
        sourceRef: clip.source_ref,
        startMs: clip.start_ms,
        durationMs: clip.duration_ms,
        offsetMs: clip.offset_ms,
        ...(clip.fade_in_ms === undefined ? {} : { fadeInMs: clip.fade_in_ms }),
        ...(clip.fade_out_ms === undefined ? {} : { fadeOutMs: clip.fade_out_ms }),
      })),
    })),
  }
}

function ArrangementEditor({ compositionSave, compositionLoad, compositionRevision, onRefreshWorkspace, candidate, creativeSources, takes, structure, lyricsPreview, currentVersionRef, playerVersionRef, positionSeconds, playing, initialIntent, studioChangeRun, currentVersionCommitRun, onSeekTimeline, onGenerateStudioChange, onCancelStudioChange, onResetStudioChange, onSelectTake, onPreviewTake, onPromoteTake, onRetryCurrentVersion, onDismissCurrentVersion, onOpenLyrics }: ArrangementEditorProps) {
  const timelineSections = useMemo(() => buildStudioTimelineSections(structure, candidate.durationSeconds), [candidate.durationSeconds, structure])
  const defaultSection = studioChangeRun.plan?.selection
    ?? timelineSections.find((item) => item.label.toLowerCase() === "chorus")
    ?? timelineSections[0]
  const [selectionState, setSelectionState] = useState<{ versionRef: string; selection: StudioTimelineSection | undefined }>(() => ({
    versionRef: candidate.versionRef,
    selection: defaultSection,
  }))
  const selection = selectionState.versionRef === candidate.versionRef ? selectionState.selection : defaultSection
  const changeActive = isActiveStudioChangeStatus(studioChangeRun.status)
  const compositionTracks = useMemo<CompositionTrack[]>(() => [{
    trackRef: `${candidate.versionRef}:main`, kind: "other", name: "Main version",
    clips: [{ clipRef: `${candidate.versionRef}:clip`, sourceRef: candidate.versionRef, startMs: 0, durationMs: Math.round(candidate.durationSeconds * 1_000), offsetMs: 0 }],
  }], [candidate.durationSeconds, candidate.versionRef])
  const compositionDocument = useMemo<Composition>(() => ({ tracks: compositionTracks }), [compositionTracks])
  const compositionEditor = useCompositionEditor(compositionDocument, async (input, idempotencyKey) => {
    const response = await compositionSave(candidate.versionRef, input as MoriCompositionRevisionInput, idempotencyKey)
    return {
      revision: response.data.revision,
      composition: response.data.tracks.length === 0 ? undefined : compositionFromOwnerRevision(response.data),
    }
  }, compositionRevision)
  const [selectedClipRef, setSelectedClipRef] = useState<string | undefined>(undefined)
  const [selectedTrackRef, setSelectedTrackRef] = useState<string | undefined>(compositionTracks[0]?.trackRef)
  const [editOperation, setEditOperation] = useState<"move" | "trim" | "split" | "crop" | "fade" | null>(null)
  const replaceCompositionFromOwner = compositionEditor.replaceFromOwner
  useEffect(() => {
    let disposed = false
    void compositionLoad(candidate.versionRef).then((response) => {
      if (disposed || response.data.version_ref !== candidate.versionRef || response.data.tracks.length === 0) return
      const composition = compositionFromOwnerRevision(response.data)
      if (replaceCompositionFromOwner(composition, response.data.revision)) {
        setSelectedTrackRef(composition.tracks[0]?.trackRef)
        setSelectedClipRef(undefined)
        setEditOperation(null)
      }
    }).catch(() => undefined)
    return () => { disposed = true }
  }, [candidate.versionRef, compositionLoad, replaceCompositionFromOwner])
  const insertSources = useMemo<CompositionInsertSource[]>(() => takes.map((take) => ({
    sourceRef: take.versionRef,
    label: take.title,
    description: take.subtitle,
    durationMs: Math.round(take.durationSeconds * 1_000),
  })), [takes])
  const duplicateClip = (clipRef: string, trackRef: string) => {
    const track = compositionEditor.composition.find((item) => item.trackRef === trackRef)
    const source = track?.clips.find((clip) => clip.clipRef === clipRef)
    if (source === undefined) return
    const endMs = Math.max(...(track?.clips.map((clip) => clip.startMs + clip.durationMs) ?? [0]))
    compositionEditor.editAndQueue({ operation: "insert", trackRef, clip: { ...source, clipRef: `${source.clipRef}:copy-${(track?.clips.length ?? 0) + 1}`, startMs: endMs + 250 } })
    setSelectedClipRef(undefined)
  }
  if (selection === undefined) return null

  const insertClip = (sourceRef: string, trackRef: string) => {
    const source = takes.find((take) => take.versionRef === sourceRef)
    const track = compositionEditor.composition.find((item) => item.trackRef === trackRef)
    if (source === undefined || track === undefined) return
    const selectionDurationMs = Math.max(1_000, selection.endMs - selection.startMs)
    const durationMs = Math.min(selectionDurationMs, Math.max(1_000, Math.round(source.durationSeconds * 1_000)))
    const clipRef = `${candidate.versionRef}:${trackRef}:insert-${track.clips.length + 1}`
    compositionEditor.editAndQueue({ operation: "insert", trackRef, clip: { clipRef, sourceRef: source.versionRef, startMs: selection.startMs, durationMs, offsetMs: 0 } })
    setSelectedClipRef(clipRef)
    setSelectedTrackRef(trackRef)
    setEditOperation(null)
  }

  const selectTimelineRange = (nextSelection: StudioTimelineSection) => {
    if (changeActive) return
    onResetStudioChange()
    setSelectionState({ versionRef: candidate.versionRef, selection: nextSelection })
  }

  return (
    <section aria-label="Arrangement editor">
      <div className={styles.arrangementTimelineHeader}>
        <CompositionSaveIndicator state={compositionEditor.saveState} />
        <button
          className={styles.arrangementSaveButton}
          type="button"
          disabled={compositionEditor.saveState === "saved" || compositionEditor.saveState === "saving"}
          onClick={() => { if (compositionEditor.saveState === "conflict") onRefreshWorkspace(); else void compositionEditor.persist() }}
        >
          {compositionEditor.saveState === "saving" ? <LoaderCircle className={styles.spinner} size={14} /> : <Check size={14} />}
          {compositionEditor.saveState === "conflict" ? "Refresh to resolve" : compositionEditor.saveState === "failed" ? "Retry save" : "Save arrangement"}
        </button>
      </div>
      <StudioTimeline candidate={candidate} sections={timelineSections} selection={selection} positionSeconds={positionSeconds} playing={playing} disabled={changeActive || compositionEditor.saveState === "saving"} onSeek={onSeekTimeline} onSelect={selectTimelineRange} compositionTracks={compositionEditor.composition} selectedClipRef={selectedClipRef} selectedTrackRef={selectedTrackRef} onSelectTrack={(trackRef) => { setSelectedTrackRef(trackRef); setSelectedClipRef(undefined); setEditOperation(null) }} onSelectClip={(clipRef, trackRef) => { setSelectedClipRef(clipRef); setSelectedTrackRef(trackRef) }} onEditClip={(operation, clipRef, trackRef) => { setSelectedClipRef(clipRef); setSelectedTrackRef(trackRef); setEditOperation(operation) }} onDuplicateClip={duplicateClip} insertSources={insertSources} onInsertClip={insertClip} />
      {selectedClipRef !== undefined && selectedTrackRef !== undefined && editOperation !== null ? <CompositionEditPanel clipRef={selectedClipRef} trackRef={selectedTrackRef} disabled={changeActive || compositionEditor.saveState === "saving"} operation={editOperation} onApply={(edit) => { compositionEditor.editAndQueue(edit); setEditOperation(null) }} /> : null}
      <StudioAiComposer
        selectedSection={selection}
        run={studioChangeRun}
        creativeSources={creativeSources}
        initialOperation={initialIntent === "transform" || initialIntent === "cover" ? "transform" : undefined}
        initialTransformScope={initialIntent === "transform" ? "whole_version" : undefined}
        initialTransformIntent={initialIntent === "cover" ? "cover" : initialIntent === "transform" ? "restyle" : undefined}
        onGenerate={onGenerateStudioChange}
        onCancel={onCancelStudioChange}
        onReset={onResetStudioChange}
      />
      <section className={styles.takeLanes} id="mori-take-lanes" aria-label="Take lanes">
        <div className={styles.takeLanesHeader}>
          <div><span>Compare before committing</span><h3>Take lanes</h3></div>
          <span>{takes.length} {takes.length === 1 ? "take" : "takes"}</span>
        </div>
        {currentVersionCommitRun.status === "failed" ? <div className={`${styles.takeLaneCommitNotice} ${styles.takeLaneCommitNoticeError}`} role="alert">
          <AlertCircle aria-hidden="true" size={15} />
          <div><strong>Current wasn&apos;t changed</strong><span>{currentVersionCommitRun.message}</span></div>
          <div className={styles.takeLaneCommitActions}>
            {currentVersionCommitRun.retryable ? <button type="button" onClick={onRetryCurrentVersion}><RotateCcw size={12} /> Retry Use take</button> : null}
            <button type="button" onClick={onDismissCurrentVersion}><X size={12} /> Dismiss</button>
          </div>
        </div> : null}
        {currentVersionCommitRun.status === "succeeded" ? <div className={`${styles.takeLaneCommitNotice} ${styles.takeLaneCommitNoticeSuccess}`} role="status">
          <Check aria-hidden="true" size={15} />
          <div><strong>Current Version updated</strong><span>{currentVersionCommitRun.message}</span></div>
          <button className={styles.takeLaneCommitDismiss} type="button" aria-label="Dismiss Current Version confirmation" onClick={onDismissCurrentVersion}><X size={12} /></button>
        </div> : null}
        <div className={styles.takeLaneList}>
          {takes.map((take, index) => {
            const isSelected = take.versionRef === candidate.versionRef
            const isCurrent = take.versionRef === currentVersionRef
            const isPlaying = take.versionRef === playerVersionRef && playing
            const isCommitting = currentVersionCommitRun.status === "saving"
            const isCommitTarget = isCommitting && currentVersionCommitRun.targetVersionRef === take.versionRef
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
                  {isCurrent ? <span className={styles.takeLaneCurrentLabel}>Current version</span> : <button className={styles.takeLanePromote} type="button" disabled={isCommitting} onClick={() => onPromoteTake(take)} aria-label={`${isCommitTarget ? "Using" : "Use"} ${take.title} as current`}>{isCommitTarget ? <><LoaderCircle aria-hidden="true" size={12} /> Using take…</> : "Use take"}</button>}
                </div>
              </article>
            )
          })}
        </div>
      </section>
      <LyricsCard lyrics={lyricsPreview} onOpen={onOpenLyrics} />
    </section>
  )
}

function LyricsCard({ lyrics, onOpen }: { lyrics: string; onOpen: () => void }) {
  const hasLyrics = lyrics.trim() !== ""
  return <section className={styles.lyricsCard} aria-label="Lyrics summary">
    <div className={styles.lyricsHeader}>
      <div><span>Lyrics</span><strong>{hasLyrics ? "Draft 01" : "No draft yet"}</strong></div>
      <button className={styles.lyricsOpenButton} type="button" onClick={onOpen}>Open Lyrics <ArrowRight size={12} /></button>
    </div>
    {hasLyrics ? <p className={styles.lyricsPreview}>{lyrics}</p> : <div className={styles.lyricsEmpty}><strong>No lyric draft attached</strong><span>Start words for this Version without leaving the Studio context.</span></div>}
  </section>
}

function toStudioCreativeSource(source: MoriCreativeSource): MoriCreativeLibrarySource {
  return {
    sourceKind: source.source_kind,
    ref: source.source_ref,
    name: source.name,
    description: source.description,
    ...(source.source_kind === "audio" ? { durationSeconds: source.duration_seconds } : {}),
    ...(source.source_kind === "inspiration" ? { style: source.style } : {}),
  }
}
