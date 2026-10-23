'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useHabits } from '@/lib/context'

const NAV_ITEMS = [
  { href: '/',          label: 'Hari Ini', icon: '🏠' },
  { href: '/habits',    label: 'Kebiasaan', icon: '📋' },
  { href: '/stats',     label: 'Statistik', icon: '📊' },
  { href: '/settings',  label: 'Pengaturan', icon: '⚙️' },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { settings, isLoading } = useHabits()
  const pathname = usePathname()
  const router   = useRouter()
  const [mounted, setMounted] = useState(false)

  // Apply theme
  useEffect(() => {
    setMounted(true)
    const root = document.documentElement
    const { theme } = settings

    const apply = (dark: boolean) => {
      root.classList.toggle('dark', dark)
    }

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      apply(mq.matches)
      const handler = (e: MediaQueryListEvent) => apply(e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    } else {
      apply(theme === 'dark')
    }
  }, [settings.theme])

  if (!mounted || isLoading) {
    return (
      <div className="flex items-center justify-center h-dvh" style={{ background: 'var(--surface)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="text-5xl animate-pulse-soft">⚡</div>
          <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Memuat data…
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-dvh">
      <main className="flex-1">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="nav-bottom">
        {NAV_ITEMS.map(item => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href)

          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`nav-item ${isActive ? 'active' : ''}`}
              aria-label={item.label}
            >
              <span className="nav-icon-wrap text-xl">{item.icon}</span>
              {item.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
