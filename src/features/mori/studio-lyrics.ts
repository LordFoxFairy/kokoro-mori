export type StudioLyricsDirection = "rewrite" | "continue" | "rhyme" | "restructure"
export type StudioLyricsScope = "verse" | "chorus" | "whole_lyrics"

export type StudioLyricsPlan = {
  direction: StudioLyricsDirection
  scope: StudioLyricsScope
  instruction: string
  sourceText: string
}

export const defaultStudioLyrics = "We were headlights in the quiet\nfinding a little gold in the blue\nand every road became a reason\nto carry the morning through"

export function buildStudioLyricsPlan(
  direction: StudioLyricsDirection,
  scope: StudioLyricsScope,
  instruction: string,
  lyrics: string,
): StudioLyricsPlan {
  return {
    direction,
    scope,
    instruction: instruction.trim(),
    sourceText: readStudioLyricsScope(lyrics, scope),
  }
}

export function buildStudioLyricsPreview(plan: StudioLyricsPlan): string {
  const source = plan.sourceText.trim()
  switch (plan.direction) {
    case "rewrite":
      if (plan.scope === "verse") return "We wore the city like a signal\nand found a little gold inside the blue"
      if (plan.scope === "chorus") return "Every road becomes a rhythm\npulling open daylight into view"
      return "We wore the city like a signal\nand found a little gold inside the blue\nEvery road becomes a rhythm\npulling open daylight into view"
    case "continue":
      return joinLyrics(source, "The windows wake along the avenue\nand every mile comes carrying us through")
    case "rhyme": {
      const lines = source.split("\n").filter((line) => line.trim() !== "")
      if (lines.length === 0) return "We follow every flicker into view\nand carry all the morning through"
      return `${lines.slice(0, -1).join("\n")}${lines.length > 1 ? "\n" : ""}and carry all the morning through`
    }
    case "restructure": {
      const lines = source.split("\n").filter((line) => line.trim() !== "")
      if (lines.length < 2) return joinLyrics(source, "Let the next image answer this one")
      const midpoint = Math.ceil(lines.length / 2)
      return [...lines.slice(midpoint), ...lines.slice(0, midpoint)].join("\n")
    }
  }
}

export function replaceStudioLyricsScope(lyrics: string, scope: StudioLyricsScope, replacement: string): string {
  const nextText = replacement.trim()
  if (scope === "whole_lyrics") return nextText

  const lines = lyrics.split("\n")
  const splitAt = lyricsSplitIndex(lines)
  if (scope === "verse") return [...nextText.split("\n"), ...lines.slice(splitAt)].join("\n")
  return [...lines.slice(0, splitAt), ...nextText.split("\n")].join("\n")
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

function readStudioLyricsScope(lyrics: string, scope: StudioLyricsScope): string {
  if (scope === "whole_lyrics") return lyrics.trim()
  const lines = lyrics.split("\n")
  const splitAt = lyricsSplitIndex(lines)
  return (scope === "verse" ? lines.slice(0, splitAt) : lines.slice(splitAt)).join("\n").trim()
}

function lyricsSplitIndex(lines: string[]): number {
  return Math.max(1, Math.ceil(lines.length / 2))
}

function joinLyrics(first: string, second: string): string {
  return first === "" ? second : `${first}\n${second}`
}
