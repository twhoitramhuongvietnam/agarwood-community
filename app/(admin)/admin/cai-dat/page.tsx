import { prisma } from "@/lib/prisma"
import { SettingsForm } from "./SettingsForm"

export const revalidate = 0

export default async function AdminSettingsPage() {
  const configs = await prisma.siteConfig.findMany({ orderBy: { key: "asc" } })
  const configMap = Object.fromEntries(configs.map((c: { key: string; value: string }) => [c.key, c.value]))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-900">Cài đặt Hệ thống</h1>
      <SettingsForm configMap={configMap} />
    </div>
  )
}
