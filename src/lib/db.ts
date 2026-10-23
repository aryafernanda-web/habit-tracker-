import { openDB, DBSchema, IDBPDatabase } from 'idb'
import type { Habit, Category, HabitLog, AppSettings } from './types'

// ─── Schema ────────────────────────────────────────────────────────────────────

interface HabitTrackerDB extends DBSchema {
  habits: {
    key: string
    value: Habit
    indexes: { 'by-category': string; 'by-order': number }
  }
  categories: {
    key: string
    value: Category
  }
  logs: {
    key: string
    value: HabitLog
    indexes: { 'by-habit': string; 'by-date': string; 'by-habit-date': [string, string] }
  }
  settings: {
    key: string
    value: { key: string; value: unknown }
  }
}

// ─── Singleton DB ──────────────────────────────────────────────────────────────

let dbPromise: Promise<IDBPDatabase<HabitTrackerDB>> | null = null

function getDB(): Promise<IDBPDatabase<HabitTrackerDB>> {
  if (!dbPromise) {
    dbPromise = openDB<HabitTrackerDB>('habit-tracker-db', 1, {
      upgrade(db) {
        // habits store
        const habitStore = db.createObjectStore('habits', { keyPath: 'id' })
        habitStore.createIndex('by-category', 'categoryId')
        habitStore.createIndex('by-order', 'order')

        // categories store
        db.createObjectStore('categories', { keyPath: 'id' })

        // logs store
        const logStore = db.createObjectStore('logs', { keyPath: 'id' })
        logStore.createIndex('by-habit', 'habitId')
        logStore.createIndex('by-date', 'date')
        logStore.createIndex('by-habit-date', ['habitId', 'date'])

        // settings store
        db.createObjectStore('settings', { keyPath: 'key' })
      },
    })
  }
  return dbPromise
}

// ─── Habits ────────────────────────────────────────────────────────────────────

export async function getAllHabits(): Promise<Habit[]> {
  const db = await getDB()
  return db.getAll('habits')
}

export async function getHabit(id: string): Promise<Habit | undefined> {
  const db = await getDB()
  return db.get('habits', id)
}

export async function saveHabit(habit: Habit): Promise<void> {
  const db = await getDB()
  await db.put('habits', habit)
}

export async function deleteHabit(id: string): Promise<void> {
  const db = await getDB()
  try {
    const tx = db.transaction(['habits', 'logs'], 'readwrite')
    tx.objectStore('habits').delete(id)
    // Delete associated logs
    try {
      const logsIndex = tx.objectStore('logs').index('by-habit')
      const logs = await logsIndex.getAllKeys(id)
      for (const key of logs) {
        tx.objectStore('logs').delete(key)
      }
    } catch (e) {
      console.warn('Could not delete logs by index:', e)
    }
    await tx.done
  } catch (err) {
    console.warn('deleteHabit transaction fallback:', err)
    await db.delete('habits', id)
  }
}

// ─── Categories ────────────────────────────────────────────────────────────────

export async function getAllCategories(): Promise<Category[]> {
  const db = await getDB()
  return db.getAll('categories')
}

export async function saveCategory(category: Category): Promise<void> {
  const db = await getDB()
  await db.put('categories', category)
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('categories', id)
}

// ─── Logs ──────────────────────────────────────────────────────────────────────

export async function getLogsByDate(date: string): Promise<HabitLog[]> {
  const db = await getDB()
  const index = db.transaction('logs').store.index('by-date')
  return index.getAll(date)
}

export async function getLogsByHabit(habitId: string): Promise<HabitLog[]> {
  const db = await getDB()
  const index = db.transaction('logs').store.index('by-habit')
  return index.getAll(habitId)
}

export async function getLogsByHabitAndDate(habitId: string, date: string): Promise<HabitLog | undefined> {
  const db = await getDB()
  return db.get('logs', `${habitId}_${date}`)
}

export async function getLogsInRange(startDate: string, endDate: string): Promise<HabitLog[]> {
  const db = await getDB()
  const all = await db.getAll('logs')
  return all.filter(log => log.date >= startDate && log.date <= endDate)
}

export async function saveLog(log: HabitLog): Promise<void> {
  const db = await getDB()
  await db.put('logs', log)
}

export async function getAllLogs(): Promise<HabitLog[]> {
  const db = await getDB()
  return db.getAll('logs')
}

// ─── Settings ──────────────────────────────────────────────────────────────────

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const db = await getDB()
  const record = await db.get('settings', key)
  return record !== undefined ? (record.value as T) : defaultValue
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await getDB()
  await db.put('settings', { key, value })
}

// ─── Bulk import ───────────────────────────────────────────────────────────────

export async function importAllData(
  habits: Habit[],
  categories: Category[],
  logs: HabitLog[]
): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['habits', 'categories', 'logs'], 'readwrite')

  // Clear existing
  await tx.objectStore('habits').clear()
  await tx.objectStore('categories').clear()
  await tx.objectStore('logs').clear()

  // Insert new
  for (const h of habits) await tx.objectStore('habits').put(h)
  for (const c of categories) await tx.objectStore('categories').put(c)
  for (const l of logs) await tx.objectStore('logs').put(l)

  await tx.done
}

// ─── Seed default categories ───────────────────────────────────────────────────

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'health',       name: 'Kesehatan',     color: '#22c55e', icon: '🏃', isDefault: true },
  { id: 'learning',     name: 'Belajar',       color: '#3b82f6', icon: '📚', isDefault: true },
  { id: 'career',       name: 'Karier',        color: '#f59e0b', icon: '💼', isDefault: true },
  { id: 'productivity', name: 'Produktivitas', color: '#8b5cf6', icon: '⚡', isDefault: true },
  { id: 'finance',      name: 'Keuangan',      color: '#10b981', icon: '💰', isDefault: true },
  { id: 'other',        name: 'Lainnya',       color: '#6b7280', icon: '✨', isDefault: true },
]

export async function ensureDefaultCategories(): Promise<void> {
  const existing = await getAllCategories()
  if (existing.length === 0) {
    const db = await getDB()
    const tx = db.transaction('categories', 'readwrite')
    for (const cat of DEFAULT_CATEGORIES) {
      await tx.store.put(cat)
    }
    await tx.done
  }
}
