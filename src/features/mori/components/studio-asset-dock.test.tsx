import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { MoriCreativeLibrarySource } from "../creative-assets"
import type { AudioRecording } from "../use-audio-recorder"
import { compositionSourceDragMimeType } from "./composition-lane"
import { StudioAssetDock } from "./studio-asset-dock"

const sources: readonly MoriCreativeLibrarySource[] = [
  { sourceKind: "audio", ref: "source_room", assetRef: "asset_room", name: "Room tone", description: "18 sec · brushed pulse", durationSeconds: 18 },
  { sourceKind: "voice", ref: "voice_mira", name: "Mira", description: "Warm alto · intimate phrasing" },
  { sourceKind: "inspiration", ref: "style_afterglow", name: "Afterglow", description: "Soft pulse · intimate glow", style: "Dream pop" },
]

class FakeMediaRecorder {
  static isTypeSupported = vi.fn(() => true)
  static nextBlob = new Blob(["recorded audio"], { type: "audio/webm" })
  state: RecordingState = "inactive"
  mimeType = "audio/webm;codecs=opus"
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onerror: (() => void) | null = null
  onstop: (() => void) | null = null

  constructor(stream: MediaStream, options?: { mimeType?: string }) {
    void stream
    void options
  }

  start() {
    this.state = "recording"
    this.ondataavailable?.({ data: FakeMediaRecorder.nextBlob })
  }

  stop() {
    this.state = "inactive"
    this.onstop?.()
  }
}

function stubMicrophone(getUserMedia: () => Promise<MediaStream>) {
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } })
}

function renderDock(overrides: Partial<React.ComponentProps<typeof StudioAssetDock>> = {}) {
  return render(
    <StudioAssetDock
      sources={sources}
      selectedTrackName="Main version"
      selectedRangeLabel="Chorus"
      selectedRangeTime="0:42–1:12"
      onPreview={vi.fn()}
      onInsert={vi.fn()}
      {...overrides}
    />,
  )
}

