import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { MoriApi, MoriLibraryItem } from "@/lib/mori-api"
import { MoriAppProvider } from "./components/mori-app-provider"
import { LibraryPageContent } from "./library-list"

type LibraryPage = Awaited<ReturnType<MoriApi["listLibrary"]>>

function libraryItem(overrides: Partial<MoriLibraryItem> = {}): MoriLibraryItem {
  return {
    library_item_ref: "library_item_first",
    kind: "version",
    project_ref: "project_first_light",
    project_title: "First Light",
    version_ref: "version_first_light",
    title: "First Light · Sunrise",
    duration_seconds: 120,
    audio_asset_ref: "asset_first_light",
    waveform_asset_ref: "waveform_first_light",
    created_at: "2026-09-04T12:00:00.000Z",
    ...overrides,
  }
}

function libraryPage(items: MoriLibraryItem[], nextCursor: string | null): LibraryPage {
  return {
    data: { items, next_cursor: nextCursor },
    meta: { request_id: "request_library_test" },
  }
}

function renderLibrary(listLibrary: MoriApi["listLibrary"]) {
  render(
    <MoriAppProvider>
      <LibraryPageContent api={{ listLibrary }} />
    </MoriAppProvider>,
  )
}

describe("Library version pagination", () => {
  it("keeps the initial request, appends the next page, and removes duplicate refs", async () => {
    const firstItem = libraryItem()
    const secondItem = libraryItem({
      library_item_ref: "library_item_second",
      version_ref: "version_second",
      title: "First Light · Horizon",
    })
    const listLibrary = vi.fn<MoriApi["listLibrary"]>()
      .mockResolvedValueOnce(libraryPage([firstItem], "cursor_1"))
      .mockResolvedValueOnce(libraryPage([
        { ...firstItem, title: "Duplicate library item" },
        { ...firstItem, library_item_ref: "library_item_duplicate", title: "Duplicate version ref" },
        secondItem,
      ], null))

    renderLibrary(listLibrary)

    await waitFor(() => expect(listLibrary).toHaveBeenCalledWith("all"))
    fireEvent.click(screen.getByRole("button", { name: "Versions" }))
    const loadMore = await screen.findByRole("button", { name: "Load more versions" })
    fireEvent.click(loadMore)

    await waitFor(() => expect(screen.getByText("First Light · Horizon")).toBeInTheDocument())
    expect(screen.getAllByRole("article")).toHaveLength(2)
    expect(screen.queryByText("Duplicate library item")).not.toBeInTheDocument()
    expect(screen.queryByText("Duplicate version ref")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Load more versions" })).not.toBeInTheDocument()
    expect(listLibrary).toHaveBeenNthCalledWith(2, { kind: "all", limit: 20, cursor: "cursor_1" })
  })

  it("keeps the active filter and search while loading more versions", async () => {
    const listLibrary = vi.fn<MoriApi["listLibrary"]>()
      .mockResolvedValueOnce(libraryPage([libraryItem()], "cursor_1"))
      .mockResolvedValueOnce(libraryPage([libraryItem({
        library_item_ref: "library_item_later",
        version_ref: "version_later",
        title: "Later direction",
      })], null))

    renderLibrary(listLibrary)

    await waitFor(() => expect(screen.getByText("First Light · Sunrise")).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Versions" }))
    fireEvent.change(screen.getByRole("searchbox", { name: "Search library" }), {
      target: { value: "Later direction" },
    })

    expect(screen.getByRole("button", { name: "Load more versions" })).toBeInTheDocument()
    expect(screen.getByRole("status", { name: "0 results for Later direction" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Load more versions" }))

    await waitFor(() => expect(screen.getByText("Later direction")).toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Versions" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("status")).toHaveTextContent("1 result")
  })

  it("disables while loading and retries the same cursor after a failure", async () => {
    const listLibrary = vi.fn<MoriApi["listLibrary"]>()
      .mockResolvedValueOnce(libraryPage([libraryItem()], "cursor_retry"))
      .mockRejectedValueOnce(new Error("page unavailable"))
      .mockResolvedValueOnce(libraryPage([libraryItem({
        library_item_ref: "library_item_retry_success",
        version_ref: "version_retry_success",
        title: "Recovered direction",
      })], null))

    renderLibrary(listLibrary)

    await waitFor(() => expect(screen.getByText("First Light · Sunrise")).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Versions" }))
    const loadMore = screen.getByRole("button", { name: "Load more versions" })
    fireEvent.click(loadMore)

    await waitFor(() => expect(screen.getByRole("status", { name: "Library versions pagination" })).toHaveTextContent("could not load"))
    expect(screen.getByRole("button", { name: "Load more versions" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
    expect(loadMore).not.toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    await waitFor(() => expect(screen.getByText("Recovered direction")).toBeInTheDocument())
    expect(listLibrary).toHaveBeenNthCalledWith(3, { kind: "all", limit: 20, cursor: "cursor_retry" })
  })

  it("encodes opaque project and version refs in Studio links", async () => {
    const item = libraryItem({
      project_ref: "project library / 01",
      version_ref: "version?take=2#wide",
      title: "Opaque ref direction",
    })
    const listLibrary = vi.fn<MoriApi["listLibrary"]>().mockResolvedValue(libraryPage([item], null))

    renderLibrary(listLibrary)

    await waitFor(() => expect(screen.getByText("Opaque ref direction")).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Versions" }))
    expect(screen.getByRole("link", { name: "Open Opaque ref direction studio" })).toHaveAttribute(
      "href",
      "/projects/project%20library%20%2F%2001/studio/version%3Ftake%3D2%23wide",
    )
  })
})
