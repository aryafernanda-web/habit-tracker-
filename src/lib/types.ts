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
  daysOfWeek?: number[]   // For 'weekly': 0=Sun, 6=Sat
  intervalDays?: number   // For 'custom': interval in days
}

export interface Habit {
  id: string
  name: string
  description?: string
  categoryId: CategoryId
  color: string          // hex
  icon: string           // emoji
  frequency: HabitFrequency
  targetCount: number    // times per occurrence (default 1)
  reminderTime?: string  // HH:MM — e.g. "07:30"
  reminderEnabled: boolean
  createdAt: string      // ISO
  archivedAt?: string    // ISO
  order: number
}

// Record of habit completion for a specific date
export interface HabitLog {
  id: string       // `${habitId}_${dateStr}`
  habitId: string
  date: string     // YYYY-MM-DD
  count: number
  note?: string
  completedAt?: string  // ISO
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
  completionRate7d: number
  completionRate30d: number
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
  notificationsEnabled: boolean
}
