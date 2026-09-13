"use client"

import { Check, ThumbsDown, ThumbsUp } from "lucide-react"
import { useId } from "react"
import styles from "./studio-take-review.module.css"

export type StudioTakeReviewRating = "positive" | "negative" | null
export type StudioTakeReviewReason = "sound_quality" | "timing" | "layers"

export type StudioTakeReviewState = {
  rating: StudioTakeReviewRating
  reason: StudioTakeReviewReason | null
}

export const emptyStudioTakeReview: StudioTakeReviewState = { rating: null, reason: null }

const reasons: readonly { id: StudioTakeReviewReason; label: string }[] = [
  { id: "sound_quality", label: "Sound quality" },
  { id: "timing", label: "Timing feels off" },
  { id: "layers", label: "Too many layers" },
]

type StudioTakeReviewProps = {
  takeTitle: string
  review: StudioTakeReviewState
  onChange: (review: StudioTakeReviewState) => void
  onOpenStems?: () => void
}

export function StudioTakeReview({ takeTitle, review, onChange, onOpenStems }: StudioTakeReviewProps) {
  const reasonGroupId = useId()
  const hasReview = review.rating !== null

  function setRating(rating: Exclude<StudioTakeReviewRating, null>) {
    if (review.rating === rating) {
      onChange(emptyStudioTakeReview)
      return
    }
    onChange({ rating, reason: rating === "negative" ? review.reason : null })
  }

  return (
    <div className={styles.review} aria-label={`Review ${takeTitle}`}>
      <div className={styles.reviewRow}>
        <span className={styles.reviewPrompt}>How does this take feel?</span>
        <div className={styles.reviewActions} role="group" aria-label={`Rate ${takeTitle}`}>
          <button
            className={`${styles.reviewButton} ${review.rating === "positive" ? styles.reviewButtonPositive : ""}`}
            type="button"
            aria-label={`Like ${takeTitle}`}
            aria-pressed={review.rating === "positive"}
            onClick={() => setRating("positive")}
          >
            <ThumbsUp aria-hidden="true" size={13} />
            <span>Works</span>
          </button>
          <button
            className={`${styles.reviewButton} ${review.rating === "negative" ? styles.reviewButtonNegative : ""}`}
            type="button"
            aria-label={`Dislike ${takeTitle}`}
            aria-pressed={review.rating === "negative"}
            aria-expanded={review.rating === "negative"}
            aria-controls={reasonGroupId}
            onClick={() => setRating("negative")}
          >
            <ThumbsDown aria-hidden="true" size={13} />
            <span>Needs work</span>
          </button>
        </div>
      </div>

      {review.rating === "negative" ? (
        <fieldset className={styles.reasonGroup} id={reasonGroupId}>
          <legend>What should change?</legend>
          <div className={styles.reasonOptions}>
            {reasons.map((reason) => (
              <button
                className={`${styles.reasonButton} ${review.reason === reason.id ? styles.reasonButtonSelected : ""}`}
                type="button"
                key={reason.id}
                aria-pressed={review.reason === reason.id}
                onClick={() => onChange({ rating: "negative", reason: reason.id })}
              >
                {review.reason === reason.id ? <Check aria-hidden="true" size={12} /> : null}
                {reason.label}
              </button>
            ))}
          </div>
          {review.reason === "layers" && onOpenStems !== undefined ? (
            <button className={styles.openStemsButton} type="button" onClick={onOpenStems}>Open Voice &amp; stems</button>
          ) : null}
        </fieldset>
      ) : null}

      {hasReview ? <span className={styles.sessionNote} role="status">Saved for this session · does not change Current</span> : null}
    </div>
  )
}
