import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { previewCandidates } from "./preview-data"
import { MoriAppProvider } from "./components/mori-app-provider"
import { MoriStudioShell } from "./components/mori-studio-shell"

describe("Mori studio shell", () => {
  it("keeps Studio inside the global navigation and player shell", () => {
    render(
      <MoriAppProvider>
        <MoriStudioShell candidate={previewCandidates[0]}>
          <div>Studio canvas</div>
        </MoriStudioShell>
      </MoriAppProvider>,
    )

    expect(screen.getByRole("navigation", { name: "Mori" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Studio" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Global player" })).toBeInTheDocument()
    expect(screen.getByText("Studio canvas")).toBeInTheDocument()
  })
})
