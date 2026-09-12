import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { MoriCreativeLibrarySource } from "../creative-assets"
import { StudioAssetDock } from "./studio-asset-dock"

const sources: readonly MoriCreativeLibrarySource[] = [
  { sourceKind: "audio", ref: "source_room", assetRef: "asset_room", name: "Room tone", description: "18 sec · brushed pulse", durationSeconds: 18 },
  { sourceKind: "voice", ref: "voice_mira", name: "Mira", description: "Warm alto · intimate phrasing" },
  { sourceKind: "inspiration", ref: "style_afterglow", name: "Afterglow", description: "Soft pulse · intimate glow", style: "Dream pop" },
]

describe("StudioAssetDock", () => {
  it("previews and inserts audio into the selected arrangement context", () => {
    const onPreview = vi.fn()
    const onInsert = vi.fn()
    render(<StudioAssetDock sources={sources} selectedTrackName="Main version" selectedRangeLabel="Chorus" selectedRangeTime="0:42–1:12" onPreview={onPreview} onInsert={onInsert} />)

    const dock = screen.getByRole("region", { name: "Studio asset dock" })
    expect(within(dock).getByText("Main version")).toBeInTheDocument()
    fireEvent.click(within(dock).getByRole("button", { name: "Preview Room tone" }))
    expect(onPreview).toHaveBeenCalledWith(sources[0])
    fireEvent.click(within(dock).getByRole("button", { name: "Insert Room tone" }))
    expect(onInsert).toHaveBeenCalledWith(sources[0])
  })

  it("filters sources and keeps non-audio references visibly non-insertable", () => {
    render(<StudioAssetDock sources={sources} selectedTrackName="Main version" selectedRangeLabel="Chorus" selectedRangeTime="0:42–1:12" onPreview={vi.fn()} onInsert={vi.fn()} />)
    const dock = screen.getByRole("region", { name: "Studio asset dock" })

    fireEvent.click(within(dock).getByRole("button", { name: "Voices" }))
    expect(within(dock).getByText("Mira")).toBeInTheDocument()
    expect(within(dock).getByText("Reference only in Arrangement")).toBeInTheDocument()
    expect(within(dock).queryByRole("button", { name: "Insert" })).not.toBeInTheDocument()

    fireEvent.click(within(dock).getByRole("button", { name: "All" }))
    fireEvent.change(within(dock).getByRole("searchbox", { name: "Search creative sources" }), { target: { value: "afterglow" } })
    expect(within(dock).getByText("Afterglow")).toBeInTheDocument()
    expect(within(dock).queryByText("Room tone")).not.toBeInTheDocument()
  })

  it("explains when a track must be selected before insertion", () => {
    render(<StudioAssetDock sources={sources} selectedRangeLabel="Chorus" selectedRangeTime="0:42–1:12" onPreview={vi.fn()} onInsert={vi.fn()} />)
    expect(screen.getByRole("button", { name: "Select a track to insert Room tone" })).toBeDisabled()
  })
})
