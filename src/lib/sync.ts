import { Habit, Category, HabitLog } from './types'

export interface SyncPayload {
  version: number
  timestamp: string
  habits: Habit[]
  categories: Category[]
  logs: HabitLog[]
}

export interface SyncConfig {
  roomCode: string
  firebaseProjectId?: string
  autoSync: boolean
  lastSyncedAt?: string
}

const STORAGE_KEY = 'habit_sync_config'

/** Read stored sync settings */
export function getSyncConfig(): SyncConfig {
  if (typeof window === 'undefined') {
    return { roomCode: '', autoSync: true }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        roomCode: parsed.roomCode || '',
        firebaseProjectId: parsed.firebaseProjectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
        autoSync: parsed.autoSync !== undefined ? parsed.autoSync : true,
        lastSyncedAt: parsed.lastSyncedAt,
      }
    }
  } catch {
    // fallback
  }
  return {
    roomCode: '',
    firebaseProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    autoSync: true,
  }
}

/** Save sync settings */
export function saveSyncConfig(cfg: SyncConfig): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
  } catch {
    // ignore
  }
}

// ─── Direct Firebase Firestore REST API (Zero NPM Dependencies) ────────────────

/** Convert plain JSON to Firestore REST API document format */
function toFirestoreFields(obj: unknown): Record<string, unknown> {
  if (obj === null || obj === undefined) return { nullValue: null }
  if (typeof obj === 'boolean') return { booleanValue: obj }
  if (typeof obj === 'number') {
    return Number.isInteger(obj) ? { integerValue: String(obj) } : { doubleValue: obj }
  }
  if (typeof obj === 'string') return { stringValue: obj }
  if (Array.isArray(obj)) {
    return { arrayValue: { values: obj.map(toFirestoreFields) } }
  }
  if (typeof obj === 'object') {
    const fields: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      fields[k] = toFirestoreFields(v)
    }
    return { mapValue: { fields } }
  }
  return { stringValue: String(obj) }
}

/** Convert Firestore REST API document to plain JSON */
function fromFirestoreFields(field: Record<string, unknown>): unknown {
  if ('nullValue' in field) return null
  if ('booleanValue' in field) return field.booleanValue
  if ('integerValue' in field) return parseInt(field.integerValue as string, 10)
  if ('doubleValue' in field) return field.doubleValue
  if ('stringValue' in field) return field.stringValue
  if ('arrayValue' in field) {
    const arr = (field.arrayValue as { values?: Record<string, unknown>[] })?.values || []
    return arr.map(fromFirestoreFields)
  }
  if ('mapValue' in field) {
    const m = (field.mapValue as { fields?: Record<string, Record<string, unknown>> })?.fields || {}
    const res: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(m)) {
      res[k] = fromFirestoreFields(v)
    }
    return res
  }
  return null
}

/** Push data to Firebase Firestore REST */
async function pushToFirestore(
  projectId: string,
  roomCode: string,
  payload: SyncPayload
): Promise<boolean> {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/(default)/documents/habit_sync/${encodeURIComponent(roomCode)}`

  // Store JSON as a stringified payload inside Firestore to avoid deep nested map limits
  const body = {
    fields: {
      jsonString: { stringValue: JSON.stringify(payload) },
      updatedAt: { stringValue: new Date().toISOString() },
    },
  }

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return res.ok
}

/** Pull data from Firebase Firestore REST */
async function pullFromFirestore(
  projectId: string,
  roomCode: string
): Promise<SyncPayload | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/(default)/documents/habit_sync/${encodeURIComponent(roomCode)}`

  const res = await fetch(url)
  if (!res.ok) return null

  const json = await res.json()
  const fields = json.fields
  if (fields?.jsonString?.stringValue) {
    return JSON.parse(fields.jsonString.stringValue) as SyncPayload
  }
  return null
}

// ─── Public Cloud Sync Methods ────────────────────────────────────────────────

/**
 * Upload local habit data to the cloud vault.
 * Uses Firebase Firestore if Project ID is set, or /api/sync endpoint.
 */
