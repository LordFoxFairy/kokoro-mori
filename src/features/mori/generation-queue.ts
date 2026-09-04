/**
 * Browser-owned summary of generations.
 *
 * Mori deliberately stores references and display metadata only. Lyrics,
 * complete prompts, provider payloads, and media bytes belong outside this
 * queue and must never cross the persistence boundary below.
 */

export const GENERATION_QUEUE_STORAGE_VERSION = 1 as const

export type GenerationQueueKind = "create" | "studio_change"

export type GenerationQueueServerStatus =
  | "queued"
  | "preparing"
  | "generating"
  | "post_processing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "expired"

/**
 * Client lifecycle is intentionally separate from the provider/server
 * status. Some phases, such as reconnecting and cancelling, describe work
 * the browser is doing around a server status rather than replacing it.
 */
export type GenerationQueueClientPhase =
  | "idle"
  | "submitting"
  | "queued"
  | "streaming"
  | "reconnecting"
  | "cancelling"
  | "completed"
  | "failed"

export type GenerationQueueItem = {
  readonly generation_ref: string
  readonly project_ref: string
  readonly source_version_ref: string | null
  readonly kind: GenerationQueueKind
  readonly label: string
  readonly created_at: string
  readonly status: GenerationQueueServerStatus
  readonly progress: number
  readonly candidate_refs: readonly string[]
  readonly last_event_id: string | null
}

export type GenerationQueueState = {
  readonly version: typeof GENERATION_QUEUE_STORAGE_VERSION
  readonly items: readonly GenerationQueueItem[]
  readonly active_generation_ref: string | null
}

export type GenerationQueueStateInput = {
  readonly items?: readonly GenerationQueueItem[]
  readonly active_generation_ref?: string | null
}

export type GenerationQueueItemPatch = Partial<Omit<GenerationQueueItem, "generation_ref">>

export type GenerationQueueContext = {
  readonly project_ref: string
  /** Omit this field to match every source version in the project. */
  readonly source_version_ref?: string | null
}

const SERVER_STATUSES: readonly GenerationQueueServerStatus[] = [
  "queued",
  "preparing",
  "generating",
  "post_processing",
  "succeeded",
  "failed",
  "cancelled",
  "expired",
]

const QUEUE_KINDS: readonly GenerationQueueKind[] = ["create", "studio_change"]

export function isGenerationQueueServerStatus(value: unknown): value is GenerationQueueServerStatus {
  return typeof value === "string" && SERVER_STATUSES.some((status) => status === value)
}

export function isGenerationQueueKind(value: unknown): value is GenerationQueueKind {
  return typeof value === "string" && QUEUE_KINDS.some((kind) => kind === value)
}

export function generationQueueClientPhaseForStatus(status: GenerationQueueServerStatus): GenerationQueueClientPhase {
  switch (status) {
    case "queued":
    case "preparing":
      return "queued"
    case "generating":
    case "post_processing":
      return "streaming"
    case "succeeded":
    case "cancelled":
      return "completed"
    case "failed":
    case "expired":
      return "failed"
  }
}

export function createGenerationQueueState(input: GenerationQueueStateInput = {}): GenerationQueueState {
  let state = emptyGenerationQueueState()
  for (const item of input.items ?? []) {
    state = upsertGenerationQueueItem(state, item)
  }

  const activeGenerationRef = input.active_generation_ref ?? null
  if (activeGenerationRef !== null && !state.items.some((item) => item.generation_ref === activeGenerationRef)) {
    throw new RangeError("active_generation_ref must identify an item in the queue")
  }
  return { ...state, active_generation_ref: activeGenerationRef }
}

export function emptyGenerationQueueState(): GenerationQueueState {
  return {
    version: GENERATION_QUEUE_STORAGE_VERSION,
    items: [],
    active_generation_ref: null,
  }
}

/** Merge two records for the same generation, preserving every candidate ref. */
export function mergeGenerationQueueItems(
  current: GenerationQueueItem,
  incoming: GenerationQueueItem,
): GenerationQueueItem {
  assertGenerationQueueItem(current)
  assertGenerationQueueItem(incoming)
  if (current.generation_ref !== incoming.generation_ref) {
    throw new RangeError("generation_ref is immutable during queue merge")
  }

  const lifecycle = mergeGenerationLifecycle(current, incoming)
  return normalizeGenerationQueueItem({
    ...current,
    ...incoming,
    project_ref: current.project_ref,
    source_version_ref: current.source_version_ref,
    kind: current.kind,
    created_at: current.created_at,
    status: lifecycle.status,
    progress: lifecycle.progress,
    candidate_refs: uniqueStrings([...current.candidate_refs, ...incoming.candidate_refs]),
    last_event_id: mergeEventCursor(current.last_event_id, incoming.last_event_id),
  })
}

