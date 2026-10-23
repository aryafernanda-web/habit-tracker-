'use client'

import { useState, useCallback } from 'react'
import type { Habit, HabitLog, Category } from '@/lib/types'
import { isCompleted, completionPercent, colorWithOpacity } from '@/lib/utils'
import { ConfirmDialog } from './Modal'

// ── Confetti helper ─────────────────────────────────────────────────────────────

function triggerConfetti(x: number, y: number, color: string) {
  if (typeof window === 'undefined') return
  const colors = [color, '#f59e0b', '#22c55e', '#d946ef']
  for (let i = 0; i < 8; i++) {
    const dot = document.createElement('div')
    dot.className = 'confetti-dot'
    const size = Math.random() * 8 + 4
    dot.style.cssText = `
      width: ${size}px; height: ${size}px;
      left: ${x + (Math.random() - 0.5) * 60}px;
      top: ${y}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-delay: ${Math.random() * 0.2}s;
    `
    document.body.appendChild(dot)
    setTimeout(() => dot.remove(), 900)
  }
}

// ── HabitCard ──────────────────────────────────────────────────────────────────

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
  compact?: boolean
}

export default function HabitCard({
  habit, log, category, date,
  onToggle, onIncrement, onEdit, onDelete, onArchive,
  showActions = false, compact = false,
}: HabitCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [toggling, setToggling] = useState(false)

  const done     = isCompleted(log, habit)
  const percent  = completionPercent(log, habit)
  const bgColor  = colorWithOpacity(habit.color, 0.1)
  const isMulti  = habit.targetCount > 1

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

  if (compact) {
    return (
      <div
        className="flex items-center gap-3 p-3 rounded-2xl transition-all duration-200"
        style={{ background: done ? bgColor : 'var(--surface-secondary)', border: '1px solid var(--border)' }}
      >
        <span className="text-xl">{habit.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: done ? habit.color : 'var(--text)' }}>
            {habit.name}
          </p>
        </div>
        <button
          onClick={handleCheck}
          className={`habit-check-btn ${done ? 'done' : ''}`}
          style={done ? { background: habit.color } : {}}
          disabled={toggling}
          aria-label={done ? 'Tandai belum' : 'Tandai selesai'}
        >
          {done ? '✓' : ''}
        </button>
      </div>
    )
  }

  return (
    <>
      <div
        className="glass-card p-4 animate-fade-in"
        style={{ borderLeft: `3px solid ${habit.color}` }}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className="flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center text-xl"
            style={{ background: bgColor }}
          >
            {habit.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3
                className={`font-semibold text-base truncate transition-all ${done ? 'line-through opacity-60' : ''}`}
                style={{ color: 'var(--text)' }}
              >
                {habit.name}
              </h3>

              <div className="flex items-center gap-1 flex-shrink-0">
                {showActions && (
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(v => !v)}
                      className="btn-ghost p-1.5 rounded-lg text-base"
                      aria-label="Menu"
                    >⋯</button>
                    {menuOpen && (
                      <div
                        className="absolute right-0 top-8 z-20 rounded-2xl shadow-xl border overflow-hidden min-w-[160px]"
                        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                      >
                        {onEdit && (
                          <button
                            onClick={() => { setMenuOpen(false); onEdit(habit) }}
                            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm hover:bg-[var(--surface-secondary)] transition-colors"
                          >✏️ Edit</button>
                        )}
                        {onArchive && (
                          <button
                            onClick={() => { setMenuOpen(false); onArchive(habit) }}
                            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm hover:bg-[var(--surface-secondary)] transition-colors"
                          >📦 Arsipkan</button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => { setMenuOpen(false); setConfirmDelete(true) }}
                            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                          >🗑 Hapus</button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Check button */}
                <button
                  onClick={handleCheck}
                  className={`habit-check-btn ${done ? 'done' : ''}`}
                  style={done ? { background: habit.color } : {}}
                  disabled={toggling}
                  aria-label={done ? 'Tandai belum' : 'Tandai selesai'}
                >
                  <span className={`text-sm transition-all ${toggling ? 'opacity-50' : ''}`}>
                    {done ? '✓' : ''}
                  </span>
                </button>
              </div>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {category && (
                <span
                  className="badge text-xs"
                  style={{ background: category.color + '20', color: category.color }}
                >
                  {category.icon} {category.name}
                </span>
              )}
              {isMulti && (
                <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                  {log?.count ?? 0}/{habit.targetCount}×
                </span>
              )}
            </div>

            {/* Description */}
            {habit.description && (
              <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-tertiary)' }}>
                {habit.description}
              </p>
            )}

            {/* Progress bar (for multi-target) */}
            {isMulti && (
              <div className="progress-bar mt-2.5">
                <div
                  className="progress-fill"
                  style={{
                    width: `${percent}%`,
                    background: done ? habit.color : `linear-gradient(90deg, ${habit.color}, ${habit.color}99)`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Backdrop for menu */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Delete confirm */}
      {onDelete && (
        <ConfirmDialog
          isOpen={confirmDelete}
          title="Hapus Kebiasaan?"
          message={`Kebiasaan "${habit.name}" dan seluruh riwayatnya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
          onConfirm={() => { setConfirmDelete(false); onDelete(habit) }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}
