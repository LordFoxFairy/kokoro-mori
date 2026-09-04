import { useRef, useState, type RefObject } from "react"
import type { MoriApi } from "@/lib/mori-api"
import type { Candidate } from "./domain"
import {
  currentVersionCommand,
  currentVersionCommitFailure,
  currentVersionSelectionMatchesCommand,
  idleCurrentVersionCommitRun,
  type CurrentVersionCommitRun,
  type PendingCurrentVersionCommand,
} from "./current-version"

type ProjectCurrentVersionCommitOptions = {
  projectRef: string
  currentVersionRef: string | null
  candidates: Candidate[]
  putCurrentVersion: MoriApi["putCurrentVersion"] | undefined
  onConfirmed: (candidate: Candidate) => void
}

type ProjectCurrentVersionCommit = {
  currentVersionCommitRun: CurrentVersionCommitRun
  currentVersionConfirmationEpochsRef: RefObject<ReadonlyMap<string, number>>
  commitCurrentVersion: (candidate: Candidate) => void
  retryCurrentVersionCommit: () => void
  dismissCurrentVersionCommit: () => void
}

export function useProjectCurrentVersionCommit({
  projectRef,
  currentVersionRef,
  candidates,
  putCurrentVersion,
  onConfirmed,
}: ProjectCurrentVersionCommitOptions): ProjectCurrentVersionCommit {
  const [state, setState] = useState(() => ({
    projectRef,
    run: idleCurrentVersionCommitRun,
  }))
  const pendingCommandRef = useRef<PendingCurrentVersionCommand | null>(null)
  const savingRef = useRef(false)
  // A projection read that started before this command must not erase its owner confirmation.
  const currentVersionConfirmationEpochsRef = useRef(new Map<string, number>())
  const currentVersionCommitRun = state.projectRef === projectRef ? state.run : idleCurrentVersionCommitRun

  const setCurrentVersionCommitRun = (targetProjectRef: string, run: CurrentVersionCommitRun) => {
    setState({ projectRef: targetProjectRef, run })
  }

  const commit = async (candidate: Candidate, retryCommand?: PendingCurrentVersionCommand) => {
    if (savingRef.current || currentVersionCommitRun.status === "saving" || candidate.versionRef === currentVersionRef) return
    if (putCurrentVersion === undefined) {
      setCurrentVersionCommitRun(projectRef, {
        status: "failed",
        targetVersionRef: candidate.versionRef,
        message: "Current Version saving is not connected. Your previous Current is unchanged.",
        retryable: false,
      })
      return
    }

    const expectedCurrentVersionRef = currentVersionRef?.trim() || null
    const command = retryCommand
      ?? currentVersionCommand(
        projectRef,
        candidate.candidateRef,
        candidate.versionRef,
        expectedCurrentVersionRef,
        pendingCommandRef.current,
      )
    savingRef.current = true
    pendingCommandRef.current = command
    setCurrentVersionCommitRun(command.projectRef, {
      status: "saving",
      targetVersionRef: candidate.versionRef,
      message: null,
      retryable: false,
    })

    try {
      const response = await putCurrentVersion(command.projectRef, command.input, command.idempotencyKey)
      if (!currentVersionSelectionMatchesCommand(response.data, command)) {
        throw new Error("current_version_confirmation_mismatch")
      }
      const confirmationEpoch = currentVersionConfirmationEpochsRef.current.get(command.projectRef) ?? 0
      currentVersionConfirmationEpochsRef.current.set(command.projectRef, confirmationEpoch + 1)
      onConfirmed(candidate)
      pendingCommandRef.current = null
      setCurrentVersionCommitRun(command.projectRef, {
        status: "succeeded",
        targetVersionRef: candidate.versionRef,
        message: `${candidate.title} is now the Current Version.`,
        retryable: false,
      })
    } catch (error) {
      const failure = currentVersionCommitFailure(error, "Project direction")
      if (!failure.retryable) pendingCommandRef.current = null
      setCurrentVersionCommitRun(command.projectRef, {
        status: "failed",
        targetVersionRef: candidate.versionRef,
        message: failure.message,
        retryable: failure.retryable,
      })
    } finally {
      savingRef.current = false
    }
  }

  const retryCurrentVersionCommit = () => {
    const command = pendingCommandRef.current
    if (command === null || !currentVersionCommitRun.retryable || command.projectRef !== projectRef) return
    const candidate = candidates.find((item) => (
      item.candidateRef === command.input.candidate_ref
      && item.versionRef === command.input.version_ref
    ))
    if (candidate !== undefined) void commit(candidate, command)
  }

  const dismissCurrentVersionCommit = () => {
    pendingCommandRef.current = null
    setCurrentVersionCommitRun(projectRef, idleCurrentVersionCommitRun)
  }

  return {
    currentVersionCommitRun,
    currentVersionConfirmationEpochsRef,
    commitCurrentVersion: (candidate) => { void commit(candidate) },
    retryCurrentVersionCommit,
    dismissCurrentVersionCommit,
  }
}
