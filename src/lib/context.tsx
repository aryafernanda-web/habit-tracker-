'use client'

import React, {
  createContext, useContext, useEffect, useState, useCallback, useMemo
} from 'react'
import type { Habit, Category, HabitLog, AppSettings, Theme } from '@/lib/types'
import {
  getAllHabits, saveHabit, deleteHabit,
  getAllCategories, saveCategory, deleteCategory,
  getAllLogs, saveLog, getLogsByHabit,
  getSetting, setSetting,
  ensureDefaultCategories, importAllData,
} from '@/lib/db'
import { generateId, todayStr } from '@/lib/utils'
import {
  scheduleReminders, requestNotificationPermission, notificationsGranted,
  sendTestNotification, getNotificationPermission, NotificationPermissionStatus
} from '@/lib/notifications'

// ─── Context type ──────────────────────────────────────────────────────────────

interface HabitContextValue {
  // State
  habits: Habit[]
  categories: Category[]
  logs: HabitLog[]
  todayLogs: HabitLog[]
  settings: AppSettings
  isLoading: boolean
  notificationStatus: NotificationPermissionStatus

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
  refreshLogs: () => Promise<void>
  refreshTodayLogs: () => Promise<void>

  // Settings
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>

  // Notifications
  enableNotifications: () => Promise<boolean>
  testNotification: () => Promise<boolean>

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
  notificationsEnabled: false,
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function HabitProvider({ children }: { children: React.ReactNode }) {
  const [habits,     setHabits]     = useState<Habit[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [logs,       setLogs]       = useState<HabitLog[]>([])
  const [settings,   setSettings]   = useState<AppSettings>(DEFAULT_SETTINGS)
  const [isLoading,  setIsLoading]  = useState(true)
  const [notifStatus, setNotifStatus] = useState<NotificationPermissionStatus>('default')

  // Derive todayLogs from all logs
  const today = todayStr()
  const todayLogs = useMemo(() => {
    return logs.filter(l => l.date === today)
  }, [logs, today])

  // ── Bootstrap ───────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      try {
        await ensureDefaultCategories()
        const [h, c, allLogs, theme, wsMon, showDone, defView, notifEnabled] = await Promise.all([
          getAllHabits(),
          getAllCategories(),
          getAllLogs(),
          getSetting<Theme>('theme', 'system'),
          getSetting<boolean>('weekStartsOnMonday', true),
          getSetting<boolean>('showCompletedHabits', true),
          getSetting<'today' | 'week'>('defaultView', 'today'),
          getSetting<boolean>('notificationsEnabled', false),
        ])
        const sortedHabits = h.sort((a, b) => a.order - b.order)
        setHabits(sortedHabits)
        setCategories(c)
        setLogs(allLogs)
        setSettings({ theme, weekStartsOnMonday: wsMon, showCompletedHabits: showDone, defaultView: defView, notificationsEnabled: notifEnabled })
        setNotifStatus(getNotificationPermission())

        // Schedule reminders if enabled
        if (notifEnabled && notificationsGranted()) {
          scheduleReminders(sortedHabits)
        }
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
    setHabits(prev => {
      const next = [...prev, habit]
      if (settings.notificationsEnabled && notificationsGranted()) {
        scheduleReminders(next)
      }
      return next
    })
  }, [habits.length, settings.notificationsEnabled])

  const updateHabit = useCallback(async (habit: Habit) => {
    await saveHabit(habit)
    setHabits(prev => {
      const next = prev.map(h => h.id === habit.id ? habit : h)
      if (settings.notificationsEnabled && notificationsGranted()) {
        scheduleReminders(next)
      }
      return next
    })
  }, [settings.notificationsEnabled])

  const archiveHabit = useCallback(async (id: string) => {
    const h = habits.find(x => x.id === id)
    if (!h) return
    const updated = { ...h, archivedAt: new Date().toISOString() }
    await saveHabit(updated)
    setHabits(prev => {
      const next = prev.map(x => x.id === id ? updated : x)
      if (settings.notificationsEnabled && notificationsGranted()) {
        scheduleReminders(next.filter(h => !h.archivedAt))
      }
      return next
    })
  }, [habits, settings.notificationsEnabled])

