export type MoriVoiceProfile = {
  ref: string
  name: string
  description: string
}

export type MoriReferenceAudio = {
  ref: string
  name: string
  description: string
  durationSeconds: number
}

export type MoriAudioReferenceSelection = {
  ref: string
  name: string
  detail: string
}

export type MoriInspirationPreset = {
  ref: string
  name: string
  description: string
  style: string
}

export type MoriCreativeSourceKind = "audio" | "voice" | "inspiration"

export type MoriCreativeSourceSelection = {
  kind: MoriCreativeSourceKind
  ref: string
}

export type MoriCreativeLibrarySource = {
  sourceKind: MoriCreativeSourceKind
  ref: string
  name: string
  description: string
}

export const previewReferenceAudios = [
  {
    ref: "asset_preview_city_lights",
    name: "City Lights demo",
    description: "24 sec · soft city pulse",
    durationSeconds: 24,
  },
] satisfies readonly MoriReferenceAudio[]

export const previewVoiceProfiles = [
  {
    ref: "voice_preview_mira",
    name: "Mira",
    description: "Warm alto · intimate phrasing",
  },
  {
    ref: "voice_preview_rowan",
    name: "Rowan",
    description: "Soft tenor · airy upper range",
  },
] satisfies readonly MoriVoiceProfile[]

export const previewInspirationPresets = [
  {
    ref: "style_preview_afterglow",
    name: "Afterglow",
    description: "Soft pulse · intimate glow",
    style: "Dream pop · intimate · organic",
  },
  {
    ref: "style_preview_open_road",
    name: "Open Road",
    description: "Wide acoustic motion · hopeful lift",
    style: "Cinematic folk · open horizon · strings",
  },
  {
    ref: "style_preview_pulse_glass",
    name: "Pulse Glass",
    description: "Nocturnal rhythm · textured synth",
    style: "Future garage · textured drums · nocturnal synth",
  },
] satisfies readonly MoriInspirationPreset[]

export const previewCreativeSources = [
  ...previewReferenceAudios.map((audio) => ({
    sourceKind: "audio" as const,
    ref: audio.ref,
    name: audio.name,
    description: audio.description,
  })),
  ...previewVoiceProfiles.map((voice) => ({
    sourceKind: "voice" as const,
    ref: voice.ref,
    name: voice.name,
    description: voice.description,
  })),
  ...previewInspirationPresets.map((preset) => ({
    sourceKind: "inspiration" as const,
    ref: preset.ref,
    name: preset.name,
    description: preset.description,
  })),
] satisfies readonly MoriCreativeLibrarySource[]

export function resolvePreviewCreativeSource(kind: string | undefined, ref: string | undefined): MoriCreativeSourceSelection | undefined {
  if (ref === undefined) return undefined
  if (kind === "audio" && previewReferenceAudios.some((audio) => audio.ref === ref)) return { kind, ref }
  if (kind === "voice" && previewVoiceProfiles.some((voice) => voice.ref === ref)) return { kind, ref }
  if (kind === "inspiration" && previewInspirationPresets.some((preset) => preset.ref === ref)) return { kind, ref }
  return undefined
}

export function creativeSourceKindLabel(kind: MoriCreativeSourceKind): string {
  switch (kind) {
    case "audio": return "Audio reference"
    case "voice": return "Voice profile"
    case "inspiration": return "Inspiration preset"
  }
}
