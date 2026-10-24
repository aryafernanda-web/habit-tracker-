/**
 * Notification utilities for PWA habit reminders.
 * Engineered specifically for Android Chrome / Samsung Internet PWA & desktop browsers.
 */

export type NotificationPermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported'

export interface NotificationDiagnostic {
  supported: boolean
  permission: NotificationPermissionStatus
  hasServiceWorker: boolean
  swState: 'active' | 'installing' | 'waiting' | 'none'
  isStandalonePWA: boolean
  isAndroid: boolean
}

/** Check if the Notification API is available in this browser */
export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

/** Current notification permission status */
export function getNotificationPermission(): NotificationPermissionStatus {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.permission as NotificationPermissionStatus
}

/** Check if permission is already granted */
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

// ─── Synthesized Audio Chime (Web Audio API) ───────────────────────────────────

export function playReminderChime(): void {
  if (typeof window === 'undefined') return
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    const ctx = new AudioContextClass()
    const now = ctx.currentTime

    // Two-tone cheerful chime (C5 = 523.25Hz -> G5 = 783.99Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(523.25, now)
    gain1.gain.setValueAtTime(0.18, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.28)

    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(783.99, now + 0.14)
    gain2.gain.setValueAtTime(0.22, now + 0.14)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.48)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.14)
    osc2.stop(now + 0.48)
  } catch {
    // Silently continue if autoplay policies restrict audio
  }
}

// ─── Service Worker Registration Helper ────────────────────────────────────────

let _cachedReg: ServiceWorkerRegistration | null = null

export async function getSWReg(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  if (_cachedReg && _cachedReg.active) return _cachedReg

  try {
    // 1. Check if active registration already exists
    const existing = await navigator.serviceWorker.getRegistration()
    if (existing && existing.active) {
      _cachedReg = existing
      return existing
    }

    // 2. Register explicitly if not found
    if (!existing) {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => null)
    }

    // 3. navigator.serviceWorker.ready is the gold standard on Android Chrome (wait up to 4s)
    const ready = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((r) => setTimeout(() => r(null), 4000)),
    ])
    if (ready) {
      _cachedReg = ready
      return ready
    }

    if (existing) {
      _cachedReg = existing
      return existing
    }
  } catch (e) {
    console.warn('[HabitNotif] SW registration error:', e)
  }
  return null
}

// ─── Notification Dispatcher ───────────────────────────────────────────────────

const ICON = '/icons/icon-192x192.png'
const BADGE = '/icons/icon-96x96.png'

export async function showNotification(
  title: string,
  body: string,
  icon = ICON
): Promise<boolean> {
  const result = await sendNotificationWithDetails(title, body, icon)
  return result.success
}

export interface NotificationResult {
  success: boolean
  permission: NotificationPermissionStatus
  step: string
  error?: string
}

export async function sendNotificationWithDetails(
  title: string,
  body: string,
  icon = ICON
): Promise<NotificationResult> {
  if (!notificationsSupported()) {
    return { success: false, permission: 'unsupported', step: 'support_check', error: 'Browser tidak mendukung Notification API.' }
  }

  // Check or request permission
  let perm = getNotificationPermission()
  if (perm !== 'granted') {
    perm = await requestNotificationPermission()
  }

  if (perm !== 'granted') {
    return {
      success: false,
      permission: perm,
      step: 'permission_check',
      error: perm === 'denied'
        ? 'Izin notifikasi diblokir di sistem Android / Chrome. Buka panduan buka blokir!'
        : 'Izin notifikasi belum disetujui (Default).',
    }
  }

  // Play audio chime for audible feedback
  playReminderChime()

  // Haptic feedback for Android
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200, 100, 200])
    } catch {
      // ignore
    }
  }

  // Resolve absolute URLs for Android notification drawer
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const resolvedIcon = icon.startsWith('http') ? icon : (origin ? `${origin}${icon}` : icon)
  const resolvedBadge = BADGE.startsWith('http') ? BADGE : (origin ? `${origin}${BADGE}` : BADGE)

  // Standard, clean options compatible with all Android Chrome versions
  const options: NotificationOptions = {
    body,
    icon: resolvedIcon,
    badge: resolvedBadge,
    tag: 'habit-reminder',
    data: { url: '/' },
  }

  // ── Strategy A: Service Worker showNotification (Mandatory on Android Chrome & Pixel)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await getSWReg()
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, options)
        return { success: true, permission: 'granted', step: 'sw_showNotification' }
      }
    } catch (swErr) {
      console.warn('[HabitNotif] SW showNotification failed, trying postMessage:', swErr)
      // Attempt postMessage fallback
      try {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            title,
            options,
          })
          return { success: true, permission: 'granted', step: 'sw_postMessage' }
        }
      } catch (pmErr) {
        console.warn('[HabitNotif] SW postMessage failed:', pmErr)
      }

      return {
        success: false,
        permission: 'granted',
        step: 'sw_showNotification',
        error: swErr instanceof Error ? swErr.message : String(swErr),
      }
    }

    // Try posting message to active controller
    try {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title,
          options,
        })
        return { success: true, permission: 'granted', step: 'sw_postMessage' }
      }
    } catch (pmErr) {
      console.warn('[HabitNotif] SW postMessage failed:', pmErr)
    }
  }

  // ── Strategy B: Web Notification constructor (Desktop Chrome, Firefox, Safari)
  try {
    if (typeof Notification !== 'undefined') {
      new Notification(title, options)
      return { success: true, permission: 'granted', step: 'desktop_notification' }
    }
  } catch (constrErr) {
    console.warn('[HabitNotif] Notification constructor failed (expected on Android Chrome):', constrErr)
    return {
      success: false,
      permission: 'granted',
      step: 'desktop_constructor',
      error: constrErr instanceof Error ? constrErr.message : String(constrErr),
    }
  }

  return { success: false, permission: 'granted', step: 'unknown', error: 'Tidak dapat mengaktifkan Service Worker.' }
}

