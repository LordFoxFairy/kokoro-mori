import { afterEach, describe, expect, it } from "vitest"
import { isolateMoriShellBackground, lockMoriModalBody } from "./mori-modal-isolation"

describe("Mori modal isolation", () => {
  afterEach(() => {
    document.body.innerHTML = ""
    document.body.style.overflow = ""
  })

  it("keeps the body locked until the final nested modal closes", () => {
    document.body.style.overflow = "auto"
    const releaseFirst = lockMoriModalBody()
    const releaseSecond = lockMoriModalBody()

    expect(document.body.style.overflow).toBe("hidden")
    releaseFirst()
    expect(document.body.style.overflow).toBe("hidden")
    releaseSecond()
    expect(document.body.style.overflow).toBe("auto")
  })

  it("restores shell accessibility attributes only after the final layer closes", () => {
    document.body.innerHTML = `
      <div data-mori-app-shell="true">
        <nav data-mori-shell-region="true" aria-hidden="false"></nav>
        <section data-mori-shell-region="true"></section>
      </div>
    `
    const regions = Array.from(document.querySelectorAll<HTMLElement>('[data-mori-shell-region="true"]'))
    const releaseFirst = isolateMoriShellBackground()
    const releaseSecond = isolateMoriShellBackground()

    for (const region of regions) {
      expect(region).toHaveAttribute("aria-hidden", "true")
      expect(region).toHaveAttribute("inert")
    }
    releaseFirst()
    expect(regions[0]).toHaveAttribute("inert")
    releaseSecond()
    expect(regions[0]).toHaveAttribute("aria-hidden", "false")
    expect(regions[0]).not.toHaveAttribute("inert")
    expect(regions[1]).not.toHaveAttribute("aria-hidden")
    expect(regions[1]).not.toHaveAttribute("inert")
  })
})
