import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MoriAppProvider } from "./components/mori-app-provider"
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

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Appearance" })).toBeInTheDocument()
    expect(screen.getByText("Light gradient")).toBeInTheDocument()
    expect(screen.queryByText("My computer")).not.toBeInTheDocument()
    expect(screen.queryByText("Integrations")).not.toBeInTheDocument()
  })

  it("switches between focused settings sections", () => {
    renderSettings()

    fireEvent.click(screen.getByRole("button", { name: /playback/i }))

    expect(screen.getByRole("heading", { name: "Playback" })).toBeInTheDocument()
    expect(screen.getByText("Remember last track")).toBeInTheDocument()
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
})
