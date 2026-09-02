import { MoriCatalogShell } from "@/features/mori/components/mori-catalog-shell"
import { MoriSettingsPage } from "@/features/mori/settings-page"
import styles from "@/features/mori/mori-workspace.module.css"

export default function SettingsPage() {
  return (
    <main className={styles.catalogApp}>
      <MoriCatalogShell activeKey="settings" ariaLabel="Settings">
        <MoriSettingsPage />
      </MoriCatalogShell>
    </main>
  )
}
