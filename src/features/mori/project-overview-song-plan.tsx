import { ArrowUpRight, Clock3, Sparkles } from "lucide-react"
import Link from "next/link"
import type { MoriCurrentSongPlanRevision } from "@/lib/mori-api"
import type { ProjectWorkspaceProjectionStatus } from "./use-project-workspace-projection"
import styles from "./mori-workspace.module.css"

type ProjectOverviewSongPlanProps = {
  projectRef: string
  plan: MoriCurrentSongPlanRevision | null
  isPreview: boolean
  status: ProjectWorkspaceProjectionStatus
  onRetry: () => void
}

export function ProjectOverviewSongPlan({ projectRef, plan, isPreview, status, onRetry }: ProjectOverviewSongPlanProps) {
  return (
    <section className={styles.overviewSection} aria-labelledby="plan-overview-heading">
      <div className={styles.overviewSectionHeader}>
        <div><h2 id="plan-overview-heading">Song plan</h2><p>The intention behind this project, kept visible as you refine it.</p></div>
      </div>
      {status === "loading" ? <PlanMessage
        title="Loading saved plan"
        description="Mori is recovering this Project’s creative direction."
      /> : plan !== null ? <div className={styles.overviewPlanCard}>
        <div className={styles.overviewPlanStats}>
          <span><b>Mood</b>{plan.mood}</span>
          <span><b>Tempo</b>{plan.tempo_bpm} BPM</span>
          <span><b>Palette</b>{plan.instruments.join(" · ") || "Open palette"}</span>
        </div>
        <div className={styles.tagRow}>{plan.structure.map((item) => <span className={`${styles.tag} ${styles.tagSelected}`} key={item}>{item}</span>)}</div>
        <p><Clock3 size={14} /><span>{isPreview ? "Preview plan" : `Revision ${plan.revision} · saved`}</span><span aria-hidden="true">·</span><span>{plan.vocal_direction}</span></p>
      </div> : status === "ready" ? <PlanMessage
        title="No saved plan yet"
        description="Start a direction to shape the mood, structure, palette, and voice before generating."
        projectRef={projectRef}
      /> : <PlanMessage
        title="Plan details not available"
        description="Mori could not recover this Project’s saved direction yet."
        projectRef={projectRef}
        onRetry={onRetry}
      />}
    </section>
  )
}

function PlanMessage({ title, description, projectRef, onRetry }: {
  title: string
  description: string
  projectRef?: string
  onRetry?: () => void
}) {
  return <div className={styles.overviewPlanUnavailable}>
    <span className={styles.overviewPlanUnavailableIcon} aria-hidden="true"><Sparkles size={17} /></span>
    <div><strong>{title}</strong><p>{description}</p></div>
    {onRetry !== undefined
      ? <button className={styles.ghostButton} type="button" onClick={onRetry}>Try again</button>
      : projectRef !== undefined ? <Link href={`/create?project_ref=${encodeURIComponent(projectRef)}`}>Create with a plan <ArrowUpRight size={13} /></Link> : null}
  </div>
}
