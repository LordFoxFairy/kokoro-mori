import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MoriAppProvider, useMoriApp } from "./components/mori-app-provider"
import { MoriSettingsPage } from "./settings-page"

function renderSettings() {
  return render(
    <MoriAppProvider>
      <MoriSettingsPage />
    </MoriAppProvider>,
  )
}

describe("Mori settings", () => {
  it("starts with music-focused appearance controls", () => {
    renderSettings()

    expect(screen.getByTestId("settings-overlay")).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Settings" })).toHaveAttribute("aria-modal", "true")
    expect(screen.getByRole("link", { name: "Close settings" })).toHaveAttribute("href", "/")
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/")
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Appearance" })).toBeInTheDocument()
    expect(screen.getByText("Light gradient")).toBeInTheDocument()
    expect(screen.queryByText("My computer")).not.toBeInTheDocument()
    expect(screen.queryByText("Integrations")).not.toBeInTheDocument()
  })

  it("keeps the workspace behind the modal from scrolling", () => {
    renderSettings()

    expect(document.body.style.overflow).toBe("hidden")
  })

  it("moves focus into the window and keeps keyboard focus inside it", async () => {
    renderSettings()

    await waitFor(() => expect(screen.getByRole("link", { name: "Back to home" })).toHaveFocus())

    const settingsSearch = screen.getByRole("textbox", { name: "Search settings" })
    const lastControl = screen.getByRole("button", { name: "Off" })
    settingsSearch.focus()
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true })
    expect(lastControl).toHaveFocus()

    lastControl.focus()
    fireEvent.keyDown(window, { key: "Tab" })
    expect(settingsSearch).toHaveFocus()

  })

  it("lets Escape use the same close affordance as the window", async () => {
    renderSettings()

    await waitFor(() => expect(screen.getByRole("link", { name: "Back to home" })).toHaveFocus())
    const closeSettings = screen.getByRole("link", { name: "Back to home" })
    const closeSpy = vi.spyOn(closeSettings, "click").mockImplementation(() => {})
    fireEvent.keyDown(window, { key: "Escape" })

    expect(closeSpy).toHaveBeenCalledTimes(1)
  })

  it("returns to the originating Mori surface when closed", () => {
    render(
      <MoriAppProvider>
        <MoriSettingsPage returnTo="/projects/project_live_1/studio/version_live_1" />
      </MoriAppProvider>,
    )

    expect(screen.getByRole("link", { name: "Back to studio" })).toHaveAttribute("href", "/projects/project_live_1/studio/version_live_1")
  })

  it("switches between focused settings sections", () => {
    renderSettings()

    fireEvent.click(screen.getByRole("button", { name: /playback/i }))

    expect(screen.getByRole("heading", { name: "Playback" })).toBeInTheDocument()
    expect(screen.getByText("Autoplay new takes")).toBeInTheDocument()
    expect(screen.queryByText("Light gradient")).not.toBeInTheDocument()
  })

  it("makes preference controls visible and reversible", () => {
    renderSettings()

    const expanded = screen.getByRole("button", { name: "Expanded" })
    const compact = screen.getByRole("button", { name: "Compact" })
    expect(expanded).toHaveAttribute("aria-pressed", "true")

    fireEvent.click(compact)
    expect(compact).toHaveAttribute("aria-pressed", "true")

    const reduceMotion = screen.getByRole("button", { name: "Off" })
    fireEvent.click(reduceMotion)
    expect(screen.getByRole("button", { name: "On" })).toHaveAttribute("aria-pressed", "true")
  })

  it("shares creation defaults with the next Create surface", () => {
    function PreferenceProbe() {
      const { preferences } = useMoriApp()
      return <output aria-label="creation defaults">{`${preferences.defaultMode}:${preferences.lyricsMode}:${preferences.durationSeconds}`}</output>
    }

    render(
      <MoriAppProvider>
        <MoriSettingsPage />
        <PreferenceProbe />
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: /creation/i }))
    fireEvent.click(screen.getByRole("button", { name: "Custom" }))
    fireEvent.click(screen.getByRole("button", { name: "Instrumental" }))
    fireEvent.change(screen.getByLabelText("Default duration"), { target: { value: "240" } })

    expect(screen.getByRole("group", { name: "Default creation mode" })).toHaveTextContent("Custom")
    expect(screen.getByLabelText("creation defaults")).toHaveTextContent("custom:instrumental:240")
  })
})
