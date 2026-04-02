import type { Metadata, Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: { default: "Diagnosticator", template: "%s · Diagnosticator" },
  description: "Plataforma clínica de evaluaciones y diagnósticos",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Diagnosticator" },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f8f7f4",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="h-full antialiased">{children}</body>
    </html>
  )
}
