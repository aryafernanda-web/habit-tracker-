import type { Metadata, Viewport } from 'next'
import './globals.css'
import { HabitProvider } from '@/lib/context'
import AppShell from '@/components/AppShell'

export const metadata: Metadata = {
  title: 'Habit Tracker – Bangun Kebiasaan Terbaikmu',
  description: 'Aplikasi habit tracker modern berbasis PWA. Lacak kebiasaan harian, lihat statistik progres, dan capai target hidupmu.',
  keywords: ['habit tracker', 'kebiasaan', 'produktivitas', 'daily habits', 'pwa'],
  authors: [{ name: 'Habit Tracker App' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Habit Tracker',
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: 'Habit Tracker',
    description: 'Bangun kebiasaan positif setiap hari',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)',  color: '#0f172a' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <HabitProvider>
          <AppShell>{children}</AppShell>
        </HabitProvider>
      </body>
    </html>
  )
}
