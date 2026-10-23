'use client'

import { useState, useMemo } from 'react'
import { format, parseISO, addDays, subDays } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { useHabits } from '@/lib/context'
import { todayStr, isHabitScheduledOn, getDailyStats, getWeekDates } from '@/lib/utils'
import HabitCard from '@/components/HabitCard'
import HabitForm from '@/components/HabitForm'
import ProgressRing from '@/components/ProgressRing'

export default function TodayPage() {
  const { habits, categories, todayLogs, toggleHabitLog, incrementLog,
          removeHabit, archiveHabit, settings } = useHabits()

  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [showForm, setShowForm] = useState(false)
  const [editHabit, setEditHabit] = useState<(typeof habits)[0] | null>(null)

  const isToday = selectedDate === todayStr()

  // Habits scheduled for selected date
  const scheduledHabits = useMemo(() => {
    return habits.filter(h => !h.archivedAt && isHabitScheduledOn(h, selectedDate))
  }, [habits, selectedDate])

  // Log map for the selected date
  const logMap = useMemo(() => {
    const map = new Map()
    todayLogs.forEach(l => { if (l.date === selectedDate) map.set(l.habitId, l) })
    // For past dates we'd need to load from DB — handled separately
    return map
  }, [todayLogs, selectedDate])

  const stats = useMemo(() => getDailyStats(habits, todayLogs, selectedDate), [habits, todayLogs, selectedDate])

  // Category map
  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])

  // Week dates for mini-calendar
  const weekDates = useMemo(() => getWeekDates(settings.weekStartsOnMonday), [settings.weekStartsOnMonday])

  // Navigate date
  const navDate = (dir: 1 | -1) => {
    const d = dir === 1 ? addDays(parseISO(selectedDate), 1) : subDays(parseISO(selectedDate), 1)
    const next = format(d, 'yyyy-MM-dd')
    if (next <= todayStr()) setSelectedDate(next)
  }

  const dayLabel = useMemo(() => {
    if (selectedDate === todayStr()) return 'Hari Ini'
    const diff = Math.round((parseISO(todayStr()).getTime() - parseISO(selectedDate).getTime()) / 86400000)
    if (diff === 1) return 'Kemarin'
    return format(parseISO(selectedDate), 'd MMMM', { locale: localeId })
  }, [selectedDate])

  const donePct   = stats.percentage
  const ringColor = donePct === 100 ? '#22c55e' : '#3b63fb'

  const headerBg = `linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1d2b88 100%)`

  return (
    <div className="page-container">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div
        className="rounded-3xl p-6 mb-6 text-white relative overflow-hidden"
        style={{ background: headerBg }}
      >
        {/* Decorative blobs */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #608aff, transparent)' }} />
        <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #d946ef, transparent)' }} />

        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-0.5">
                {format(parseISO(selectedDate), 'EEEE', { locale: localeId })}
              </p>
              <h1 className="text-2xl font-extrabold">{dayLabel}</h1>
              <p className="text-sm opacity-60 mt-0.5">
                {format(parseISO(selectedDate), 'd MMMM yyyy', { locale: localeId })}
              </p>
            </div>
            <ProgressRing percent={donePct} size={84} strokeWidth={7} color={ringColor} trackColor="rgba(255,255,255,0.15)">
              <div className="text-center">
                <p className="text-xl font-extrabold leading-none">{donePct}%</p>
                <p className="text-[9px] opacity-60 mt-0.5 uppercase tracking-wide">selesai</p>
              </div>
            </ProgressRing>
          </div>

          {/* Progress bar */}
          <div className="progress-bar" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <div
              className="progress-fill"
              style={{
                width: `${donePct}%`,
                background: donePct === 100
                  ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                  : 'linear-gradient(90deg, #608aff, #d946ef)',
              }}
            />
          </div>
          <p className="text-xs opacity-50 mt-2">
            {stats.completed}/{stats.total} kebiasaan selesai
          </p>
        </div>
      </div>

      {/* ── Week mini-calendar ───────────────────────────────────────────── */}
      <div className="glass-card p-3 mb-6">
        <div className="flex justify-between items-center mb-2 px-1">
          <button onClick={() => navDate(-1)} className="p-1.5 rounded-lg hover:bg-[var(--surface-tertiary)] transition-colors text-sm">
            ‹
          </button>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {format(parseISO(weekDates[0]), 'MMM yyyy', { locale: localeId })}
          </span>
          <button
            onClick={() => navDate(1)}
            disabled={selectedDate >= todayStr()}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-tertiary)] transition-colors text-sm disabled:opacity-30"
          >›</button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDates.map(d => {
            const isSelected = d === selectedDate
            const isT        = d === todayStr()
            const isFuture   = d > todayStr()
            const dayStats   = getDailyStats(habits, todayLogs, d)
            const hasSome    = dayStats.completed > 0
            const allDone    = dayStats.percentage === 100 && dayStats.total > 0

            return (
              <button
                key={d}
                onClick={() => !isFuture && setSelectedDate(d)}
                disabled={isFuture}
                className="flex flex-col items-center gap-1 py-2 px-1 rounded-2xl transition-all duration-200"
                style={isSelected
                  ? { background: 'var(--brand)', color: '#fff' }
                  : isFuture
                  ? { opacity: 0.3 }
                  : {}}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-tertiary)' }}>
                  {format(parseISO(d), 'EEE', { locale: localeId }).slice(0,2)}
                </span>
                <span className="text-sm font-bold"
                  style={{ color: isSelected ? '#fff' : isT ? 'var(--brand)' : 'var(--text)' }}>
                  {format(parseISO(d), 'd')}
                </span>
                {!isFuture && (
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    allDone ? 'bg-green-400' : hasSome ? 'bg-yellow-400' : 'opacity-0'
                  }`} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Habit list ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <p className="section-title">Kebiasaan</p>
        {isToday && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary py-1.5 px-3 text-xs"
            id="add-habit-btn"
          >+ Tambah</button>
        )}
      </div>

      {scheduledHabits.length === 0 ? (
        <div className="empty-state glass-card">
          <div className="text-5xl">🌱</div>
          <div>
            <p className="font-bold text-base" style={{ color: 'var(--text)' }}>
              {isToday ? 'Belum ada kebiasaan hari ini' : 'Tidak ada kebiasaan di hari ini'}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {isToday ? 'Tambahkan kebiasaan pertamamu!' : 'Pilih hari lain atau tambah kebiasaan baru'}
            </p>
          </div>
          {isToday && (
            <button onClick={() => setShowForm(true)} className="btn-primary mt-2">
              + Tambah Kebiasaan
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {scheduledHabits.map(habit => (
            <HabitCard
              key={habit.id}
              habit={habit}
              log={logMap.get(habit.id)}
              category={catMap.get(habit.categoryId)}
              date={selectedDate}
              onToggle={toggleHabitLog}
              onIncrement={incrementLog}
              onEdit={isToday ? (h) => { setEditHabit(h); setShowForm(true) } : undefined}
              onDelete={isToday ? (h) => removeHabit(h.id) : undefined}
              onArchive={isToday ? (h) => archiveHabit(h.id) : undefined}
              showActions={isToday}
            />
          ))}
        </div>
      )}

      {/* ── Completion celebration ───────────────────────────────────────── */}
      {donePct === 100 && stats.total > 0 && (
        <div
          className="glass-card p-5 text-center mt-6 animate-scale-in"
          style={{ background: 'linear-gradient(135deg, #064e3b22, #16a34a11)', borderColor: '#22c55e44' }}
        >
          <div className="text-4xl mb-2 streak-fire">🎉</div>
          <p className="font-bold text-green-600 dark:text-green-400">Sempurna! Semua selesai hari ini!</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Kamu luar biasa! Pertahankan momentum ini.
          </p>
        </div>
      )}

      <HabitForm
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditHabit(null) }}
        editHabit={editHabit}
      />
    </div>
  )
}
