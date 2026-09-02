import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { LibraryPageContent } from "./library-list"
import { ProjectsPageContent } from "./project-list"

describe("Mori catalog surfaces", () => {
  it("makes project continuation information findable", () => {
    render(<ProjectsPageContent />)
    expect(screen.getByText("Continue creating")).toBeInTheDocument()
    expect(screen.getByText("Current version")).toBeInTheDocument()
    expect(screen.getByText("Active project")).toBeInTheDocument()
  })

  it("keeps library filters local and provider-neutral", () => {
    render(<LibraryPageContent />)
    for (const label of ["All", "Projects", "Versions", "Lyrics", "Exports"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
    }
    expect(screen.queryByText(/suno|tad/i)).not.toBeInTheDocument()
  })
})