/** Send an immediate test notification with detailed status */
export async function sendTestNotification(): Promise<NotificationResult> {
  return sendNotificationWithDetails(
    '⚡ Pengingat Habit Aktif!',
    'Notifikasi berhasil diaktifkan! Pengingat kebiasaan akan muncul di HP Pixel dan browser kamu. 💪'
  )
}

/** Check full diagnostics for notification setup */
export async function getNotificationDiagnostic(): Promise<NotificationDiagnostic> {
  const isAndroid =
    typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '')
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as unknown as { standalone?: boolean }).standalone))

  let swState: 'active' | 'installing' | 'waiting' | 'none' = 'none'
  let hasSW = false

  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        hasSW = true
        if (reg.active) swState = 'active'
        else if (reg.installing) swState = 'installing'
        else if (reg.waiting) swState = 'waiting'
      }
    } catch {
      // ignore
    }
  }

  return {
    supported: notificationsSupported(),
    permission: getNotificationPermission(),
    hasServiceWorker: hasSW,
    swState,
    isStandalonePWA: isStandalone,
    isAndroid,
  }
}

// ─── Scheduled Reminders Engine ──────────────────────────────────────────────

export interface HabitReminderInfo {
  id: string
  name: string
  icon: string
  reminderTime?: string
  reminderEnabled: boolean
  isCompletedToday?: boolean
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

/**
 * Check and fire reminders whose time has arrived or was recently reached.
 * Allows a generous 60-minute catch-up window so that phone lock / backgrounding
 * doesn't cause missed reminders when the user wakes the screen.
 */
function tick(): void {
  if (!notificationsGranted()) return
  const now = new Date()
  const curMin = now.getHours() * 60 + now.getMinutes()

  for (const h of activeHabits) {
    if (!h.reminderEnabled || !h.reminderTime) continue
    if (h.isCompletedToday) continue
    if (hasFiredToday(h.id)) continue

    const [hh, mm] = h.reminderTime.split(':').map(Number)
    if (isNaN(hh) || isNaN(mm)) continue
    const targetMin = hh * 60 + mm

    // Catch-up window: up to 60 minutes after scheduled time
    if (curMin >= targetMin && curMin <= targetMin + 60) {
      markFiredToday(h.id)
      showNotification(
        `⏰ ${h.icon} ${h.name} (${h.reminderTime})`,
        `Saatnya kebiasaan ini dilakukan! Yuk selesaikan sekarang. 💪`
      )
    }
  }
}

/** Register habits for reminders */
export function scheduleReminders(habits: HabitReminderInfo[]): void {
  activeHabits = habits.filter((h) => h.reminderEnabled && h.reminderTime)

  if (typeof window === 'undefined') return

  // Poll every 30 seconds for accuracy
  if (!pollTimer) {
    pollTimer = setInterval(tick, 30_000)
  }

  // Check immediately
  tick()

  // Catch up whenever user unlocks phone or switches back to app
  if (!visibilityBound) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') tick()
    })
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
