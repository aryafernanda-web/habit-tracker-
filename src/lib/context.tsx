'use client'

import React, {
  createContext, useContext, useEffect, useState, useCallback, useRef
} from 'react'
import type { Habit, Category, HabitLog, AppSettings, Theme } from '@/lib/types'
import {
  getAllHabits, saveHabit, deleteHabit,
  getAllCategories, saveCategory, deleteCategory,
  getLogsByDate, saveLog, getAllLogs, getLogsByHabit,
  getSetting, setSetting,
  ensureDefaultCategories, importAllData,
} from '@/lib/db'
import { generateId, todayStr } from '@/lib/utils'

// ─── Context type ──────────────────────────────────────────────────────────────

interface HabitContextValue {
  // State
  habits: Habit[]
  categories: Category[]
  todayLogs: HabitLog[]
  settings: AppSettings
  isLoading: boolean

  // Habit actions
  addHabit: (habit: Omit<Habit, 'id' | 'createdAt' | 'order'>) => Promise<void>
  updateHabit: (habit: Habit) => Promise<void>
  archiveHabit: (id: string) => Promise<void>
  removeHabit: (id: string) => Promise<void>
  reorderHabits: (habits: Habit[]) => Promise<void>

  // Category actions
  addCategory: (cat: Omit<Category, 'id' | 'isDefault'>) => Promise<void>
  updateCategory: (cat: Category) => Promise<void>
  removeCategory: (id: string) => Promise<void>

  // Log actions
  toggleHabitLog: (habitId: string, date: string) => Promise<void>
  incrementLog: (habitId: string, date: string) => Promise<void>
  getLogsForHabit: (habitId: string) => Promise<HabitLog[]>
  refreshTodayLogs: () => Promise<void>

  // Settings
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>

  // Data management
  exportData: () => Promise<{ habits: Habit[]; categories: Category[]; logs: HabitLog[] }>
  importData: (data: { habits: Habit[]; categories: Category[]; logs: HabitLog[] }) => Promise<void>
}

const HabitContext = createContext<HabitContextValue | null>(null)

export function useHabits(): HabitContextValue {
  const ctx = useContext(HabitContext)
  if (!ctx) throw new Error('useHabits must be used inside <HabitProvider>')
  return ctx
}

