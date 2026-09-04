import { CircleHelp, FolderKanban, House, Library, PanelLeftClose, PanelLeftOpen, Plus, Settings2, Sparkles } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import styles from "../mori-workspace.module.css"

export type MoriNavigationKey = "home" | "create" | "projects" | "library" | "settings" | "help"

type MoriRailProps = {
  activeKey?: MoriNavigationKey
  collapsed?: boolean
  projectRef?: string | null
  onNavigate?: () => void
  onToggle?: () => void
}

const navigation = [
  { key: "home" as const, label: "Home", href: "/", icon: House },
  { key: "create" as const, label: "Create", href: "/create", icon: Sparkles },
  { key: "projects" as const, label: "Projects", href: "/projects", icon: FolderKanban },
  { key: "library" as const, label: "Library", href: "/library", icon: Library },
]

export function MoriRail({ activeKey = "create", collapsed = false, projectRef, onNavigate, onToggle }: MoriRailProps) {
  const [settingsHref, setSettingsHref] = useState("/settings?return_to=%2F")
  const [createHref, setCreateHref] = useState("/create")

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const currentPath = window.location.pathname
      const currentLocation = `${currentPath}${window.location.search}`
      const pathProjectRef = currentPath.match(/^\/projects\/([^/]+)/u)?.[1]
      const queryProjectRef = new URLSearchParams(window.location.search).get("project_ref")
      const activeProjectRef = projectRef === undefined ? pathProjectRef ?? queryProjectRef ?? undefined : projectRef ?? undefined
      if (currentPath !== "/settings" && currentLocation.startsWith("/")) {
        setSettingsHref(`/settings?return_to=${encodeURIComponent(currentLocation)}`)
      }
      setCreateHref(activeProjectRef === undefined ? "/create" : `/create?project_ref=${encodeURIComponent(activeProjectRef)}`)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [projectRef])

  return (
    <nav className={`${styles.rail} ${collapsed ? styles.railCollapsed : ""}`} aria-label="Mori" data-rail-state={collapsed ? "collapsed" : "expanded"}>
      <div className={styles.brandRow}>
        <Link className={styles.brandIdentity} href="/" aria-label="Mori home" onClick={onNavigate}>
          <div className={styles.brandMark} aria-hidden="true">M</div>
          <span className={styles.brandName}>Mori</span>
        </Link>
        {onToggle ? <button className={styles.railToggle} type="button" onClick={onToggle} aria-expanded={!collapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</button> : null}
      </div>

      <Link className={styles.newButton} href={createHref} aria-label="New creation" title={collapsed ? "New creation" : undefined} onClick={onNavigate}>
        <Plus size={16} strokeWidth={2.4} />
        <span>New creation</span>
      </Link>

      <div className={styles.navGroup}>
        <div className={styles.navLabel}>Workspace</div>
        {navigation.map(({ key, label, href, icon: Icon }) => (
          <Link className={`${styles.navItem} ${activeKey === key ? styles.navItemActive : ""}`} href={key === "create" ? createHref : href} key={key} aria-current={activeKey === key ? "page" : undefined} title={collapsed ? label : undefined} onClick={onNavigate}>
            <Icon />
            <span>{label}</span>
          </Link>
        ))}
      </div>

      <div className={styles.railBottom}>
        <Link className={`${styles.railFooterLink} ${activeKey === "settings" ? styles.railFooterLinkActive : ""}`} href={settingsHref} aria-label="Settings" aria-current={activeKey === "settings" ? "page" : undefined} title={collapsed ? "Settings" : undefined} onClick={onNavigate}>
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
