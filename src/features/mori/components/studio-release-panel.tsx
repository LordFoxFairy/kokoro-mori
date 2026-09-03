"use client"

import { Check, Globe2, ImagePlus, Link2, LoaderCircle, LockKeyhole, Pencil, RotateCcw, Sparkles, Square } from "lucide-react"
import { useId, useState, type FormEvent } from "react"
import type { ArtworkPalette, ArtworkStyle, ReleaseVisibility } from "@/lib/mori-api"
import { buildMoriAssetContentUrl } from "@/lib/mori-media"
import {
  buildStudioArtworkPlan,
  isActiveArtworkGenerationStatus,
  type StudioArtworkDraft,
  type StudioArtworkPlan,
  type StudioArtworkRunState,
  type StudioReleaseDraft,
  type StudioReleaseSaveState,
} from "../studio-release"
import styles from "./studio-release-panel.module.css"

export type StudioReleasePanelProps = {
  versionRef: string
  draft: StudioReleaseDraft
  artworkDraft: StudioArtworkDraft
  artworkRun: StudioArtworkRunState
  saveState: StudioReleaseSaveState
  onDraftChange: (draft: StudioReleaseDraft) => void
  onArtworkDraftChange: (draft: StudioArtworkDraft) => void
  onGenerateArtwork: (plan: StudioArtworkPlan) => void
  onCancelArtwork: () => void
  onResetArtwork: () => void
  onSave: (draft: StudioReleaseDraft) => void
}

const styleOptions: ReadonlyArray<{ id: ArtworkStyle; label: string }> = [
  { id: "abstract", label: "Abstract" },
  { id: "editorial", label: "Editorial" },
  { id: "illustrated", label: "Illustrated" },
  { id: "photographic", label: "Photographic" },
]

const paletteOptions: ReadonlyArray<{ id: ArtworkPalette; label: string }> = [
  { id: "warm_dawn", label: "Warm dawn" },
  { id: "violet_night", label: "Violet night" },
  { id: "mint_haze", label: "Mint haze" },
  { id: "monochrome", label: "Monochrome" },
]

const visibilityOptions: ReadonlyArray<{
  id: ReleaseVisibility
  label: string
  description: string
  icon: React.ReactNode
}> = [
  { id: "private", label: "Private", description: "Only you", icon: <LockKeyhole size={14} /> },
  { id: "link_only", label: "Link only", description: "Anyone with the link", icon: <Link2 size={14} /> },
  { id: "public", label: "Public", description: "Visible on your profile", icon: <Globe2 size={14} /> },
]

function parseArtworkStyle(value: string): ArtworkStyle {
  return styleOptions.find((option) => option.id === value)?.id ?? "abstract"
}

