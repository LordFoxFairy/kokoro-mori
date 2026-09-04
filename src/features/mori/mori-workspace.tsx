"use client"

import { AlertCircle, Check, LoaderCircle, PanelRight } from "lucide-react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  createGenerationRequest,
  type GenerationSnapshot,
  type MoriApi,
  type MoriCreativeSource,
  type MoriProject,
  type MoriProjectCreateInput,
  type NewSongGenerationSnapshot,
} from "@/lib/mori-api"
import { createMoriApiClient, MoriApiRequestError } from "@/lib/mori-api-client"
import type { Candidate, CreationMode, GenerationStatus, SongPlan } from "./domain"
import type { MoriCreativeLibrarySource, MoriCreativeSourceSelection } from "./creative-assets"
import { listAllMoriCandidates } from "./candidate-pagination"
import {
  emptyGenerationQueueState,
  reconcileGenerationQueueItemFromSnapshot,
  updateGenerationQueueItem,
  upsertGenerationQueueItem,
  type GenerationQueueItem,
  type GenerationQueueServerStatus,
  type GenerationQueueState,
} from "./generation-queue"
import {
  readGenerationQueueState,
  subscribeGenerationQueueState,
  updateStoredGenerationQueueState,
} from "./generation-queue-storage"
import { getGenerationForRecovery } from "./generation-recovery"
import { previewCandidates, previewGeneration, previewProject, previewSongPlan } from "./preview-data"
import { buildSongPlan, toSongPlanCreateInput } from "./song-plan"
import {
  currentVersionCommand,
  currentVersionCommitFailure,
  currentVersionSelectionMatchesCommand,
  idleCurrentVersionCommitRun,
  type CurrentVersionCommitRun,
  type PendingCurrentVersionCommand,
} from "./current-version"
import { CreateCanvas, type CreationDraft } from "./components/create-canvas"
import { InspectorPanel } from "./components/inspector-panel"
import { useMoriApp } from "./components/mori-app-provider"
import { MoriAppShell } from "./components/mori-app-shell"
import styles from "./mori-workspace.module.css"

type MoriWorkspaceProps = {
  projectRef?: string
  generationRef?: string
  initialPrompt?: string
  initialCreativeSource?: MoriCreativeSourceSelection
  api?: Pick<MoriApi, "createSongPlan" | "createGeneration" | "getGeneration" | "getGenerationEvents" | "listCandidates" | "cancelGeneration"> & Partial<Pick<MoriApi, "createProject" | "getProject" | "putCurrentVersion" | "listCreativeSources" | "getCreativeSource">>
}

type GenerationAttempt = {
  mode: CreationMode
  draft: CreationDraft
}

type ProjectCreationAttempt = {
  digest: string
  idempotencyKey: string
  request: Promise<MoriProject> | null
}

type QueuePresentation = "drawer" | "pane"
type GenerationFeedback = "idle" | "active" | "ready" | "attention"

