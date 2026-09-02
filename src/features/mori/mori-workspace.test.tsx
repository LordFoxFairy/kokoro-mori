import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MoriWorkspace } from "./mori-workspace"

describe("Mori workspace", () => {
  it("starts in Smart Create mode without a permanent queue column", () => {
    render(<MoriWorkspace />)
    expect(screen.getByRole("navigation", { name: "Mori" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /make something you can feel/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /smart/i })).toHaveAttribute("aria-selected", "true")
    expect(screen.queryByRole("region", { name: /generation queue/i })).not.toBeInTheDocument()
    expect(screen.getByRole("region", { name: /global player/i })).toBeInTheDocument()
  })

  it("reveals Custom controls without leaving Create", () => {
    render(<MoriWorkspace />)
    fireEvent.click(screen.getByRole("tab", { name: /custom/i }))
    expect(screen.getByLabelText(/lyrics or instrumental/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/style/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /reference audio/i })).toBeInTheDocument()
  })

  it("keeps the sidebar state at the application shell level", () => {
    render(<MoriWorkspace />)
    const navigation = screen.getByRole("navigation", { name: "Mori" })

    expect(screen.getByRole("button", { name: /collapse sidebar/i })).toHaveAttribute("aria-expanded", "true")
    fireEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }))

    expect(navigation).toHaveAttribute("aria-label", "Mori")
    expect(screen.getByRole("button", { name: /expand sidebar/i })).toHaveAttribute("aria-expanded", "false")
  })

  it("opens the generation queue as a contextual drawer", () => {
    render(<MoriWorkspace />)
    expect(screen.queryByRole("region", { name: /generation queue/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /open generation queue/i }))

    expect(screen.getByRole("region", { name: /generation queue/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /close generation queue/i })).toBeInTheDocument()
  })
})
