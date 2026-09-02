"use client"

import { MoreHorizontal, PanelRight, Share2 } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import type { Candidate, CreationMode, GenerationStatus } from "./domain"
import { previewCandidates, previewGeneration, previewProject, previewSongPlan } from "./preview-data"
import { CreateCanvas, type CreationDraft } from "./components/create-canvas"
import { InspectorPanel } from "./components/inspector-panel"
import { MoriAppShell } from "./components/mori-app-shell"
import { PersistentPlayer } from "./components/persistent-player"
import styles from "./mori-workspace.module.css"

export function MoriWorkspace() {
  const [mode, setMode] = useState<CreationMode>("smart")
  const [queueOpen, setQueueOpen] = useState(false)
  const [candidates, setCandidates] = useState(previewCandidates)
  const [currentVersionRef, setCurrentVersionRef] = useState(previewProject.currentVersionRef)
  const [selectedCandidateRef, setSelectedCandidateRef] = useState(previewCandidates[0].candidateRef)
  const [playing, setPlaying] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>(previewGeneration.status)
  const [generationLabel, setGenerationLabel] = useState(previewGeneration.label)
  const [progress, setProgress] = useState(previewGeneration.progress)

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.candidateRef === selectedCandidateRef) ?? candidates[0],
    [candidates, selectedCandidateRef],
  )

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
  }, [])

  const handlePromote = useCallback((candidate: Candidate) => {
    setCurrentVersionRef(candidate.versionRef)
    setCandidates((items) => items.map((item) => ({ ...item, isCurrent: item.candidateRef === candidate.candidateRef })))
    setSelectedCandidateRef(candidate.candidateRef)
  }, [])

  const currentCandidates = candidates.map((candidate) => ({ ...candidate, isCurrent: candidate.versionRef === currentVersionRef }))
  const activeCandidate = currentCandidates.find((candidate) => candidate.candidateRef === selectedCandidate.candidateRef) ?? currentCandidates[0]
  return (
    <main className={styles.app}>
      <MoriAppShell
        activeKey="create"
        ariaLabel="Create workspace"
        project={previewProject}
        player={
          <PersistentPlayer
            candidate={activeCandidate}
            playing={playing}
            onToggle={() => setPlaying((value) => !value)}
            onSelectQueue={() => setQueueOpen(true)}
          />
        }
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
              onSelect={(candidate) => { setSelectedCandidateRef(candidate.candidateRef); setPlaying(false) }}
              onPromote={handlePromote}
              onPlay={(candidate) => { setSelectedCandidateRef(candidate.candidateRef); setPlaying((value) => selectedCandidateRef === candidate.candidateRef ? !value : true) }}
              onClose={() => setQueueOpen(false)}
            />
          ) : null}
        </div>
      </MoriAppShell>
    </main>
  )
}
