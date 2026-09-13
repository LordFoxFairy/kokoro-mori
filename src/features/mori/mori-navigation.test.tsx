import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { previewCandidates } from "./preview-data"
import { MoriCatalogShell } from "./components/mori-catalog-shell"
import { MoriAppProvider, useMoriApp } from "./components/mori-app-provider"

describe("Mori application navigation", () => {
  it("keeps the server shell viewport-neutral until the client measures mobile layout", () => {
    const markup = renderToString(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="library" ariaLabel="Library">
          <div>Library content</div>
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    expect(markup).toContain('data-viewport-ready="false"')
  })

  it("keeps product-level destinations in one shared shell", () => {
    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="home" ariaLabel="Home">
          <div>Home content</div>
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/")
    expect(screen.getByRole("link", { name: "Create" })).toHaveAttribute("href", "/create")
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/projects")
    expect(screen.getByRole("link", { name: "Library" })).toHaveAttribute("href", "/library")
  })

  it("keeps New direction in the active Project context", async () => {
    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview" projectRef="project_live_1">
          <div>Project overview</div>
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    await waitFor(() => expect(screen.getByRole("link", { name: "New direction" })).toHaveAttribute("href", "/create?project_ref=project_live_1"))
  })

  it("keeps the empty global player quiet until a Version is chosen", () => {
    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="library" ariaLabel="Library">
          <div>Library content</div>
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    expect(screen.getByRole("region", { name: "Global player" })).toBeInTheDocument()
    const player = screen.getByRole("region", { name: "Global player" })
    expect(player).toHaveAttribute("data-player-state", "empty")
    expect(player).toHaveTextContent("Choose a version")
    expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Mute" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Open playback queue" })).not.toBeInTheDocument()
  })

  it("toggles the desktop rail without changing the current surface", async () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 })
    localStorage.removeItem("mori.rail.v1")

    try {
      render(
        <MoriAppProvider>
          <MoriCatalogShell activeKey="create" ariaLabel="Create">
            <div>Create content</div>
          </MoriCatalogShell>
        </MoriAppProvider>,
      )

      await waitFor(() => expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument())
      const shell = document.querySelector('[data-mori-app-shell="true"]')
      expect(shell).toHaveAttribute("data-rail-collapsed", "false")
      fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }))
      await waitFor(() => expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument())
      expect(shell).toHaveAttribute("data-rail-collapsed", "true")
      expect(screen.getByRole("link", { name: "Create" })).toHaveAttribute("aria-current", "page")
    } finally {
      localStorage.removeItem("mori.rail.v1")
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth })
    }
  })

  it("supports a spacebar playback shortcut without hijacking text entry", () => {
    render(
      <MoriAppProvider>
        <input aria-label="Search" />
        <MoriCatalogShell activeKey="library" ariaLabel="Library">
          <div>Library content</div>
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.keyDown(window, { code: "Space", key: " " })
    expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Search" }), { code: "Space", key: " " })
    expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument()
  })

  it("presents the player as one global dock with an explicit control group", () => {
    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="library" ariaLabel="Library">
          <div>Library content</div>
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    expect(screen.getByRole("region", { name: "Global player" })).toHaveAttribute("data-player-surface", "global-dock")
    expect(screen.queryByRole("group", { name: "Playback controls" })).not.toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Global player" })).toHaveAttribute("data-player-state", "empty")
  })

  it("opens a playback queue from the shared global player and plays a chosen version", async () => {
    render(
      <MoriAppProvider>
        <PlaybackQueueSeed />
        <MoriCatalogShell activeKey="library" ariaLabel="Library">
          <div>Library content</div>
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Choose preview listening queue" }))
    const trigger = screen.getByRole("button", { name: "Open playback queue" })
    expect(trigger).toHaveTextContent("Up next")
    trigger.focus()
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    fireEvent.click(trigger)

    const queue = screen.getByRole("dialog", { name: "Up next" })
    await waitFor(() => expect(queue).toHaveFocus())
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("button", { name: "Play First Light from queue" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Play First Light · Afterglow from queue" }))
    expect(screen.getByRole("region", { name: "Global player" })).toHaveTextContent("First Light · Afterglow")
    expect(screen.getByRole("region", { name: "Global player" })).toHaveAttribute("data-player-state", "ready")
    expect(within(screen.getByRole("region", { name: "Global player" })).getByRole("button", { name: "Pause" })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Up next" })).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it("keeps the portalled playback queue inside the player geometry contract", async () => {
    render(
      <MoriAppProvider>
        <PlaybackQueueSeed />
        <MoriCatalogShell activeKey="library" ariaLabel="Library">
          <div>Library content</div>
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Choose preview listening queue" }))
    fireEvent.click(screen.getByRole("button", { name: "Open playback queue" }))

    const queue = screen.getByRole("dialog", { name: "Up next" })
    const shell = queue.closest('[data-mori-app-shell="true"]')
    expect(shell).not.toBeNull()
    expect(shell?.className).toContain("appShellWithPlayer")
    expect(shell?.querySelector('[data-player-surface="global-dock"]')).toBeInTheDocument()
  })

  it("does not expose seek controls before a Version is chosen", () => {
    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="library" ariaLabel="Library">
          <div>Library content</div>
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    expect(screen.queryByRole("slider", { name: "Seek through current version" })).not.toBeInTheDocument()
  })

  it("starts with a compact rail on narrow viewports", async () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 })

    try {
      render(
        <MoriAppProvider>
          <MoriCatalogShell activeKey="library" ariaLabel="Library">
            <div>Library content</div>
          </MoriCatalogShell>
        </MoriAppProvider>,
      )
      await waitFor(() => expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument())
      expect(screen.getByRole("navigation", { name: "Mori" })).toHaveAttribute("data-rail-state", "collapsed")
      expect(screen.getByRole("link", { name: "Library" })).toHaveAttribute("aria-current", "page")
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth })
    }
  })

  it("keeps the rail compact when a desktop window is resized to mobile", async () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 })
    localStorage.removeItem("mori.rail.v1")

    try {
      render(
        <MoriAppProvider>
          <MoriCatalogShell activeKey="library" ariaLabel="Library">
            <div>Library content</div>
          </MoriCatalogShell>
        </MoriAppProvider>,
      )

      await waitFor(() => expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument())
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 })
      fireEvent(window, new Event("resize"))

      await waitFor(() => expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument())
    } finally {
      localStorage.removeItem("mori.rail.v1")
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth })
    }
  })

  it("does not overwrite the desktop rail preference during a mobile resize", async () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 })
    localStorage.setItem("mori.rail.v1", "expanded")

    try {
      render(
        <MoriAppProvider>
          <MoriCatalogShell activeKey="library" ariaLabel="Library">
            <div>Library content</div>
          </MoriCatalogShell>
        </MoriAppProvider>,
      )

      await waitFor(() => expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument())
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 })
      fireEvent(window, new Event("resize"))
      await waitFor(() => expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument())

      Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 })
      fireEvent(window, new Event("resize"))

      await waitFor(() => expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument())
      expect(localStorage.getItem("mori.rail.v1")).toBe("expanded")
    } finally {
      localStorage.removeItem("mori.rail.v1")
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth })
    }
  })

  it("locks the page behind the expanded mobile rail", async () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 })

    try {
      render(
        <MoriAppProvider>
          <MoriCatalogShell activeKey="library" ariaLabel="Library">
            <div>Library content</div>
          </MoriCatalogShell>
        </MoriAppProvider>,
      )
      await waitFor(() => expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument())

      fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }))
      await waitFor(() => expect(document.body.style.overflow).toBe("hidden"))

      fireEvent.keyDown(window, { key: "Escape" })
      await waitFor(() => expect(document.body.style.overflow).toBe(""))
      expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument()
    } finally {
      document.body.style.overflow = ""
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth })
    }
  })

  it("moves focus into the mobile rail, hides the page behind it, and restores the trigger", async () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 })
    localStorage.removeItem("mori.rail.v1")

    try {
      render(
        <MoriAppProvider>
          <MoriCatalogShell activeKey="library" ariaLabel="Library">
            <div>Library content</div>
          </MoriCatalogShell>
        </MoriAppProvider>,
      )
      await waitFor(() => expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument())

      const expandButton = screen.getByRole("button", { name: "Expand sidebar" })
      fireEvent.click(expandButton)
      const collapseButton = screen.getByRole("button", { name: "Collapse sidebar" })
      await waitFor(() => expect(collapseButton).toHaveFocus())

      const surface = document.querySelector<HTMLElement>('section[aria-label="Library"]')
      expect(surface).not.toBeNull()
      expect(surface).toHaveAttribute("aria-hidden", "true")
      expect(surface).toHaveAttribute("inert")
      const player = document.querySelector<HTMLElement>('section[aria-label="Global player"]')
      expect(player?.parentElement).toHaveAttribute("inert")

      const brandLink = screen.getByRole("link", { name: "Mori home" })
      const helpLink = screen.getByRole("link", { name: "Help and feedback" })
      helpLink.focus()
      fireEvent.keyDown(window, { key: "Tab" })
      expect(brandLink).toHaveFocus()
      fireEvent.keyDown(window, { key: "Tab", shiftKey: true })
      expect(helpLink).toHaveFocus()

      fireEvent.click(collapseButton)
      await waitFor(() => expect(expandButton).toHaveFocus())
    } finally {
      document.body.style.overflow = ""
      localStorage.removeItem("mori.rail.v1")
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth })
    }
  })

  it("treats the mobile playback queue as a modal and traps focus inside it", async () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 })

    try {
      render(
        <MoriAppProvider>
          <PlaybackQueueSeed />
          <MoriCatalogShell activeKey="library" ariaLabel="Library">
            <div>Library content</div>
          </MoriCatalogShell>
        </MoriAppProvider>,
      )
      fireEvent.click(screen.getByRole("button", { name: "Choose preview listening queue" }))
      const trigger = screen.getByRole("button", { name: "Open playback queue" })
      trigger.focus()
      fireEvent.click(trigger)

      const queue = await screen.findByRole("dialog", { name: "Up next" })
      await waitFor(() => expect(queue).toHaveAttribute("aria-modal", "true"))
      await waitFor(() => expect(queue).toHaveFocus())

      const closeButton = screen.getByRole("button", { name: "Close playback queue" })
      const queueItems = screen.getAllByRole("button", { name: /from queue$/u })
      const lastItem = queueItems[queueItems.length - 1]
      expect(lastItem).toBeDefined()
      closeButton.focus()
      fireEvent.keyDown(window, { key: "Tab", shiftKey: true })
      expect(lastItem).toHaveFocus()
      fireEvent.keyDown(window, { key: "Tab" })
      expect(closeButton).toHaveFocus()

      fireEvent.keyDown(window, { key: "Escape" })
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Up next" })).not.toBeInTheDocument())
      expect(trigger).toHaveFocus()
    } finally {
      document.body.style.overflow = ""
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth })
    }
  })

  it("dismisses the mobile rail when a destination is chosen", async () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 })

    try {
      render(
        <MoriAppProvider>
          <MoriCatalogShell activeKey="library" ariaLabel="Library">
            <div>Library content</div>
          </MoriCatalogShell>
        </MoriAppProvider>,
      )
      await waitFor(() => expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument())

      fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }))
      fireEvent.click(screen.getByRole("link", { name: "Home" }))

      await waitFor(() => expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument())
    } finally {
      document.body.style.overflow = ""
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth })
    }
  })

  it("persists the rail state while moving between product surfaces", () => {
    function SurfaceHarness() {
      const [surface, setSurface] = useState<"home" | "library">("home")

      return (
        <>
          <button type="button" onClick={() => setSurface((value) => value === "home" ? "library" : "home")}>Switch surface</button>
          <MoriCatalogShell activeKey={surface} ariaLabel={surface}>
            <div>{surface} content</div>
          </MoriCatalogShell>
        </>
      )
    }

    render(
      <MoriAppProvider>
        <SurfaceHarness />
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }))
    fireEvent.click(screen.getByRole("button", { name: "Switch surface" }))

    expect(screen.getByRole("button", { name: /expand sidebar/i })).toBeInTheDocument()
  })

  it("restores the desktop rail preference from local storage", async () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 })
    localStorage.setItem("mori.rail.v1", "collapsed")

    try {
      render(
        <MoriAppProvider>
          <MoriCatalogShell activeKey="library" ariaLabel="Library">
            <div>Library content</div>
          </MoriCatalogShell>
        </MoriAppProvider>,
      )

      await waitFor(() => expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument())
    } finally {
      localStorage.removeItem("mori.rail.v1")
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth })
    }
  })

  it("carries the current surface into the settings return path", async () => {
    const originalPath = window.location.pathname
    window.history.pushState({}, "", "/projects/project_live_1/studio/version_live_1")

    try {
      render(
        <MoriAppProvider>
          <MoriCatalogShell activeKey="projects" ariaLabel="Studio">
            <div>Studio content</div>
          </MoriCatalogShell>
        </MoriAppProvider>,
      )

      await waitFor(() => expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings?return_to=%2Fprojects%2Fproject_live_1%2Fstudio%2Fversion_live_1"))
    } finally {
      window.history.pushState({}, "", originalPath)
    }
  })

  it("opens settings over the current surface without discarding draft state", async () => {
    const originalPath = `${window.location.pathname}${window.location.search}`
    window.history.pushState({}, "", "/create")

    function DraftSurface() {
      const [draft, setDraft] = useState("")
      return (
        <MoriCatalogShell activeKey="create" ariaLabel="Create">
          <label>
            Working prompt
            <input aria-label="Working prompt" value={draft} onChange={(event) => setDraft(event.target.value)} />
          </label>
        </MoriCatalogShell>
      )
    }

    try {
      render(
        <MoriAppProvider>
          <DraftSurface />
        </MoriAppProvider>,
      )

      const prompt = screen.getByRole("textbox", { name: "Working prompt" })
      fireEvent.change(prompt, { target: { value: "A quiet chorus with brushed drums" } })
      fireEvent.click(screen.getByRole("link", { name: "Settings" }))

      expect(await screen.findByRole("dialog", { name: "Settings" })).toBeInTheDocument()
      expect(prompt).toHaveValue("A quiet chorus with brushed drums")
      expect(prompt.closest("section")).toHaveAttribute("inert")

      fireEvent.click(screen.getByRole("button", { name: "Back to create" }))
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Settings" })).not.toBeInTheDocument())
      expect(prompt).toHaveValue("A quiet chorus with brushed drums")
      expect(screen.getByRole("link", { name: "Settings" })).toHaveFocus()
    } finally {
      window.history.pushState({}, "", originalPath)
    }
  })

  it("preserves project context when settings opens from Create", async () => {
    const originalUrl = window.location.href
    window.history.pushState({}, "", "/create?project_ref=project_live_1")

    try {
      render(
        <MoriAppProvider>
          <MoriCatalogShell activeKey="create" ariaLabel="Create">
            <div>Create content</div>
          </MoriCatalogShell>
        </MoriAppProvider>,
      )

      await waitFor(() => expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings?return_to=%2Fcreate%3Fproject_ref%3Dproject_live_1"))
    } finally {
      window.history.pushState({}, "", originalUrl)
    }
  })

  it("keeps new creation inside the current project context", async () => {
    const originalPath = window.location.pathname
    window.history.pushState({}, "", "/projects/project_live_1/studio/version_live_1")

    try {
      render(
        <MoriAppProvider>
          <MoriCatalogShell activeKey="projects" ariaLabel="Studio">
            <div>Studio content</div>
          </MoriCatalogShell>
        </MoriAppProvider>,
      )

      await waitFor(() => expect(screen.getByRole("link", { name: "New direction" })).toHaveAttribute("href", "/create?project_ref=project_live_1"))
    } finally {
      window.history.pushState({}, "", originalPath)
    }
  })

  it("carries project context through the Create route", async () => {
    const originalUrl = window.location.href
    window.history.pushState({}, "", "/create?project_ref=project_live_1")

    try {
      render(
        <MoriAppProvider>
          <MoriCatalogShell activeKey="create" ariaLabel="Create">
            <div>Create content</div>
          </MoriCatalogShell>
        </MoriAppProvider>,
      )

      await waitFor(() => expect(screen.getByRole("link", { name: "New direction" })).toHaveAttribute("href", "/create?project_ref=project_live_1"))
      expect(screen.getByRole("link", { name: "Create" })).toHaveAttribute("href", "/create?project_ref=project_live_1")
    } finally {
      window.history.pushState({}, "", originalUrl)
    }
  })

  it("marks the current utility surface in the rail", () => {
    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="settings" ariaLabel="Settings">
          <div>Settings content</div>
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page")
  })

  it("keeps the project catalog reachable when the rail is collapsed", () => {
    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="library" ariaLabel="Library">
          <div>Library content</div>
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }))

    expect(screen.getByRole("navigation", { name: "Mori" })).toHaveAttribute("data-rail-state", "collapsed")
    expect(screen.getByRole("link", { name: "Projects" })).toBeVisible()
  })

  it("applies reduce-motion preference at the shared shell", () => {
    function MotionPreferenceHarness() {
      const { updatePreferences } = useMoriApp()

      return (
        <>
          <button type="button" onClick={() => updatePreferences({ reduceMotion: true })}>Reduce motion</button>
          <MoriCatalogShell activeKey="home" ariaLabel="Home">
            <div>Home content</div>
          </MoriCatalogShell>
        </>
      )
    }

    render(
      <MoriAppProvider>
        <MotionPreferenceHarness />
      </MoriAppProvider>,
    )

    expect(document.querySelector('[data-reduce-motion="true"]')).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Reduce motion" }))
    expect(document.querySelector('[data-reduce-motion="true"]')).toBeInTheDocument()
  })

  it("restores music preferences from local storage", async () => {
    localStorage.clear()

    function PreferenceHarness() {
      const { preferences, updatePreferences } = useMoriApp()

      return (
        <>
          <output aria-label="stored preferences">{`${preferences.defaultMode}:${preferences.lyricsMode}:${preferences.durationSeconds}`}</output>
          <button type="button" onClick={() => updatePreferences({ defaultMode: "custom", lyricsMode: "instrumental", durationSeconds: 240 })}>Save preferences</button>
        </>
      )
    }

    const firstRender = render(
      <MoriAppProvider>
        <PreferenceHarness />
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }))
    await waitFor(() => expect(localStorage.getItem("mori.preferences.v1")).toContain('"defaultMode":"custom"'))

    firstRender.unmount()
    render(
      <MoriAppProvider>
        <PreferenceHarness />
      </MoriAppProvider>,
    )

    await waitFor(() => expect(screen.getByLabelText("stored preferences")).toHaveTextContent("custom:instrumental:240"))
    localStorage.clear()
  })

  it("keeps the active track playing while moving between product surfaces", () => {
    function PlayerSurfaceHarness() {
      const [surface, setSurface] = useState<"home" | "library">("home")
      const { selectPlayerCandidate } = useMoriApp()

      return (
        <>
          <button type="button" onClick={() => selectPlayerCandidate(previewCandidates[0])}>Select current version</button>
          <button type="button" onClick={() => setSurface((value) => value === "home" ? "library" : "home")}>Switch surface</button>
          <MoriCatalogShell activeKey={surface} ariaLabel={surface}>
            <div>{surface} content</div>
          </MoriCatalogShell>
        </>
      )
    }

    render(
      <MoriAppProvider>
        <PlayerSurfaceHarness />
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Select current version" }))
    fireEvent.click(screen.getByRole("button", { name: "Switch surface" }))

    expect(screen.getByRole("region", { name: "Global player" })).toHaveTextContent("First Light")
    expect(screen.getByRole("region", { name: "Global player" })).toHaveAttribute("data-player-state", "ready")
  })

  it("moves between preview versions from the global player", () => {
    function PreviewPlayerHarness() {
      const { nextPlayerCandidate, previousPlayerCandidate, selectPlayerCandidate } = useMoriApp()

      return (
        <>
          <button type="button" onClick={() => {
            selectPlayerCandidate(previewCandidates[0])
            selectPlayerCandidate(previewCandidates[1])
            selectPlayerCandidate(previewCandidates[0])
          }}>Select first version</button>
          <button type="button" onClick={nextPlayerCandidate}>Next version</button>
          <button type="button" onClick={previousPlayerCandidate}>Previous version</button>
          <MoriCatalogShell activeKey="home" ariaLabel="Home">
            <div>Home content</div>
          </MoriCatalogShell>
        </>
      )
    }

    render(
      <MoriAppProvider>
        <PreviewPlayerHarness />
      </MoriAppProvider>,
    )

    const player = screen.getByRole("region", { name: "Global player" })
    fireEvent.click(screen.getByRole("button", { name: "Select first version" }))
    expect(player).toHaveTextContent("First Light")
    fireEvent.click(within(player).getByRole("button", { name: "Next version" }))
    expect(player).toHaveTextContent("First Light · Afterglow")
    fireEvent.click(within(player).getByRole("button", { name: "Previous version" }))
    expect(player).toHaveTextContent("First Light")
  })

  it("keeps global transport navigation inside the active candidate collection", () => {
    const liveCandidates = [
      { ...previewCandidates[0], candidateRef: "candidate_live_a", versionRef: "version_live_a", title: "Window Seat" },
      { ...previewCandidates[1], candidateRef: "candidate_live_b", versionRef: "version_live_b", title: "Window Seat · Afterglow" },
    ]
    const firstLiveCandidate = liveCandidates.at(0)

    function CandidateCollectionHarness() {
      const { nextPlayerCandidate, selectPlayerCandidate } = useMoriApp()
      return (
        <>
          <button type="button" onClick={() => {
            const secondLiveCandidate = liveCandidates.at(1)
            if (firstLiveCandidate !== undefined) selectPlayerCandidate(firstLiveCandidate)
            if (secondLiveCandidate !== undefined) selectPlayerCandidate(secondLiveCandidate)
            if (firstLiveCandidate !== undefined) selectPlayerCandidate(firstLiveCandidate)
          }}>Play live take</button>
          <button type="button" onClick={nextPlayerCandidate}>Next live take</button>
          <MoriCatalogShell activeKey="home" ariaLabel="Home">
            <div>Home content</div>
          </MoriCatalogShell>
        </>
      )
    }

    render(
      <MoriAppProvider>
        <CandidateCollectionHarness />
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Play live take" }))
    fireEvent.click(screen.getByRole("button", { name: "Next live take" }))

    expect(screen.getByRole("region", { name: "Global player" })).toHaveTextContent("Window Seat · Afterglow")
    expect(screen.getByRole("region", { name: "Global player" })).not.toHaveTextContent("First Light")
  })

  it("does not advance an unavailable preview when the playback preference is enabled", () => {
    vi.useFakeTimers()

    try {
      function PlaybackPreferenceHarness() {
        const { selectPlayerCandidate, updatePreferences } = useMoriApp()

        return (
          <>
            <button type="button" onClick={() => updatePreferences({ endBehavior: "next" })}>Play next at end</button>
            <button type="button" onClick={() => selectPlayerCandidate({ ...previewCandidates[0], durationSeconds: 2, audioAssetRef: null })}>Use short preview</button>
            <MoriCatalogShell activeKey="home" ariaLabel="Home">
              <div>Home content</div>
            </MoriCatalogShell>
          </>
        )
      }

      render(
        <MoriAppProvider>
          <PlaybackPreferenceHarness />
        </MoriAppProvider>,
      )

      fireEvent.click(screen.getByRole("button", { name: "Play next at end" }))
      fireEvent.click(screen.getByRole("button", { name: "Use short preview" }))
      expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument()

      act(() => vi.advanceTimersByTime(2_000))

      expect(screen.getByRole("region", { name: "Global player" })).toHaveTextContent("First Light")
      expect(screen.getByRole("region", { name: "Global player" })).toHaveTextContent("Preview audio is unavailable")
    } finally {
      vi.useRealTimers()
    }
  })
})

function PlaybackQueueSeed() {
  const { selectPlayerCandidate } = useMoriApp()
  return <button type="button" onClick={() => {
    selectPlayerCandidate(previewCandidates[0])
    selectPlayerCandidate(previewCandidates[1])
    selectPlayerCandidate(previewCandidates[0])
  }}>Choose preview listening queue</button>
}
