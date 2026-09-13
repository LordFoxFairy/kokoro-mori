import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { emptyStudioTakeReview, StudioTakeReview, type StudioTakeReviewState } from "./studio-take-review"

describe("StudioTakeReview", () => {
  it("keeps review state explicit and lets the user undo a rating", () => {
    const onChange = vi.fn<(review: StudioTakeReviewState) => void>()
    const view = render(<StudioTakeReview takeTitle="Afterglow" review={emptyStudioTakeReview} onChange={onChange} />)

    fireEvent.click(screen.getByRole("button", { name: "Like Afterglow" }))
    expect(onChange).toHaveBeenLastCalledWith({ rating: "positive", reason: null })

    view.rerender(<StudioTakeReview takeTitle="Afterglow" review={{ rating: "positive", reason: null }} onChange={onChange} />)
    fireEvent.click(screen.getByRole("button", { name: "Like Afterglow" }))
    expect(onChange).toHaveBeenLastCalledWith(emptyStudioTakeReview)
  })

  it("asks for a negative reason and routes layer feedback to stems", () => {
    const onChange = vi.fn<(review: StudioTakeReviewState) => void>()
    const onOpenStems = vi.fn()
    const view = render(<StudioTakeReview takeTitle="Afterglow" review={emptyStudioTakeReview} onChange={onChange} onOpenStems={onOpenStems} />)

    fireEvent.click(screen.getByRole("button", { name: "Dislike Afterglow" }))
    expect(onChange).toHaveBeenLastCalledWith({ rating: "negative", reason: null })

    view.rerender(<StudioTakeReview takeTitle="Afterglow" review={{ rating: "negative", reason: "layers" }} onChange={onChange} onOpenStems={onOpenStems} />)
    expect(screen.getByRole("group", { name: "Rate Afterglow" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Open Voice & stems" }))
    expect(onOpenStems).toHaveBeenCalledOnce()
  })

  it("keeps the feedback private to the browser session", () => {
    render(<StudioTakeReview takeTitle="Afterglow" review={{ rating: "positive", reason: null }} onChange={vi.fn()} />)
    expect(screen.getByRole("status")).toHaveTextContent("Saved for this session")
    expect(screen.getByRole("status")).toHaveTextContent("does not change Current")
  })
})
