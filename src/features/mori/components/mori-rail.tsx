import { ChevronLeft, ChevronRight, CircleHelp, FolderKanban, House, Library, Music2, Plus, Settings2, Sparkles } from "lucide-react"
import Link from "next/link"
import styles from "../mori-workspace.module.css"
import type { Project } from "../domain"

export type MoriNavigationKey = "home" | "create" | "projects" | "library" | "settings" | "help"

type MoriRailProps = {
  project: Project
  activeKey?: MoriNavigationKey
  collapsed?: boolean
  onToggle?: () => void
}

const navigation = [
  { key: "home" as const, label: "Home", href: "/", icon: House },
  { key: "create" as const, label: "Create", href: "/create", icon: Sparkles },
  { key: "projects" as const, label: "Projects", href: "/projects", icon: FolderKanban },
  { key: "library" as const, label: "Library", href: "/library", icon: Library },
]

export function MoriRail({ project, activeKey = "create", collapsed = false, onToggle }: MoriRailProps) {
  return (
    <nav className={`${styles.rail} ${collapsed ? styles.railCollapsed : ""}`} aria-label="Mori" data-rail-state={collapsed ? "collapsed" : "expanded"}>
      <div className={styles.brandRow}>
        <div className={styles.brandMark} aria-hidden="true">M</div>
        <span className={styles.brandName}>Mori</span>
        {onToggle ? <button className={styles.railToggle} type="button" onClick={onToggle} aria-expanded={!collapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <ChevronRight /> : <ChevronLeft />}</button> : null}
      </div>

      <Link className={styles.newButton} href="/create" aria-label="New creation" title={collapsed ? "New creation" : undefined}>
        <Plus size={16} strokeWidth={2.4} />
        <span>New creation</span>
      </Link>

      <div className={styles.navGroup}>
        <div className={styles.navLabel}>Workspace</div>
        {navigation.map(({ key, label, href, icon: Icon }) => (
          <Link className={`${styles.navItem} ${activeKey === key ? styles.navItemActive : ""}`} href={href} key={key} aria-current={activeKey === key ? "page" : undefined} title={collapsed ? label : undefined}>
            <Icon />
            <span>{label}</span>
          </Link>
        ))}
      </div>

      <Link className={styles.projectMini} href={`/projects/${project.projectRef}`} aria-label={`Open ${project.title} project`}>
        <div className={styles.projectMiniHeader}>
          <span className={styles.projectMiniTitle}>Current project</span>
          <span className={styles.projectMiniStatus}>Active</span>
        </div>
        <div className={styles.projectMiniCover}>
          <div className={styles.miniArtwork} aria-hidden="true"><Music2 size={16} /></div>
          <div className={styles.miniArtworkText}>
            <strong>{project.title}</strong>
            <span>{project.candidateCount} directions</span>
          </div>
        </div>
      </Link>

      <div className={styles.railBottom}>
        <Link className={styles.railFooterLink} href="/settings" aria-label="Settings" title={collapsed ? "Settings" : undefined}>
          <Settings2 size={16} />
          <span>Settings</span>
        </Link>
        <Link className={styles.railFooterLink} href="/help" aria-label="Help and feedback" title={collapsed ? "Help and feedback" : undefined}>
          <CircleHelp size={16} />
          <span>Help &amp; feedback</span>
        </Link>
      </div>
    </nav>
  )
}
