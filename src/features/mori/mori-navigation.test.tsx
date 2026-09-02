import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MoriCatalogShell } from "./components/mori-catalog-shell"

describe("Mori application navigation", () => {
  it("keeps product-level destinations in one shared shell", () => {
    render(
      <MoriCatalogShell activeKey="home" ariaLabel="Home">
        <div>Home content</div>
      </MoriCatalogShell>,
    )

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/")
    expect(screen.getByRole("link", { name: "Create" })).toHaveAttribute("href", "/create")
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/projects")
    expect(screen.getByRole("link", { name: "Library" })).toHaveAttribute("href", "/library")
  })

  it("keeps playback controls available below catalog content", () => {
    render(
      <MoriCatalogShell activeKey="library" ariaLabel="Library">
        <div>Library content</div>
      </MoriCatalogShell>,
    )

    expect(screen.getByRole("region", { name: "Global player" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Play" }))
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
  })

  it("starts with a compact rail on narrow viewports", async () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 })

    try {
      render(
        <MoriCatalogShell activeKey="library" ariaLabel="Library">
          <div>Library content</div>
        </MoriCatalogShell>,
      )
      await waitFor(() => expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument())
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth })
    }
  })
})
