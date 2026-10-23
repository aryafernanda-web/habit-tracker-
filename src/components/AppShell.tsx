'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useHabits } from '@/lib/context'

const NAV_ITEMS = [
  { href: '/',          label: 'Hari Ini', icon: '🏠' },
  { href: '/habits',    label: 'Habit',    icon: '📋' },
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
    const apply = (dark: boolean) => root.classList.toggle('dark', dark)

    if (settings.theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      apply(mq.matches)
      const handler = (e: MediaQueryListEvent) => apply(e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    } else {
      apply(settings.theme === 'dark')
    }
  }, [settings.theme])

  // Register Service Worker for Android PWA notifications
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('PWA service worker registration notice:', err)
      })
    }
  }, [])

  if (!mounted || isLoading) {
    return (
      <div className="flex items-center justify-center h-dvh" style={{ background: 'var(--surface)' }}>
        <div className="flex flex-col items-center gap-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
            style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-2))' }}
          >
            ⚡
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full animate-pulse"
                style={{
                  background: 'var(--brand)',
                  animationDelay: `${i * 0.2}s`,
                  opacity: 0.7,
                }}
              />
            ))}
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
