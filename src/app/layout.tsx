import type { Metadata } from "next"
import "./globals.css"
import { MoriAppProvider } from "@/features/mori/components/mori-app-provider"

export const metadata: Metadata = {
  title: "Mori — Make something you can feel",
  description: "A calm, tactile workspace for turning musical ideas into finished pieces.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><MoriAppProvider>{children}</MoriAppProvider></body>
    </html>
  )
}
