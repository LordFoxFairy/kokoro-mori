import type { LyricsRevisionConstraint, LyricsRevisionDirection, LyricsRevisionStatus, MoriLyricsRevisionDraft } from "@/lib/mori-api"

export type StudioLyricsDirection = LyricsRevisionDirection
export type StudioLyricsScope = "verse" | "chorus" | "whole_lyrics"

type StudioLyricsPlanCommon = {
  direction: StudioLyricsDirection
  instruction: string
  sourceText: string
  lyricsContext: string
  constraints: LyricsRevisionConstraint[]
  outputCount: number
}

export type StudioLyricsPlan = StudioLyricsPlanCommon & (
  | { scope: Exclude<StudioLyricsScope, "whole_lyrics">; startLine: number; endLine: number }
  | { scope: "whole_lyrics"; startLine: null; endLine: null }
)

export const defaultStudioLyrics = "We were headlights in the quiet\nfinding a little gold in the blue\nand every road became a reason\nto carry the morning through"

export function buildStudioLyricsPlan(
  direction: StudioLyricsDirection,
  scope: StudioLyricsScope,
  instruction: string,
  lyrics: string,
): StudioLyricsPlan {
  const common = {
    direction,
    instruction: instruction.trim(),
    lyricsContext: lyrics.trim(),
    constraints: ["meaning", "cadence"] as LyricsRevisionConstraint[],
    outputCount: 2,
  }
  if (scope === "whole_lyrics") {
    return { ...common, scope, startLine: null, endLine: null, sourceText: lyrics.trim() }
  }

  const lines = lyrics.trim().split("\n")
  const splitAt = lyricsSplitIndex(lines)
  const startLine = scope === "verse" ? 0 : splitAt
  const endLine = scope === "verse" ? splitAt : lines.length
  return {
    ...common,
    scope,
    startLine,
    endLine,
    sourceText: lines.slice(startLine, endLine).join("\n").trim(),
  }
}

export function createStudioLyricsRevisionDraft(plan: StudioLyricsPlan): MoriLyricsRevisionDraft {
  const common = {
    direction: plan.direction,
    instruction: plan.instruction,
    lyricsContext: plan.lyricsContext,
    constraints: [...plan.constraints],
    outputCount: plan.outputCount,
  }
  if (plan.scope === "whole_lyrics") {
    return { ...common, scope: { type: "whole_lyrics", sourceText: plan.sourceText } }
  }
  return {
    ...common,
    scope: {
      type: "section",
      sectionLabel: studioLyricsScopeLabel(plan.scope),
      startLine: plan.startLine,
      endLine: plan.endLine,
      sourceText: plan.sourceText,
    },
  }
}

export function replaceStudioLyricsScope(lyrics: string, plan: StudioLyricsPlan, replacement: string): string {
  const nextText = replacement.trim()
  if (plan.scope === "whole_lyrics") return nextText

  const lines = lyrics.trim().split("\n")
  return [
    ...lines.slice(0, plan.startLine),
    ...nextText.split("\n"),
    ...lines.slice(plan.endLine),
  ].join("\n")
}

export function isActiveLyricsRevisionStatus(status: "idle" | "preparing" | LyricsRevisionStatus): boolean {
  return status === "preparing" || status === "queued" || status === "generating"
}

export function studioLyricsScopeLabel(scope: StudioLyricsScope): string {
  switch (scope) {
    case "verse": return "Verse"
    case "chorus": return "Chorus"
    case "whole_lyrics": return "Whole lyrics"
  }
}

export function studioLyricsDirectionLabel(direction: StudioLyricsDirection): string {
  switch (direction) {
    case "rewrite": return "Rewrite"
    case "continue": return "Continue"
    case "rhyme": return "Find rhyme"
    case "restructure": return "Restructure"
  }
}

function lyricsSplitIndex(lines: string[]): number {
  return Math.max(1, Math.ceil(lines.length / 2))
}
