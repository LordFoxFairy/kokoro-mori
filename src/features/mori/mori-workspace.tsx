"use client"

import { MoreHorizontal, PanelRight, Share2 } from "lucide-react"
import { createPortal } from "react-dom"
import { useCallback, useEffect, useMemo, useState } from "react"
import { createGenerationRequest } from "@/lib/mori-api"
import { createMoriApiClient, MoriApiRequestError } from "@/lib/mori-api-client"
import type { Candidate, CreationMode, GenerationStatus } from "./domain"
import { previewCandidates, previewGeneration, previewProject, previewSongPlan } from "./preview-data"
import { CreateCanvas, type CreationDraft } from "./components/create-canvas"
import { InspectorPanel } from "./components/inspector-panel"
import { useMoriApp } from "./components/mori-app-provider"
import { MoriAppShell } from "./components/mori-app-shell"
import styles from "./mori-workspace.module.css"

export function MoriWorkspace() {
  const [mode, setMode] = useState<CreationMode>("smart")
  const [queueOpen, setQueueOpen] = useState(false)
  const [candidates, setCandidates] = useState(previewCandidates)
  const [currentVersionRef, setCurrentVersionRef] = useState(previewProject.currentVersionRef)
  const [selectedCandidateRef, setSelectedCandidateRef] = useState(previewCandidates[0].candidateRef)
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>(previewGeneration.status)
  const [generationLabel, setGenerationLabel] = useState(previewGeneration.label)
  const [progress, setProgress] = useState(previewGeneration.progress)
  const [generationRef, setGenerationRef] = useState<string | null>(null)
  const api = useMemo(() => createMoriApiClient(), [])
  const { playing, playerCandidate, setPlaying, togglePlaying, selectPlayerCandidate } = useMoriApp()

  const generation = useMemo(() => ({
    ...previewGeneration,
    status: generationStatus,
    label: generationLabel,
    progress,
    candidateRefs: candidates.map((candidate) => candidate.candidateRef),
  }), [candidates, generationLabel, generationStatus, progress])

  const handleGenerate = useCallback(async (draft: CreationDraft) => {
    setGenerationStatus("preparing")
    setGenerationLabel(draft.prompt.trim() ? "Preparing your next direction" : "Preparing a new direction")
    setProgress(8)
    setPlaying(false)
    setQueueOpen(true)
    try {
      const response = await api.createGeneration(
        previewProject.projectRef,
        createGenerationRequest({
          mode,
          prompt: draft.prompt,
          songPlanRef: previewSongPlan.songPlanRef,
          lyricsMode: draft.lyricsMode,
          style: draft.style,
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
      setGenerationLabel(error instanceof MoriApiRequestError ? error.code : "Generation request failed")
      setProgress(0)
    }
  }, [api, mode, setPlaying])

  useEffect(() => {
    const getGeneration = api.getGeneration
    const listCandidates = api.listCandidates
    if (generationRef === null || getGeneration === undefined || listCandidates === undefined) return
    let disposed = false
    let timer: number | undefined

    const sync = async () => {
      try {
        const snapshot = await getGeneration(generationRef)
        if (disposed) return
        setGenerationStatus(snapshot.data.status)
        setProgress(snapshot.data.progress)
        setGenerationLabel(generationLabelFor(snapshot.data.status))
        if (snapshot.data.status === "succeeded") {
          const candidateResponse = await listCandidates(previewProject.projectRef)
          if (disposed) return
          const generated = candidateResponse.data.candidates.filter((candidate) => snapshot.data.candidate_refs.includes(candidate.candidate_ref))
          if (generated.length > 0) setCandidates(generated.map(toDomainCandidate))
          return
        }
        if (["failed", "cancelled", "expired"].includes(snapshot.data.status)) return
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
  }, [api, generationRef])

  useEffect(() => {
    if (!queueOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setQueueOpen(false)
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [queueOpen])

  const handlePromote = useCallback((candidate: Candidate) => {
    setCurrentVersionRef(candidate.versionRef)
    setCandidates((items) => items.map((item) => ({ ...item, isCurrent: item.candidateRef === candidate.candidateRef })))
    setSelectedCandidateRef(candidate.candidateRef)
    selectPlayerCandidate(candidate)
  }, [selectPlayerCandidate])

  const currentCandidates = candidates.map((candidate) => ({ ...candidate, isCurrent: candidate.versionRef === currentVersionRef }))
  return (
    <main className={styles.app}>
      <MoriAppShell
        activeKey="create"
        ariaLabel="Create workspace"
        project={previewProject}
        showQueueButton
        onQueueOpen={() => setQueueOpen(true)}
      >
        <div className={`${styles.workspaceLayout} ${queueOpen ? styles.workspaceLayoutWithDrawer : ""}`}>
          <section className={styles.createSurface} aria-label="Create canvas">
            <header className={styles.canvasHeader}>
              <div className={styles.breadcrumb}><span>Workspace</span><span>/</span><strong>New creation</strong></div>
              <div className={styles.headerActions}>
                <button className={styles.queueButton} type="button" onClick={() => setQueueOpen((value) => !value)} aria-expanded={queueOpen} aria-label={queueOpen ? "Hide generation queue" : "Open generation queue"}>
                  <PanelRight size={14} /> <span>Queue</span><b>{currentCandidates.length}</b>
                </button>
                <button className={styles.ghostButton} type="button"><Share2 size={14} /> Share</button>
                <button className={styles.iconButton} type="button" aria-label="More workspace options"><MoreHorizontal /></button>
              </div>
            </header>
            <div className={styles.canvasBody}>
              <CreateCanvas mode={mode} onModeChange={setMode} onGenerate={handleGenerate} />
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
            songPlan={previewSongPlan}
            selectedCandidateRef={selectedCandidateRef}
            playing={playing}
            onSelect={(candidate) => { setSelectedCandidateRef(candidate.candidateRef); selectPlayerCandidate(candidate); setPlaying(false) }}
            onPromote={handlePromote}
            onPlay={(candidate) => {
              setSelectedCandidateRef(candidate.candidateRef)
              if (playerCandidate.candidateRef === candidate.candidateRef) togglePlaying()
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
