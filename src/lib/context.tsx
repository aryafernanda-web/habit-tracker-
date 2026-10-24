'use client'

import React, {
  createContext, useContext, useEffect, useState, useCallback, useMemo, useRef
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
  decodeTransferData, SyncConfig
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
  testNotification: () => Promise<{ success: boolean; message: string }>

  // Data management & Cloud Sync
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
  const [syncConfig, setSyncConfigState] = useState<SyncConfig>({ roomCode: '', autoSync: true })
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null)

  // Auto-sync refs to track timestamps & active sync locks
  const autoPushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPullingRef = useRef(false)
  const lastPushedTimestampRef = useRef<string>('')

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

  // ── Sync Settings updater ───────────────────────────────────────────────────

  const updateSyncConfig = useCallback((patch: Partial<SyncConfig>) => {
    setSyncConfigState(prev => {
      const next = { ...prev, ...patch }
      saveSyncConfig(next)
      return next
    })
  }, [])

  // ── Explicit Cloud Push / Pull ──────────────────────────────────────────────

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
        lastPushedTimestampRef.current = new Date().toISOString()
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
        lastPushedTimestampRef.current = res.data.timestamp || new Date().toISOString()
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

  // ── Debounced Auto-Push Engine ───────────────────────────────────────────────

  const triggerAutoPush = useCallback(() => {
    if (!syncConfig.roomCode || !syncConfig.autoSync) return
    if (autoPushTimer.current) clearTimeout(autoPushTimer.current)

    autoPushTimer.current = setTimeout(async () => {
      try {
        const [h, c, l] = await Promise.all([getAllHabits(), getAllCategories(), getAllLogs()])
        const res = await pushSyncData(syncConfig.roomCode, h, c, l, syncConfig.firebaseProjectId)
        if (res.success) {
          lastPushedTimestampRef.current = new Date().toISOString()
          const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
          updateSyncConfig({ lastSyncedAt: now })
        }
      } catch (err) {
        console.warn('[AutoSync] Background push error:', err)
      }
    }, 1200)
  }, [syncConfig.roomCode, syncConfig.autoSync, syncConfig.firebaseProjectId, updateSyncConfig])

  // ── Auto-Pull Engine (Background Polling & Wakeup) ───────────────────────────

  const triggerAutoPull = useCallback(async () => {
    if (!syncConfig.roomCode || !syncConfig.autoSync || isPullingRef.current || isSyncing) return
    isPullingRef.current = true
    try {
      const res = await pullSyncData(syncConfig.roomCode, syncConfig.firebaseProjectId)
      if (res.success && res.data && res.data.timestamp) {
        // If cloud data is newer than what we pushed or pulled locally
        if (res.data.timestamp > (lastPushedTimestampRef.current || '')) {
          lastPushedTimestampRef.current = res.data.timestamp
          await importAllData(res.data.habits || [], res.data.categories || [], res.data.logs || [])
          const [h, c, l] = await Promise.all([getAllHabits(), getAllCategories(), getAllLogs()])
          const sorted = h.sort((a, b) => a.order - b.order)
          setHabits(sorted)
          setCategories(c)
          setLogs(l)
          const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
          updateSyncConfig({ lastSyncedAt: now })
          if (settings.notificationsEnabled && notificationsGranted()) {
            scheduleReminders(getReminderList(sorted, l))
          }
        }
      }
    } catch {
      // Ignore background network hiccups
    } finally {
      isPullingRef.current = false
    }
  }, [syncConfig.roomCode, syncConfig.autoSync, syncConfig.firebaseProjectId, isSyncing, updateSyncConfig, settings.notificationsEnabled, getReminderList])

  // Auto-pull background timer and visibility / focus hooks
  useEffect(() => {
    if (!syncConfig.roomCode || !syncConfig.autoSync) return

    // 1. Initial pull
    triggerAutoPull()

    // 2. Interval polling every 10 seconds
    const interval = setInterval(triggerAutoPull, 10_000)

    // 3. Immediately pull whenever user switches back to the tab or unlocks phone
    const handleFocus = () => triggerAutoPull()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') triggerAutoPull()
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [syncConfig.roomCode, syncConfig.autoSync, triggerAutoPull])

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

        // Load sync config (generate friendly default code if empty)
        let storedSync = getSyncConfig()
        if (!storedSync.roomCode) {
          const generatedRoom = 'habit-' + Math.random().toString(36).substring(2, 7)
          storedSync = { ...storedSync, roomCode: generatedRoom, autoSync: true }
          saveSyncConfig(storedSync)
        }
        setSyncConfigState(storedSync)

        // Check URL for incoming transfer payload (?importSync=... or ?syncRoom=...)
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search)
          const importSync = params.get('importSync')
          const roomParam = params.get('syncRoom')

          if (roomParam) {
            const updated = { ...storedSync, roomCode: roomParam, autoSync: true }
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
    triggerAutoPush()
  }, [habits.length, settings.notificationsEnabled, getReminderList, logs, triggerAutoPush])

  const updateHabit = useCallback(async (habit: Habit) => {
    await saveHabit(habit)
    setHabits(prev => {
      const next = prev.map(h => h.id === habit.id ? habit : h)
      if (settings.notificationsEnabled && notificationsGranted()) {
        scheduleReminders(getReminderList(next, logs))
      }
      return next
    })
    triggerAutoPush()
  }, [settings.notificationsEnabled, getReminderList, logs, triggerAutoPush])

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
    triggerAutoPush()
  }, [habits, settings.notificationsEnabled, getReminderList, logs, triggerAutoPush])

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
    triggerAutoPush()
  }, [settings.notificationsEnabled, getReminderList, logs, triggerAutoPush])

  const reorderHabits = useCallback(async (reordered: Habit[]) => {
    const updated = reordered.map((h, i) => ({ ...h, order: i }))
    setHabits(updated)
    await Promise.all(updated.map(saveHabit))
    triggerAutoPush()
  }, [triggerAutoPush])

  // ── Category CRUD ────────────────────────────────────────────────────────────

  const addCategory = useCallback(async (data: Omit<Category, 'id' | 'isDefault'>) => {
    const cat: Category = { ...data, id: generateId(), isDefault: false }
    await saveCategory(cat)
    setCategories(prev => [...prev, cat])
    triggerAutoPush()
  }, [triggerAutoPush])

  const updateCategory = useCallback(async (cat: Category) => {
    await saveCategory(cat)
    setCategories(prev => prev.map(c => c.id === cat.id ? cat : c))
    triggerAutoPush()
  }, [triggerAutoPush])

  const removeCategory = useCallback(async (id: string) => {
    await deleteCategory(id)
    setCategories(prev => prev.filter(c => c.id !== id))
    triggerAutoPush()
  }, [triggerAutoPush])

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
    triggerAutoPush()
  }, [habits, logs, settings.notificationsEnabled, getReminderList, triggerAutoPush])

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
    triggerAutoPush()
  }, [habits, logs, settings.notificationsEnabled, getReminderList, triggerAutoPush])

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

  const testNotification = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    const res = await sendTestNotification()
    setNotifStatus(getNotificationPermission())
    if (res.success) {
      return {
        success: true,
        message: '✅ Notifikasi terkirim ke bilah status Android! Cek bagian atas layar HP kamu.',
      }
    } else {
      return {
        success: false,
        message: res.error || `⚠️ Gagal: Status izin notifikasi adalah ${res.permission}. Buka panduan buka blokir.`,
      }
    }
  }, [])

  // ── Data management & Transfer ───────────────────────────────────────────────

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
    triggerAutoPush()
  }, [settings.notificationsEnabled, getReminderList, triggerAutoPush])

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
    triggerAutoPush()
    return { success: true, message: `Berhasil mengimpor ${decoded.habits.length} kebiasaan!` }
  }, [settings.notificationsEnabled, getReminderList, triggerAutoPush])

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
