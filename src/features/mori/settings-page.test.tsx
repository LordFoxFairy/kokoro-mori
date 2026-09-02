import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
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
    expect(screen.getByRole("link", { name: "Back to studio" })).toHaveAttribute("href", "/")
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Appearance" })).toBeInTheDocument()
    expect(screen.getByText("Light gradient")).toBeInTheDocument()
    expect(screen.queryByText("My computer")).not.toBeInTheDocument()
    expect(screen.queryByText("Integrations")).not.toBeInTheDocument()
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
