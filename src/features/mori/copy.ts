import { createI18n } from "@kokoro/i18n"

type CopyKey =
  | "heroTitle"
  | "heroDescription"
  | "smartLabel"
  | "customLabel"
  | "promptPlaceholder"
  | "generateLabel"
  | "queueTitle"
  | "playerTitle"

const i18n = createI18n<"en", CopyKey>({
  locales: ["en"],
  defaultLocale: "en",
  source: {
    heroTitle: "Make something you can feel.",
    heroDescription: "Start with a thought, a mood, or a scene. Mori shapes it into a song plan you can keep refining.",
    smartLabel: "Smart",
    customLabel: "Custom",
    promptPlaceholder: "A warm, late-night track for the drive home...",
    generateLabel: "Generate",
    queueTitle: "Generation queue",
    playerTitle: "Persistent player",
  },
})

export function t(key: CopyKey): string {
  return i18n.translate("en", key)
}