export function MoriWorkspace({ projectRef: requestedProjectRef, generationRef: requestedGenerationRef, initialPrompt, initialCreativeSource, api: injectedApi }: MoriWorkspaceProps = {}) {
  const initialProjectRef = requestedProjectRef?.trim() || null
  const initialGenerationRef = requestedGenerationRef?.trim() || null
  const initialCandidates = initialProjectRef === previewProject.projectRef ? previewCandidates : []
  const { playing, playerCandidate, replacePlayerCandidates, setPlaying, togglePlaying, selectPlayerCandidate, preferences } = useMoriApp()
  const [workspaceProjectRef, setWorkspaceProjectRef] = useState<string | null>(initialProjectRef)
  const [modeOverride, setModeOverride] = useState<CreationMode | null>(null)
  const [queueOpen, setQueueOpen] = useState(false)
  const [queuePresentation, setQueuePresentation] = useState<QueuePresentation>("drawer")
  const [candidates, setCandidates] = useState(initialCandidates)
  const [songPlan, setSongPlan] = useState<SongPlan | null>(initialProjectRef === previewProject.projectRef ? previewSongPlan : null)
  const [currentVersionRef, setCurrentVersionRef] = useState<string>(initialProjectRef === previewProject.projectRef ? previewProject.currentVersionRef ?? "" : "")
  const [selectedCandidateRef, setSelectedCandidateRef] = useState(initialCandidates[0]?.candidateRef ?? "")
  const [hasGeneration, setHasGeneration] = useState(initialProjectRef === previewProject.projectRef)
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>(previewGeneration.status)
  const [generationLabel, setGenerationLabel] = useState(previewGeneration.label)
  const [progress, setProgress] = useState(previewGeneration.progress)
  const [creativeSources, setCreativeSources] = useState<readonly MoriCreativeLibrarySource[] | undefined>(undefined)
  const [generationRef, setGenerationRef] = useState<string | null>(null)
  const [generationQueue, setGenerationQueue] = useState<GenerationQueueState>(() => emptyGenerationQueueState())
  const generationQueueRouteKey = JSON.stringify([initialProjectRef, initialGenerationRef])
  const [generationQueueHydratedRouteKey, setGenerationQueueHydratedRouteKey] = useState<string | null>(null)
  const generationQueueHydrated = generationQueueHydratedRouteKey === generationQueueRouteKey
  const [lastGenerationAttempt, setLastGenerationAttempt] = useState<GenerationAttempt | null>(null)
  const [currentVersionCommitRun, setCurrentVersionCommitRun] = useState<CurrentVersionCommitRun>(idleCurrentVersionCommitRun)
  const [cancelPendingGenerationRef, setCancelPendingGenerationRef] = useState<string | null>(null)
  const [workspaceProjectTitle, setWorkspaceProjectTitle] = useState(initialProjectRef === null ? "New project" : initialProjectRef === previewProject.projectRef ? previewProject.title : "Project")
  const workspaceProjectRefMirror = useRef<string | null>(initialProjectRef)
  const projectCreationAttemptRef = useRef<ProjectCreationAttempt | null>(null)
  const generationQueueRef = useRef<GenerationQueueState>(emptyGenerationQueueState())
  const pendingCurrentVersionCommandRef = useRef<PendingCurrentVersionCommand | null>(null)
  const generationCommandEpochRef = useRef(0)
  const generationObservationEpochRef = useRef(0)
  const recoveredGenerationSnapshotRef = useRef<NewSongGenerationSnapshot | null>(null)
  const cancelGenerationRequestRef = useRef<string | null>(null)
  const defaultApi = useMemo(() => createMoriApiClient(), [])
  const api = injectedApi ?? defaultApi
  const mode = modeOverride ?? preferences.defaultMode

  const updateQueue = useCallback(async (transform: (current: GenerationQueueState) => GenerationQueueState) => {
    const next = await updateStoredGenerationQueueState(transform)
    generationQueueRef.current = next
    setGenerationQueue(next)
    return next
  }, [setGenerationQueue])

  useEffect(() => {
    let disposed = false
    queueMicrotask(() => {
      if (disposed) return
      const restored = readGenerationQueueState()
      generationQueueRef.current = restored
      setGenerationQueue(restored)

      const createItemsForRoute = restored.items.filter((item) => (
        item.kind === "create" && (initialProjectRef === null || item.project_ref === initialProjectRef)
      ))
      const globallyActiveItem = restored.active_generation_ref === null
        ? undefined
        : createItemsForRoute.find((item) => item.generation_ref === restored.active_generation_ref)
      const activeItem = initialGenerationRef === null
        ? globallyActiveItem ?? createItemsForRoute.find((item) => isActiveQueueStatus(item.status))
        : undefined
      if (activeItem !== undefined) {
        setGenerationRef(activeItem.generation_ref)
        setHasGeneration(true)
        setGenerationStatus(activeItem.status)
        setGenerationLabel(activeItem.label)
        setProgress(activeItem.progress)
        setSelectedCandidateRef(activeItem.candidate_refs[0] ?? "")
        if (workspaceProjectRefMirror.current === null) {
          workspaceProjectRefMirror.current = activeItem.project_ref
          setWorkspaceProjectRef(activeItem.project_ref)
          setWorkspaceProjectTitle("Project")
        }
      } else if (initialGenerationRef !== null) {
        recoveredGenerationSnapshotRef.current = null
        pendingCurrentVersionCommandRef.current = null
        setGenerationRef(null)
        setHasGeneration(false)
        setCandidates([])
        setSongPlan(null)
        setCurrentVersionRef("")
        setSelectedCandidateRef("")
        setCurrentVersionCommitRun(idleCurrentVersionCommitRun)
      }
      setGenerationQueueHydratedRouteKey(generationQueueRouteKey)
    })
    return () => {
      disposed = true
      generationObservationEpochRef.current += 1
    }
  }, [generationQueueRouteKey, initialGenerationRef, initialProjectRef])

  useEffect(() => {
    if (!generationQueueHydrated || initialGenerationRef === null || generationRef !== null) return
    let disposed = false
    let retryTimer: number | undefined
    let retryDelayMs = 900
    const observationEpoch = generationObservationEpochRef.current

    const recoverRouteGeneration = async () => {
      try {
        const response = await getGenerationForRecovery(api, initialGenerationRef)
        if (disposed || generationObservationEpochRef.current !== observationEpoch) return
        const snapshot = response.data
        if (!createGenerationSnapshotMatchesContext(snapshot, initialGenerationRef, initialProjectRef)) return

        const storedItem = generationQueueRef.current.items.find((item) => item.generation_ref === snapshot.generation_ref)
        const storedContextMatches = storedItem?.kind === "create"
          && storedItem.project_ref === snapshot.project_ref
          && storedItem.source_version_ref === null

        const queueItem: GenerationQueueItem = {
          generation_ref: snapshot.generation_ref,
          project_ref: snapshot.project_ref,
          source_version_ref: null,
          kind: "create",
          label: storedContextMatches ? storedItem.label : snapshot.mode === "smart" ? "Smart direction" : "Custom direction",
          created_at: snapshot.created_at,
          status: snapshot.status,
          progress: snapshot.progress,
          candidate_refs: snapshot.candidate_refs,
          last_event_id: storedContextMatches ? storedItem.last_event_id : null,
        }
        await updateQueue((current) => ({
          ...reconcileGenerationQueueItemFromSnapshot(current, queueItem),
          active_generation_ref: queueItem.generation_ref,
        }))
        if (disposed || generationObservationEpochRef.current !== observationEpoch) return

        retryDelayMs = 900
        workspaceProjectRefMirror.current = snapshot.project_ref
        setWorkspaceProjectRef(snapshot.project_ref)
        setWorkspaceProjectTitle(snapshot.project_ref === previewProject.projectRef ? previewProject.title : "Project")
        setModeOverride(snapshot.mode)
        setGenerationRef(snapshot.generation_ref)
        setHasGeneration(true)
        setGenerationStatus(snapshot.status)
        setGenerationLabel(generationLabelFor(snapshot.status))
        setProgress(snapshot.progress)
        setSelectedCandidateRef(snapshot.candidate_refs[0] ?? "")
        recoveredGenerationSnapshotRef.current = snapshot
      } catch (error) {
        if (disposed || generationObservationEpochRef.current !== observationEpoch) return
        if (isRetryableGenerationStatusError(error)) {
          retryTimer = window.setTimeout(() => { void recoverRouteGeneration() }, retryDelayMs)
          retryDelayMs = Math.min(retryDelayMs * 2, 4_000)
        }
      }
    }

    void recoverRouteGeneration()
    return () => {
      disposed = true
      if (retryTimer !== undefined) window.clearTimeout(retryTimer)
    }
  }, [api, generationQueueHydrated, generationRef, initialGenerationRef, initialProjectRef, updateQueue])

  useEffect(() => subscribeGenerationQueueState((next) => {
    generationQueueRef.current = next
    setGenerationQueue(next)
  }), [])

  useEffect(() => {
    const getCreativeSource = api.getCreativeSource
    const listCreativeSources = api.listCreativeSources
    let disposed = false

    const applySources = (sources: readonly MoriCreativeSource[]) => {
      if (!disposed) setCreativeSources(sources.map(toDomainCreativeSource))
    }

    const request = initialCreativeSource !== undefined && getCreativeSource !== undefined
      ? getCreativeSource(initialCreativeSource.kind, initialCreativeSource.ref).then((response) => applySources([response.data]))
      : listCreativeSources === undefined
        ? Promise.resolve()
        : listCreativeSources({ limit: 20 }).then((response) => applySources(response.data.sources)).catch(() => {
            if (!disposed) setCreativeSources(undefined)
          })

    void request.catch(() => {
      if (!disposed) setCreativeSources(undefined)
    })

    return () => {
      disposed = true
    }
  }, [api, initialCreativeSource])
  const generation = useMemo(() => hasGeneration ? {
    ...previewGeneration,
    projectRef: workspaceProjectRef ?? "project_pending",
    songPlanRef: songPlan?.songPlanRef ?? "song_plan_pending",
    status: generationStatus,
    label: generationLabel,
    progress,
    candidateRefs: candidates.map((candidate) => candidate.candidateRef),
  } : null, [candidates, generationLabel, generationStatus, hasGeneration, progress, songPlan?.songPlanRef, workspaceProjectRef])
  const backgroundQueueSignature = generationQueue.items
    .filter((item) => item.generation_ref !== generationRef && isActiveQueueStatus(item.status))
    .map((item) => item.generation_ref)
    .sort()
    .join("\u001f")

  useEffect(() => {
    const syncQueuePresentation = () => setQueuePresentation(window.innerWidth > 1120 ? "pane" : "drawer")
    syncQueuePresentation()
    window.addEventListener("resize", syncQueuePresentation)
    return () => window.removeEventListener("resize", syncQueuePresentation)
  }, [])

  useEffect(() => {
    if (workspaceProjectRef === null || workspaceProjectRef === previewProject.projectRef || api.getProject === undefined) return
    let disposed = false

    void api.getProject(workspaceProjectRef).then((response) => {
      if (!disposed) {
        setWorkspaceProjectTitle(response.data.title)
        setCurrentVersionRef((current) => current.trim() === "" ? response.data.current_version_ref ?? "" : current)
      }
    }).catch(() => {
      // The neutral Project label keeps creation usable while the projection is unavailable.
    })

    return () => {
      disposed = true
    }
  }, [api, workspaceProjectRef])

  const ensureWorkspaceProject = useCallback(async (draft: CreationDraft): Promise<string> => {
    const persistedProjectRef = workspaceProjectRefMirror.current
    if (persistedProjectRef !== null) return persistedProjectRef

    const createProject = api.createProject
    if (createProject === undefined) throw new Error("project_creation_unavailable")

    const input = creationProjectInput(draft.prompt)
    const digest = JSON.stringify(input)
    const previousAttempt = projectCreationAttemptRef.current
    if (previousAttempt?.digest === digest && previousAttempt.request !== null) {
      return (await previousAttempt.request).project_ref
    }

    const attempt: ProjectCreationAttempt = previousAttempt?.digest === digest
      ? previousAttempt
      : {
          digest,
          idempotencyKey: `mori-project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          request: null,
        }
    const request = createProject(input, attempt.idempotencyKey).then((response) => response.data)
    attempt.request = request
    projectCreationAttemptRef.current = attempt

    try {
      const project = await request
      workspaceProjectRefMirror.current = project.project_ref
      replaceCreateLocation(project.project_ref)
      setWorkspaceProjectRef(project.project_ref)
      setWorkspaceProjectTitle(project.title)
      projectCreationAttemptRef.current = null
      return project.project_ref
    } finally {
      if (projectCreationAttemptRef.current === attempt) attempt.request = null
    }
  }, [api])

  const handleGenerate = useCallback(async (draft: CreationDraft, generationMode = mode) => {
    const commandEpoch = generationCommandEpochRef.current + 1
    generationCommandEpochRef.current = commandEpoch
    generationObservationEpochRef.current += 1
    cancelGenerationRequestRef.current = null
    setCancelPendingGenerationRef(null)
    setLastGenerationAttempt({ mode: generationMode, draft })
    setGenerationRef(null)
    setHasGeneration(true)
    setGenerationStatus("preparing")
    setGenerationLabel(draft.prompt.trim() ? "Preparing your next direction" : "Preparing a new direction")
    setProgress(8)
    setPlaying(false)
    setQueueOpen(true)
    pendingCurrentVersionCommandRef.current = null
    setCurrentVersionCommitRun(idleCurrentVersionCommitRun)
    const localPlan = generationMode === "smart"
      ? draft.songPlan ?? buildSongPlan(workspaceProjectRefMirror.current ?? "project_pending", draft)
      : null
    setSongPlan(localPlan)
    try {
      const targetProjectRef = await ensureWorkspaceProject(draft)
      if (generationCommandEpochRef.current !== commandEpoch) return
      let songPlanRef: string | undefined
      if (generationMode === "smart") {
        const draftPlan = localPlan ?? buildSongPlan(targetProjectRef, draft)
        const planResponse = await api.createSongPlan(
          targetProjectRef,
          toSongPlanCreateInput(draftPlan),
          `mori-plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        )
        songPlanRef = planResponse.data.song_plan_ref
        if (generationCommandEpochRef.current !== commandEpoch) return
        setSongPlan(toDomainSongPlan(planResponse.data))
      }
      const response = await api.createGeneration(
        targetProjectRef,
        createGenerationRequest({
          mode: generationMode,
          prompt: draft.prompt,
          songPlanRef,
          lyricsMode: draft.lyricsMode,
          lyrics: draft.lyrics,
          style: draft.style,
          referenceAssetRefs: draft.referenceAssetRefs,
          voiceRef: draft.voiceRef,
          durationSeconds: draft.durationSeconds,
        }),
        `mori-create-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      )
      if (generationCommandEpochRef.current !== commandEpoch) return
      const queueItem: GenerationQueueItem = {
        generation_ref: response.data.generation_ref,
        project_ref: targetProjectRef,
        source_version_ref: null,
        kind: "create",
        label: generationMode === "smart" ? "Smart direction" : "Custom direction",
        created_at: new Date().toISOString(),
        status: response.data.status,
        progress: response.data.status === "queued" ? 0 : 12,
        candidate_refs: [],
        last_event_id: null,
      }
      await updateQueue((current) => ({
        ...upsertGenerationQueueItem(current, queueItem),
        active_generation_ref: queueItem.generation_ref,
      }))
      if (generationCommandEpochRef.current !== commandEpoch) return
      replaceCreateLocation(targetProjectRef, queueItem.generation_ref)
      setGenerationRef(response.data.generation_ref)
      setGenerationStatus(response.data.status)
      setGenerationLabel("Queued for your workspace")
      setProgress(response.data.status === "queued" ? 0 : 12)
    } catch (error) {
      if (generationCommandEpochRef.current !== commandEpoch) return
      setGenerationStatus("failed")
      setGenerationLabel(generationFailureLabel(error))
      setProgress(0)
    }
  }, [
    api,
    ensureWorkspaceProject,
    mode,
    setGenerationLabel,
    setGenerationRef,
    setGenerationStatus,
    setHasGeneration,
    setPlaying,
    setProgress,
    setQueueOpen,
    setSongPlan,
    updateQueue,
  ])

  const retryLastGeneration = useCallback(() => {
    if (lastGenerationAttempt === null) return
    void handleGenerate(lastGenerationAttempt.draft, lastGenerationAttempt.mode)
  }, [handleGenerate, lastGenerationAttempt])

  useEffect(() => {
    const getGeneration = api.getGeneration
    const getGenerationEvents = api.getGenerationEvents
    const listCandidates = api.listCandidates
    if (generationRef === null) return
    let disposed = false
    let timer: number | undefined
    let lastEventId: string | null = generationQueueRef.current.items.find((item) => item.generation_ref === generationRef)?.last_event_id ?? null
    let retryDelayMs = 900
    const eventController = new AbortController()
    const observationEpoch = generationObservationEpochRef.current

    const sync = async () => {
      try {
        const recoveredSnapshot = recoveredGenerationSnapshotRef.current?.generation_ref === generationRef
          ? recoveredGenerationSnapshotRef.current
          : null
        if (recoveredSnapshot !== null) recoveredGenerationSnapshotRef.current = null
        const snapshot = recoveredSnapshot ?? (await getGeneration(generationRef)).data
        if (disposed || generationObservationEpochRef.current !== observationEpoch) return
        const queueContext = generationQueueRef.current.items.find((item) => item.generation_ref === generationRef)
        const expectedProjectRef = queueContext?.kind === "create"
          ? queueContext.project_ref
          : workspaceProjectRefMirror.current
        if (!createGenerationSnapshotMatchesContext(snapshot, generationRef, expectedProjectRef)) return
        retryDelayMs = 900
        let status = snapshot.status
        let progressValue = snapshot.progress
        let candidateRefs = snapshot.candidate_refs

        if (getGenerationEvents !== undefined) {
          try {
            const events = await getGenerationEvents(generationRef, lastEventId, eventController.signal)
            if (disposed || generationObservationEpochRef.current !== observationEpoch) return
            const latest = events.at(-1)
            if (
              latest !== undefined
              && latest.data.generation_ref === generationRef
              && latest.data.project_ref === snapshot.project_ref
            ) {
              lastEventId = latest.id
              status = latest.data.status
              progressValue = latest.data.progress
              candidateRefs = latest.data.candidate_refs
            }
          } catch {
            // Snapshot polling remains the recovery path when event replay is unavailable.
          }
        }

        const reconciledQueue = await updateQueue((current) => updateGenerationQueueItem(current, generationRef, {
          status,
          progress: progressValue,
          candidate_refs: candidateRefs,
          last_event_id: lastEventId,
        }))
        if (disposed || generationObservationEpochRef.current !== observationEpoch) return
        const reconciledItem = reconciledQueue.items.find((item) => item.generation_ref === generationRef)
        if (reconciledItem !== undefined) {
          status = reconciledItem.status
          progressValue = reconciledItem.progress
          candidateRefs = [...reconciledItem.candidate_refs]
          lastEventId = reconciledItem.last_event_id
        }
        setGenerationStatus(status)
        setProgress(progressValue)
        setGenerationLabel(generationLabelFor(status))

        if (status === "succeeded") {
          const candidateResponse = await listAllMoriCandidates({ listCandidates }, snapshot.project_ref)
          if (disposed || generationObservationEpochRef.current !== observationEpoch) return
          const generated = candidateResponse.filter((candidate) => candidateRefs.includes(candidate.candidate_ref))
          const generatedCandidates = generated.map(toDomainCandidate)
          setCandidates(generatedCandidates)
          setSelectedCandidateRef(generatedCandidates[0]?.candidateRef ?? "")
          replacePlayerCandidates(generatedCandidates)
          if (preferences.autoplay) {
            const firstCandidate = generatedCandidates[0]
            if (firstCandidate) {
              selectPlayerCandidate(firstCandidate)
              setPlaying(true)
            }
          }
          return
        }
        if (["failed", "cancelled", "expired"].includes(status)) return
        timer = window.setTimeout(() => { void sync() }, 220)
      } catch (error) {
        if (!disposed && generationObservationEpochRef.current === observationEpoch) {
          const item = generationQueueRef.current.items.find((candidate) => candidate.generation_ref === generationRef)
          if (item !== undefined && isActiveQueueStatus(item.status)) {
            setGenerationLabel(isRetryableGenerationStatusError(error) ? "Reconnecting to Mori…" : "Mori status is unavailable. Retrying…")
            timer = window.setTimeout(() => { void sync() }, retryDelayMs)
            retryDelayMs = Math.min(retryDelayMs * 2, 4_000)
            return
          }
          setGenerationLabel("Generation status unavailable")
        }
      }
    }

    void sync()
    return () => {
      disposed = true
      eventController.abort()
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [api, generationRef, preferences.autoplay, replacePlayerCandidates, selectPlayerCandidate, setPlaying, updateQueue])

  useEffect(() => {
    if (!generationQueueHydrated) return
    const backgroundRefs = generationQueueRef.current.items
      .filter((item) => item.generation_ref !== generationRef && item.generation_ref !== initialGenerationRef && isActiveQueueStatus(item.status))
      .map((item) => item.generation_ref)
    if (backgroundRefs.length === 0) return

    let disposed = false
    const timers = new Map<string, number>()
    const schedule = (ref: string, delayMs: number) => {
      if (disposed) return
      timers.set(ref, window.setTimeout(() => { void syncBackground(ref) }, delayMs))
    }
    const syncBackground = async (ref: string): Promise<void> => {
      try {
        const snapshot = await api.getGeneration(ref)
        if (disposed) return
        const item = snapshot.data
        const queueContext = generationQueueRef.current.items.find((candidate) => candidate.generation_ref === ref)
        if (queueContext?.kind !== "create" || !createGenerationSnapshotMatchesContext(item, ref, queueContext.project_ref)) return
        void updateQueue((current) => updateGenerationQueueItem(current, ref, {
          status: item.status,
          progress: item.progress,
          candidate_refs: item.candidate_refs,
        }))
        if (isActiveQueueStatus(item.status)) schedule(ref, 900)
      } catch {
        schedule(ref, 1_500)
      }
    }

    for (const ref of backgroundRefs) void syncBackground(ref)
    return () => {
      disposed = true
      for (const timer of timers.values()) window.clearTimeout(timer)
    }
  }, [api, backgroundQueueSignature, generationQueueHydrated, generationRef, initialGenerationRef, updateQueue])

  useEffect(() => {
    if (!queueOpen || queuePresentation !== "drawer") return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setQueueOpen(false)
    }
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", closeOnEscape)
    return () => {
      window.removeEventListener("keydown", closeOnEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [queueOpen, queuePresentation])

  const commitCurrentVersion = useCallback(async (candidate: Candidate, retryCommand?: PendingCurrentVersionCommand) => {
    const projectRef = workspaceProjectRefMirror.current
    if (currentVersionCommitRun.status === "saving" || projectRef === null || candidate.versionRef === currentVersionRef) return
    if (api.putCurrentVersion === undefined) {
      setCurrentVersionCommitRun({
        status: "failed",
        targetVersionRef: candidate.versionRef,
        message: "Current Version saving is not connected. Your previous Current is unchanged.",
        retryable: false,
      })
      return
    }

    const expectedCurrentVersionRef = currentVersionRef.trim() === "" ? null : currentVersionRef
    const command = retryCommand
      ?? currentVersionCommand(
        projectRef,
        candidate.candidateRef,
        candidate.versionRef,
        expectedCurrentVersionRef,
        pendingCurrentVersionCommandRef.current,
      )
    pendingCurrentVersionCommandRef.current = command
    setCurrentVersionCommitRun({
      status: "saving",
      targetVersionRef: candidate.versionRef,
      message: null,
      retryable: false,
    })

    try {
      const response = await api.putCurrentVersion(command.projectRef, command.input, command.idempotencyKey)
      if (!currentVersionSelectionMatchesCommand(response.data, command)) {
        throw new Error("current_version_confirmation_mismatch")
      }
      setCurrentVersionRef(candidate.versionRef)
      setCandidates((items) => items.map((item) => ({ ...item, isCurrent: item.candidateRef === candidate.candidateRef })))
      setSelectedCandidateRef(candidate.candidateRef)
      selectPlayerCandidate(candidate)
      pendingCurrentVersionCommandRef.current = null
      setCurrentVersionCommitRun({
        status: "succeeded",
        targetVersionRef: candidate.versionRef,
        message: `${candidate.title} is now the Current Version.`,
        retryable: false,
      })
    } catch (error) {
      const failure = currentVersionCommitFailure(error, "direction")
      if (!failure.retryable) pendingCurrentVersionCommandRef.current = null
      setCurrentVersionCommitRun({
        status: "failed",
        targetVersionRef: candidate.versionRef,
        message: failure.message,
        retryable: failure.retryable,
      })
    }
  }, [api, currentVersionCommitRun.status, currentVersionRef, selectPlayerCandidate, setCandidates, setCurrentVersionRef, setSelectedCandidateRef])

  const retryCurrentVersionCommit = useCallback(() => {
    const command = pendingCurrentVersionCommandRef.current
    if (command === null || !currentVersionCommitRun.retryable) return
    const candidate = candidates.find((item) => (
      item.candidateRef === command.input.candidate_ref
      && item.versionRef === command.input.version_ref
    ))
    if (candidate !== undefined) void commitCurrentVersion(candidate, command)
  }, [candidates, commitCurrentVersion, currentVersionCommitRun.retryable])

  const dismissCurrentVersionCommit = useCallback(() => {
    pendingCurrentVersionCommandRef.current = null
    setCurrentVersionCommitRun(idleCurrentVersionCommitRun)
  }, [])

  const handleCancel = useCallback(async () => {
    if (generationRef === null) return
    if (cancelGenerationRequestRef.current === generationRef) return
    const commandEpoch = generationCommandEpochRef.current
    const requestedGenerationRef = generationRef
    cancelGenerationRequestRef.current = requestedGenerationRef
    setCancelPendingGenerationRef(requestedGenerationRef)
    try {
      const response = await api.cancelGeneration(
        requestedGenerationRef,
        `mori-cancel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      )
      if (generationCommandEpochRef.current !== commandEpoch) return
      if (response.data.generation_ref !== requestedGenerationRef) throw new Error("generation_cancel_context_mismatch")
      const reconciledQueue = await updateQueue((current) => {
        const item = current.items.find((candidate) => candidate.generation_ref === requestedGenerationRef)
        return item === undefined
          ? current
          : updateGenerationQueueItem(current, requestedGenerationRef, {
            status: response.data.status,
            progress: item.progress,
          })
      })
      if (generationCommandEpochRef.current !== commandEpoch) return
      const reconciledItem = reconciledQueue.items.find((item) => item.generation_ref === requestedGenerationRef)
      const reconciledStatus = reconciledItem?.status ?? response.data.status
      if (reconciledStatus === "cancelled" || reconciledStatus === "failed" || reconciledStatus === "expired") {
        generationObservationEpochRef.current += 1
      }
      setGenerationStatus(reconciledStatus)
      setGenerationLabel(generationLabelFor(reconciledStatus))
      if (reconciledItem !== undefined) setProgress(reconciledItem.progress)
    } catch {
      if (generationCommandEpochRef.current === commandEpoch) setGenerationLabel("Cancellation failed")
    } finally {
      if (cancelGenerationRequestRef.current === requestedGenerationRef) {
        cancelGenerationRequestRef.current = null
        if (generationCommandEpochRef.current === commandEpoch) setCancelPendingGenerationRef(null)
      }
    }
  }, [api, generationRef, setGenerationLabel, setGenerationStatus, setProgress, updateQueue])

  const currentCandidates = candidates.map((candidate) => ({ ...candidate, isCurrent: candidate.versionRef === currentVersionRef }))
  const generationFeedback = generationFeedbackFor(hasGeneration ? generationStatus : null)
  const visibleGenerationQueueItems = generationQueue.items.filter((item) => workspaceProjectRef === null || item.project_ref === workspaceProjectRef)
  const activeQueueItem = generationRef === null ? undefined : generationQueue.items.find((item) => item.generation_ref === generationRef)
  const canRetryGeneration = activeQueueItem?.kind === "create" || (activeQueueItem === undefined && lastGenerationAttempt !== null)

  const selectQueuedGeneration = useCallback((nextGenerationRef: string) => {
    const item = generationQueueRef.current.items.find((candidate) => candidate.generation_ref === nextGenerationRef)
    if (item === undefined || item.kind !== "create") return
    generationCommandEpochRef.current += 1
    generationObservationEpochRef.current += 1
    cancelGenerationRequestRef.current = null
    setCancelPendingGenerationRef(null)
    void updateQueue((current) => ({ ...current, active_generation_ref: item.generation_ref }))
    replaceCreateLocation(item.project_ref, item.generation_ref)
    setGenerationRef(item.generation_ref)
    setHasGeneration(true)
    setGenerationStatus(item.status)
    setGenerationLabel(item.label)
    setProgress(item.progress)
    setSelectedCandidateRef(item.candidate_refs[0] ?? "")
    setCandidates([])
    setSongPlan(null)
    if (workspaceProjectRefMirror.current !== item.project_ref) {
      workspaceProjectRefMirror.current = item.project_ref
      setWorkspaceProjectRef(item.project_ref)
      setWorkspaceProjectTitle("Project")
    }
  }, [
    setCandidates,
    setGenerationLabel,
    setGenerationRef,
    setGenerationStatus,
    setHasGeneration,
    setProgress,
    setSelectedCandidateRef,
    setSongPlan,
    setWorkspaceProjectRef,
    updateQueue,
  ])

  const renderQueue = (presentation: QueuePresentation) => (
    <InspectorPanel
      presentation={presentation}
      projectRef={workspaceProjectRef}
      generation={generation}
      queueItems={visibleGenerationQueueItems}
      activeGenerationRef={generationRef}
      candidates={currentCandidates}
      songPlan={songPlan}
      selectedCandidateRef={selectedCandidateRef}
      playing={playing}
      onSelect={(candidate) => { setSelectedCandidateRef(candidate.candidateRef); selectPlayerCandidate(candidate); setPlaying(false) }}
      currentVersionCommitRun={currentVersionCommitRun}
      onPromote={(candidate) => { void commitCurrentVersion(candidate) }}
      onRetryCurrentVersion={retryCurrentVersionCommit}
      onDismissCurrentVersion={dismissCurrentVersionCommit}
      onCancel={() => { void handleCancel() }}
      cancelPending={cancelPendingGenerationRef === generationRef}
      onRetry={canRetryGeneration ? retryLastGeneration : undefined}
      onSelectGeneration={selectQueuedGeneration}
      onPlay={(candidate) => {
        setSelectedCandidateRef(candidate.candidateRef)
        if (playerCandidate?.candidateRef === candidate.candidateRef) togglePlaying()
        else { selectPlayerCandidate(candidate); setPlaying(true) }
      }}
      onClose={() => setQueueOpen(false)}
    />
  )

  return (
    <main className={styles.app}>
      <MoriAppShell
        activeKey="create"
        ariaLabel="Create workspace"
        projectRef={workspaceProjectRef}
      >
        <div className={`${styles.workspaceLayout} ${queueOpen && queuePresentation === "pane" ? styles.workspaceLayoutWithQueue : ""}`}>
          <section className={styles.createSurface} aria-label="Create canvas">
            <header className={styles.canvasHeader}>
              <div className={styles.breadcrumb}>
                <span>Workspace</span><span>/</span>
                {workspaceProjectRef === null
                  ? <strong>New project</strong>
                  : <><Link className={styles.breadcrumbLink} href={`/projects/${encodeURIComponent(workspaceProjectRef)}`}>{workspaceProjectTitle}</Link><span>/</span><strong>New direction</strong></>}
              </div>
              <div className={styles.headerActions}>
                <button className={styles.queueButton} type="button" onClick={() => setQueueOpen((value) => !value)} aria-expanded={queueOpen} aria-label={queueOpen ? "Hide generation queue" : "Open generation queue"} title={generationFeedbackLabel(generationFeedback)} data-generation-feedback={generationFeedback}>
                  <span className={styles.generationFeedbackIcon} data-generation-icon={generationFeedback} aria-hidden="true"><GenerationFeedbackIcon status={generationFeedback} /></span>
                  <span>{generationFeedbackLabel(generationFeedback)}</span>
                  <b>{currentCandidates.length}</b>
                </button>
              </div>
            </header>
            <div className={styles.canvasBody}>
              <CreateCanvas projectRef={workspaceProjectRef ?? "project_pending"} mode={mode} initialPrompt={initialPrompt} initialCreativeSource={initialCreativeSource} creativeSources={creativeSources} onModeChange={setModeOverride} onGenerate={handleGenerate} />
            </div>
          </section>
          {queueOpen && queuePresentation === "pane" ? renderQueue("pane") : null}
        </div>
      </MoriAppShell>
      {queueOpen && queuePresentation === "drawer" && typeof document !== "undefined" ? createPortal(
        <div className={styles.drawerLayer}>
          <button className={styles.drawerBackdrop} type="button" aria-label="Dismiss generation queue" onClick={() => setQueueOpen(false)} />
          {renderQueue("drawer")}
        </div>,
        document.body,
      ) : null}
    </main>
  )
}

