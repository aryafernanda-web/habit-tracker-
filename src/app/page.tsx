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
  const {
    habits, categories, logs, toggleHabitLog, incrementLog,
    removeHabit, archiveHabit, settings, notificationStatus, enableNotifications,
  } = useHabits()

  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [showForm,     setShowForm]     = useState(false)
  const [editHabit,    setEditHabit]    = useState<(typeof habits)[0] | null>(null)
  const [dismissNotifBanner, setDismissNotifBanner] = useState(false)

  const isToday = selectedDate === todayStr()

  // Habits scheduled for selected date
  const scheduledHabits = useMemo(() =>
    habits.filter(h => !h.archivedAt && isHabitScheduledOn(h, selectedDate))
  , [habits, selectedDate])

  // Log map for selected date
  const logMap = useMemo(() => {
    const map = new Map()
    logs.forEach(l => {
      if (l.date === selectedDate) map.set(l.habitId, l)
    })
    return map
  }, [logs, selectedDate])

  // Hide completed if setting says so (only for today), then sort by reminderTime
  const visibleHabits = useMemo(() => {
    let list = scheduledHabits
    if (isToday && !settings.showCompletedHabits) {
      list = list.filter(h => {
        const log = logMap.get(h.id)
        return !(log && log.count >= h.targetCount)
      })
    }
    // Sort by reminderTime ascending (habits without reminder go to bottom)
    return [...list].sort((a, b) => {
      const ta = a.reminderEnabled && a.reminderTime ? a.reminderTime : '99:99'
      const tb = b.reminderEnabled && b.reminderTime ? b.reminderTime : '99:99'
      return ta.localeCompare(tb)
    })
  }, [scheduledHabits, settings.showCompletedHabits, logMap, isToday])

  // Selected date stats
  const stats = useMemo(() => {
    const dateLogs = logs.filter(l => l.date === selectedDate)
    return getDailyStats(habits, dateLogs, selectedDate)
  }, [habits, logs, selectedDate])

  const catMap = useMemo(() =>
    new Map(categories.map(c => [c.id, c]))
  , [categories])

  const weekDates = useMemo(() =>
    getWeekDates(settings.weekStartsOnMonday)
  , [settings.weekStartsOnMonday])

  const navDate = (dir: 1 | -1) => {
    const d    = dir === 1 ? addDays(parseISO(selectedDate), 1) : subDays(parseISO(selectedDate), 1)
    const next = format(d, 'yyyy-MM-dd')
    if (next <= todayStr()) setSelectedDate(next)
  }

  const dayLabel = useMemo(() => {
    if (selectedDate === todayStr()) return 'Hari Ini'
    const diff = Math.round((parseISO(todayStr()).getTime() - parseISO(selectedDate).getTime()) / 86400000)
    if (diff === 1) return 'Kemarin'
    return format(parseISO(selectedDate), 'EEEE, d MMMM', { locale: localeId })
  }, [selectedDate])

  const donePct   = stats.percentage
  const allDone   = donePct === 100 && stats.total > 0

  return (
    <div className="page-container">

      {/* ── Notification Enable Banner for Android / PWA ───────────────── */}
      {!dismissNotifBanner && notificationStatus !== 'granted' && notificationStatus !== 'unsupported' && (
        <div
          className="mb-4 p-3.5 rounded-2xl flex items-center justify-between gap-3 animate-slide-down"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.12))',
            border: '1px solid rgba(99,102,241,0.25)',
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl flex-shrink-0">🔔</span>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate" style={{ color: 'var(--text)' }}>
                Aktifkan Pengingat Android
              </p>
              <p className="text-[11px] truncate opacity-70" style={{ color: 'var(--text-secondary)' }}>
                Dapatkan notifikasi waktu habit di HP kamu
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => enableNotifications()}
              className="text-xs font-bold px-3 py-1.5 rounded-xl text-white transition-transform active:scale-95"
              style={{ background: 'var(--brand)' }}
            >
              Izinkan
            </button>
            <button
              onClick={() => setDismissNotifBanner(true)}
              className="text-xs opacity-50 hover:opacity-100 p-1"
              aria-label="Tutup"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Hero Header ────────────────────────────────────────────────── */}
      <div
        className="rounded-3xl p-5 mb-5 text-white relative overflow-hidden shadow-lg"
        style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #3730a3 50%, #4c1d95 100%)' }}
      >
        {/* Decorative ambient lights */}
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle at center, #818cf8 0%, transparent 70%)', opacity: 0.18 }} />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle at center, #ec4899 0%, transparent 70%)', opacity: 0.15 }} />

        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-0.5">
                {format(parseISO(selectedDate), 'EEEE', { locale: localeId })}
              </p>
              <h1 className="text-2xl font-black tracking-tight">{dayLabel}</h1>
              <p className="text-xs opacity-65 mt-0.5">
                {format(parseISO(selectedDate), 'd MMMM yyyy', { locale: localeId })}
              </p>
            </div>

            <ProgressRing
              percent={donePct}
              size={80}
              strokeWidth={6}
              color={allDone ? '#10b981' : '#818cf8'}
              trackColor="rgba(255,255,255,0.15)"
            >
              <div className="text-center">
                <p className="text-xl font-black leading-none">{donePct}%</p>
                <p className="text-[8px] opacity-60 mt-0.5 uppercase tracking-wider">selesai</p>
              </div>
            </ProgressRing>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${donePct}%`,
                  background: allDone
                    ? 'linear-gradient(90deg, #10b981, #34d399)'
                    : 'linear-gradient(90deg, #818cf8, #ec4899)',
                }}
              />
            </div>
            <div className="flex justify-between items-center mt-2.5">
              <p className="text-xs opacity-65 font-medium">
                {stats.completed}/{stats.total} kebiasaan selesai
              </p>
              <button
                onClick={() => { setEditHabit(null); setShowForm(true) }}
                className="text-xs font-bold px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-all active:scale-95"
                id="add-habit-header-btn"
              >
                + Tambah Kebiasaan
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Week mini-calendar ─────────────────────────────────────────── */}
      <div className="glass-card p-3 mb-5">
        <div className="flex justify-between items-center mb-2 px-1">
          <button
            onClick={() => navDate(-1)}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold transition-colors hover:bg-[var(--surface-tertiary)]"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Hari sebelumnya"
          >‹</button>
          <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
            {format(parseISO(weekDates[0]), 'MMMM yyyy', { locale: localeId })}
          </span>
          <button
            onClick={() => navDate(1)}
            disabled={selectedDate >= todayStr()}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold transition-colors hover:bg-[var(--surface-tertiary)] disabled:opacity-20"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Hari berikutnya"
          >›</button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {weekDates.map(d => {
            const isSelected = d === selectedDate
            const isT        = d === todayStr()
            const isFuture   = d > todayStr()
            const dayLogs    = logs.filter(l => l.date === d)
            const ds         = getDailyStats(habits, dayLogs, d)
            const allDoneDay = ds.percentage === 100 && ds.total > 0
            const hasSome    = ds.completed > 0 && !allDoneDay

            return (
              <button
                key={d}
                onClick={() => !isFuture && setSelectedDate(d)}
                disabled={isFuture}
                className="flex flex-col items-center gap-1 py-2 px-1 rounded-2xl transition-all duration-200 select-none"
                style={isSelected
                  ? { background: 'linear-gradient(135deg, var(--brand), var(--brand-2))', color: '#fff', boxShadow: '0 4px 12px var(--brand-glow)' }
                  : isFuture ? { opacity: 0.25 } : {}}
              >
                <span
                  className="text-[10px] font-bold uppercase tracking-wide"
                  style={{ color: isSelected ? 'rgba(255,255,255,0.75)' : 'var(--text-tertiary)' }}
                >
                  {format(parseISO(d), 'EEE', { locale: localeId }).slice(0, 2)}
                </span>
                <span
                  className={`text-sm font-black ${isT && !isSelected ? 'underline' : ''}`}
                  style={{ color: isSelected ? '#fff' : isT ? 'var(--brand)' : 'var(--text)' }}
                >
                  {format(parseISO(d), 'd')}
                </span>
                {!isFuture && (
                  <div
                    className="w-1.5 h-1.5 rounded-full transition-colors"
                    style={{
                      background: isSelected
                        ? 'rgba(255,255,255,0.8)'
                        : allDoneDay ? '#10b981'
                        : hasSome   ? '#f59e0b'
                        : 'transparent',
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Habit list header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="section-title">
            {isToday ? 'Kebiasaan Hari Ini' : `Kebiasaan: ${dayLabel}`}
          </p>
          {!isToday && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              Kamu bisa mencentang kebiasaan hari sebelumnya
            </p>
          )}
        </div>
        <button
          onClick={() => { setEditHabit(null); setShowForm(true) }}
          className="btn-primary py-1.5 px-3.5 text-xs gap-1"
          id="add-habit-btn"
        >
          + Baru
        </button>
      </div>

      {/* ── Habit list ────────────────────────────────────────────────── */}
      {scheduledHabits.length === 0 ? (
        <div className="empty-state glass-card p-8">
          <div className="text-5xl mb-2">{isToday ? '🌱' : '📅'}</div>
          <div>
            <p className="font-bold text-base" style={{ color: 'var(--text)' }}>
              {isToday ? 'Belum ada kebiasaan' : 'Tidak ada jadwal kebiasaan'}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {isToday ? 'Tambahkan kebiasaan pertamamu sekarang!' : 'Pilih hari lain atau tambah kebiasaan baru'}
            </p>
          </div>
          {isToday && (
            <button onClick={() => setShowForm(true)} className="btn-primary mt-2">
              + Tambah Kebiasaan Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleHabits.map(habit => (
            <HabitCard
              key={habit.id}
              habit={habit}
              log={logMap.get(habit.id)}
              category={catMap.get(habit.categoryId)}
              date={selectedDate}
              onToggle={toggleHabitLog}
              onIncrement={incrementLog}
              onEdit={h => { setEditHabit(h); setShowForm(true) }}
              onDelete={h => removeHabit(h.id)}
              onArchive={h => archiveHabit(h.id)}
              showActions
            />
          ))}

          {/* Show hidden count */}
          {isToday && !settings.showCompletedHabits && visibleHabits.length < scheduledHabits.length && (
            <p className="text-center text-xs py-2 font-medium" style={{ color: 'var(--text-tertiary)' }}>
              {scheduledHabits.length - visibleHabits.length} kebiasaan sudah selesai (disembunyikan)
            </p>
          )}
        </div>
      )}

      {/* ── Completion celebration ─────────────────────────────────────── */}
      {allDone && !showForm && (
        <div
          className="glass-card p-5 text-center mt-5 animate-scale-in"
          style={{ borderColor: '#10b98155', background: 'rgba(16, 185, 129, 0.08)' }}
        >
          <div className="text-4xl mb-2 streak-fire">🎉</div>
          <p className="font-black text-base" style={{ color: '#059669' }}>
            Luar biasa! Semua kebiasaan selesai!
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Pertahankan konsistensi ini. Kamu hebat! 🔥
          </p>
        </div>
      )}

      <HabitForm
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditHabit(null) }}
        editHabit={editHabit}
        onDelete={removeHabit}
      />
    </div>
  )
}
