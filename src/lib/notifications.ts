/**
 * Notification utilities for PWA habit reminders.
 * Tuned for Android Chrome / Samsung Internet PWA and desktop browsers.
 *
 * Strategy:
 *  1. Try ServiceWorkerRegistration.showNotification() — required for Android Chrome PWA
 *  2. Fallback: try navigator.serviceWorker.ready with timeout
 *  3. Last resort: new Notification() constructor (works on desktop, limited on Android)
 */

export type NotificationPermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported'

/** Check if the Notification API is available */
export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

/** Current notification permission */
export function getNotificationPermission(): NotificationPermissionStatus {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.permission as NotificationPermissionStatus
}

/** True if permission is already granted */
export function notificationsGranted(): boolean {
  return notificationsSupported() && Notification.permission === 'granted'
}

/** Request browser notification permission */
export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (!notificationsSupported()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  try {
    const result = await Notification.requestPermission()
    return result as NotificationPermissionStatus
  } catch (err) {
    console.warn('[HabitNotif] Permission request failed:', err)
    return 'denied'
  }
}

// ─── Service Worker helper ─────────────────────────────────────────────────

let _cachedReg: ServiceWorkerRegistration | null = null

/** Get or register service worker, with a timeout so we never hang forever */
async function getSWReg(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  if (_cachedReg) return _cachedReg

  try {
    // 1. Try already-registered
    const existing = await navigator.serviceWorker.getRegistration('/')
    if (existing) { _cachedReg = existing; return existing }

    // 2. Register explicitly
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => null)
    if (reg) { _cachedReg = reg; return reg }

    // 3. Wait for `ready` with 2s timeout
    const readyRace = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>(r => setTimeout(() => r(null), 2000)),
    ])
    if (readyRace) { _cachedReg = readyRace as ServiceWorkerRegistration; return _cachedReg }
  } catch (e) {
    console.warn('[HabitNotif] SW registration error:', e)
  }
  return null
}

// ─── Show notification ─────────────────────────────────────────────────────

const ICON = '/icons/icon-192x192.png'

export async function showNotification(
  title: string,
  body: string,
  icon = ICON
): Promise<boolean> {
  if (!notificationsGranted()) return false

  const opts: NotificationOptions = {
    body,
    icon,
    badge: icon,
    tag: `habit-reminder-${Date.now()}`,
    requireInteraction: false,
    silent: false,
    // vibrate is valid on Android via SW — cast through any
    ...(({ vibrate: [200, 100, 200] }) as Record<string, unknown>),
  }

  // ── Path 1: SW showNotification (Android Chrome, Samsung Internet) ────────
  if ('serviceWorker' in navigator) {
    try {
      const reg = await getSWReg()
      if (reg?.showNotification) {
        await reg.showNotification(title, {
          body,
          icon,
          badge: icon,
          tag: `habit-reminder-${Date.now()}`,
          requireInteraction: false,
          silent: false,
        } as NotificationOptions)
        return true
      }
    } catch (swErr) {
      console.warn('[HabitNotif] SW showNotification failed, trying constructor:', swErr)
    }
  }

  // ── Path 2: Web Notification constructor (desktop / iOS Safari 16.4+) ───
  try {
    if (typeof Notification !== 'undefined') {
      new Notification(title, opts)
      return true
    }
  } catch (e) {
    console.warn('[HabitNotif] Notification constructor failed:', e)
  }

  return false
}

/** Send a test notification immediately after permission is granted */
export async function sendTestNotification(): Promise<boolean> {
  const perm = await requestNotificationPermission()
  if (perm !== 'granted') return false
  return showNotification(
    '✅ Pengingat Habit Aktif!',
    'Notifikasi berhasil! Kamu akan diingatkan sesuai jadwal kebiasaan.',
    ICON
  )
}

// ─── Scheduled Reminders Engine ──────────────────────────────────────────────

interface HabitReminderInfo {
  id: string
  name: string
  icon: string
  reminderTime?: string
  reminderEnabled: boolean
}

let activeHabits: HabitReminderInfo[] = []
let pollTimer: ReturnType<typeof setInterval> | null = null
let visibilityBound = false

function todayKey(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

function hasFiredToday(id: string): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(`hn_${id}_${todayKey()}`) === '1'
}

function markFiredToday(id: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(`hn_${id}_${todayKey()}`, '1')
}

/** Fire any reminders whose time window we're in right now */
function tick(): void {
  if (!notificationsGranted()) return
  const now = new Date()
  const curMin = now.getHours() * 60 + now.getMinutes()

  for (const h of activeHabits) {
    if (!h.reminderEnabled || !h.reminderTime) continue
    if (hasFiredToday(h.id)) continue

    const [hh, mm] = h.reminderTime.split(':').map(Number)
    const targetMin = hh * 60 + mm

    // Fire within a 5-minute window (wider than before for reliability)
    if (curMin >= targetMin && curMin <= targetMin + 5) {
      markFiredToday(h.id)
      showNotification(
        `⏰ ${h.icon} ${h.name}`,
        `Saatnya melakukan kebiasaan ini! Jangan sampai terlewat. 💪`
      )
    }
  }
}

/** Register habits for reminders. Call whenever habits list changes. */
export function scheduleReminders(habits: HabitReminderInfo[]): void {
  activeHabits = habits.filter(h => h.reminderEnabled && h.reminderTime)

  if (typeof window === 'undefined') return

  // Poll every 60 seconds
  if (!pollTimer) {
    pollTimer = setInterval(tick, 60_000)
  }

  // Check immediately (e.g. if we just opened the app)
  tick()

  // Also check when user returns to app
  if (!visibilityBound) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') tick()
    })
    // Also on page focus (works when switching tabs)
    window.addEventListener('focus', tick)
    visibilityBound = true
  }
}

/** Stop all reminder polling */
export function clearAllReminders(): void {
  activeHabits = []
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}
