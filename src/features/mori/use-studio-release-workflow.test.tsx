import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { MoriApi, MoriRelease, MoriReleaseDraft, MoriShare } from "@/lib/mori-api"
import { useStudioReleaseWorkflow } from "./use-studio-release-workflow"

type ReleaseApi = Parameters<typeof useStudioReleaseWorkflow>[0]["api"]

const releaseDraft: MoriReleaseDraft = {
  release_draft_ref: "release_draft_1",
  version_ref: "version_1",
  revision: 3,
  state: "draft",
  title: "Morning Lines",
  description: "A quiet ride toward morning.",
  visibility: "public",
  allow_remix: false,
  explicit_content: false,
  artwork: { type: "current" },
  updated_at: "2026-09-12T12:00:00.000Z",
}

function createRelease(status: MoriRelease["status"]): MoriRelease {
  return {
    release_ref: "release_1",
    version_ref: "version_1",
    release_draft_ref: releaseDraft.release_draft_ref,
    status,
    public_url: status === "published" ? "https://mori.local/release/release_1" : null,
    created_at: "2026-09-12T12:00:00.000Z",
    updated_at: "2026-09-12T12:00:00.000Z",
  }
}

function createShare(status: MoriShare["status"]): MoriShare {
  return {
    share_ref: "share_1",
    version_ref: "version_1",
    release_draft_ref: releaseDraft.release_draft_ref,
    status,
    share_url: status === "active" ? "https://mori.local/share/share_1" : null,
    created_at: "2026-09-12T12:00:00.000Z",
    updated_at: "2026-09-12T12:00:00.000Z",
  }
}

function createApi(overrides: Partial<ReleaseApi> = {}): ReleaseApi {
  return {
    createArtworkGeneration: vi.fn(),
    getArtworkGeneration: vi.fn(),
    getArtworkGenerationEvents: vi.fn(),
    cancelArtworkGeneration: vi.fn(),
    getReleaseDraft: vi.fn<MoriApi["getReleaseDraft"]>(async () => ({ data: releaseDraft, meta: { request_id: "request_release_draft" } })),
    putReleaseDraft: vi.fn<MoriApi["putReleaseDraft"]>(async (_versionRef, input) => {
      return {
        data: {
          ...releaseDraft,
          title: input.title,
          description: input.description,
          visibility: input.visibility,
          allow_remix: input.allow_remix,
          explicit_content: input.explicit_content,
          artwork: input.artwork,
          revision: (input.expected_revision ?? 0) + 1,
        },
        meta: { request_id: "request_release_saved" },
      }
    }),
    publishRelease: vi.fn(),
    getRelease: vi.fn(),
    unpublishRelease: vi.fn(),
    createShare: vi.fn(),
    getShare: vi.fn(),
    revokeShare: vi.fn(),
    ...overrides,
  } as ReleaseApi
}

describe("useStudioReleaseWorkflow release tracking", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("tracks a 202 publish receipt until the release is published without posting twice", async () => {
    const publishRelease = vi.fn<MoriApi["publishRelease"]>(async () => ({
      data: {
        release_ref: "release_1",
        version_ref: "version_1",
        status: "publishing",
        public_url: null,
        created_at: "2026-09-12T12:00:00.000Z",
      },
      meta: { request_id: "request_publish" },
    }))
    const getRelease = vi.fn<MoriApi["getRelease"]>()
      .mockResolvedValueOnce({ data: createRelease("publishing"), meta: { request_id: "request_release_pending" } })
      .mockResolvedValueOnce({ data: createRelease("published"), meta: { request_id: "request_release_published" } })
    const api = createApi({ publishRelease, getRelease })
    const { result } = renderHook(() => useStudioReleaseWorkflow({ versionRef: "version_1", versionTitle: "Morning Lines", api }))

    await waitFor(() => expect(result.current.releaseSave.snapshot).not.toBeNull())
    await act(async () => { await result.current.saveReleaseDraft(result.current.releaseDraft) })
    await act(async () => { await result.current.publishRelease() })
    await waitFor(() => expect(result.current.releasePublish.status).toBe("published"), { timeout: 2_000 })

    expect(publishRelease).toHaveBeenCalledTimes(1)
    expect(getRelease).toHaveBeenCalledTimes(2)
    expect(result.current.releasePublish.publicUrl).toBe("https://mori.local/release/release_1")
  })

  it("tracks a 202 share receipt until the link is active without posting twice", async () => {
    const createShareRequest = vi.fn<MoriApi["createShare"]>(async () => ({
      data: createShare("creating"),
      meta: { request_id: "request_share" },
    }))
    const getShare = vi.fn<MoriApi["getShare"]>()
      .mockResolvedValueOnce({ data: createShare("creating"), meta: { request_id: "request_share_pending" } })
      .mockResolvedValueOnce({ data: createShare("active"), meta: { request_id: "request_share_active" } })
    const api = createApi({ createShare: createShareRequest, getShare })
    const { result } = renderHook(() => useStudioReleaseWorkflow({ versionRef: "version_1", versionTitle: "Morning Lines", api }))

    await waitFor(() => expect(result.current.releaseSave.snapshot).not.toBeNull())
    act(() => { result.current.updateReleaseDraft({
      title: releaseDraft.title,
      description: releaseDraft.description,
      visibility: "link_only",
      allowRemix: releaseDraft.allow_remix,
      explicitContent: releaseDraft.explicit_content,
      artwork: { type: "current" },
    }) })
    await act(async () => { await result.current.saveReleaseDraft(result.current.releaseDraft) })
    await act(async () => { await result.current.createShare() })
    await waitFor(() => expect(result.current.releaseShare.status).toBe("active"), { timeout: 2_000 })

    expect(createShareRequest).toHaveBeenCalledTimes(1)
    expect(getShare).toHaveBeenCalledTimes(2)
    expect(result.current.releaseShare.shareUrl).toBe("https://mori.local/share/share_1")
  })

  it("drops an in-flight publish response when the user switches Version", async () => {
    let resolvePublish: (value: Awaited<ReturnType<MoriApi["publishRelease"]>>) => void = () => undefined
    const publishResponse = {
      data: {
        release_ref: "release_1",
        version_ref: "version_1",
        status: "published" as const,
        public_url: "https://mori.local/release/release_1",
        created_at: "2026-09-12T12:00:00.000Z",
      },
      meta: { request_id: "request_publish_stale" },
    }
    const publishRelease = vi.fn<MoriApi["publishRelease"]>(() => new Promise((resolve) => { resolvePublish = resolve }))
    const api = createApi({ publishRelease })
    const { result, rerender } = renderHook(
      ({ currentVersionRef }: { currentVersionRef: string }) => useStudioReleaseWorkflow({ versionRef: currentVersionRef, versionTitle: "Morning Lines", api }),
      { initialProps: { currentVersionRef: "version_1" } },
    )

    await waitFor(() => expect(result.current.releaseSave.snapshot).not.toBeNull())
    await act(async () => { await result.current.saveReleaseDraft(result.current.releaseDraft) })
    act(() => { void result.current.publishRelease() })
    rerender({ currentVersionRef: "version_2" })
    await act(async () => { resolvePublish(publishResponse); await Promise.resolve() })

    expect(result.current.releasePublish.status).toBe("idle")
    expect(result.current.releasePublish.releaseRef).toBeNull()
  })
})
