import { describe, expect, it } from "vitest"
import { formatMusicTime, formatRecordingTime } from "./format-music-time"

describe("formatMusicTime", () => {
  it("rounds media durations to whole seconds by default", () => {
    expect(formatMusicTime(47.25)).toBe("0:47")
    expect(formatMusicTime(47.75)).toBe("0:48")
    expect(formatMusicTime(125.4)).toBe("2:05")
  })

  it("can floor live transport positions", () => {
    expect(formatMusicTime(47.99, "floor")).toBe("0:47")
  })

  it("normalizes invalid and negative values", () => {
    expect(formatMusicTime(Number.NaN)).toBe("0:00")
    expect(formatMusicTime(Number.POSITIVE_INFINITY)).toBe("0:00")
    expect(formatMusicTime(-1)).toBe("0:00")
  })
})

describe("formatRecordingTime", () => {
  it("uses a two-digit clock display and floors elapsed time", () => {
    expect(formatRecordingTime(5.9)).toBe("00:05")
    expect(formatRecordingTime(65.9)).toBe("01:05")
  })
})
