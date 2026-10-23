/**
 * Notification utilities for PWA habit reminders.
 * Specifically tuned for Android Chrome / PWA and desktop browsers.
 * Uses ServiceWorkerRegistration.showNotification() for Android Chrome compatibility
 * with fallback to Web Notifications API.
 */

export type NotificationPermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported'

/** Check if notifications are supported by the browser */
export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

/** Check current notification permission */
export function getNotificationPermission(): NotificationPermissionStatus {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.permission as NotificationPermissionStatus
}

/** Check if notifications are granted */
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
    console.warn('Failed to request notification permission:', err)
    return 'denied'
  }
}

/**
 * Display a notification using Service Worker if available (required by Android Chrome),
 * or native Notification constructor as fallback.
 */
export async function showNotification(
  title: string,
  body: string,
  icon = '/icons/icon-192x192.png'
): Promise<boolean> {
  if (!notificationsGranted()) return false

  const options: NotificationOptions = {
    body,
    icon,
    badge: icon,
    tag: `habit-${Date.now()}`,
    requireInteraction: false,
    silent: false,
  }

  // 1. Try Service Worker registration first (standard for Android Chrome PWA)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          ...options,
          // Vibration pattern for mobile
          vibrate: [200, 100, 200],
        } as NotificationOptions)
        return true
      }
    } catch (swErr) {
      console.warn('Service Worker showNotification fallback:', swErr)
    }
  }

  // 2. Fallback to standard window Notification constructor
  try {
    new Notification(title, options)
    return true
  } catch (nErr) {
    console.warn('Standard Notification constructor failed:', nErr)
    return false
  }
}

/** Send an immediate test notification for Android / browser verification */
export async function sendTestNotification(): Promise<boolean> {
  const perm = await requestNotificationPermission()
  if (perm !== 'granted') return false

  return showNotification(
    '⚡ Habit Tracker Berhasil Terhubung!',
    'Notifikasi aktif di perangkatmu. Pengingat kebiasaan akan muncul sesuai jadwal.',
    '/icons/icon-192x192.png'
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

let activeHabitsForReminder: HabitReminderInfo[] = []
let intervalCheckId: ReturnType<typeof setInterval> | null = null
let visibilityListenerAdded = false

function getTodayKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function hasFiredToday(habitId: string): boolean {
  if (typeof window === 'undefined') return false
  const key = `habit_notif_${habitId}_${getTodayKey()}`
  return localStorage.getItem(key) === 'true'
}

function markFiredToday(habitId: string): void {
  if (typeof window === 'undefined') return
  const key = `habit_notif_${habitId}_${getTodayKey()}`
  localStorage.setItem(key, 'true')
}

/**
 * Check if any habit reminders should fire right now.
 * Runs on periodic timer and whenever the app becomes visible.
 */
function checkAndFireReminders(): void {
  if (!notificationsGranted()) return

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  for (const h of activeHabitsForReminder) {
    if (!h.reminderEnabled || !h.reminderTime) continue
    if (hasFiredToday(h.id)) continue

    const [hh, mm] = h.reminderTime.split(':').map(Number)
    const reminderMinutes = hh * 60 + mm

    // If current time is at or within 60 minutes after the scheduled reminder time
    if (currentMinutes >= reminderMinutes && currentMinutes <= reminderMinutes + 60) {
      markFiredToday(h.id)
      showNotification(
        `⏰ Waktunya: ${h.icon} ${h.name}`,
        `Yuk tuntaskan kebiasaan ini sekarang!`
      )
    }
  }
}

/**
 * Schedule habit reminders with both background interval checking
 * and window visibility wake-up triggers.
 */
export function scheduleReminders(habits: HabitReminderInfo[]): void {
  activeHabitsForReminder = habits

  if (typeof window === 'undefined') return

  // Start periodic polling every 30 seconds
  if (!intervalCheckId) {
    intervalCheckId = setInterval(checkAndFireReminders, 30000)
  }

  // Check immediately
  checkAndFireReminders()

  // Also check whenever user switches back to the app / unlocks phone
  if (!visibilityListenerAdded && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkAndFireReminders()
      }
    })
    visibilityListenerAdded = true
  }
}

/** Clear all reminders and timers */
export function clearAllReminders(): void {
  activeHabitsForReminder = []
  if (intervalCheckId) {
    clearInterval(intervalCheckId)
    intervalCheckId = null
  }
}