function mergeGenerationLifecycle(
  current: GenerationQueueItem,
  incoming: GenerationQueueItem,
): Pick<GenerationQueueItem, "status" | "progress"> {
  const currentTerminal = isTerminalGenerationQueueStatus(current.status)
  const incomingTerminal = isTerminalGenerationQueueStatus(incoming.status)
  const progress = Math.max(current.progress, incoming.progress)
  if (currentTerminal && !incomingTerminal) return { status: current.status, progress }
  if (!currentTerminal && incomingTerminal) return { status: incoming.status, progress }
  if (currentTerminal && incomingTerminal) {
    return {
      status: terminalStatusRank(incoming.status) > terminalStatusRank(current.status) ? incoming.status : current.status,
      progress,
    }
  }

  const currentRank = activeStatusRank(current.status)
  const incomingRank = activeStatusRank(incoming.status)
  return {
    status: incomingRank >= currentRank ? incoming.status : current.status,
    progress,
  }
}

function isTerminalGenerationQueueStatus(status: GenerationQueueServerStatus): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled" || status === "expired"
}

function activeStatusRank(status: GenerationQueueServerStatus): number {
  switch (status) {
    case "queued": return 0
    case "preparing": return 1
    case "generating": return 2
    case "post_processing": return 3
    case "succeeded":
    case "failed":
    case "cancelled":
    case "expired": return 4
  }
}

function terminalStatusRank(status: GenerationQueueServerStatus): number {
  switch (status) {
    case "expired": return 0
    case "failed": return 1
    case "cancelled": return 2
    case "succeeded": return 3
    case "queued":
    case "preparing":
    case "generating":
    case "post_processing": return -1
  }
}

function mergeEventCursor(current: string | null, incoming: string | null): string | null {
  if (current === incoming) return current
  if (current === null) return incoming
  if (incoming === null) return current
  return null
}

/** Upsert by generation_ref; duplicate items are merged instead of appended. */
export function upsertGenerationQueueItem(
  state: GenerationQueueState,
  incoming: GenerationQueueItem,
): GenerationQueueState {
  assertGenerationQueueState(state)
  const normalizedIncoming = normalizeGenerationQueueItem(incoming)
  const existing = state.items.find((item) => item.generation_ref === normalizedIncoming.generation_ref)
  const item = existing === undefined
    ? normalizedIncoming
    : mergeGenerationQueueItems(existing, normalizedIncoming)
  const items = existing === undefined
    ? [...state.items, item]
    : state.items.map((candidate) => candidate.generation_ref === item.generation_ref ? item : candidate)

  return {
    ...state,
    items: sortQueueItems(items),
  }
}

/**
 * Reconcile a validated owner snapshot. Matching browser context keeps the
 * monotonic lifecycle merge; conflicting local context is replaced because
 * project, source Version, and kind are owner facts rather than preferences.
 */
export function reconcileGenerationQueueItemFromSnapshot(
  state: GenerationQueueState,
  incoming: GenerationQueueItem,
): GenerationQueueState {
  assertGenerationQueueState(state)
  const normalizedIncoming = normalizeGenerationQueueItem(incoming)
  const existing = state.items.find((item) => item.generation_ref === normalizedIncoming.generation_ref)
  const contextMatches = existing !== undefined
    && existing.project_ref === normalizedIncoming.project_ref
    && existing.source_version_ref === normalizedIncoming.source_version_ref
    && existing.kind === normalizedIncoming.kind
  const item = contextMatches
    ? mergeGenerationQueueItems(existing, normalizedIncoming)
    : normalizedIncoming
  const items = existing === undefined
    ? [...state.items, item]
    : state.items.map((candidate) => candidate.generation_ref === item.generation_ref ? item : candidate)

  return { ...state, items: sortQueueItems(items) }
}