export async function pushSyncData(
  roomCode: string,
  habits: Habit[],
  categories: Category[],
  logs: HabitLog[],
  firebaseProjectId?: string
): Promise<{ success: boolean; message: string }> {
  if (!roomCode.trim()) {
    return { success: false, message: 'Masukkan Kode Sinkronisasi terlebih dahulu.' }
  }

  const payload: SyncPayload = {
    version: 1,
    timestamp: new Date().toISOString(),
    habits,
    categories,
    logs,
  }

  // 1. If Firebase Project ID is configured, use Firebase Firestore directly
  if (firebaseProjectId?.trim()) {
    try {
      const ok = await pushToFirestore(firebaseProjectId.trim(), roomCode.trim(), payload)
      if (ok) {
        return {
          success: true,
          message: `✅ Berhasil sinkron ke Firebase Firestore (Room: ${roomCode})!`,
        }
      }
    } catch (e) {
      console.warn('[Sync] Firebase push error, falling back to /api/sync:', e)
    }
  }

  // 2. Next.js /api/sync cloud relay
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: roomCode.trim(), data: payload }),
    })
    const json = await res.json()

    if (res.ok && json.success) {
      return {
        success: true,
        message: `✅ Data berhasil diunggah ke Cloud Vault (Kode: ${roomCode})!`,
      }
    }
    return {
      success: false,
      message: json.error || 'Gagal mengunggah data sinkronisasi.',
    }
  } catch (err) {
    return {
      success: false,
      message: 'Koneksi jaringan terputus saat menghubungi server sinkronisasi.',
    }
  }
}

/**
 * Download habit data from cloud vault.
 */
export async function pullSyncData(
  roomCode: string,
  firebaseProjectId?: string
): Promise<{ success: boolean; data?: SyncPayload; message: string }> {
  if (!roomCode.trim()) {
    return { success: false, message: 'Masukkan Kode Sinkronisasi terlebih dahulu.' }
  }

  // 1. Try Firebase if configured
  if (firebaseProjectId?.trim()) {
    try {
      const data = await pullFromFirestore(firebaseProjectId.trim(), roomCode.trim())
      if (data && data.habits) {
        return {
          success: true,
          data,
          message: `✅ Berhasil mengunduh data dari Firebase Firestore (${data.habits.length} kebiasaan)!`,
        }
      }
    } catch (e) {
      console.warn('[Sync] Firebase pull error, falling back to /api/sync:', e)
    }
  }

  // 2. Next.js /api/sync cloud relay
  try {
    const res = await fetch(`/api/sync?room=${encodeURIComponent(roomCode.trim())}`)
    const json = await res.json()

    if (res.ok && json.success && json.data) {
      const data = json.data as SyncPayload
      return {
        success: true,
        data,
        message: `✅ Data ditemukan di Cloud Vault (${data.habits?.length || 0} kebiasaan)!`,
      }
    }
    return {
      success: false,
      message:
        json.error || 'Data dengan kode ini belum ditemukan. Pastikan sudah klik Unggah di laptop.',
    }
  } catch {
    return {
      success: false,
      message: 'Koneksi jaringan gagal saat mengambil data sinkronisasi.',
    }
  }
}

// ─── Instant QR / Link Transfer (Zero Setup) ───────────────────────────────────

/** Encode habit data into compact base64 string */
export function encodeDataForTransfer(
  habits: Habit[],
  categories: Category[],
  logs: HabitLog[]
): string {
  try {
    const payload: SyncPayload = {
      version: 1,
      timestamp: new Date().toISOString(),
      habits,
      categories,
      logs,
    }
    const json = JSON.stringify(payload)
    return btoa(encodeURIComponent(json))
  } catch (err) {
    console.error('Failed to encode transfer data:', err)
    return ''
  }
}

/** Decode compact base64 string */
export function decodeTransferData(encoded: string): SyncPayload | null {
  try {
    const json = decodeURIComponent(atob(encoded))
    const parsed = JSON.parse(json) as SyncPayload
    if (parsed && Array.isArray(parsed.habits)) {
      return parsed
    }
  } catch (err) {
    console.error('Failed to decode transfer data:', err)
  }
  return null
}

/** Generate QR code URL using public QR generator */
export function getQRCodeUrl(text: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(text)}`
}
