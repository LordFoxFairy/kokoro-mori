import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MoriAppProvider } from "@/features/mori/components/mori-app-provider"
import CreatePage from "./page"

describe("Mori Create entry", () => {
  it("hydrates a Home idea without treating it as generated work", async () => {
    const page = await CreatePage({
      searchParams: Promise.resolve({ idea: "  A patient piano song for the first train home.  " }),
    })

    render(<MoriAppProvider>{page}</MoriAppProvider>)

    expect(screen.getByRole("textbox", { name: "Song idea" })).toHaveValue("A patient piano song for the first train home.")
    expect(screen.queryByRole("region", { name: "Song plan preview" })).not.toBeInTheDocument()
  })

  it("ignores an oversized idea at the route boundary", async () => {
    const page = await CreatePage({
      searchParams: Promise.resolve({ idea: "x".repeat(1001) }),
    })

    render(<MoriAppProvider>{page}</MoriAppProvider>)

    expect(screen.getByRole("textbox", { name: "Song idea" })).not.toHaveValue("x".repeat(1001))
  })
})
