"use client"

import { Check, FolderPlus, X } from "lucide-react"
import { useEffect, useRef, useState, type FormEvent } from "react"
import type { MoriApi, MoriProject, MoriProjectCreateInput } from "@/lib/mori-api"
import { MoriApiRequestError } from "@/lib/mori-api-client"
import styles from "./mori-workspace.module.css"

type ProjectCreateDialogProps = {
  createProject?: MoriApi["createProject"]
  onClose: () => void
  onCreated: (project: MoriProject) => void
}

export function ProjectCreateDialog({ createProject, onClose, onCreated }: ProjectCreateDialogProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [createdProject, setCreatedProject] = useState<MoriProject | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    titleRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== "Tab") return

      const dialog = dialogRef.current
      if (dialog === null) return
      const focusable = getFocusableElements(dialog)
      const first = focusable[0]
      const last = focusable.at(-1)
      if (first === undefined || last === undefined) return
      if (document.activeElement === dialog) {
        event.preventDefault()
        const destination = event.shiftKey ? last : first
        destination.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [onClose])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = toProjectInput(title, description)
    if (input === null) {
      setError("Give this project a name so you can find it later.")
      titleRef.current?.focus()
      return
    }
    if (createProject === undefined) {
      setError("Project creation is not connected yet. Try again from the workspace.")
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      const response = await createProject(input, `mori-project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
      setCreatedProject(response.data)
      onCreated(response.data)
    } catch (cause) {
      setError(projectCreationError(cause))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.projectCreateLayer}>
      <button className={styles.projectCreateBackdrop} type="button" aria-label="Dismiss new project" onClick={onClose} />
      <section ref={dialogRef} className={styles.projectCreateDialog} role="dialog" aria-modal="true" aria-labelledby="project-create-title" tabIndex={-1}>
        {createdProject === null ? (
          <>
            <header className={styles.projectCreateHeader}>
              <div className={styles.projectCreateIcon} aria-hidden="true"><FolderPlus size={18} /></div>
              <div>
                <h2 id="project-create-title">Start a new project</h2>
                <p>Give the idea a home. You can shape its first direction next.</p>
              </div>
              <button className={styles.iconButton} type="button" onClick={onClose} aria-label="Close new project"><X size={17} /></button>
            </header>
            <form className={styles.projectCreateForm} onSubmit={(event) => { void submit(event) }}>
              <label className={styles.projectCreateField}>
                <span>Project name</span>
                <input ref={titleRef} className={styles.textInput} value={title} onChange={(event) => { setTitle(event.target.value); setError(null) }} placeholder="e.g. Glasshouse" autoComplete="off" />
              </label>
              <label className={styles.projectCreateField}>
                <span>Description <small>Optional</small></span>
                <textarea className={styles.projectCreateDescription} value={description} onChange={(event) => { setDescription(event.target.value); setError(null) }} placeholder="What should this body of work feel like?" rows={4} />
              </label>
              {error !== null ? <p className={styles.projectCreateError} role="alert">{error}</p> : null}
              <footer className={styles.projectCreateActions}>
                <button className={styles.ghostButton} type="button" onClick={onClose}>Cancel</button>
                <button className={styles.generateButton} type="submit" disabled={submitting}>{submitting ? "Creating…" : <><Check size={14} /> Create project</>}</button>
              </footer>
            </form>
          </>
        ) : (
          <div className={styles.projectCreateSuccess}>
            <div className={styles.projectCreateSuccessIcon}><Check size={22} /></div>
            <div className={styles.eyebrow}><span className={styles.eyebrowDot} />Project created</div>
            <h2 id="project-create-title">{createdProject.title}</h2>
            <p>{createdProject.description}</p>
            <div className={styles.projectCreateActions}>
              <button className={styles.ghostButton} type="button" onClick={onClose}>Keep browsing</button>
              <a
                className={styles.generateButton}
                href={`/create?project_ref=${encodeURIComponent(createdProject.project_ref)}`}
                aria-label={`Start the first direction for ${createdProject.title}`}
              >
                Start first direction
              </a>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function toProjectInput(title: string, description: string): MoriProjectCreateInput | null {
  const normalizedTitle = title.trim()
  if (normalizedTitle === "") return null
  return {
    title: normalizedTitle,
    description: description.trim() || "A new space for your next direction.",
  }
}

function projectCreationError(error: unknown): string {
  if (error instanceof MoriApiRequestError && error.code === "mori_bff_unavailable") return "Mori is offline right now. Try again."
  return "We couldn't create this project. Try again."
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>([
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",")))
}
