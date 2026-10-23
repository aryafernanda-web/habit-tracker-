// ─── Core Types ────────────────────────────────────────────────────────────────

export type CategoryId = string

export interface Category {
  id: CategoryId
  name: string
  color: string   // hex color
  icon: string    // emoji
  isDefault: boolean
}

export type FrequencyType = 'daily' | 'weekly' | 'custom'

export interface HabitFrequency {
  type: FrequencyType
  // For 'weekly': which days of week (0=Sun, 6=Sat)
  daysOfWeek?: number[]
  // For 'custom': interval in days
  intervalDays?: number
}

export interface Habit {
  id: string
  name: string
  description?: string
  categoryId: CategoryId
  color: string          // habit accent color (hex)
  icon: string           // emoji
  frequency: HabitFrequency
  targetCount: number    // times per occurrence (default 1)
  reminderTime?: string  // HH:MM
  createdAt: string      // ISO date string
  archivedAt?: string    // ISO date string
  order: number          // sort order
}

// Record of habit completion for a specific date
export interface HabitLog {
  id: string       // `${habitId}_${dateStr}` e.g. "abc_2024-01-15"
  habitId: string
  date: string     // YYYY-MM-DD
  count: number    // how many times completed (0 = not done)
  note?: string
  completedAt?: string  // ISO timestamp of last completion
}

// Statistics helpers
export interface DailyStats {
  date: string
  total: number
  completed: number
  percentage: number
}

export interface HabitStreak {
  habitId: string
  currentStreak: number
  longestStreak: number
  lastCompletedDate?: string
}

export interface HabitStats {
  habit: Habit
  streak: HabitStreak
  completionRate7d: number   // % last 7 days
  completionRate30d: number  // % last 30 days
  totalCompleted: number
  logs: HabitLog[]
}

// App-level data export/import format
export interface AppDataExport {
  version: number
  exportedAt: string
  habits: Habit[]
  categories: Category[]
  logs: HabitLog[]
}

// Theme
export type Theme = 'light' | 'dark' | 'system'

export interface AppSettings {
  theme: Theme
  weekStartsOnMonday: boolean
  showCompletedHabits: boolean
  defaultView: 'today' | 'week'
}
