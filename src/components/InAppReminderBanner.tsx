'use client'

import { useState, useEffect, useMemo } from 'react'
import { useHabits } from '@/lib/context'
import { todayStr } from '@/lib/utils'
import { playReminderChime } from '@/lib/notifications'

export default function InAppReminderBanner() {
  const { habits, todayLogs, toggleHabitLog } = useHabits()
  const [dismissedHabitIds, setDismissedHabitIds] = useState<string[]>([])
  const [nowMinute, setNowMinute] = useState(() => {
    const d = new Date()
    return d.getHours() * 60 + d.getMinutes()
  })

  // Update clock every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date()
      setNowMinute(d.getHours() * 60 + d.getMinutes())
    }, 30_000)
    return () => clearInterval(timer)
  }, [])

  const dueHabit = useMemo(() => {
    const today = todayStr()
    for (const h of habits) {
      if (h.archivedAt || !h.reminderEnabled || !h.reminderTime) continue
      if (dismissedHabitIds.includes(h.id)) continue

      // Check if already completed today
      const isDone = todayLogs.some((l) => l.date === today && l.habitId === h.id && l.count >= h.targetCount)
      if (isDone) continue

      const [hh, mm] = h.reminderTime.split(':').map(Number)
      if (isNaN(hh) || isNaN(mm)) continue
      const targetMin = hh * 60 + mm

      // Active window: from the target minute up to 120 minutes past
      if (nowMinute >= targetMin && nowMinute <= targetMin + 120) {
        return h
      }
    }
    return null
  }, [habits, todayLogs, dismissedHabitIds, nowMinute])

  // Play a soft reminder chime and vibrate when a new due habit appears
  useEffect(() => {
    if (dueHabit) {
      playReminderChime()
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([200, 100, 200, 100, 300])
        } catch {
          // ignore
        }
      }
    }
  }, [dueHabit])

  if (!dueHabit) return null

  const handleComplete = async () => {
    await toggleHabitLog(dueHabit.id, todayStr())
    setDismissedHabitIds((prev) => [...prev, dueHabit.id])
  }

  const handleDismiss = () => {
    setDismissedHabitIds((prev) => [...prev, dueHabit.id])
  }

  return (
    <div
      className="fixed top-3 left-4 right-4 max-w-lg mx-auto z-[999] animate-slide-down p-3.5 rounded-2xl shadow-2xl border flex items-center justify-between gap-3"
      style={{
        background: 'rgba(23, 23, 40, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderColor: 'rgba(99, 102, 241, 0.4)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 25px rgba(99, 102, 241, 0.25)',
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 animate-pulse-soft"
          style={{ background: 'rgba(99, 102, 241, 0.2)' }}
        >
          {dueHabit.icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400">
              ⏰ {dueHabit.reminderTime}
            </span>
            <p className="text-xs font-bold truncate text-white">{dueHabit.name}</p>
          </div>
          <p className="text-[11px] text-gray-300 truncate mt-0.5">
            Waktunya kebiasaan ini! Yuk selesaikan sekarang.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleComplete}
          className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-all active:scale-95 shadow-md flex items-center gap-1"
        >
          <span>✓</span>
          <span>Selesai</span>
        </button>
        <button
          onClick={handleDismiss}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs text-gray-400 hover:text-white hover:bg-white/10"
          aria-label="Tutup"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
