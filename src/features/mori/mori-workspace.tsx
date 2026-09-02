"use client"

import { PanelRight, Share2 } from "lucide-react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { createGenerationRequest, type MoriApi } from "@/lib/mori-api"
import { createMoriApiClient, MoriApiRequestError } from "@/lib/mori-api-client"
import type { Candidate, CreationMode, GenerationStatus, SongPlan } from "./domain"
import { previewCandidates, previewGeneration, previewProject, previewSongPlan } from "./preview-data"
import { buildSongPlan, toSongPlanCreateInput } from "./song-plan"
import { CreateCanvas, type CreationDraft } from "./components/create-canvas"
import { InspectorPanel } from "./components/inspector-panel"
import { useMoriApp } from "./components/mori-app-provider"
import { MoriAppShell } from "./components/mori-app-shell"
import styles from "./mori-workspace.module.css"

type MoriWorkspaceProps = {
  api?: Pick<MoriApi, "createSongPlan" | "createGeneration" | "getGeneration" | "getGenerationEvents" | "listCandidates" | "cancelGeneration">
}

type GenerationAttempt = {
  mode: CreationMode
  draft: CreationDraft
}

export function MoriWorkspace({ api: injectedApi }: MoriWorkspaceProps = {}) {
  const { playing, playerCandidate, setPlaying, togglePlaying, selectPlayerCandidate, preferences } = useMoriApp()
  const [modeOverride, setModeOverride] = useState<CreationMode | null>(null)
  const [queueOpen, setQueueOpen] = useState(false)
  const [candidates, setCandidates] = useState(previewCandidates)
  const [songPlan, setSongPlan] = useState(previewSongPlan)
  const [currentVersionRef, setCurrentVersionRef] = useState(previewProject.currentVersionRef)
  const [selectedCandidateRef, setSelectedCandidateRef] = useState(previewCandidates[0].candidateRef)
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>(previewGeneration.status)
  const [generationLabel, setGenerationLabel] = useState(previewGeneration.label)
  const [progress, setProgress] = useState(previewGeneration.progress)
  const [generationRef, setGenerationRef] = useState<string | null>(null)
  const [lastGenerationAttempt, setLastGenerationAttempt] = useState<GenerationAttempt | null>(null)
  const [shareFeedback, setShareFeedback] = useState(false)
  const defaultApi = useMemo(() => createMoriApiClient(), [])
  const api = injectedApi ?? defaultApi
  const mode = modeOverride ?? preferences.defaultMode
  const generation = useMemo(() => ({
    ...previewGeneration,
    status: generationStatus,
    label: generationLabel,
    progress,
    candidateRefs: candidates.map((candidate) => candidate.candidateRef),
  }), [candidates, generationLabel, generationStatus, progress])

  const handleGenerate = useCallback(async (draft: CreationDraft, generationMode = mode) => {
    setLastGenerationAttempt({ mode: generationMode, draft })
    setGenerationRef(null)
    setGenerationStatus("preparing")
    setGenerationLabel(draft.prompt.trim() ? "Preparing your next direction" : "Preparing a new direction")
    setProgress(8)
    setPlaying(false)
    setQueueOpen(true)
    try {
      let songPlanRef: string | undefined
      if (generationMode === "smart") {
        const draftPlan = draft.songPlan ?? buildSongPlan(previewProject.projectRef, draft)
        const planResponse = await api.createSongPlan(
          previewProject.projectRef,
          toSongPlanCreateInput(draftPlan),
          `mori-plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        )
        songPlanRef = planResponse.data.song_plan_ref
        setSongPlan(toDomainSongPlan(planResponse.data))
      }
      const response = await api.createGeneration(
        previewProject.projectRef,
        createGenerationRequest({
          mode: generationMode,
          prompt: draft.prompt,
          songPlanRef,
          lyricsMode: draft.lyricsMode,
          style: draft.style,
          referenceAssetRefs: draft.referenceAssetRefs,
          voiceRef: draft.voice,
          durationSeconds: draft.durationSeconds,
        }),
        `mori-create-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      )
      setGenerationRef(response.data.generation_ref)
      setGenerationStatus(response.data.status)
      setGenerationLabel("Queued for your workspace")
      setProgress(response.data.status === "queued" ? 0 : 12)
    } catch (error) {
      setGenerationStatus("failed")
      setGenerationLabel(generationFailureLabel(error))
      setProgress(0)
    }
  }, [api, mode, setPlaying])

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
    let lastEventId: string | null = null

    const sync = async () => {
      try {
        const snapshot = await getGeneration(generationRef)
        if (disposed) return
        let status = snapshot.data.status
        let progressValue = snapshot.data.progress
        let candidateRefs = snapshot.data.candidate_refs
        setGenerationStatus(status)
        setProgress(progressValue)
        setGenerationLabel(generationLabelFor(status))

        if (getGenerationEvents !== undefined) {
          try {
            const events = await getGenerationEvents(generationRef, lastEventId)
            const latest = events.at(-1)
            if (latest !== undefined) {
              lastEventId = latest.id
              status = latest.data.status
              progressValue = latest.data.progress
              candidateRefs = latest.data.candidate_refs
              setGenerationStatus(status)
              setProgress(progressValue)
              setGenerationLabel(generationLabelFor(status))
            }
          } catch {
            // Snapshot polling remains the recovery path when event replay is unavailable.
          }
        }

        if (status === "succeeded") {
          const candidateResponse = await listCandidates(snapshot.data.project_ref)
          if (disposed) return
          const generated = candidateResponse.data.candidates.filter((candidate) => candidateRefs.includes(candidate.candidate_ref))
          const generatedCandidates = generated.map(toDomainCandidate)
          setCandidates(generatedCandidates)
          setSelectedCandidateRef(generatedCandidates[0]?.candidateRef ?? "")
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
      } catch {
        if (!disposed) {
          setGenerationStatus("failed")
          setGenerationLabel("Generation status unavailable")
        }
      }
    }

    void sync()
    return () => {
      disposed = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [api, generationRef, preferences.autoplay, selectPlayerCandidate, setPlaying])

  useEffect(() => {
    if (!queueOpen) return
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
  }, [queueOpen])

  const handlePromote = useCallback((candidate: Candidate) => {
    setCurrentVersionRef(candidate.versionRef)
    setCandidates((items) => items.map((item) => ({ ...item, isCurrent: item.candidateRef === candidate.candidateRef })))
    setSelectedCandidateRef(candidate.candidateRef)
    selectPlayerCandidate(candidate)
  }, [selectPlayerCandidate])

  const handleCancel = useCallback(async () => {
    if (generationRef === null) return
    try {
      const response = await api.cancelGeneration(
        generationRef,
        `mori-cancel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      )
      setGenerationStatus(response.data.status)
      setGenerationLabel(generationLabelFor(response.data.status))
      setProgress((value) => Math.min(value, 99))
    } catch {
      setGenerationLabel("Cancellation failed")
    }
  }, [api, generationRef])

  const handleShare = useCallback(() => {
    const clipboardWrite = navigator.clipboard?.writeText(window.location.href)
    if (clipboardWrite !== undefined) void clipboardWrite.catch(() => undefined)
    setShareFeedback(true)
    window.setTimeout(() => setShareFeedback(false), 1800)
  }, [])

  const currentCandidates = candidates.map((candidate) => ({ ...candidate, isCurrent: candidate.versionRef === currentVersionRef }))

  return (
    <main className={styles.app}>
      <MoriAppShell
        activeKey="create"
        ariaLabel="Create workspace"
        showQueueButton
        onQueueOpen={() => setQueueOpen(true)}
      >
        <div className={`${styles.workspaceLayout} ${queueOpen ? styles.workspaceLayoutWithDrawer : ""}`}>
          <section className={styles.createSurface} aria-label="Create canvas">
            <header className={styles.canvasHeader}>
              <div className={styles.breadcrumb}><span>Workspace</span><span>/</span><Link className={styles.breadcrumbLink} href={`/projects/${previewProject.projectRef}`}>{previewProject.title}</Link><span>/</span><strong>New creation</strong></div>
              <div className={styles.headerActions}>
                <button className={styles.queueButton} type="button" onClick={() => setQueueOpen((value) => !value)} aria-expanded={queueOpen} aria-label={queueOpen ? "Hide generation queue" : "Open generation queue"}>
                  <PanelRight size={14} /> <span>Queue</span><b>{currentCandidates.length}</b>
                </button>
                <button className={styles.ghostButton} type="button" onClick={handleShare}><Share2 size={14} /> {shareFeedback ? "Link copied" : "Share"}</button>
              </div>
            </header>
            <div className={styles.canvasBody}>
              <CreateCanvas projectRef={previewProject.projectRef} mode={mode} onModeChange={setModeOverride} onGenerate={handleGenerate} />
            </div>
          </section>

        </div>
      </MoriAppShell>
      {queueOpen && typeof document !== "undefined" ? createPortal(
        <div className={styles.drawerLayer}>
          <button className={styles.drawerBackdrop} type="button" aria-label="Dismiss generation queue" onClick={() => setQueueOpen(false)} />
          <InspectorPanel
            generation={generation}
            candidates={currentCandidates}
            songPlan={songPlan}
            selectedCandidateRef={selectedCandidateRef}
            playing={playing}
            onSelect={(candidate) => { setSelectedCandidateRef(candidate.candidateRef); selectPlayerCandidate(candidate); setPlaying(false) }}
            onPromote={handlePromote}
            onCancel={() => { void handleCancel() }}
            onRetry={retryLastGeneration}
            onPlay={(candidate) => {
              setSelectedCandidateRef(candidate.candidateRef)
              if (playerCandidate?.candidateRef === candidate.candidateRef) togglePlaying()
              else { selectPlayerCandidate(candidate); setPlaying(true) }
            }}
            onClose={() => setQueueOpen(false)}
          />
        </div>,
        document.body,
      ) : null}
    </main>
  )
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
