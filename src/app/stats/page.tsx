'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, startOfWeek, endOfWeek } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area,
} from 'recharts'
import { useHabits } from '@/lib/context'
import {
  getAllLogs, getLogsInRange,
} from '@/lib/db'
import { todayStr, isHabitScheduledOn, isCompleted, calculateStreak, completionRateInRange } from '@/lib/utils'
import type { HabitLog } from '@/lib/types'
import ProgressRing from '@/components/ProgressRing'

// ── Heatmap cell ──────────────────────────────────────────────────────────────

function HeatCell({ pct, date }: { pct: number; date: string }) {
  const alpha = pct === 0 ? 0 : 0.15 + (pct / 100) * 0.85
  return (
    <div
      title={`${date}: ${pct}%`}
      className="aspect-square rounded-sm transition-all"
      style={{
        background: pct === 100
          ? `rgba(34,197,94,${alpha})`
          : pct > 0
          ? `rgba(59,99,251,${alpha})`
          : 'var(--surface-tertiary)',
      }}
    />
  )
}

// ── Main Stats Page ───────────────────────────────────────────────────────────

export default function StatsPage() {
  const { habits, categories, settings } = useHabits()
  const [allLogs, setAllLogs] = useState<HabitLog[]>([])
  const [period,  setPeriod]  = useState<'week'|'month'|'3months'>('week')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllLogs().then(l => { setAllLogs(l); setLoading(false) })
  }, [])

  const today  = new Date()
  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])

  const activeHabits = habits.filter(h => !h.archivedAt)

  // ── Period range ─────────────────────────────────────────────────────────────

  const { startDate, endDate, barDays } = useMemo(() => {
    let start: Date, end = today, days: number
    if (period === 'week')    { start = subDays(today, 6);  days = 7  }
    else if (period === 'month') { start = subDays(today, 29); days = 30 }
    else                      { start = subDays(today, 89); days = 90 }
    return { startDate: start, endDate: end, barDays: days }
  }, [period])

  const logMap = useMemo(() => {
    const map = new Map<string, HabitLog>()
    allLogs.forEach(l => map.set(l.id, l))
    return map
  }, [allLogs])

  // ── Daily chart data ──────────────────────────────────────────────────────────

  const dailyChartData = useMemo(() => {
    const days = eachDayOfInterval({ start: startDate, end: endDate })
    return days.map(d => {
      const ds   = format(d, 'yyyy-MM-dd')
      const sched = activeHabits.filter(h => isHabitScheduledOn(h, ds))
      const done  = sched.filter(h => {
        const log = logMap.get(`${h.id}_${ds}`)
        return isCompleted(log, h)
      })
      return {
        date: format(d, period === 'week' ? 'EEE' : 'd/M', { locale: localeId }),
        total: sched.length,
        done:  done.length,
        pct:   sched.length === 0 ? 0 : Math.round(done.length / sched.length * 100),
      }
    })
  }, [activeHabits, startDate, endDate, logMap, period])

  // ── Overall completion rate ────────────────────────────────────────────────────

  const overallRate = useMemo(() => {
    if (dailyChartData.length === 0) return 0
    const withHabits = dailyChartData.filter(d => d.total > 0)
    if (withHabits.length === 0) return 0
    return Math.round(withHabits.reduce((sum, d) => sum + d.pct, 0) / withHabits.length)
  }, [dailyChartData])

  // ── Streaks ───────────────────────────────────────────────────────────────────

  const streaks = useMemo(() => {
    return activeHabits.map(h => {
      const hLogs = allLogs.filter(l => l.habitId === h.id)
      return { habit: h, streak: calculateStreak(h, hLogs) }
    }).sort((a, b) => b.streak.currentStreak - a.streak.currentStreak)
  }, [activeHabits, allLogs])

  // ── Category stats ────────────────────────────────────────────────────────────

  const catStats = useMemo(() => {
    return categories.map(cat => {
      const catHabits = activeHabits.filter(h => h.categoryId === cat.id)
      if (catHabits.length === 0) return null
      const rate = catHabits.reduce((sum, h) => {
        const hLogs = allLogs.filter(l => l.habitId === h.id)
        return sum + completionRateInRange(h, hLogs, startDate, endDate)
      }, 0) / catHabits.length
      return { cat, rate: Math.round(rate), count: catHabits.length }
    }).filter(Boolean).sort((a, b) => b!.rate - a!.rate)
  }, [categories, activeHabits, allLogs, startDate, endDate])

  // ── Heatmap (last 3 months) ───────────────────────────────────────────────────

  const heatmapData = useMemo(() => {
    const start = subDays(today, 90)
    const days  = eachDayOfInterval({ start, end: today })
    return days.map(d => {
      const ds    = format(d, 'yyyy-MM-dd')
      const sched = activeHabits.filter(h => isHabitScheduledOn(h, ds))
      const done  = sched.filter(h => isCompleted(logMap.get(`${h.id}_${ds}`), h))
      return { date: ds, pct: sched.length === 0 ? 0 : Math.round(done.length / sched.length * 100) }
    })
  }, [activeHabits, logMap])

  if (loading) {
    return (
      <div className="page-container">
        <div className="skeleton h-40 mb-4" />
        <div className="skeleton h-64 mb-4" />
        <div className="skeleton h-40" />
      </div>
    )
  }

  return (
    <div className="page-container">
      <h1 className="text-2xl font-extrabold mb-1" style={{ color: 'var(--text)' }}>Statistik</h1>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>Progres & rekap kebiasaanmu</p>

      {/* ── Period selector ────────────────────────────────────────────── */}
      <div className="tab-bar mb-6">
        {(['week','month','3months'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)} className={`tab-item ${period === p ? 'active' : ''}`}>
            {p === 'week' ? '7 Hari' : p === 'month' ? '30 Hari' : '90 Hari'}
          </button>
        ))}
      </div>

      {/* ── Summary cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Rata-rata',      value: `${overallRate}%`, icon: '📈', color: '#3b63fb' },
          { label: 'Kebiasaan Aktif', value: String(activeHabits.length), icon: '⚡', color: '#d946ef' },
          { label: 'Streak Terbaik', value: String(streaks[0]?.streak.currentStreak ?? 0) + '🔥', icon: '🏆', color: '#f59e0b' },
        ].map(stat => (
          <div key={stat.label} className="glass-card p-4 text-center">
            <div className="text-2xl mb-1">{stat.icon}</div>
            <p className="text-xl font-extrabold" style={{ color: stat.color }}>{stat.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Completion Bar Chart ───────────────────────────────────────── */}
      <div className="glass-card p-4 mb-5">
        <p className="font-bold mb-4" style={{ color: 'var(--text)' }}>Penyelesaian Harian (%)</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={dailyChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v: number) => [`${v}%`, 'Selesai']}
              contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)' }}
            />
            <Bar dataKey="pct" fill="url(#barGradient)" radius={[4,4,0,0]} />
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b63fb" />
                <stop offset="100%" stopColor="#d946ef" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Area Line Chart ────────────────────────────────────────────── */}
      <div className="glass-card p-4 mb-5">
        <p className="font-bold mb-4" style={{ color: 'var(--text)' }}>Tren Progres</p>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={dailyChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3b63fb" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#3b63fb" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)' }}
              formatter={(v: number) => [`${v}%`, 'Selesai']} />
            <Area type="monotone" dataKey="pct" stroke="#3b63fb" strokeWidth={2}
              fill="url(#areaGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Category breakdown ─────────────────────────────────────────── */}
      {catStats.length > 0 && (
        <div className="glass-card p-4 mb-5">
          <p className="font-bold mb-4" style={{ color: 'var(--text)' }}>Per Kategori</p>
          <div className="flex flex-col gap-3">
            {catStats.map(s => s && (
              <div key={s.cat.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                  style={{ background: s.cat.color + '20' }}>
                  {s.cat.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{s.cat.name}</span>
                    <span className="text-sm font-bold ml-2" style={{ color: s.cat.color }}>{s.rate}%</span>
                  </div>
                  <div className="progress-bar h-1.5">
                    <div className="progress-fill h-full" style={{ width: `${s.rate}%`, background: s.cat.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Streaks ────────────────────────────────────────────────────── */}
      {streaks.length > 0 && (
        <div className="glass-card p-4 mb-5">
          <p className="font-bold mb-4" style={{ color: 'var(--text)' }}>🔥 Streak</p>
          <div className="flex flex-col gap-3">
            {streaks.slice(0, 8).map(({ habit, streak }) => (
              <div key={habit.id} className="flex items-center gap-3">
                <span className="text-xl flex-shrink-0">{habit.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{habit.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Terpanjang: {streak.longestStreak} hari
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-extrabold" style={{ color: habit.color }}>
                    {streak.currentStreak}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>hari</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Heatmap ────────────────────────────────────────────────────── */}
      <div className="glass-card p-4 mb-5">
        <p className="font-bold mb-1" style={{ color: 'var(--text)' }}>Kalender Aktivitas</p>
        <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>90 hari terakhir</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(13, 1fr)', gap: '3px' }}>
          {heatmapData.map(({ date, pct }) => (
            <HeatCell key={date} pct={pct} date={date} />
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3 justify-end">
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Kurang</span>
          {[0, 25, 50, 75, 100].map(p => (
            <div key={p} className="w-3 h-3 rounded-sm"
              style={{ background: p === 0 ? 'var(--surface-tertiary)' : `rgba(59,99,251,${0.15 + p / 100 * 0.85})` }} />
          ))}
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Banyak</span>
        </div>
      </div>

      {/* ── Per-habit detail ───────────────────────────────────────────── */}
      <div>
        <p className="section-title mb-3">Detail Per Kebiasaan</p>
        <div className="flex flex-col gap-3">
          {activeHabits.map(habit => {
            const hLogs  = allLogs.filter(l => l.habitId === habit.id)
            const rate7  = completionRateInRange(habit, hLogs, subDays(today, 6), today)
            const rate30 = completionRateInRange(habit, hLogs, subDays(today, 29), today)
            const streak = calculateStreak(habit, hLogs)
            const cat    = catMap.get(habit.categoryId)

            return (
              <div key={habit.id} className="glass-card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: habit.color + '20' }}>{habit.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{habit.name}</p>
                    {cat && <p className="text-xs" style={{ color: cat.color }}>{cat.icon} {cat.name}</p>}
                  </div>
                  <div className="flex items-center gap-1 text-orange-400 flex-shrink-0">
                    <span className="text-base streak-fire">🔥</span>
                    <span className="font-bold text-sm">{streak.currentStreak}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-3 text-center" style={{ background: 'var(--surface-tertiary)' }}>
                    <p className="text-xl font-extrabold" style={{ color: habit.color }}>{rate7}%</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>7 hari</p>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ background: 'var(--surface-tertiary)' }}>
                    <p className="text-xl font-extrabold" style={{ color: habit.color }}>{rate30}%</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>30 hari</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {activeHabits.length === 0 && (
        <div className="empty-state glass-card">
          <div className="text-5xl">📊</div>
          <p className="font-bold" style={{ color: 'var(--text)' }}>Belum ada data</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Tambahkan kebiasaan untuk mulai melacak statistik</p>
        </div>
      )}
    </div>
  )
}
