import { fireEvent, render, screen, within } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import type { Candidate } from "../domain"
import { StudioVersionHistoryDrawer } from "./studio-version-history"

const candidates: Candidate[] = [
  {
    candidateRef: "candidate_a",
    versionRef: "version/a",
    generationRef: "generation_a",
    title: "First Light",
    subtitle: "Warm indie pop",
    durationSeconds: 182,
    mood: "warm",
    waveformSeed: 11,
    isCurrent: false,
  },
  {
    candidateRef: "candidate_b",
    versionRef: "version_b",
    generationRef: "generation_b",
    title: "Afterglow",
    subtitle: "Airy dream pop",
    durationSeconds: 196,
    mood: "airy",
    waveformSeed: 17,
    isCurrent: true,
  },
]

const sharedProps = {
  candidates,
  projectRef: "project /one",
  openVersionRef: "version/a",
  currentVersionRef: "version_b",
}

describe("Studio Version history", () => {
  it("labels Current and Open independently and encodes Version links", () => {
    render(<DrawerHarness />)
    fireEvent.click(screen.getByRole("button", { name: "Show versions" }))

    const drawer = screen.getByRole("dialog", { name: "Version history" })
    const openDraft = within(drawer).getByRole("link", { name: "First Light, Draft, Open, 3:02" })
    const current = within(drawer).getByRole("link", { name: "Afterglow, Current, 3:16" })

    expect(openDraft).toHaveAttribute("aria-current", "page")
    expect(openDraft).toHaveAttribute("href", "/projects/project%20%2Fone/studio/version%2Fa")
    expect(current).not.toHaveAttribute("aria-current")
    expect(within(openDraft).getByText("Draft · Open · 3:02")).toBeInTheDocument()
    expect(within(current).getByText("Current · 3:16")).toBeInTheDocument()
  })

  it("opens as a modal drawer, traps focus, and restores the launcher on Escape", () => {
    render(<DrawerHarness />)
    const launcher = screen.getByRole("button", { name: "Show versions" })
    launcher.focus()
    fireEvent.click(launcher)

    const dialog = screen.getByRole("dialog", { name: "Version history" })
    const close = within(dialog).getByRole("button", { name: "Close version history" })
    const links = within(dialog).getAllByRole("link")
    const lastLink = links.at(-1)

    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(close).toHaveFocus()
    expect(document.body.style.overflow).toBe("hidden")
    expect(lastLink).toBeDefined()

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true })
    expect(lastLink).toHaveFocus()
    fireEvent.keyDown(window, { key: "Tab" })
    expect(close).toHaveFocus()

    fireEvent.keyDown(window, { key: "Escape" })
    expect(screen.queryByRole("dialog", { name: "Version history" })).not.toBeInTheDocument()
    expect(launcher).toHaveFocus()
    expect(document.body.style.overflow).toBe("")
  })

  it("closes from the backdrop and restores focus", () => {
    render(<DrawerHarness />)
    const launcher = screen.getByRole("button", { name: "Show versions" })
    launcher.focus()
    fireEvent.click(launcher)

    fireEvent.click(screen.getByRole("button", { name: "Dismiss version history" }))

    expect(screen.queryByRole("dialog", { name: "Version history" })).not.toBeInTheDocument()
    expect(launcher).toHaveFocus()
  })

  it("dismisses on Version navigation without moving focus back to the launcher", () => {
    render(<DrawerHarness />)
    const launcher = screen.getByRole("button", { name: "Show versions" })
    fireEvent.click(launcher)

    const dialog = screen.getByRole("dialog", { name: "Version history" })
    const versionLink = within(dialog).getByRole("link", { name: "First Light, Draft, Open, 3:02" })
    versionLink.addEventListener("click", (event) => event.preventDefault(), { once: true })
    fireEvent.click(versionLink)

    expect(screen.queryByRole("dialog", { name: "Version history" })).not.toBeInTheDocument()
    expect(launcher).not.toHaveFocus()
  })

  it("keeps modifier-clicks native when Studio supplies an in-place Version selector", () => {
    const onSelectVersion = vi.fn()
    render(<DrawerHarness onSelectVersion={onSelectVersion} />)
    fireEvent.click(screen.getByRole("button", { name: "Show versions" }))

    const drawer = screen.getByRole("dialog", { name: "Version history" })
    const versionLink = within(drawer).getByRole("link", {
      name: "Afterglow, Current, 3:16",
    })
    const click = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      metaKey: true,
    })
    document.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    })
    versionLink.dispatchEvent(click)

    expect(onSelectVersion).not.toHaveBeenCalled()
  })
})

function DrawerHarness({ onSelectVersion }: { onSelectVersion?: (candidate: Candidate) => void } = {}) {
  const [open, setOpen] = useState(false)

  return <>
    <button type="button" onClick={() => setOpen(true)}>Show versions</button>
    {open ? <StudioVersionHistoryDrawer id="studio-version-history-drawer" {...sharedProps} onSelectVersion={onSelectVersion} onClose={() => setOpen(false)} /> : null}
  </>
}