function generationFeedbackFor(status: GenerationStatus | null): GenerationFeedback {
  if (status === null || status === "cancelled") return "idle"
  if (["queued", "preparing", "generating", "post_processing"].includes(status)) return "active"
  if (status === "succeeded") return "ready"
  return "attention"
}

function isActiveQueueStatus(status: GenerationQueueServerStatus): boolean {
  return status === "queued" || status === "preparing" || status === "generating" || status === "post_processing"
}

function isRetryableGenerationStatusError(error: unknown): boolean {
  return error instanceof MoriApiRequestError && error.retryable
}

function createGenerationSnapshotMatchesContext(
  snapshot: GenerationSnapshot,
  generationRef: string,
  projectRef: string | null,
): snapshot is NewSongGenerationSnapshot {
  return snapshot.generation_ref === generationRef
    && snapshot.generation_kind === "new_song"
    && snapshot.source_version_ref === null
    && (projectRef === null || snapshot.project_ref === projectRef)
}

function generationFeedbackLabel(status: GenerationFeedback): string {
  switch (status) {
    case "active": return "Generating"
    case "ready": return "Directions ready"
    case "attention": return "Needs attention"
    default: return "Generations"
  }
}

function GenerationFeedbackIcon({ status }: { status: GenerationFeedback }) {
  if (status === "active") return <LoaderCircle size={14} />
  if (status === "ready") return <Check size={14} />
  if (status === "attention") return <AlertCircle size={14} />
  return <PanelRight size={14} />
}

