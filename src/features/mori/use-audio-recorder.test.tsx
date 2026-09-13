import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useAudioRecorder, type AudioRecording } from "./use-audio-recorder"

class FakeMediaRecorder {
  static isTypeSupported = vi.fn(() => true)
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
    this.ondataavailable?.({ data: new Blob(["recorded audio"], { type: "audio/webm" }) })
  }

  stop() {
    this.state = "inactive"
    this.onstop?.()
  }
}

function RecorderHarness({ onComplete, onError }: { onComplete: (recording: AudioRecording) => void; onError: (message: string) => void }) {
  const recorder = useAudioRecorder({ onComplete, onError })
  return <>
    <button type="button" onClick={() => { void recorder.start() }}>Start</button>
    <button type="button" onClick={recorder.stop}>Stop</button>
    <output aria-label="recording state">{recorder.status}</output>
    <output aria-label="recording time">{recorder.elapsedSeconds}</output>
  </>
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("useAudioRecorder", () => {
  it("captures a microphone recording and returns an uploadable blob", async () => {
    const onComplete = vi.fn<(recording: AudioRecording) => void>()
    const onError = vi.fn<(message: string) => void>()
    const stopTrack = vi.fn()
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder)
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] })) } })

    render(<RecorderHarness onComplete={onComplete} onError={onError} />)
    fireEvent.click(screen.getByRole("button", { name: "Start" }))
    await waitFor(() => expect(screen.getByRole("status", { name: "recording state" })).toHaveTextContent("recording"))
    fireEvent.click(screen.getByRole("button", { name: "Stop" }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce())
    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({ contentType: expect.stringMatching(/^audio\/(webm|mp4)/u), fileName: expect.stringMatching(/^mori-recording-.*\.(webm|m4a)$/u), byteSize: expect.any(Number), durationSeconds: expect.any(Number) })
    expect(screen.getByRole("status", { name: "recording state" })).toHaveTextContent("idle")
    expect(stopTrack).toHaveBeenCalledOnce()
    expect(onError).not.toHaveBeenCalled()
  })

  it("reports microphone permission failures without leaving recording active", async () => {
    const onComplete = vi.fn<(recording: AudioRecording) => void>()
    const onError = vi.fn<(message: string) => void>()
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder)
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(async () => { throw new DOMException("blocked", "NotAllowedError") }) } })

    render(<RecorderHarness onComplete={onComplete} onError={onError} />)
    fireEvent.click(screen.getByRole("button", { name: "Start" }))

    await waitFor(() => expect(onError).toHaveBeenCalledWith("Microphone access is needed to record a reference."))
    expect(screen.getByRole("status", { name: "recording state" })).toHaveTextContent("idle")
    expect(onComplete).not.toHaveBeenCalled()
  })
})
