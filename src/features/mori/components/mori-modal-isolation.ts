import { useEffect } from "react"

type AttributeSnapshot = {
  element: HTMLElement
  ariaHidden: string | null
  inert: string | null
}

type ShellIsolation = {
  count: number
  snapshots: AttributeSnapshot[]
}

const shellIsolations = new WeakMap<HTMLElement, ShellIsolation>()
let bodyLockCount = 0
let bodyOverflowBeforeLock = ""

export function useMoriModalLayer(active = true): void {
  useEffect(() => {
    if (!active) return
    const releaseBodyLock = lockMoriModalBody()
    const releaseShellIsolation = isolateMoriShellBackground()
    return () => {
      releaseShellIsolation()
      releaseBodyLock()
    }
  }, [active])
}

export function lockMoriModalBody(): () => void {
  if (bodyLockCount === 0) {
    bodyOverflowBeforeLock = document.body.style.overflow
    document.body.style.overflow = "hidden"
  }
  bodyLockCount += 1
  let released = false

  return () => {
    if (released) return
    released = true
    bodyLockCount = Math.max(0, bodyLockCount - 1)
    if (bodyLockCount === 0) document.body.style.overflow = bodyOverflowBeforeLock
  }
}

export function isolateMoriShellBackground(): () => void {
  const appShell = document.querySelector<HTMLElement>('[data-mori-app-shell="true"]')
  if (appShell === null) return () => undefined

  const existing = shellIsolations.get(appShell)
  if (existing !== undefined) {
    existing.count += 1
    return createShellRelease(appShell, existing)
  }

  const snapshots = Array.from(appShell.querySelectorAll<HTMLElement>('[data-mori-shell-region="true"]')).map((element) => ({
    element,
    ariaHidden: element.getAttribute("aria-hidden"),
    inert: element.getAttribute("inert"),
  }))
  const isolation = { count: 1, snapshots }
  shellIsolations.set(appShell, isolation)
  snapshots.forEach(({ element }) => {
    element.setAttribute("aria-hidden", "true")
    element.setAttribute("inert", "")
  })
  return createShellRelease(appShell, isolation)
}

function createShellRelease(appShell: HTMLElement, isolation: ShellIsolation): () => void {
  let released = false
  return () => {
    if (released) return
    released = true
    isolation.count -= 1
    if (isolation.count > 0) return
    isolation.snapshots.forEach(({ element, ariaHidden, inert }) => {
      if (ariaHidden === null) element.removeAttribute("aria-hidden")
      else element.setAttribute("aria-hidden", ariaHidden)
      if (inert === null) element.removeAttribute("inert")
      else element.setAttribute("inert", inert)
    })
    shellIsolations.delete(appShell)
  }
}
