import { MoriCatalogShell } from "@/features/mori/components/mori-catalog-shell"
import { MoriSettingsPage } from "@/features/mori/settings-page"
import styles from "@/features/mori/mori-workspace.module.css"

type SettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function SettingsPage({ searchParams }: SettingsPageProps = {}) {
  const params = searchParams === undefined ? {} : await searchParams
  const returnTo = normalizeReturnTo(params.return_to)

  return (
    <main className={styles.catalogApp}>
      <MoriCatalogShell activeKey="settings" ariaLabel="Settings">
        <div aria-hidden="true" />
      </MoriCatalogShell>
      <MoriSettingsPage returnTo={returnTo} />
    </main>
  )
}

function normalizeReturnTo(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value
  if (candidate === undefined || !candidate.startsWith("/") || candidate.startsWith("//")) return "/"
  return candidate
}
