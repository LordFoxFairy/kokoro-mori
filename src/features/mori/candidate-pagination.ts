import type { MoriApi, MoriCandidate } from "@/lib/mori-api"

const maxCandidatePages = 50

type CandidateListApi = Pick<MoriApi, "listCandidates">

/**
 * Reads every candidate page while keeping the opaque cursor entirely at the
 * transport boundary. The UI needs a complete set before it can build Take
 * Lanes, and duplicate refs must not produce duplicate cards after a retry.
 */
export async function listAllMoriCandidates(api: CandidateListApi, projectRef: string, generationRef?: string): Promise<MoriCandidate[]> {
  const candidates = new Map<string, MoriCandidate>()
  const seenCursors = new Set<string>()
  let cursor: string | null = null

  for (let page = 0; page < maxCandidatePages; page += 1) {
    let response: Awaited<ReturnType<CandidateListApi["listCandidates"]>>
    if (cursor === null) {
      response = generationRef === undefined
        ? await api.listCandidates(projectRef)
        : await api.listCandidates(projectRef, { generation_ref: generationRef })
    } else {
      response = await api.listCandidates(projectRef, {
        cursor,
        ...(generationRef === undefined ? {} : { generation_ref: generationRef }),
      })
    }

    response.data.candidates.forEach((candidate) => candidates.set(candidate.candidate_ref, candidate))
    const nextCursor = response.data.next_cursor
    if (nextCursor === null) return [...candidates.values()]
    if (nextCursor.trim() === "" || seenCursors.has(nextCursor)) throw new Error("candidate_cursor_invalid")
    seenCursors.add(nextCursor)
    cursor = nextCursor
  }

  throw new Error("candidate_pagination_limit_exceeded")
}
