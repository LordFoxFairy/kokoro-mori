export type MoriVoiceProfile = {
  ref: string
  name: string
  description: string
}

export type MoriInspirationPreset = {
  ref: string
  name: string
  description: string
  style: string
}

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
