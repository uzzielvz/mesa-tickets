import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Mesa de Ayuda — CrediFlexi',
  description: 'Sistema interno de tickets para gestión de incidencias operativas.',
  themeColor: '#F58220',
  openGraph: {
    title: 'Mesa de Ayuda — CrediFlexi',
    description: 'Sistema interno de tickets para gestión de incidencias operativas.',
    locale: 'es_MX',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={inter.variable}>
      <body>
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  )
}
