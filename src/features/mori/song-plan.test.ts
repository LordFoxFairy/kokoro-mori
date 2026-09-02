import { describe, expect, it } from "vitest"
import { buildSongPlan } from "./song-plan"

describe("Mori song plan", () => {
  it("turns a Smart draft into a concrete, inspectable arrangement", () => {
    const plan = buildSongPlan("project_preview_first_light", {
      prompt: "A quiet piano song for the first train home.",
      lyricsMode: "lyrics",
      style: "Quiet folk · piano · intimate",
      voice: "Natural lead",
      durationSeconds: 180,
    })

    expect(plan).toMatchObject({
      projectRef: "project_preview_first_light",
      prompt: "A quiet piano song for the first train home.",
      mood: "Quiet folk",
      tempoBpm: 82,
      structure: ["Intro", "Verse", "Lift", "Chorus", "Outro"],
      instruments: ["Piano", "Intimate"],
      vocalDirection: "Natural lead with a focused lift in the chorus",
    })
    expect(plan.lyricsIntent).toContain("first train home")
  })

  it("uses an instrumental arc when the draft has no vocal output", () => {
    const plan = buildSongPlan("project_preview_first_light", {
      prompt: "An expansive morning horizon",
      lyricsMode: "instrumental",
      style: "Cinematic · strings",
      voice: "Natural lead",
      durationSeconds: 240,
    })

    expect(plan.structure).toEqual(["Intro", "Theme", "Lift", "Break", "Outro"])
    expect(plan.vocalDirection).toBe("Instrumental arrangement with a clear melodic arc")
    expect(plan.lyricsIntent).toBe("A melodic arc shaped by the prompt")
  })
})
