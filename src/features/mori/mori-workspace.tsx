"use client"

import { MoreHorizontal, PanelRight, Share2 } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
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
  const { playing, playerCandidate, setPlaying, togglePlaying, selectPlayerCandidate } = useMoriApp()

  const generation = useMemo(() => ({
    ...previewGeneration,
    status: generationStatus,
    label: generationLabel,
    progress,
    candidateRefs: candidates.map((candidate) => candidate.candidateRef),
  }), [candidates, generationLabel, generationStatus, progress])

  const handleGenerate = useCallback((draft: CreationDraft) => {
    setGenerationStatus("generating")
    setGenerationLabel(draft.prompt.trim() ? "Shaping your next direction" : "Adding a new direction")
    setProgress(42)
    setPlaying(false)
    setQueueOpen(true)
    window.setTimeout(() => {
      setGenerationStatus("succeeded")
      setGenerationLabel("Two new directions")
      setProgress(100)
    }, 650)
  }, [setPlaying])

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

          {queueOpen ? (
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
          ) : null}
        </div>
      </MoriAppShell>
    </main>
  )
}
