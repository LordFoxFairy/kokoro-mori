import { AudioLines, CircleHelp, FolderKanban, House, Library, PanelLeftClose, PanelLeftOpen, Plus, Settings2, Sparkles } from "lucide-react"
import Link from "next/link"
import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react"
import type { RefObject } from "react"
import styles from "../mori-workspace.module.css"

export type MoriNavigationKey = "home" | "create" | "projects" | "library" | "settings" | "help"

type MoriRailProps = {
  activeKey?: MoriNavigationKey
  collapsed?: boolean
  projectRef?: string | null
  projectTitle?: string | null
  projectMeta?: string | null
  onNavigate?: () => void
  onOpenSettings?: (returnTo: string) => void
  onToggle?: () => void
  railRef?: RefObject<HTMLElement | null>
  toggleRef?: RefObject<HTMLButtonElement | null>
}

const navigation = [
  { key: "home" as const, label: "Home", href: "/", icon: House },
  { key: "create" as const, label: "Create", href: "/create", icon: Sparkles },
  { key: "projects" as const, label: "Projects", href: "/projects", icon: FolderKanban },
  { key: "library" as const, label: "Library", href: "/library", icon: Library },
]

export function MoriRail({ activeKey = "create", collapsed = false, projectRef, projectTitle, projectMeta, onNavigate, onOpenSettings, onToggle, railRef, toggleRef }: MoriRailProps) {
  const [settingsHref, setSettingsHref] = useState("/settings?return_to=%2F")
  const activeProjectRef = projectRef?.trim() || null
  const activeProjectTitle = projectTitle?.trim() || "Project"
  const activeProjectMeta = projectMeta?.trim() || "Open project overview"

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const currentPath = window.location.pathname
      const currentLocation = `${currentPath}${window.location.search}`
      if (currentPath !== "/settings" && currentLocation.startsWith("/")) {
        setSettingsHref(`/settings?return_to=${encodeURIComponent(currentLocation)}`)
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <nav ref={railRef} className={`${styles.rail} ${collapsed ? styles.railCollapsed : ""}`} aria-label="Mori" data-mori-shell-region="true" data-rail-state={collapsed ? "collapsed" : "expanded"}>
      <div className={styles.brandRow}>
        <Link className={styles.brandIdentity} href="/" aria-label="Mori home" onClick={onNavigate}>
          <div className={styles.brandMark} aria-hidden="true"><AudioLines size={20} strokeWidth={1.9} /></div>
          <span className={styles.brandName}>Mori</span>
        </Link>
        {onToggle ? <button ref={toggleRef} className={styles.railToggle} type="button" onClick={onToggle} aria-expanded={!collapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</button> : null}
      </div>

      <Link className={styles.newButton} href="/create" aria-label="New song" title={collapsed ? "New song" : undefined} onClick={onNavigate}>
        <Plus size={16} strokeWidth={2.4} />
        <span>New song</span>
      </Link>

      <div className={styles.navGroup}>
        <div className={styles.navLabel}>Workspace</div>
        {navigation.map(({ key, label, href, icon: Icon }) => (
          <Link className={`${styles.navItem} ${activeKey === key ? styles.navItemActive : ""}`} href={href} key={key} aria-current={activeKey === key ? "page" : undefined} title={collapsed ? label : undefined} onClick={onNavigate}>
            <Icon />
            <span>{label}</span>
          </Link>
        ))}
      </div>

      {activeProjectRef !== null ? <div className={styles.recentProjectGroup} role="group" aria-label="Recent project">
        <div className={styles.navLabel}>Recent</div>
        <Link
          className={styles.recentProjectLink}
          href={`/projects/${encodeURIComponent(activeProjectRef)}`}
          aria-label={`Open recent project ${activeProjectTitle}`}
          title={collapsed ? `${activeProjectTitle} · ${activeProjectMeta}` : undefined}
          data-project-context={collapsed ? "compact" : "recent"}
          onClick={onNavigate}
        >
          <span className={styles.recentProjectArtwork} aria-hidden="true"><AudioLines size={collapsed ? 16 : 17} /></span>
          <span className={styles.recentProjectCopy}><strong>{activeProjectTitle}</strong><span>{activeProjectMeta}</span></span>
        </Link>
      </div> : null}

      <div className={styles.railBottom}>
        <Link className={`${styles.railFooterLink} ${activeKey === "settings" ? styles.railFooterLinkActive : ""}`} href={settingsHref} aria-label="Settings" aria-current={activeKey === "settings" ? "page" : undefined} title={collapsed ? "Settings" : undefined} onClick={(event: ReactMouseEvent<HTMLAnchorElement>) => {
          if (onOpenSettings !== undefined) {
            event.preventDefault()
            event.currentTarget.focus()
            onOpenSettings(currentMoriLocation())
            return
          }
          onNavigate?.()
        }}>
          <Settings2 size={16} />
          <span>Settings</span>
        </Link>
        <Link className={`${styles.railFooterLink} ${activeKey === "help" ? styles.railFooterLinkActive : ""}`} href="/help" aria-label="Help and feedback" aria-current={activeKey === "help" ? "page" : undefined} title={collapsed ? "Help and feedback" : undefined} onClick={onNavigate}>
          <CircleHelp size={16} />
          <span>Help &amp; feedback</span>
        </Link>
      </div>
    </nav>
  )
}

function currentMoriLocation(): string {
  const currentLocation = `${window.location.pathname}${window.location.search}`
  return currentLocation.startsWith("/") && !currentLocation.startsWith("//") ? currentLocation : "/"
}
