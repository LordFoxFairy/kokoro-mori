export type CompositionSaveState = "saved" | "unsaved" | "saving" | "conflict" | "failed"

export function nextCompositionSaveState(input: { dirty: boolean; saving: boolean; conflict?: boolean; failed?: boolean }): CompositionSaveState {
  if (input.conflict) return "conflict"
  if (input.failed) return "failed"
  if (input.saving) return "saving"
  return input.dirty ? "unsaved" : "saved"
}

export function compositionSaveLabel(state: CompositionSaveState): string {
  return ({ saved: "Saved", unsaved: "Unsaved changes", saving: "Saving…", conflict: "Refresh required", failed: "Save failed" })[state]
}