/** Update one item without allowing its generation_ref identity to change. */
export function updateGenerationQueueItem(
  state: GenerationQueueState,
  generationRef: string,
  patch: GenerationQueueItemPatch,
): GenerationQueueState {
  assertGenerationQueueState(state)
  assertNonEmptyString(generationRef, "generation_ref")
  const existing = state.items.find((item) => item.generation_ref === generationRef)
  if (existing === undefined) return state

  const incoming: GenerationQueueItem = {
    ...existing,
    ...patch,
    generation_ref: existing.generation_ref,
    candidate_refs: patch.candidate_refs === undefined ? existing.candidate_refs : patch.candidate_refs,
  }
  const normalizedIncoming = normalizeGenerationQueueItem(incoming)
  const merged = mergeGenerationQueueItems(existing, normalizedIncoming)
  const updated = patch.last_event_id === undefined
    ? merged
    : normalizeGenerationQueueItem({
        ...merged,
        last_event_id: incomingLifecycleAccepted(existing, normalizedIncoming, merged)
          ? patch.last_event_id
          : merged.last_event_id,
      })
  const items = state.items.map((item) => item.generation_ref === generationRef ? updated : item)
  return { ...state, items: sortQueueItems(items) }
}

function incomingLifecycleAccepted(
  current: GenerationQueueItem,
  incoming: GenerationQueueItem,
  merged: GenerationQueueItem,
): boolean {
  if (merged.status !== incoming.status) return false
  if (isTerminalGenerationQueueStatus(incoming.status)) return true
  return !isTerminalGenerationQueueStatus(current.status)
    && activeStatusRank(incoming.status) >= activeStatusRank(current.status)
}

export function removeGenerationQueueItem(state: GenerationQueueState, generationRef: string): GenerationQueueState {
  assertGenerationQueueState(state)
  assertNonEmptyString(generationRef, "generation_ref")
  const items = state.items.filter((item) => item.generation_ref !== generationRef)
  return {
    ...state,
    items,
    active_generation_ref: state.active_generation_ref === generationRef ? null : state.active_generation_ref,
  }
}

export function mergeGenerationQueueStates(
  current: GenerationQueueState,
  incoming: GenerationQueueState,
): GenerationQueueState {
  assertGenerationQueueState(current)
  assertGenerationQueueState(incoming)
  let merged = current
  for (const item of incoming.items) {
    merged = upsertGenerationQueueItem(merged, item)
  }

  const activeGenerationRef = incoming.active_generation_ref
  return {
    ...merged,
    active_generation_ref: activeGenerationRef !== null && merged.items.some((item) => item.generation_ref === activeGenerationRef)
      ? activeGenerationRef
      : null,
  }
}

/** Match a project and, when supplied, one exact source version. */
export function filterGenerationQueueByContext(
  state: GenerationQueueState,
  context: GenerationQueueContext,
): GenerationQueueState {
  assertGenerationQueueState(state)
  assertNonEmptyString(context.project_ref, "project_ref")
  if (context.source_version_ref !== undefined && context.source_version_ref !== null) {
    assertNonEmptyString(context.source_version_ref, "source_version_ref")
  }

  const items = state.items.filter((item) => (
    item.project_ref === context.project_ref
    && (context.source_version_ref === undefined || item.source_version_ref === context.source_version_ref)
  ))
  const activeGenerationRef = items.some((item) => item.generation_ref === state.active_generation_ref)
    ? state.active_generation_ref
    : null
  return { ...state, items, active_generation_ref: activeGenerationRef }
}

/** Serialize an explicit allow-list so sensitive fields cannot leak by spread. */
export function serializeGenerationQueueState(state: GenerationQueueState): string {
  assertGenerationQueueState(state)
  return JSON.stringify({
    version: GENERATION_QUEUE_STORAGE_VERSION,
    active_generation_ref: state.active_generation_ref,
    items: state.items.map((item) => ({
      generation_ref: item.generation_ref,
      project_ref: item.project_ref,
      source_version_ref: item.source_version_ref,
      kind: item.kind,
      label: item.label,
      created_at: item.created_at,
      status: item.status,
      progress: item.progress,
      candidate_refs: [...item.candidate_refs],
      last_event_id: item.last_event_id,
    })),
  })
}

/**
 * Parse only the current, complete storage schema. Corrupt, unknown-version,
 * extra-field, and invariant-breaking payloads return null as one boundary
 * outcome instead of entering application state.
 */
export function deserializeGenerationQueueState(serialized: unknown): GenerationQueueState | null {
  if (typeof serialized !== "string") return null

  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    return null
  }
  if (!isRecord(parsed) || !hasExactKeys(parsed, ["version", "active_generation_ref", "items"])) return null
  if (parsed.version !== GENERATION_QUEUE_STORAGE_VERSION || !Array.isArray(parsed.items)) return null

  const items: GenerationQueueItem[] = []
  const generationRefs = new Set<string>()
  for (const value of parsed.items) {
    const item = parseGenerationQueueItem(value)
    if (item === null || generationRefs.has(item.generation_ref)) return null
    generationRefs.add(item.generation_ref)
    items.push(item)
  }

  const activeGenerationRef = parseNullableNonEmptyString(parsed.active_generation_ref)
  if (activeGenerationRef === undefined) return null
  if (activeGenerationRef !== null && !generationRefs.has(activeGenerationRef)) return null

  return {
    version: GENERATION_QUEUE_STORAGE_VERSION,
    active_generation_ref: activeGenerationRef,
    items: sortQueueItems(items),
  }
}

