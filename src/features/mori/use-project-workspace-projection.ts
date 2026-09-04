"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { MoriApi, MoriProjectWorkspaceProjection } from "@/lib/mori-api"

export type ProjectWorkspaceProjectionStatus = "loading" | "ready" | "unavailable"

export type ProjectWorkspaceProjectionState = {
  projectRef: string
  status: ProjectWorkspaceProjectionStatus
  projection: MoriProjectWorkspaceProjection | null
}

type GetProjectWorkspace = Pick<MoriApi, "getProjectWorkspace">["getProjectWorkspace"]

type ProjectWorkspaceProjectionRequestState = ProjectWorkspaceProjectionState & {
  attempt: number
  source: GetProjectWorkspace | undefined
}

export function useProjectWorkspaceProjection(
  requestedProjectRef: string,
  getProjectWorkspace: GetProjectWorkspace | undefined,
): ProjectWorkspaceProjectionState & { retry: () => void } {
  const projectRef = requestedProjectRef.trim()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<ProjectWorkspaceProjectionRequestState>(() => initialState(projectRef, getProjectWorkspace, attempt))
  const requestEpochRef = useRef(0)
  const canLoad = projectRef !== "" && getProjectWorkspace !== undefined
  const isCurrentRequest = state.projectRef === projectRef && state.attempt === attempt && state.source === getProjectWorkspace

  useEffect(() => {
    const requestEpoch = requestEpochRef.current + 1
    requestEpochRef.current = requestEpoch
    let disposed = false

    if (!canLoad || getProjectWorkspace === undefined) return () => { disposed = true }
    void getProjectWorkspace(projectRef).then((response) => {
      if (disposed || requestEpochRef.current !== requestEpoch) return
      if (response.data.project.project_ref !== projectRef) {
        setState({ projectRef, status: "unavailable", projection: null, attempt, source: getProjectWorkspace })
        return
      }
      setState({ projectRef, status: "ready", projection: response.data, attempt, source: getProjectWorkspace })
    }).catch(() => {
      if (!disposed && requestEpochRef.current === requestEpoch) {
        setState({ projectRef, status: "unavailable", projection: null, attempt, source: getProjectWorkspace })
      }
    })

    return () => {
      disposed = true
    }
  }, [attempt, canLoad, getProjectWorkspace, projectRef])

  const retry = useCallback(() => {
    setAttempt((current) => current + 1)
  }, [])

  if (!canLoad) return { projectRef, status: "unavailable", projection: null, retry }
  if (!isCurrentRequest) return { projectRef, status: "loading", projection: null, retry }
  return { projectRef: state.projectRef, status: state.status, projection: state.projection, retry }
}

function initialState(
  projectRef: string,
  getProjectWorkspace: GetProjectWorkspace | undefined,
  attempt: number,
): ProjectWorkspaceProjectionRequestState {
  return {
    projectRef,
    status: projectRef === "" || getProjectWorkspace === undefined ? "unavailable" : "loading",
    projection: null,
    attempt,
    source: getProjectWorkspace,
  }
}