export function StudioReleasePanel({
  versionRef,
  draft,
  artworkDraft,
  artworkRun,
  saveState,
  onDraftChange,
  onArtworkDraftChange,
  onGenerateArtwork,
  onCancelArtwork,
  onResetArtwork,
  onSave,
}: StudioReleasePanelProps) {
  const titleId = useId()
  const [reviewedArtworkPlan, setReviewedArtworkPlan] = useState<StudioArtworkPlan | null>(null)
  const artworkBusy = isActiveArtworkGenerationStatus(artworkRun.status)
  const artworkRetryable = artworkRun.plan !== null && (artworkRun.status === "failed" || artworkRun.status === "cancelled" || artworkRun.status === "expired")
  const artworkReady = artworkRun.status === "succeeded" && artworkRun.candidates.length > 0

  function updateDraft(patch: Partial<StudioReleaseDraft>) {
    onDraftChange({ ...draft, ...patch })
  }

  function updateArtworkDraft(patch: Partial<StudioArtworkDraft>) {
    onArtworkDraftChange({ ...artworkDraft, ...patch })
    setReviewedArtworkPlan(null)
  }

  function reviewArtwork() {
    setReviewedArtworkPlan(buildStudioArtworkPlan(artworkDraft))
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (draft.title.trim() === "" || saveState.status === "saving") return
    onSave(draft)
  }

  return (
    <form className={styles.release} aria-labelledby={titleId} onSubmit={save}>
      <div className={styles.body}>
        <div className={styles.intro}>
          <div><span>Release draft</span><h3 id={titleId}>Prepare the way this song leaves Studio.</h3></div>
          <p>Artwork and release choices stay attached to <code>{versionRef}</code>. Nothing is published from this window.</p>
        </div>

        <div className={styles.grid}>
          <section className={styles.card} aria-labelledby="release-artwork-heading">
            <header className={styles.cardHeader}>
              <span className={styles.cardIcon}><ImagePlus size={16} /></span>
              <div><span>Visual identity</span><h4 id="release-artwork-heading">Artwork</h4></div>
              <span className={styles.optional}>Optional AI</span>
            </header>

            <div className={styles.currentArtworkRow}>
              <button
                className={`${styles.currentArtwork} ${draft.artwork.type === "current" ? styles.artworkSelected : ""}`}
                type="button"
                role="radio"
                aria-checked={draft.artwork.type === "current"}
                aria-label="Use current artwork"
                onClick={() => updateDraft({ artwork: { type: "current" } })}
              >
                <span aria-hidden="true"><i /><i /><i /></span>
                <small>Current</small>
                {draft.artwork.type === "current" ? <b aria-hidden="true"><Check size={12} /></b> : null}
              </button>
              <div className={styles.artworkCopy}>
                <strong>Keep the current cover</strong>
                <p>Or ask Mori for four text-free square concepts based on the song.</p>
              </div>
            </div>

            {artworkReady ? (
              <ArtworkCandidates draft={draft} candidates={artworkRun.candidates} onSelect={(artworkCandidateRef) => updateDraft({ artwork: { type: "artwork_candidate", artworkCandidateRef } })} />
            ) : null}

            {artworkBusy ? (
              <div className={styles.runCard} aria-live="polite">
                <div className={styles.runTitle}><span><LoaderCircle size={14} /></span><div><strong>Creating four concepts</strong><small>{artworkStatusLabel(artworkRun.status)}</small></div></div>
                <div className={styles.progress} role="progressbar" aria-label="Artwork progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={artworkRun.progress}><span style={{ width: `${artworkRun.progress}%` }} /></div>
                <button className={styles.dangerButton} type="button" onClick={onCancelArtwork}><Square size={10} fill="currentColor" /> Cancel artwork</button>
              </div>
            ) : artworkRetryable ? (
              <div className={styles.runCard} role="alert">
                <div><strong>Artwork needs another pass.</strong><p>{artworkRun.message}</p></div>
                <div className={styles.inlineActions}>
                  <button className={styles.textButton} type="button" onClick={() => { onResetArtwork(); setReviewedArtworkPlan(null) }}><Pencil size={12} /> Edit brief</button>
                  <button className={styles.secondaryAction} type="button" onClick={() => artworkRun.plan !== null && onGenerateArtwork(artworkRun.plan)}><RotateCcw size={12} /> Retry artwork</button>
                </div>
              </div>
            ) : reviewedArtworkPlan !== null ? (
              <section className={styles.artworkPlan} role="region" aria-label="Artwork plan">
                <header><div><span>Artwork plan</span><strong>{styleLabel(reviewedArtworkPlan.style)} · {paletteLabel(reviewedArtworkPlan.palette)}</strong></div><span>Ready</span></header>
                <p>{reviewedArtworkPlan.prompt}</p>
                <div><span>Square · no typography</span><span>4 concepts</span></div>
                <footer>
                  <button className={styles.textButton} type="button" onClick={() => setReviewedArtworkPlan(null)}><Pencil size={12} /> Edit brief</button>
                  <button className={styles.secondaryAction} type="button" onClick={() => onGenerateArtwork(reviewedArtworkPlan)}><Sparkles size={13} /> Create 4 concepts</button>
                </footer>
              </section>
            ) : (
              <div className={styles.artworkEditor}>
                <label className={styles.field}>
                  <span>Artwork brief</span>
                  <textarea
                    aria-label="Artwork brief"
                    value={artworkDraft.prompt}
                    maxLength={400}
                    placeholder="e.g. sunrise through a train window, soft film grain"
                    onChange={(event) => updateArtworkDraft({ prompt: event.target.value })}
                  />
                  <small>{artworkDraft.prompt.length}/400</small>
                </label>
                <div className={styles.artworkControls}>
                  <label className={styles.field}>
                    <span>Style</span>
                    <select aria-label="Artwork style" value={artworkDraft.style} onChange={(event) => updateArtworkDraft({ style: parseArtworkStyle(event.target.value) })}>
                      {styleOptions.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
                    </select>
                  </label>
                  <fieldset className={styles.paletteField}>
                    <legend>Palette</legend>
                    <div>
                      {paletteOptions.map((option) => (
                        <label className={styles.paletteChoice} data-palette={option.id} key={option.id}>
                          <input type="radio" name="artwork-palette" aria-label={option.label} checked={artworkDraft.palette === option.id} onChange={() => updateArtworkDraft({ palette: option.id })} />
                          <span aria-hidden="true" /><small>{option.label}</small>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
                <button className={styles.reviewButton} type="button" disabled={artworkDraft.prompt.trim() === ""} onClick={reviewArtwork}><Sparkles size={13} /> Review artwork</button>
              </div>
            )}

            {artworkReady ? <button className={styles.anotherButton} type="button" onClick={() => { onResetArtwork(); setReviewedArtworkPlan(null) }}><RotateCcw size={12} /> Create another set</button> : null}
          </section>

          <section className={styles.card} aria-labelledby="release-details-heading">
            <header className={styles.cardHeader}>
              <span className={styles.cardIcon}><Sparkles size={16} /></span>
              <div><span>Release identity</span><h4 id="release-details-heading">Details & access</h4></div>
            </header>
            <label className={styles.field}>
              <span>Release title</span>
              <input aria-label="Release title" value={draft.title} maxLength={120} onChange={(event) => updateDraft({ title: event.target.value })} />
              <small>{draft.title.length}/120</small>
            </label>
            <label className={styles.field}>
              <span>Release note <em>Optional</em></span>
              <textarea aria-label="Release note" value={draft.description} maxLength={500} placeholder="A short note about this song" onChange={(event) => updateDraft({ description: event.target.value })} />
              <small>{draft.description.length}/500</small>
            </label>
            <fieldset className={styles.visibility}>
              <legend>Desired visibility</legend>
              <div>
                {visibilityOptions.map((option) => (
                  <label className={draft.visibility === option.id ? styles.visibilityActive : ""} key={option.id}>
                    <input type="radio" name="release-visibility" aria-label={`${option.label} — ${option.description}`} checked={draft.visibility === option.id} onChange={() => updateDraft({ visibility: option.id })} />
                    <span>{option.icon}</span><strong>{option.label}</strong><small>{option.description}</small>
                  </label>
                ))}
              </div>
              {draft.visibility === "public" ? <p>Public is saved as your intended visibility. Publishing still requires a separate final review.</p> : null}
            </fieldset>
            <div className={styles.toggles}>
              <label><input type="checkbox" checked={draft.allowRemix} onChange={(event) => updateDraft({ allowRemix: event.target.checked })} /><span><strong>Allow remixes</strong><small>Separate from who can see the release</small></span></label>
              <label><input type="checkbox" checked={draft.explicitContent} onChange={(event) => updateDraft({ explicitContent: event.target.checked })} /><span><strong>Contains explicit content</strong><small>Stored as release metadata</small></span></label>
            </div>
          </section>
        </div>
      </div>

      <footer className={styles.footer}>
        <div className={styles.saveMessage} aria-live="polite">
          {saveState.status === "saved" && saveState.snapshot !== null ? <span role="status"><Check size={13} /> Draft revision {saveState.snapshot.revision} saved</span> : null}
          {saveState.status === "failed" ? <span role="alert">{saveState.message ?? "Release draft was not saved. Your choices are still here."}</span> : null}
          {saveState.status === "idle" ? <span>Saving this draft does not publish or change the current song.</span> : null}
          {saveState.status === "saving" ? <span><LoaderCircle size={13} /> Saving draft…</span> : null}
        </div>
        <button className={styles.saveButton} type="submit" disabled={draft.title.trim() === "" || saveState.status === "saving"}>
          {saveState.status === "saving" ? <LoaderCircle size={14} /> : <Check size={14} />}
          Save release draft
        </button>
      </footer>
    </form>
  )
}

function ArtworkCandidates({ draft, candidates, onSelect }: {
  draft: StudioReleaseDraft
  candidates: StudioArtworkRunState["candidates"]
  onSelect: (artworkCandidateRef: string) => void
}) {
  return (
    <div className={styles.candidates} role="radiogroup" aria-label="Generated artwork concepts">
      {candidates.map((candidate, index) => {
        const selected = draft.artwork.type === "artwork_candidate" && draft.artwork.artworkCandidateRef === candidate.artwork_candidate_ref
        return (
          <button
            className={selected ? styles.artworkSelected : ""}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`Use artwork concept ${index + 1}`}
            onClick={() => onSelect(candidate.artwork_candidate_ref)}
            key={candidate.artwork_candidate_ref}
          >
            {/* Opaque authenticated BFF assets keep their same-origin URL instead of entering Next's public image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={buildMoriAssetContentUrl(candidate.thumbnail_asset_ref)} alt={candidate.alt_text} />
            <span>0{index + 1}</span>
            {selected ? <b aria-hidden="true"><Check size={12} /></b> : null}
          </button>
        )
      })}
    </div>
  )
}

function artworkStatusLabel(status: StudioArtworkRunState["status"]): string {
  if (status === "preparing") return "Preparing the visual plan"
  if (status === "queued") return "Waiting for a visual slot"
  if (status === "generating") return "Exploring composition and color"
  if (status === "post_processing") return "Finishing image assets"
  return "Artwork update"
}

function styleLabel(style: ArtworkStyle): string {
  return styleOptions.find((option) => option.id === style)?.label ?? style
}

function paletteLabel(palette: ArtworkPalette): string {
  return paletteOptions.find((option) => option.id === palette)?.label ?? palette
}
