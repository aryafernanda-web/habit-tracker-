import { format, parseISO, differenceInDays, startOfWeek, endOfWeek,
         startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval,
         subDays, addDays } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import type { Habit, HabitLog, HabitStreak, DailyStats, HabitFrequency } from './types'

// ─── Date helpers ──────────────────────────────────────────────────────────────

export const todayStr = () => format(new Date(), 'yyyy-MM-dd')

export const formatDate = (dateStr: string, fmt = 'd MMM yyyy') =>
  format(parseISO(dateStr), fmt, { locale: localeId })

export const formatDay = (dateStr: string) =>
  format(parseISO(dateStr), 'EEE', { locale: localeId })

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

// ─── Frequency checks ─────────────────────────────────────────────────────────

/** Returns true if the habit should be done on `dateStr` */
export function isHabitScheduledOn(habit: Habit, dateStr: string): boolean {
  const freq: HabitFrequency = habit.frequency
  if (freq.type === 'daily') return true
  if (freq.type === 'weekly') {
    const dayOfWeek = parseISO(dateStr).getDay()
    return (freq.daysOfWeek ?? []).includes(dayOfWeek)
  }
  if (freq.type === 'custom') {
    const created = parseISO(habit.createdAt)
    const target  = parseISO(dateStr)
    const diff    = differenceInDays(target, created)
    return diff >= 0 && diff % (freq.intervalDays ?? 1) === 0
  }
  return false
}

// ─── Completion helpers ────────────────────────────────────────────────────────

export function isCompleted(log: HabitLog | undefined, habit: Habit): boolean {
  if (!log) return false
  return log.count >= habit.targetCount
}

export function completionPercent(log: HabitLog | undefined, habit: Habit): number {
  if (!log) return 0
  return Math.min(100, Math.round((log.count / habit.targetCount) * 100))
}

// ─── Streak calculation ───────────────────────────────────────────────────────

export function calculateStreak(habit: Habit, logs: HabitLog[]): HabitStreak {
  const logMap = new Map(logs.map(l => [l.date, l]))
  const today  = new Date()
  let current  = 0
  let longest  = 0
  let running  = 0
  let lastCompleted: string | undefined

  // Walk backwards from today
  let d = today
  let foundFirst = false

  for (let i = 0; i < 365; i++) {
    const dateStr = format(d, 'yyyy-MM-dd')
    if (!isHabitScheduledOn(habit, dateStr)) {
      d = subDays(d, 1)
      continue
    }
    const log  = logMap.get(dateStr)
    const done = isCompleted(log, habit)

    if (done) {
      if (!foundFirst) { lastCompleted = dateStr; foundFirst = true }
      running++
      if (i === 0 || current > 0) current = running  // keep incrementing if no break yet
    } else {
      if (!foundFirst) {
        // today not done yet — don't break streak if it's today
        if (i === 0) { d = subDays(d, 1); continue }
      }
      if (running > longest) longest = running
      if (foundFirst && running === 0) break
      running = 0
      if (i > 0 && foundFirst) break
    }
    d = subDays(d, 1)
  }

  if (running > longest) longest = running
  current = running

  return { habitId: habit.id, currentStreak: current, longestStreak: longest, lastCompletedDate: lastCompleted }
}

// ─── Completion rate ──────────────────────────────────────────────────────────

export function completionRateInRange(
  habit: Habit,
  logs: HabitLog[],
  startDate: Date,
  endDate: Date
): number {
  const days    = eachDayOfInterval({ start: startDate, end: endDate })
  const logMap  = new Map(logs.map(l => [l.date, l]))
  const scheduled = days.filter(d => isHabitScheduledOn(habit, format(d, 'yyyy-MM-dd')))
  if (scheduled.length === 0) return 0
  const completed = scheduled.filter(d => {
    const ds  = format(d, 'yyyy-MM-dd')
    const log = logMap.get(ds)
    return isCompleted(log, habit)
  })
  return Math.round((completed.length / scheduled.length) * 100)
}

// ─── Daily stats ──────────────────────────────────────────────────────────────

export function getDailyStats(
  habits: Habit[],
  logs: HabitLog[],
  dateStr: string
): DailyStats {
  const activeHabits  = habits.filter(h => !h.archivedAt && isHabitScheduledOn(h, dateStr))
  const logMap        = new Map(logs.map(l => [l.habitId, l]))
  const completed     = activeHabits.filter(h => isCompleted(logMap.get(h.id), h))
  const total         = activeHabits.length
  return {
    date: dateStr,
    total,
    completed: completed.length,
    percentage: total === 0 ? 0 : Math.round((completed.length / total) * 100),
  }
}

// ─── Weekly calendar ──────────────────────────────────────────────────────────

export function getWeekDates(weekStartsMonday = true): string[] {
  const today = new Date()
  const start = startOfWeek(today, { weekStartsOn: weekStartsMonday ? 1 : 0 })
  return eachDayOfInterval({ start, end: addDays(start, 6) }).map(d => format(d, 'yyyy-MM-dd'))
}

// ─── Export helpers ───────────────────────────────────────────────────────────

export function exportToCSV(habits: Habit[], logs: HabitLog[]): string {
  const habitMap = new Map(habits.map(h => [h.id, h.name]))
  const headers  = ['Date', 'Habit', 'Count', 'Completed', 'Note']
  const rows     = logs.map(log => [
    log.date,
    habitMap.get(log.habitId) ?? log.habitId,
    String(log.count),
    log.count > 0 ? 'Yes' : 'No',
    log.note ?? '',
  ])
  const allRows = [headers, ...rows]
  return allRows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Color helpers ─────────────────────────────────────────────────────────────

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null
}

export function colorWithOpacity(hex: string, opacity: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateHabitName(name: string): string | null {
  if (!name.trim()) return 'Nama kebiasaan tidak boleh kosong'
  if (name.trim().length < 2) return 'Nama terlalu pendek (min. 2 karakter)'
  if (name.trim().length > 100) return 'Nama terlalu panjang (max. 100 karakter)'
  return null
}