beforeEach(() => {
  FakeMediaRecorder.nextBlob = new Blob(["recorded audio"], { type: "audio/webm" })
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder)
  stubMicrophone(async () => ({ getTracks: () => [{ stop: vi.fn() }] }) as unknown as MediaStream)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

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
    render(<StudioAssetDock sources={sources} selectedRangeLabel="Chorus" selectedRangeTime="0:42–1:12" onPreview={vi.fn()} onInsert={vi.fn()} />)
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

  it("offers audio as a copy drag source while keeping other sources reference-only", () => {
    const dataTransfer = {
      effectAllowed: "",
      setData: vi.fn(),
    }
    render(<StudioAssetDock sources={sources} selectedTrackName="Main version" selectedRangeLabel="Chorus" selectedRangeTime="0:42–1:12" onPreview={vi.fn()} onInsert={vi.fn()} />)
    const dock = screen.getByRole("region", { name: "Studio asset dock" })
    fireEvent.click(within(dock).getByRole("button", { name: "Voices" }))
    const voiceCard = within(dock).getByText("Mira").closest("article")
    fireEvent.click(within(dock).getByRole("button", { name: "Audio" }))
    const audioCard = within(dock).getByText("Room tone").closest("article")

    expect(audioCard).toHaveAttribute("draggable", "true")
    expect(voiceCard).toHaveAttribute("draggable", "false")
    if (!(audioCard instanceof HTMLElement)) throw new Error("Expected an audio source card")
    fireEvent.dragStart(audioCard, { dataTransfer })
    expect(dataTransfer.effectAllowed).toBe("copy")
    expect(dataTransfer.setData).toHaveBeenCalledWith(compositionSourceDragMimeType, JSON.stringify({ sourceRef: "source_room" }))
  })

  it("records a reference and sends the completed recording to the parent without inserting it", async () => {
    const onRecordingComplete = vi.fn<(recording: AudioRecording) => void>()
    const onInsert = vi.fn()
    renderDock({ onRecordingComplete, onInsert })

    const dock = screen.getByRole("region", { name: "Studio asset dock" })
    fireEvent.click(within(dock).getByRole("button", { name: "Record reference" }))
    await waitFor(() => expect(within(dock).getByRole("button", { name: "Stop recording" })).toBeInTheDocument())
    expect(within(dock).getByText(/00:00/u)).toBeInTheDocument()

    fireEvent.click(within(dock).getByRole("button", { name: "Stop recording" }))
    await waitFor(() => expect(onRecordingComplete).toHaveBeenCalledOnce())
    expect(onRecordingComplete.mock.calls[0]?.[0]).toMatchObject({
      contentType: expect.stringMatching(/^audio\/(webm|mp4)/u),
      fileName: expect.stringMatching(/^mori-recording-.*\.(webm|m4a)$/u),
      byteSize: expect.any(Number),
    })
    expect(onInsert).not.toHaveBeenCalled()
    expect(within(dock).getByRole("button", { name: "Record reference" })).toBeInTheDocument()
  })

  it("shows a microphone permission error inside the dock", async () => {
    stubMicrophone(async () => { throw new DOMException("blocked", "NotAllowedError") })
    renderDock()

    const dock = screen.getByRole("region", { name: "Studio asset dock" })
    fireEvent.click(within(dock).getByRole("button", { name: "Record reference" }))

    await waitFor(() => expect(within(dock).getByRole("alert")).toHaveTextContent("Microphone access is needed to record a reference."))
    expect(within(dock).queryByRole("button", { name: "Stop recording" })).not.toBeInTheDocument()
  })

  it("shows an empty recording error and does not call the completion callback", async () => {
    FakeMediaRecorder.nextBlob = new Blob([], { type: "audio/webm" })
    const onRecordingComplete = vi.fn<(recording: AudioRecording) => void>()
    renderDock({ onRecordingComplete })

    const dock = screen.getByRole("region", { name: "Studio asset dock" })
    fireEvent.click(within(dock).getByRole("button", { name: "Record reference" }))
    await waitFor(() => expect(within(dock).getByRole("button", { name: "Stop recording" })).toBeInTheDocument())
    fireEvent.click(within(dock).getByRole("button", { name: "Stop recording" }))

    await waitFor(() => expect(within(dock).getByRole("alert")).toHaveTextContent("The microphone recording was empty. Try again."))
    expect(onRecordingComplete).not.toHaveBeenCalled()
  })

  it("does not expose preview sources when a live source projection is unavailable", () => {
    const onRetrySources = vi.fn()
    renderDock({ sources: [], sourceStatus: "unavailable", onRetrySources })

    const dock = screen.getByRole("region", { name: "Studio asset dock" })
    expect(within(dock).getByText("Sources are unavailable")).toBeInTheDocument()
    expect(within(dock).queryByText("City Lights demo")).not.toBeInTheDocument()
    fireEvent.click(within(dock).getByRole("button", { name: "Try again" }))
    expect(onRetrySources).toHaveBeenCalledOnce()
  })

  it("loads another source page without leaving the arrangement context", async () => {
    const onLoadMoreSources = vi.fn(async () => undefined)
    renderDock({ sourceStatus: "ready", hasMoreSources: true, onLoadMoreSources })

    const dock = screen.getByRole("region", { name: "Studio asset dock" })
    fireEvent.click(within(dock).getByRole("button", { name: "Load more sources" }))

    await waitFor(() => expect(onLoadMoreSources).toHaveBeenCalledOnce())
    expect(within(dock).getByText("Load more sources")).toBeInTheDocument()
  })

  it("disables preview, insert, and drag actions while recording", async () => {
    const onPreview = vi.fn()
    const onInsert = vi.fn()
    renderDock({ onPreview, onInsert })

    const dock = screen.getByRole("region", { name: "Studio asset dock" })
    fireEvent.click(within(dock).getByRole("button", { name: "Record reference" }))
    await waitFor(() => expect(within(dock).getByRole("button", { name: "Stop recording" })).toBeInTheDocument())

    expect(within(dock).getByRole("button", { name: "Preview Room tone" })).toBeDisabled()
    expect(within(dock).getByRole("button", { name: "Insert Room tone" })).toBeDisabled()
    expect(within(dock).getByText("Room tone").closest("article")).toHaveAttribute("draggable", "false")
    expect(within(dock).getByRole("button", { name: "Stop recording" })).toBeEnabled()
  })
})
