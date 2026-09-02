import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MoriAppProvider } from "./components/mori-app-provider"
import { MoriCatalogShell } from "./components/mori-catalog-shell"
import { HomePageContent } from "./home-page"

describe("Mori home page", () => {
  it("uses the global player when a recent direction is played", () => {
    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="home" ariaLabel="Home">
          <HomePageContent />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Play First Light" }))

    expect(screen.getByRole("region", { name: "Global player" })).toHaveTextContent("First Light")
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
  })
})