// ─── Default settings ─────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  weekStartsOnMonday: true,
  showCompletedHabits: true,
  defaultView: 'today',
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function HabitProvider({ children }: { children: React.ReactNode }) {
  const [habits,     setHabits]     = useState<Habit[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [todayLogs,  setTodayLogs]  = useState<HabitLog[]>([])
  const [settings,   setSettings]   = useState<AppSettings>(DEFAULT_SETTINGS)
  const [isLoading,  setIsLoading]  = useState(true)

  // ── Bootstrap ───────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      try {
        await ensureDefaultCategories()
        const [h, c, logs, theme, wsMon, showDone, defView] = await Promise.all([
          getAllHabits(),
          getAllCategories(),
          getLogsByDate(todayStr()),
          getSetting<Theme>('theme', 'system'),
          getSetting<boolean>('weekStartsOnMonday', true),
          getSetting<boolean>('showCompletedHabits', true),
          getSetting<'today' | 'week'>('defaultView', 'today'),
        ])
        setHabits(h.sort((a, b) => a.order - b.order))
        setCategories(c)
        setTodayLogs(logs)
        setSettings({ theme, weekStartsOnMonday: wsMon, showCompletedHabits: showDone, defaultView: defView })
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  // ── Habit CRUD ───────────────────────────────────────────────────────────────

  const addHabit = useCallback(async (data: Omit<Habit, 'id' | 'createdAt' | 'order'>) => {
    const habit: Habit = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      order: habits.length,
    }
    await saveHabit(habit)
    setHabits(prev => [...prev, habit])
  }, [habits.length])

  const updateHabit = useCallback(async (habit: Habit) => {
    await saveHabit(habit)
    setHabits(prev => prev.map(h => h.id === habit.id ? habit : h))
  }, [])

  const archiveHabit = useCallback(async (id: string) => {
    const h = habits.find(x => x.id === id)
    if (!h) return
    const updated = { ...h, archivedAt: new Date().toISOString() }
    await saveHabit(updated)
    setHabits(prev => prev.map(x => x.id === id ? updated : x))
  }, [habits])

  const removeHabit = useCallback(async (id: string) => {
    await deleteHabit(id)
    setHabits(prev => prev.filter(h => h.id !== id))
    setTodayLogs(prev => prev.filter(l => l.habitId !== id))
  }, [])

  const reorderHabits = useCallback(async (reordered: Habit[]) => {
    const updated = reordered.map((h, i) => ({ ...h, order: i }))
    setHabits(updated)
    await Promise.all(updated.map(saveHabit))
  }, [])

  // ── Category CRUD ────────────────────────────────────────────────────────────

  const addCategory = useCallback(async (data: Omit<Category, 'id' | 'isDefault'>) => {
    const cat: Category = { ...data, id: generateId(), isDefault: false }
    await saveCategory(cat)
    setCategories(prev => [...prev, cat])
  }, [])

  const updateCategory = useCallback(async (cat: Category) => {
    await saveCategory(cat)
    setCategories(prev => prev.map(c => c.id === cat.id ? cat : c))
  }, [])

  const removeCategory = useCallback(async (id: string) => {
    await deleteCategory(id)
    setCategories(prev => prev.filter(c => c.id !== id))
  }, [])

  // ── Log actions ──────────────────────────────────────────────────────────────

  const toggleHabitLog = useCallback(async (habitId: string, date: string) => {
    const habit  = habits.find(h => h.id === habitId)
    if (!habit) return

    const logId  = `${habitId}_${date}`
    const all    = await getAllLogs()
    const existing = all.find(l => l.id === logId)
    const done   = existing && existing.count >= habit.targetCount

    const log: HabitLog = {
      id: logId,
      habitId,
      date,
      count: done ? 0 : habit.targetCount,
      completedAt: done ? undefined : new Date().toISOString(),
    }
    await saveLog(log)

    if (date === todayStr()) {
      setTodayLogs(prev => {
        const others = prev.filter(l => l.id !== logId)
        return log.count > 0 ? [...others, log] : others
      })
    }
  }, [habits])

  const incrementLog = useCallback(async (habitId: string, date: string) => {
    const habit = habits.find(h => h.id === habitId)
    if (!habit) return

    const logId   = `${habitId}_${date}`
    const all     = await getAllLogs()
    const existing = all.find(l => l.id === logId)
    const newCount = Math.min((existing?.count ?? 0) + 1, habit.targetCount)

    const log: HabitLog = {
      id: logId, habitId, date,
      count: newCount,
      completedAt: newCount >= habit.targetCount ? new Date().toISOString() : existing?.completedAt,
    }
    await saveLog(log)

    if (date === todayStr()) {
      setTodayLogs(prev => {
        const others = prev.filter(l => l.id !== logId)
        return newCount > 0 ? [...others, log] : others
      })
    }
  }, [habits])

  const refreshTodayLogs = useCallback(async () => {
    const logs = await getLogsByDate(todayStr())
    setTodayLogs(logs)
  }, [])

  const getLogsForHabit = useCallback((habitId: string) => {
    return getLogsByHabit(habitId)
  }, [])

  // ── Settings ─────────────────────────────────────────────────────────────────

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    await Promise.all(
      Object.entries(patch).map(([k, v]) => setSetting(k, v))
    )
  }, [settings])

  // ── Data management ───────────────────────────────────────────────────────────

  const exportData = useCallback(async () => {
    const [h, c, l] = await Promise.all([getAllHabits(), getAllCategories(), getAllLogs()])
    return { habits: h, categories: c, logs: l }
  }, [])

  const importData = useCallback(async (data: { habits: Habit[]; categories: Category[]; logs: HabitLog[] }) => {
    await importAllData(data.habits, data.categories, data.logs)
    const today = todayStr()
    const [h, c, l] = await Promise.all([getAllHabits(), getAllCategories(), getLogsByDate(today)])
    setHabits(h.sort((a, b) => a.order - b.order))
    setCategories(c)
    setTodayLogs(l)
  }, [])

  // ── Context value ─────────────────────────────────────────────────────────────

  const value: HabitContextValue = {
    habits, categories, todayLogs, settings, isLoading,
    addHabit, updateHabit, archiveHabit, removeHabit, reorderHabits,
    addCategory, updateCategory, removeCategory,
    toggleHabitLog, incrementLog, getLogsForHabit, refreshTodayLogs,
    updateSettings,
    exportData, importData,
  }

  return <HabitContext.Provider value={value}>{children}</HabitContext.Provider>
}