function generationLabelFor(status: GenerationStatus): string {
  switch (status) {
    case "queued": return "Queued for your workspace"
    case "preparing": return "Preparing the arrangement"
    case "generating": return "Shaping your next direction"
    case "post_processing": return "Polishing the new takes"
    case "succeeded": return "New directions ready"
    case "cancelled": return "Generation cancelled"
    case "expired": return "Generation expired"
    case "failed": return "Generation failed"
  }
}

function generationFailureLabel(error: unknown): string {
  if (error instanceof MoriApiRequestError && error.code === "mori_bff_unavailable") return "Mori is offline right now. Try again."
  return "We couldn't start this direction. Try again."
}

function creationProjectInput(prompt: string): MoriProjectCreateInput {
  const description = prompt.trim() || "An open-ended new musical direction."
  const firstClause = description.split(/[,.!?;，。！？；\n]/u)[0]?.trim() || description
  const withoutArticle = firstClause.replace(/^(?:a|an|the)\s+/iu, "")
  const words = withoutArticle.split(/\s+/u).filter((word) => word !== "")
  const shortened = words.length > 1
    ? words.slice(0, 8).join(" ")
    : Array.from(withoutArticle).slice(0, 32).join("")
  const title = shortened.charAt(0).toLocaleUpperCase() + shortened.slice(1)
  return {
    title: title || "Untitled song",
    description,
  }
}

