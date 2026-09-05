import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { CompositionSaveIndicator } from "./composition-save-indicator"

describe("CompositionSaveIndicator", () => {
  it("announces the current save state", () => {
    render(<CompositionSaveIndicator state="conflict" />)
    expect(screen.getByRole("status")).toHaveTextContent("Refresh required")
  })
})
