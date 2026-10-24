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
  sendTestNotification, getNotificationPermission, NotificationPermissionStatus,
  HabitReminderInfo
} from '@/lib/notifications'
import {
  getSyncConfig, saveSyncConfig, pushSyncData, pullSyncData,
  decodeTransferData, SyncConfig, SyncPayload
} from '@/lib/sync'

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

  // Sync state
  syncConfig: SyncConfig
  isSyncing: boolean
  lastSyncMessage: string | null

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

  // Data management & Sync
  exportData: () => Promise<{ habits: Habit[]; categories: Category[]; logs: HabitLog[] }>
  importData: (data: { habits: Habit[]; categories: Category[]; logs: HabitLog[] }) => Promise<void>
  pushToCloud: (customRoom?: string) => Promise<{ success: boolean; message: string }>
  pullFromCloud: (customRoom?: string) => Promise<{ success: boolean; message: string }>
  updateSyncConfig: (cfg: Partial<SyncConfig>) => void
  importFromTransfer: (encoded: string) => Promise<{ success: boolean; message: string }>
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

  // Sync state
  const [syncConfig, setSyncConfigState] = useState<SyncConfig>({ roomCode: '', autoSync: false })
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null)

  // Derive todayLogs from all logs
  const today = todayStr()
  const todayLogs = useMemo(() => {
    return logs.filter(l => l.date === today)
  }, [logs, today])

  // Helper to construct reminder info with today's completion status
  const getReminderList = useCallback((targetHabits: Habit[], targetLogs: HabitLog[]): HabitReminderInfo[] => {
    return targetHabits
      .filter(h => !h.archivedAt && h.reminderEnabled && h.reminderTime)
      .map(h => {
        const isDone = targetLogs.some(l => l.date === today && l.habitId === h.id && l.count >= h.targetCount)
        return {
          id: h.id,
          name: h.name,
          icon: h.icon,
          reminderTime: h.reminderTime,
          reminderEnabled: h.reminderEnabled,
          isCompletedToday: isDone,
        }
      })
  }, [today])

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

        // Load sync config
        const storedSync = getSyncConfig()
        setSyncConfigState(storedSync)

        // Check URL for incoming transfer payload (?importSync=... or ?syncRoom=...)
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search)
          const importSync = params.get('importSync')
          const roomParam = params.get('syncRoom')

          if (roomParam && !storedSync.roomCode) {
            const updated = { ...storedSync, roomCode: roomParam }
            saveSyncConfig(updated)
            setSyncConfigState(updated)
          }

          if (importSync) {
            const decoded = decodeTransferData(importSync)
            if (decoded && decoded.habits) {
              await importAllData(decoded.habits, decoded.categories || [], decoded.logs || [])
              const [reH, reC, reL] = await Promise.all([getAllHabits(), getAllCategories(), getAllLogs()])
              const reSorted = reH.sort((a, b) => a.order - b.order)
              setHabits(reSorted)
              setCategories(reC)
              setLogs(reL)
              setLastSyncMessage(`🎉 Data berhasil disinkronkan (${decoded.habits.length} kebiasaan)!`)
              // Clean URL
              window.history.replaceState({}, document.title, window.location.pathname)
            }
          }
        }

        // Schedule reminders if enabled
        if (notifEnabled && notificationsGranted()) {
          scheduleReminders(getReminderList(sortedHabits, allLogs))
        }
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [getReminderList])

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
        scheduleReminders(getReminderList(next, logs))
      }
      return next
    })
  }, [habits.length, settings.notificationsEnabled, getReminderList, logs])

  const updateHabit = useCallback(async (habit: Habit) => {
    await saveHabit(habit)
    setHabits(prev => {
      const next = prev.map(h => h.id === habit.id ? habit : h)
      if (settings.notificationsEnabled && notificationsGranted()) {
        scheduleReminders(getReminderList(next, logs))
      }
      return next
    })
  }, [settings.notificationsEnabled, getReminderList, logs])

  const archiveHabit = useCallback(async (id: string) => {
    const h = habits.find(x => x.id === id)
    if (!h) return
    const updated = { ...h, archivedAt: new Date().toISOString() }
    await saveHabit(updated)
    setHabits(prev => {
      const next = prev.map(x => x.id === id ? updated : x)
      if (settings.notificationsEnabled && notificationsGranted()) {
        scheduleReminders(getReminderList(next, logs))
      }
      return next
    })
  }, [habits, settings.notificationsEnabled, getReminderList, logs])

  const removeHabit = useCallback(async (id: string) => {
    await deleteHabit(id)
    setHabits(prev => {
      const next = prev.filter(h => h.id !== id)
      if (settings.notificationsEnabled && notificationsGranted()) {
        scheduleReminders(getReminderList(next, logs))
      }
      return next
    })
    setLogs(prev => prev.filter(l => l.habitId !== id))
  }, [settings.notificationsEnabled, getReminderList, logs])

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
      const next = newLog.count > 0 ? [...others, newLog] : others
      if (settings.notificationsEnabled && notificationsGranted()) {
        scheduleReminders(getReminderList(habits, next))
      }
      return next
    })
  }, [habits, logs, settings.notificationsEnabled, getReminderList])

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
      const next = newCount > 0 ? [...others, newLog] : others
      if (settings.notificationsEnabled && notificationsGranted()) {
        scheduleReminders(getReminderList(habits, next))
      }
      return next
    })
  }, [habits, logs, settings.notificationsEnabled, getReminderList])

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
        scheduleReminders(getReminderList(habits, logs))
      }
    }
  }, [settings, habits, logs, getReminderList])

  // ── Notifications ─────────────────────────────────────────────────────────────

  const enableNotifications = useCallback(async (): Promise<boolean> => {
    const result = await requestNotificationPermission()
    setNotifStatus(result)
    if (result === 'granted') {
      await updateSettings({ notificationsEnabled: true })
      scheduleReminders(getReminderList(habits, logs))
      return true
    }
    return false
  }, [habits, logs, updateSettings, getReminderList])

  const testNotification = useCallback(async (): Promise<boolean> => {
    const success = await sendTestNotification()
    setNotifStatus(getNotificationPermission())
    return success
  }, [])

  // ── Data management & Cloud Sync ─────────────────────────────────────────────

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
      scheduleReminders(getReminderList(sorted, l))
    }
  }, [settings.notificationsEnabled, getReminderList])

  const updateSyncConfig = useCallback((patch: Partial<SyncConfig>) => {
    setSyncConfigState(prev => {
      const next = { ...prev, ...patch }
      saveSyncConfig(next)
      return next
    })
  }, [])

  const pushToCloud = useCallback(async (customRoom?: string): Promise<{ success: boolean; message: string }> => {
    const room = customRoom || syncConfig.roomCode
    if (!room.trim()) {
      return { success: false, message: 'Harap buat atau masukkan Kode Sinkronisasi.' }
    }
    setIsSyncing(true)
    try {
      const [curH, curC, curL] = await Promise.all([getAllHabits(), getAllCategories(), getAllLogs()])
      const res = await pushSyncData(room, curH, curC, curL, syncConfig.firebaseProjectId)
      if (res.success) {
        const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        updateSyncConfig({ roomCode: room, lastSyncedAt: now })
      }
      setLastSyncMessage(res.message)
      return res
    } finally {
      setIsSyncing(false)
    }
  }, [syncConfig.roomCode, syncConfig.firebaseProjectId, updateSyncConfig])

  const pullFromCloud = useCallback(async (customRoom?: string): Promise<{ success: boolean; message: string }> => {
    const room = customRoom || syncConfig.roomCode
    if (!room.trim()) {
      return { success: false, message: 'Harap masukkan Kode Sinkronisasi yang sama dengan di laptop.' }
    }
    setIsSyncing(true)
    try {
      const res = await pullSyncData(room, syncConfig.firebaseProjectId)
      if (res.success && res.data) {
        await importAllData(res.data.habits || [], res.data.categories || [], res.data.logs || [])
        const [h, c, l] = await Promise.all([getAllHabits(), getAllCategories(), getAllLogs()])
        const sorted = h.sort((a, b) => a.order - b.order)
        setHabits(sorted)
        setCategories(c)
        setLogs(l)
        const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        updateSyncConfig({ roomCode: room, lastSyncedAt: now })
        if (settings.notificationsEnabled && notificationsGranted()) {
          scheduleReminders(getReminderList(sorted, l))
        }
      }
      setLastSyncMessage(res.message)
      return { success: res.success, message: res.message }
    } finally {
      setIsSyncing(false)
    }
  }, [syncConfig.roomCode, syncConfig.firebaseProjectId, updateSyncConfig, settings.notificationsEnabled, getReminderList])

  const importFromTransfer = useCallback(async (encoded: string): Promise<{ success: boolean; message: string }> => {
    const decoded = decodeTransferData(encoded)
    if (!decoded || !decoded.habits) {
      return { success: false, message: 'Format kode transfer tidak valid.' }
    }
    await importAllData(decoded.habits, decoded.categories || [], decoded.logs || [])
    const [h, c, l] = await Promise.all([getAllHabits(), getAllCategories(), getAllLogs()])
    const sorted = h.sort((a, b) => a.order - b.order)
    setHabits(sorted)
    setCategories(c)
    setLogs(l)
    if (settings.notificationsEnabled && notificationsGranted()) {
      scheduleReminders(getReminderList(sorted, l))
    }
    return { success: true, message: `Berhasil mengimpor ${decoded.habits.length} kebiasaan!` }
  }, [settings.notificationsEnabled, getReminderList])

  // ── Context value ─────────────────────────────────────────────────────────────

  const value: HabitContextValue = {
    habits, categories, logs, todayLogs, settings, isLoading,
    notificationStatus: notifStatus,
    syncConfig, isSyncing, lastSyncMessage,
    addHabit, updateHabit, archiveHabit, removeHabit, reorderHabits,
    addCategory, updateCategory, removeCategory,
    toggleHabitLog, incrementLog, getLogsForHabit, refreshLogs, refreshTodayLogs,
    updateSettings,
    enableNotifications, testNotification,
    exportData, importData,
    pushToCloud, pullFromCloud, updateSyncConfig, importFromTransfer,
  }

  return <HabitContext.Provider value={value}>{children}</HabitContext.Provider>
}