function replaceCreateLocation(projectRef: string, generationRef?: string): void {
  const search = window.location.pathname === "/create"
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams()
  search.delete("idea")
  search.set("project_ref", projectRef)
  if (generationRef === undefined) search.delete("generation_ref")
  else search.set("generation_ref", generationRef)
  window.history.replaceState(window.history.state, "", `/create?${search.toString()}`)
}

function toDomainCandidate(candidate: import("@/lib/mori-api").MoriCandidate, index: number): Candidate {
  const tags = candidate.style_tags.length > 0 ? candidate.style_tags : ["new direction"]
  return {
    candidateRef: candidate.candidate_ref,
    versionRef: candidate.version_ref,
    generationRef: candidate.generation_ref,
    title: candidate.title,
    subtitle: tags.join(" · "),
    durationSeconds: candidate.duration_seconds,
    mood: tags[0] ?? "new direction",
    waveformSeed: index + 5,
    isCurrent: false,
    audioAssetRef: candidate.audio_asset_ref,
  }
}

function toDomainCreativeSource(source: MoriCreativeSource): MoriCreativeLibrarySource {
  return {
    sourceKind: source.source_kind,
    ref: source.source_ref,
    name: source.name,
    description: source.description,
    ...(source.source_kind === "audio" ? { durationSeconds: source.duration_seconds } : {}),
    ...(source.source_kind === "inspiration" ? { style: source.style } : {}),
  }
}

function toDomainSongPlan(plan: import("@/lib/mori-api").MoriSongPlan): SongPlan {
  return {
    songPlanRef: plan.song_plan_ref,
    projectRef: plan.project_ref,
    prompt: plan.prompt,
    mood: plan.mood,
    tempoBpm: plan.tempo_bpm,
    structure: plan.structure,
    instruments: plan.instruments,
    vocalDirection: plan.vocal_direction,
    lyricsIntent: plan.lyrics_intent,
  }
}