  const removeHabit = useCallback(async (id: string) => {
    await deleteHabit(id)
    setHabits(prev => {
      const next = prev.filter(h => h.id !== id)
      if (settings.notificationsEnabled && notificationsGranted()) {
        scheduleReminders(next.filter(h => !h.archivedAt))
      }
      return next
    })
    setLogs(prev => prev.filter(l => l.habitId !== id))
  }, [settings.notificationsEnabled])

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
    const habit = habits.find(h => h.id === habitId)
    if (!habit) return

    const logId = `${habitId}_${date}`
    const existing = logs.find(l => l.id === logId)
    const done = existing && existing.count >= habit.targetCount

    const newLog: HabitLog = {
      id: logId,
      habitId,
      date,
      count: done ? 0 : habit.targetCount,
      completedAt: done ? undefined : new Date().toISOString(),
    }
    await saveLog(newLog)

    setLogs(prev => {
      const others = prev.filter(l => l.id !== logId)
      return newLog.count > 0 ? [...others, newLog] : others
    })
  }, [habits, logs])

  const incrementLog = useCallback(async (habitId: string, date: string) => {
    const habit = habits.find(h => h.id === habitId)
    if (!habit) return

    const logId = `${habitId}_${date}`
    const existing = logs.find(l => l.id === logId)
    const newCount = Math.min((existing?.count ?? 0) + 1, habit.targetCount)

    const newLog: HabitLog = {
      id: logId,
      habitId,
      date,
      count: newCount,
      completedAt: newCount >= habit.targetCount ? new Date().toISOString() : existing?.completedAt,
    }
    await saveLog(newLog)

    setLogs(prev => {
      const others = prev.filter(l => l.id !== logId)
      return newCount > 0 ? [...others, newLog] : others
    })
  }, [habits, logs])

  const refreshLogs = useCallback(async () => {
    const all = await getAllLogs()
    setLogs(all)
  }, [])

  const refreshTodayLogs = useCallback(async () => {
    await refreshLogs()
  }, [refreshLogs])

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
    if ('notificationsEnabled' in patch) {
      if (patch.notificationsEnabled && notificationsGranted()) {
        scheduleReminders(habits)
      }
    }
  }, [settings, habits])

  // ── Notifications ─────────────────────────────────────────────────────────────

  const enableNotifications = useCallback(async (): Promise<boolean> => {
    const result = await requestNotificationPermission()
    setNotifStatus(result)
    if (result === 'granted') {
      await updateSettings({ notificationsEnabled: true })
      scheduleReminders(habits)
      return true
    }
    return false
  }, [habits, updateSettings])

  const testNotification = useCallback(async (): Promise<boolean> => {
    const success = await sendTestNotification()
    setNotifStatus(getNotificationPermission())
    return success
  }, [])

  // ── Data management ───────────────────────────────────────────────────────────

  const exportData = useCallback(async () => {
    const [h, c, l] = await Promise.all([getAllHabits(), getAllCategories(), getAllLogs()])
    return { habits: h, categories: c, logs: l }
  }, [])

  const importData = useCallback(async (data: { habits: Habit[]; categories: Category[]; logs: HabitLog[] }) => {
    await importAllData(data.habits, data.categories, data.logs)
    const [h, c, l] = await Promise.all([getAllHabits(), getAllCategories(), getAllLogs()])
    const sorted = h.sort((a, b) => a.order - b.order)
    setHabits(sorted)
    setCategories(c)
    setLogs(l)
    if (settings.notificationsEnabled && notificationsGranted()) {
      scheduleReminders(sorted)
    }
  }, [settings.notificationsEnabled])

  // ── Context value ─────────────────────────────────────────────────────────────

  const value: HabitContextValue = {
    habits, categories, logs, todayLogs, settings, isLoading,
    notificationStatus: notifStatus,
    addHabit, updateHabit, archiveHabit, removeHabit, reorderHabits,
    addCategory, updateCategory, removeCategory,
    toggleHabitLog, incrementLog, getLogsForHabit, refreshLogs, refreshTodayLogs,
    updateSettings,
    enableNotifications, testNotification,
    exportData, importData,
  }

  return <HabitContext.Provider value={value}>{children}</HabitContext.Provider>
}
