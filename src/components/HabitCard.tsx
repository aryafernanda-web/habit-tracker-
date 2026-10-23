'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Habit, HabitLog, Category } from '@/lib/types'
import { isCompleted, completionPercent, colorWithOpacity } from '@/lib/utils'
import { ConfirmDialog } from './Modal'

// ── Confetti helper ──────────────────────────────────────────────────────────

function triggerConfetti(x: number, y: number, color: string) {
  if (typeof window === 'undefined') return
  const colors = [color, '#f59e0b', '#10b981', '#ec4899', '#6366f1']
  for (let i = 0; i < 10; i++) {
    const dot = document.createElement('div')
    dot.className = 'confetti-dot'
    const size = Math.random() * 9 + 5
    dot.style.cssText = `
      width:${size}px; height:${size}px;
      left:${x + (Math.random() - 0.5) * 70}px;
      top:${y + (Math.random() - 0.5) * 20}px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      animation-delay:${Math.random() * 0.15}s;
    `
    document.body.appendChild(dot)
    setTimeout(() => dot.remove(), 900)
  }
}

// ── HabitCard ─────────────────────────────────────────────────────────────────

interface HabitCardProps {
  habit: Habit
  log?: HabitLog
  category?: Category
  date: string
  onToggle: (habitId: string, date: string) => Promise<void>
  onIncrement?: (habitId: string, date: string) => Promise<void>
  onEdit?: (habit: Habit) => void
  onDelete?: (habit: Habit) => void
  onArchive?: (habit: Habit) => void
  showActions?: boolean
}

export default function HabitCard({
  habit, log, category, date,
  onToggle, onIncrement, onEdit, onDelete, onArchive,
  showActions = false,
}: HabitCardProps) {
  const [menuOpen,       setMenuOpen]       = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(false)
  const [toggling,       setToggling]       = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    // Delay so the open-click doesn't immediately close
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, [menuOpen])

  const done    = isCompleted(log, habit)
  const percent = completionPercent(log, habit)
  const bgColor = colorWithOpacity(habit.color, 0.08)
  const isMulti = habit.targetCount > 1

  const handleCheck = useCallback(async (e: React.MouseEvent) => {
    if (toggling) return
    setToggling(true)
    try {
      if (isMulti && onIncrement) {
        await onIncrement(habit.id, date)
        if (!done) triggerConfetti(e.clientX, e.clientY, habit.color)
      } else {
        await onToggle(habit.id, date)
        if (!done) triggerConfetti(e.clientX, e.clientY, habit.color)
      }
    } finally {
      setToggling(false)
    }
  }, [toggling, isMulti, onIncrement, onToggle, habit.id, habit.color, date, done])

  return (
    <>
      <div
        className="glass-card p-4 animate-fade-in transition-all duration-300"
        style={{
          borderLeft: `3px solid ${habit.color}`,
          background: done ? bgColor : undefined,
        }}
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div
            className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: habit.color + '20' }}
          >
            {habit.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3
                  className="font-bold text-sm truncate transition-all duration-300"
                  style={{
                    color: done ? habit.color : 'var(--text)',
                    textDecoration: done ? 'line-through' : 'none',
                    opacity: done ? 0.8 : 1,
                  }}
                >
                  {habit.name}
                </h3>

                {/* Meta */}
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {/* Jam Kebiasaan Prominen */}
                  {habit.reminderTime && (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg"
                      style={{
                        background: habit.reminderEnabled ? 'rgba(99,102,241,0.15)' : 'var(--surface-tertiary)',
                        color: habit.reminderEnabled ? 'var(--brand)' : 'var(--text-secondary)',
                      }}
                      title={habit.reminderEnabled ? 'Pengingat aktif' : 'Waktu kebiasaan'}
                    >
                      <span className="text-[10px]">{habit.reminderEnabled ? '🔔' : '⏰'}</span>
                      <span>{habit.reminderTime}</span>
                    </span>
                  )}

                  {category && (
                    <span
                      className="badge text-[10px]"
                      style={{ background: category.color + '20', color: category.color }}
                    >
                      {category.icon} {category.name}
                    </span>
                  )}

                  {isMulti && (
                    <span
                      className="text-[11px] font-bold px-1.5 py-0.5 rounded-md"
                      style={{
                        background: done ? habit.color + '20' : 'var(--surface-tertiary)',
                        color: done ? habit.color : 'var(--text-tertiary)',
                      }}
                    >
                      {log?.count ?? 0}/{habit.targetCount}×
                    </span>
                  )}
                </div>

                {habit.description && (
                  <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-tertiary)' }}>
                    {habit.description}
                  </p>
                )}
              </div>

              {/* Right side actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {showActions && (
                  <div className="relative" ref={menuRef}>
                    <button
                      onClick={() => setMenuOpen(v => !v)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[var(--surface-secondary)] text-base transition-colors"
                      style={{ color: 'var(--text-secondary)' }}
                      aria-label="Menu"
                    >⋯</button>
                    {menuOpen && (
                      <div
                        className="absolute right-0 top-10 z-50 rounded-2xl shadow-2xl border overflow-hidden min-w-[180px] animate-slide-down"
                        style={{ background: 'var(--surface)', borderColor: 'var(--border-solid)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
                      >
                        {onEdit && (
                          <button
                            onClick={() => { setMenuOpen(false); onEdit(habit) }}
                            className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-medium hover:bg-[var(--surface-secondary)] transition-colors text-left"
                            style={{ color: 'var(--text)' }}
                          >✏️ Edit kebiasaan</button>
                        )}
                        {onArchive && (
                          <button
                            onClick={() => { setMenuOpen(false); onArchive(habit) }}
                            className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-medium hover:bg-[var(--surface-secondary)] transition-colors text-left"
                            style={{ color: 'var(--text)' }}
                          >📦 Arsipkan</button>
                        )}
                        {onDelete && (
                          <>
                            <div style={{ height: '1px', background: 'var(--border-solid)' }} />
                            <button
                              onClick={() => { setMenuOpen(false); setConfirmDelete(true) }}
                              className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-left text-red-500"
                            >🗑 Hapus permanen</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Check button */}
                <button
                  onClick={handleCheck}
                  disabled={toggling}
                  className={`check-btn ${done ? 'done' : ''}`}
                  style={done ? { background: habit.color } : {}}
                  aria-label={done ? 'Tandai belum' : 'Tandai selesai'}
                >
                  {done
                    ? <span className="text-sm">✓</span>
                    : toggling
                    ? <span className="text-xs animate-spin">◌</span>
                    : null
                  }
                </button>
              </div>
            </div>

            {/* Progress bar for multi-target */}
            {isMulti && (
              <div className="progress-bar mt-2.5 h-1.5">
                <div
                  className="progress-fill"
                  style={{
                    width: `${percent}%`,
                    background: done
                      ? habit.color
                      : `linear-gradient(90deg, ${habit.color}aa, ${habit.color})`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* (backdrop removed — now using document mousedown listener via useEffect) */}

      {/* Delete confirm */}
      {onDelete && (
        <ConfirmDialog
          isOpen={confirmDelete}
          title="Hapus Kebiasaan?"
          message={`"${habit.name}" dan seluruh riwayatnya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
          onConfirm={() => { setConfirmDelete(false); onDelete(habit) }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}
