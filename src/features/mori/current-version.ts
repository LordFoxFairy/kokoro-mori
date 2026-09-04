import type { CurrentVersionInput, MoriCurrentVersionSelection } from "@/lib/mori-api"
import { MoriApiRequestError } from "@/lib/mori-api-client"

export type PendingCurrentVersionCommand = {
  projectRef: string
  input: CurrentVersionInput
  idempotencyKey: string
}

export type CurrentVersionCommitRun = {
  status: "idle" | "saving" | "failed" | "succeeded"
  targetVersionRef: string | null
  message: string | null
  retryable: boolean
}

export const idleCurrentVersionCommitRun: CurrentVersionCommitRun = {
  status: "idle",
  targetVersionRef: null,
  message: null,
  retryable: false,
}

export function currentVersionCommand(
  projectRef: string,
  candidateRef: string,
  versionRef: string,
  expectedCurrentVersionRef: string | null,
  previousCommand: PendingCurrentVersionCommand | null,
): PendingCurrentVersionCommand {
  if (
    previousCommand !== null
    && previousCommand.projectRef === projectRef
    && previousCommand.input.candidate_ref === candidateRef
    && previousCommand.input.version_ref === versionRef
    && previousCommand.input.expected_current_version_ref === expectedCurrentVersionRef
  ) {
    return previousCommand
  }

  return {
    projectRef,
    input: {
      candidate_ref: candidateRef,
      version_ref: versionRef,
      expected_current_version_ref: expectedCurrentVersionRef,
    },
    idempotencyKey: `mori-current-version-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  }
}

export function currentVersionSelectionMatchesCommand(
  selection: MoriCurrentVersionSelection,
  command: PendingCurrentVersionCommand,
): boolean {
  return selection.project_ref === command.projectRef
    && selection.current_version_ref === command.input.version_ref
    && selection.source_candidate_ref === command.input.candidate_ref
    && selection.previous_version_ref === command.input.expected_current_version_ref
}

export function currentVersionCommitFailure(error: unknown, subject: "Take" | "direction"): { message: string; retryable: boolean } {
  if (error instanceof Error && error.message === "current_version_confirmation_mismatch") {
    return {
      message: `The confirmation did not match this ${subject}. Your previous Current is unchanged.`,
      retryable: false,
    }
  }
  if (error instanceof MoriApiRequestError && error.code === "current_version_conflict") {
    return {
      message: `Current Version changed elsewhere. Refresh ${subject === "Take" ? "Studio" : "Create"} before choosing again.`,
      retryable: false,
    }
  }
  if (error instanceof MoriApiRequestError && !error.retryable) {
    return {
      message: `This ${subject} is no longer eligible to become Current. Your previous Current is unchanged.`,
      retryable: false,
    }
  }
  return {
    message: `Mori couldn't make this ${subject} Current. Your previous Current is unchanged.`,
    retryable: true,
  }
}