function parseGenerationQueueItem(value: unknown): GenerationQueueItem | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    "generation_ref",
    "project_ref",
    "source_version_ref",
    "kind",
    "label",
    "created_at",
    "status",
    "progress",
    "candidate_refs",
    "last_event_id",
  ])) return null

  const candidateRefs = parseStringArray(value.candidate_refs)
  const sourceVersionRef = parseNullableNonEmptyString(value.source_version_ref)
  const lastEventId = parseNullableNonEmptyString(value.last_event_id)
  if (
    !isNonEmptyString(value.generation_ref)
    || !isNonEmptyString(value.project_ref)
    || sourceVersionRef === undefined
    || !isGenerationQueueKind(value.kind)
    || !isNonEmptyString(value.label)
    || !isValidTimestamp(value.created_at)
    || !isGenerationQueueServerStatus(value.status)
    || !isValidProgress(value.progress)
    || candidateRefs === null
    || !allUnique(candidateRefs)
    || lastEventId === undefined
  ) return null

  return {
    generation_ref: value.generation_ref,
    project_ref: value.project_ref,
    source_version_ref: sourceVersionRef,
    kind: value.kind,
    label: value.label,
    created_at: value.created_at,
    status: value.status,
    progress: value.progress,
    candidate_refs: candidateRefs,
    last_event_id: lastEventId,
  }
}

function normalizeGenerationQueueItem(item: GenerationQueueItem): GenerationQueueItem {
  assertGenerationQueueItem(item)
  return {
    ...item,
    candidate_refs: uniqueStrings(item.candidate_refs).sort(),
  }
}

function assertGenerationQueueItem(item: GenerationQueueItem): void {
  if (
    !isNonEmptyString(item.generation_ref)
    || !isNonEmptyString(item.project_ref)
    || (item.source_version_ref !== null && !isNonEmptyString(item.source_version_ref))
    || !isGenerationQueueKind(item.kind)
    || !isNonEmptyString(item.label)
    || !isValidTimestamp(item.created_at)
    || !isGenerationQueueServerStatus(item.status)
    || !isValidProgress(item.progress)
    || !isStringArray(item.candidate_refs)
    || !item.candidate_refs.every(isNonEmptyString)
    || (item.last_event_id !== null && !isNonEmptyString(item.last_event_id))
  ) {
    throw new RangeError("invalid generation queue item")
  }
}

function assertGenerationQueueState(state: GenerationQueueState): void {
  if (state.version !== GENERATION_QUEUE_STORAGE_VERSION || !Array.isArray(state.items)) {
    throw new RangeError("invalid generation queue state")
  }
  const refs = new Set<string>()
  for (const item of state.items) {
    assertGenerationQueueItem(item)
    if (refs.has(item.generation_ref)) throw new RangeError("generation_ref must be unique in the queue")
    refs.add(item.generation_ref)
  }
  if (state.active_generation_ref !== null && !refs.has(state.active_generation_ref)) {
    throw new RangeError("active_generation_ref must identify an item in the queue")
  }
}

function sortQueueItems(items: readonly GenerationQueueItem[]): GenerationQueueItem[] {
  return [...items].sort((left, right) => {
    const createdAtOrder = Date.parse(right.created_at) - Date.parse(left.created_at)
    return createdAtOrder !== 0 ? createdAtOrder : left.generation_ref.localeCompare(right.generation_ref)
  })
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function allUnique(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
}

function parseStringArray(value: unknown): string[] | null {
  if (!isStringArray(value) || !value.every(isNonEmptyString)) return null
  return [...value]
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function assertNonEmptyString(value: string, field: string): void {
  if (!isNonEmptyString(value)) throw new RangeError(`${field} must be a non-empty string`)
}

function parseNullableNonEmptyString(value: unknown): string | null | undefined {
  if (value === null) return null
  return isNonEmptyString(value) ? value : undefined
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.includes("T") && Number.isFinite(Date.parse(value))
}

function isValidProgress(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value)
  return actualKeys.length === expectedKeys.length && expectedKeys.every((key) => actualKeys.includes(key))
}
