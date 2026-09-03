# Current Version Commit Design

> Date: 2026-09-03
> Scope: `kokoro-mori` browser contract and Studio interaction only

## Product decision

Suno-style production continuity requires four states to stay distinct:

```text
Open Version  = the Version currently shown in Studio
Playing       = the Version currently heard in the global Player
Selected Take = the Take the user is inspecting
Current       = the Project's explicitly committed Version
```

`Use take` is therefore a durable Project mutation, not a local visual toggle. Mori must keep the previous Current visible until the server confirms the command. A failed, stale, or mismatched response leaves Current unchanged.

## Browser contract

```http
PUT /api/v1/mori/projects/{project_ref}/current_version
Idempotency-Key: ...
```

```text
CurrentVersionInput
  candidate_ref
  version_ref
  expected_current_version_ref  string | null

CurrentVersionSelection
  project_ref
  current_version_ref
  source_candidate_ref
  previous_version_ref          string | null
  selected_at                   RFC 3339 UTC
```

The owner validates that Candidate and Version belong to each other and to the path Project, then compares `expected_current_version_ref` before changing state. Replaying the same idempotency key returns the original result. A stale expectation is `409`; a wrong Candidate/Version relationship is `422`.

The browser accepts success only when Project, target Version, source Candidate, and previous Current exactly match the reviewed command.

## Interaction

- Pressing `Use take` changes the target action to `Using take…` and disables other commit actions.
- Current is not changed optimistically.
- Success marks only the confirmed Version as Current and opens that Take.
- Failure shows a compact message in Take Lanes, keeps the previous Current, and offers Retry / Dismiss.
- Retry reuses the same idempotency key while the command context is unchanged.
- A concurrency conflict asks the user to refresh the Version state rather than silently overriding another choice.
- Version history labels derive from the confirmed `currentVersionRef`, never list position.

## Boundary

- No BFF, owner database, sibling repository, provider field, or global navigation change.
- This slice defines and consumes the browser boundary; server implementation remains a separate owner task.
- Existing generation, Take Lane, Player, Export, Finish, Lyrics, and Stems state machines remain unchanged.

