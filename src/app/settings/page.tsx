'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useHabits } from '@/lib/context'
import { exportToCSV, downloadFile, formatDate } from '@/lib/utils'
import type { AppDataExport, Theme } from '@/lib/types'
import Modal, { ConfirmDialog } from '@/components/Modal'
import { importAllData } from '@/lib/db'
import { encodeDataForTransfer, getQRCodeUrl } from '@/lib/sync'
import { getNotificationDiagnostic, NotificationDiagnostic, playReminderChime } from '@/lib/notifications'
import UnblockNotifModal from '@/components/UnblockNotifModal'

type SettingSection = 'sync' | 'notifications' | 'appearance' | 'data' | 'about'

export default function SettingsPage() {
  const {
    settings, updateSettings, exportData, importData, habits, categories, logs,
    notificationStatus, enableNotifications, testNotification,
    syncConfig, isSyncing, lastSyncMessage, pushToCloud, pullFromCloud,
    updateSyncConfig, importFromTransfer,
  } = useHabits()

  const [activeSection, setActiveSection] = useState<SettingSection>('sync')
  const [importStatus, setImportStatus]   = useState<'idle' | 'success' | 'error'>('idle')
  const [importMsg,    setImportMsg]      = useState('')
  const [testNotifMsg, setTestNotifMsg]   = useState<string | null>(null)
  const [testingNotif, setTestingNotif]   = useState(false)
  const [clearConfirm, setClearConfirm]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Sync state
  const [roomInput, setRoomInput] = useState(syncConfig.roomCode || '')
  const [firebaseIdInput, setFirebaseIdInput] = useState(syncConfig.firebaseProjectId || '')
  const [showQRModal, setShowQRModal] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const [transferPayloadStr, setTransferPayloadStr] = useState('')
  const [manualCodeInput, setManualCodeInput] = useState('')
  const [manualImportMsg, setManualImportMsg] = useState<string | null>(null)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null)

  // Diagnostics & unblock modal state
  const [diagnostics, setDiagnostics] = useState<NotificationDiagnostic | null>(null)
  const [showUnblockModal, setShowUnblockModal] = useState(false)

  useEffect(() => {
    setRoomInput(syncConfig.roomCode || '')
    setFirebaseIdInput(syncConfig.firebaseProjectId || '')
  }, [syncConfig])

  useEffect(() => {
    getNotificationDiagnostic().then(setDiagnostics)
  }, [notificationStatus])

  // ── Theme ──────────────────────────────────────────────────────────────────

  const themeOptions: { value: Theme; label: string; icon: string }[] = [
    { value: 'light',  label: 'Terang', icon: '☀️' },
    { value: 'dark',   label: 'Gelap',  icon: '🌙' },
    { value: 'system', label: 'Sistem', icon: '💻' },
  ]

  // ── Export JSON ───────────────────────────────────────────────────────────

  const handleExportJSON = async () => {
    const data = await exportData()
    const payload: AppDataExport = {
      version: 1,
      exportedAt: new Date().toISOString(),
      habits: data.habits,
      categories: data.categories,
      logs: data.logs,
    }
    downloadFile(
      JSON.stringify(payload, null, 2),
      `habit-backup-${formatDate(new Date().toISOString().slice(0, 10))}.json`,
      'application/json'
    )
  }

  // ── Export CSV ────────────────────────────────────────────────────────────

  const handleExportCSV = async () => {
    const data = await exportData()
    const csv  = exportToCSV(data.habits, data.logs)
    downloadFile(csv, `habit-logs-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv')
  }

  // ── Import JSON ───────────────────────────────────────────────────────────

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const parsed: AppDataExport = JSON.parse(ev.target?.result as string)
        if (!parsed.habits || !parsed.categories || !parsed.logs) {
          throw new Error('Format file tidak valid')
        }
        await importData({
          habits:     parsed.habits,
          categories: parsed.categories,
          logs:       parsed.logs,
        })
        setImportStatus('success')
        setImportMsg(`Berhasil mengimpor ${parsed.habits.length} kebiasaan & ${parsed.logs.length} log`)
      } catch (err) {
        setImportStatus('error')
        setImportMsg('Gagal mengimpor: ' + (err instanceof Error ? err.message : 'File tidak valid'))
      }
      if (fileRef.current) fileRef.current.value = ''
    }
    reader.readAsText(file)
  }

  // ── Clear data ────────────────────────────────────────────────────────────

  const handleClearAll = async () => {
    await importAllData([], [], [])
    window.location.reload()
  }

  // ── Test notification ─────────────────────────────────────────────────────

  const handleTestNotification = async () => {
    setTestingNotif(true)
    setTestNotifMsg(null)
    try {
      const res = await testNotification()
      const diag = await getNotificationDiagnostic()
      setDiagnostics(diag)
      setTestNotifMsg(res.message)
    } catch (err) {
      setTestNotifMsg('❌ Terjadi kesalahan: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setTestingNotif(false)
    }
  }

  // ── Sync Actions ──────────────────────────────────────────────────────────

  const handleGenerateRoom = () => {
    const random = 'habit-' + Math.random().toString(36).substring(2, 8)
    setRoomInput(random)
    updateSyncConfig({ roomCode: random })
  }

  const handleSaveSyncConfig = () => {
    updateSyncConfig({
      roomCode: roomInput.trim(),
      firebaseProjectId: firebaseIdInput.trim(),
    })
    setSyncFeedback('✅ Pengaturan sinkronisasi disimpan!')
    setTimeout(() => setSyncFeedback(null), 3000)
  }

  const handlePushCloud = async () => {
    if (!roomInput.trim()) {
      setSyncFeedback('⚠️ Masukkan atau buat Kode Sinkronisasi dulu.')
      return
    }
    handleSaveSyncConfig()
    const res = await pushToCloud(roomInput.trim())
    setSyncFeedback(res.message)
  }

  const handlePullCloud = async () => {
    if (!roomInput.trim()) {
      setSyncFeedback('⚠️ Masukkan Kode Sinkronisasi yang sama dengan di laptop.')
      return
    }
    handleSaveSyncConfig()
    const res = await pullFromCloud(roomInput.trim())
    setSyncFeedback(res.message)
  }

  const handleOpenQR = () => {
    const encoded = encodeDataForTransfer(habits, categories, logs)
    setTransferPayloadStr(encoded)
    const transferUrl = `${window.location.origin}/?importSync=${encoded}`
    setQrUrl(getQRCodeUrl(transferUrl))
    setShowQRModal(true)
  }

  const handleManualImport = async () => {
    if (!manualCodeInput.trim()) return
    const res = await importFromTransfer(manualCodeInput.trim())
    if (res.success) {
      setManualImportMsg('✅ ' + res.message)
      setManualCodeInput('')
    } else {
      setManualImportMsg('❌ ' + res.message)
    }
  }

  const handleCopyLink = () => {
    const transferUrl = `${window.location.origin}/?importSync=${transferPayloadStr}`
    navigator.clipboard.writeText(transferUrl).then(() => {
      setCopyFeedback('✅ Tautan tersalin! Buka di HP kamu.')
      setTimeout(() => setCopyFeedback(null), 3000)
    })
  }

  const sections: { id: SettingSection; label: string; icon: string }[] = [
    { id: 'sync',          label: 'Sinkronisasi', icon: '🔄' },
    { id: 'notifications', label: 'Notifikasi',   icon: '🔔' },
    { id: 'appearance',    label: 'Tampilan',     icon: '🎨' },
    { id: 'data',          label: 'Backup Data',  icon: '💾' },
    { id: 'about',         label: 'Tentang',      icon: 'ℹ️' },
  ]

  const notifWithTimeCount = habits.filter(h => h.reminderEnabled && h.reminderTime).length

  return (
    <div className="page-container">
      <h1 className="text-2xl font-extrabold mb-1" style={{ color: 'var(--text)' }}>Pengaturan</h1>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
        Sesuaikan aplikasi, kelola notifikasi, & sinkronkan data antar perangkat
      </p>

      {/* Section tabs */}
      <div className="tab-bar mb-6 overflow-x-auto">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`tab-item ${activeSection === s.id ? 'active' : ''}`}
          >
            {s.icon} <span className="inline">{s.label}</span>
          </button>
        ))}
      </div>

      {/* ── Section: Cloud & Multi-Device Sync ────────────────────────────── */}
      {activeSection === 'sync' && (
        <div className="flex flex-col gap-5 animate-fade-in">
          {/* Explanation Banner */}
          <div
            className="glass-card p-4.5 rounded-2xl flex gap-3.5 items-start"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.08))',
              border: '1px solid rgba(99,102,241,0.25)',
            }}
          >
            <span className="text-2xl flex-shrink-0">💡</span>
            <div>
              <p className="font-bold text-sm" style={{ color: 'var(--brand)' }}>
                Kenapa Data di Web Laptop & HP Berbeda?
              </p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Aplikasi ini menjaga privasimu dengan menyimpan kebiasaan di memori browser lokal (IndexedDB).
                Karena laptop dan HP adalah perangkat terpisah, gunakan fitur sinkronisasi di bawah agar kedua perangkat memiliki data yang sama persis!
              </p>
            </div>
          </div>

          {/* Method 1: Cloud Vault Sync */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">☁️</span>
                <p className="font-bold text-base" style={{ color: 'var(--text)' }}>
                  1. Sinkronisasi Kode Cloud Vault
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: '#10b98120', color: '#10b981' }}>
                Online Sync
              </span>
            </div>

            <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
              Cukup gunakan satu kode yang sama di Laptop dan HP kamu untuk mengunggah dan menarik data kapan saja.
            </p>

            {/* Auto-Sync Toggle Card */}
            <div
              className="p-3.5 rounded-2xl border flex items-center justify-between mb-4"
              style={{
                background: syncConfig.autoSync ? 'rgba(16,185,129,0.08)' : 'var(--surface-tertiary)',
                borderColor: syncConfig.autoSync ? 'rgba(16,185,129,0.3)' : 'var(--border-solid)',
              }}
            >
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <span className="text-2xl flex-shrink-0">{syncConfig.autoSync ? '🟢' : '⚪'}</span>
                <div className="min-w-0">
                  <p className="font-bold text-xs" style={{ color: syncConfig.autoSync ? '#10b981' : 'var(--text)' }}>
                    {syncConfig.autoSync ? 'Sinkronisasi Otomatis Aktif (Real-time)' : 'Sinkronisasi Otomatis Nonaktif'}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {syncConfig.autoSync
                      ? 'Setiap centang atau kebiasaan baru di laptop otomatis masuk ke HP dalam hitungan detik!'
                      : 'Nyalakan agar kebiasaan di laptop & HP tersambung otomatis.'}
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={syncConfig.autoSync}
                onChange={(e) => updateSyncConfig({ autoSync: e.target.checked })}
                className="w-5 h-5 accent-emerald-500 cursor-pointer flex-shrink-0"
                aria-label="Saklar Sinkronisasi Otomatis"
              />
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                  Kode Sinkronisasi Pribadi
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    placeholder="Contoh: arya-habits-2026"
                    className="flex-1 px-3.5 py-2.5 rounded-xl text-sm font-mono border"
                    style={{
                      background: 'var(--surface-tertiary)',
                      color: 'var(--text)',
                      borderColor: 'var(--border-solid)',
                    }}
                  />
                  <button
                    onClick={handleGenerateRoom}
                    className="btn-secondary px-3 py-2 text-xs flex-shrink-0"
                    title="Buat kode acak"
                  >
                    🎲 Acak
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  onClick={handlePushCloud}
                  disabled={isSyncing}
                  className="btn-primary py-2.5 text-xs justify-center font-bold"
                >
                  {isSyncing ? '⏳ Menyimpan…' : '📤 Unggah dari Laptop/HP'}
                </button>
                <button
                  onClick={handlePullCloud}
                  disabled={isSyncing}
                  className="btn-secondary py-2.5 text-xs justify-center font-bold"
                >
                  {isSyncing ? '⏳ Mengunduh…' : '📥 Tarik Data ke Sini'}
                </button>
              </div>

              {/* Status feedback */}
              {syncFeedback && (
                <div
                  className="p-3 rounded-xl text-xs font-semibold animate-scale-in"
                  style={{
                    background: syncFeedback.startsWith('✅') ? '#10b98115' : '#f59e0b15',
                    color: syncFeedback.startsWith('✅') ? '#059669' : '#d97706',
                  }}
                >
                  {syncFeedback}
                </div>
              )}

              {syncConfig.lastSyncedAt && (
                <p className="text-[11px] text-right" style={{ color: 'var(--text-tertiary)' }}>
                  🕒 Terakhir disinkronkan: {syncConfig.lastSyncedAt}
                </p>
              )}

              {/* Firebase Option */}
              <div className="mt-2 pt-3 border-t border-[var(--border-solid)]">
                <details className="text-xs">
                  <summary className="font-semibold cursor-pointer select-none" style={{ color: 'var(--brand)' }}>
                    ⚙️ Pengaturan Lanjutan (Firebase Firestore)
                  </summary>
                  <div className="mt-2.5 p-3 rounded-xl flex flex-col gap-2" style={{ background: 'var(--surface-tertiary)' }}>
                    <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      Jika kamu memiliki project Google Firebase Firestore pribadi, masukkan Project ID di sini:
                    </p>
                    <input
                      type="text"
                      value={firebaseIdInput}
                      onChange={(e) => setFirebaseIdInput(e.target.value)}
                      placeholder="Contoh: my-habit-project-123"
                      className="px-3 py-2 rounded-lg text-xs font-mono border"
                      style={{
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        borderColor: 'var(--border-solid)',
                      }}
                    />
                    <button
                      onClick={handleSaveSyncConfig}
                      className="btn-secondary py-1 px-3 text-xs self-start"
                    >
                      Simpan Project ID
                    </button>
                  </div>
                </details>
              </div>
            </div>
          </div>

          {/* Method 2: Instant QR Code Transfer */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">📷</span>
                <p className="font-bold text-base" style={{ color: 'var(--text)' }}>
                  2. Pindai QR Code (Kamera HP)
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: '#6366f120', color: '#6366f1' }}>
                Instant Transfer
              </span>
            </div>

            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
              Jika kamu sedang di depan laptop dengan HP di tangan: buka QR Code di laptop, arahkan kamera HP kamu, dan semua habit langsung tersalin seketika!
            </p>

            <button
              onClick={handleOpenQR}
              className="btn-primary w-full justify-center py-2.5 text-xs font-bold"
            >
              📱 Tampilkan QR Code Sinkronisasi Laptop
            </button>

            {/* Manual paste transfer */}
            <div className="mt-4 pt-3 border-t border-[var(--border-solid)]">
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text)' }}>
                Atau Tempel Kode Transfer di Sini (di HP):
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCodeInput}
                  onChange={(e) => setManualCodeInput(e.target.value)}
                  placeholder="Tempel kode teks transfer..."
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-mono border"
                  style={{
                    background: 'var(--surface-tertiary)',
                    color: 'var(--text)',
                    borderColor: 'var(--border-solid)',
                  }}
                />
                <button
                  onClick={handleManualImport}
                  className="btn-secondary px-3.5 py-2 text-xs flex-shrink-0 font-bold"
                >
                  📥 Impor
                </button>
              </div>
              {manualImportMsg && (
                <p className="text-xs mt-2 font-semibold" style={{ color: manualImportMsg.startsWith('✅') ? '#10b981' : '#ef4444' }}>
                  {manualImportMsg}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Section: Notifications ───────────────────────────────────────── */}
      {activeSection === 'notifications' && (
        <div className="flex flex-col gap-4 animate-fade-in">
          {/* Blocked Notification Alert Banner */}
          {(notificationStatus === 'denied' || diagnostics?.permission === 'denied') && (
            <div
              className="p-4 rounded-2xl flex flex-col gap-3 animate-scale-in"
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1.5px solid rgba(239,68,68,0.35)',
              }}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">🚫</span>
                <div>
                  <p className="font-bold text-sm text-red-500">Notifikasi Diblokir oleh Sistem HP Kamu</p>
                  <p className="text-xs text-red-400 mt-0.5 leading-relaxed">
                    Sistem Android atau browser Chrome memblokir notifikasi untuk situs ini. Browser tidak bisa memunculkan jendela izin lagi sampai kamu membuka blokirnya.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUnblockModal(true)}
                className="btn-primary py-2.5 px-4 text-xs font-bold self-start flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 15px rgba(239,68,68,0.4)' }}
              >
                <span>🔓</span>
                <span>Buka Panduan Buka Blokir (1 Menit)</span>
              </button>
            </div>
          )}

          {/* Main notification permission card */}
          <div className="glass-card p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                  style={{
                    background: notificationStatus === 'granted' ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
                    color: notificationStatus === 'granted' ? '#10b981' : 'var(--brand)',
                  }}
                >
                  🔔
                </div>
                <div>
                  <p className="font-bold text-base" style={{ color: 'var(--text)' }}>
                    Izin Notifikasi Android & Web
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    {notificationStatus === 'granted'
                      ? 'Izin aktif: Pengingat bergetar & bersuara saat jadwal kebiasaan tiba'
                      : notificationStatus === 'denied'
                      ? 'Diblokir di pengaturan browser atau sistem HP kamu'
                      : 'Belum diizinkan'}
                  </p>
                </div>
              </div>

              {notificationStatus === 'granted' ? (
                <span className="badge text-xs" style={{ background: '#10b98120', color: '#10b981' }}>
                  ✓ Aktif
                </span>
              ) : notificationStatus === 'denied' ? (
                <button
                  onClick={() => setShowUnblockModal(true)}
                  className="btn-danger py-1.5 px-3.5 text-xs font-bold"
                >
                  🔓 Buka Blokir
                </button>
              ) : (
                <button
                  onClick={() => enableNotifications()}
                  className="btn-primary py-1.5 px-3.5 text-xs font-bold"
                >
                  Izinkan Notifikasi
                </button>
              )}
            </div>

            {/* Diagnostics breakdown */}
            {diagnostics && (
              <div className="p-3.5 rounded-xl flex flex-col gap-2 text-xs" style={{ background: 'var(--surface-tertiary)' }}>
                <p className="font-bold text-xs" style={{ color: 'var(--text)' }}>
                  🔍 Status Sistem Notifikasi HP:
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span style={{ color: 'var(--text-tertiary)' }}>Izin Notifikasi: </span>
                    <strong style={{ color: diagnostics.permission === 'granted' ? '#10b981' : '#f59e0b' }}>
                      {diagnostics.permission === 'granted' ? 'Diizinkan (Granted)' : diagnostics.permission}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-tertiary)' }}>Service Worker: </span>
                    <strong style={{ color: diagnostics.hasServiceWorker ? '#10b981' : '#f59e0b' }}>
                      {diagnostics.swState === 'active' ? 'Aktif (Ready)' : diagnostics.swState}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-tertiary)' }}>Platform: </span>
                    <strong>{diagnostics.isAndroid ? '🤖 Android Phone' : '💻 Desktop / Lainnya'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-tertiary)' }}>Mode Tampilan: </span>
                    <strong style={{ color: diagnostics.isStandalonePWA ? '#10b981' : 'var(--brand)' }}>
                      {diagnostics.isStandalonePWA ? '📱 Aplikasi Terpasang (PWA)' : '🌐 Tab Browser'}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Test notification button */}
            <div className="pt-3 border-t border-[var(--border-solid)] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    Uji Coba Notifikasi Langsung
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Kirim notifikasi tes dengan suara chime & getaran ke HP kamu
                  </p>
                </div>
                <button
                  onClick={handleTestNotification}
                  disabled={testingNotif}
                  className="btn-secondary py-1.5 px-3.5 text-xs font-bold"
                >
                  {testingNotif ? 'Mengirim…' : '🧪 Tes Notifikasi'}
                </button>
              </div>

              {/* Direct In-App Sound & Vibration Test */}
              <div className="flex items-center justify-between pt-2 border-t border-[var(--border-solid)]">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    🔊 Tes Alarm Suara &amp; Getar HP
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Uji coba nada dering pengingat &amp; getar (tidak butuh izin sistem Android)
                  </p>
                </div>
                <button
                  onClick={() => {
                    playReminderChime()
                    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                      navigator.vibrate([200, 100, 200, 100, 300])
                    }
                    setTestNotifMsg('🔊 Suara nada dering & getaran berhasil dibunyikan di HP kamu!')
                  }}
                  className="btn-primary py-1.5 px-3.5 text-xs font-bold"
                >
                  🔊 Bunyikan Alarm
                </button>
              </div>

              {testNotifMsg && (
                <div
                  className="p-3 rounded-xl text-xs font-semibold animate-scale-in"
                  style={{
                    background: testNotifMsg.startsWith('✅') ? '#10b98115' : '#f59e0b15',
                    color: testNotifMsg.startsWith('✅') ? '#059669' : '#d97706',
                  }}
                >
                  {testNotifMsg}
                </div>
              )}
            </div>
          </div>

          {/* Scheduled habits summary */}
          <div className="glass-card p-5">
            <p className="font-bold mb-3" style={{ color: 'var(--text)' }}>
              ⏰ Kebiasaan Dengan Jam Pengingat Aktif ({notifWithTimeCount})
            </p>
            {notifWithTimeCount === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Belum ada kebiasaan yang dipasang jam pengingat. Kamu bisa mengatur jam pengingat saat mengedit atau menambah kebiasaan baru di menu Habit.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {habits.filter(h => h.reminderEnabled && h.reminderTime).map(h => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between p-3 rounded-xl"
                    style={{ background: 'var(--surface-tertiary)' }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{h.icon}</span>
                      <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{h.name}</span>
                    </div>
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-lg"
                      style={{ background: h.color + '22', color: h.color }}
                    >
                      🔔 {h.reminderTime}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Android PWA setup advice */}
          <div className="glass-card p-5" style={{ background: 'rgba(99,102,241,0.04)', borderColor: 'rgba(99,102,241,0.2)' }}>
            <p className="font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--brand)' }}>
              📱 Panduan Wajib Agar Notifikasi Android Pasti Masuk
            </p>
            <div className="flex flex-col gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0" style={{ background: 'var(--brand)', color: '#fff' }}>1</span>
                <div>
                  <strong>Install sebagai Aplikasi (PWA):</strong> Di Chrome HP, ketuk menu <strong>⋮ (titik tiga)</strong> di pojok kanan atas, lalu ketuk <strong>&quot;Tambahkan ke Layar Utama&quot;</strong> atau <strong>&quot;Install App&quot;</strong>. Ini memberi prioritas penuh agar sistem Android tidak mematikan service worker saat HP tidur.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0" style={{ background: 'var(--brand)', color: '#fff' }}>2</span>
                <div>
                  <strong>Pengaturan Sistem Notifikasi Android:</strong> Buka Pengaturan HP &gt; Aplikasi &gt; Chrome (atau Habit Tracker) &gt; Notifikasi &gt; Pastikan semua kategori notifikasi diaktifkan dan tidak disetel ke &quot;Hening/Silent&quot;.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0" style={{ background: 'var(--brand)', color: '#fff' }}>3</span>
                <div>
                  <strong>Penghemat Baterai (Penting untuk Xiaomi/Samsung/Oppo/Realme):</strong> Sistem Android sering menghentikan proses latar belakang browser. Ubah pengaturan Penghemat Baterai untuk aplikasi ini ke <strong>&quot;Tanpa Batasan / No Restrictions&quot;</strong>.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Section: Appearance ──────────────────────────────────────────── */}
      {activeSection === 'appearance' && (
        <div className="flex flex-col gap-4 animate-fade-in">
          <div className="glass-card p-5">
            <p className="font-bold mb-3" style={{ color: 'var(--text)' }}>🌗 Tema</p>
            <div className="grid grid-cols-3 gap-3">
              {themeOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => updateSettings({ theme: opt.value })}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                    settings.theme === opt.value
                      ? 'border-[var(--brand)] bg-[rgba(99,102,241,0.1)] font-bold'
                      : 'border-[var(--border-solid)] hover:bg-[var(--surface-tertiary)]'
                  }`}
                  style={{ color: settings.theme === opt.value ? 'var(--brand)' : 'var(--text)' }}
                >
                  <span className="text-2xl">{opt.icon}</span>
                  <span className="text-xs">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card p-5 flex flex-col gap-4">
            <p className="font-bold" style={{ color: 'var(--text)' }}>⚙️ Preferensi Kalender</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Awal Minggu Hari Senin</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Matikan untuk memulai minggu dari hari Minggu</p>
              </div>
              <input
                type="checkbox"
                checked={settings.weekStartsOnMonday}
                onChange={(e) => updateSettings({ weekStartsOnMonday: e.target.checked })}
                className="w-5 h-5 accent-[var(--brand)] cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-[var(--border-solid)]">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Tampilkan Habit Selesai</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Tetap tampilkan kebiasaan yang sudah selesai di hari ini</p>
              </div>
              <input
                type="checkbox"
                checked={settings.showCompletedHabits}
                onChange={(e) => updateSettings({ showCompletedHabits: e.target.checked })}
                className="w-5 h-5 accent-[var(--brand)] cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Section: Backup Data ─────────────────────────────────────────── */}
      {activeSection === 'data' && (
        <div className="flex flex-col gap-4 animate-fade-in">
          <div className="glass-card p-5">
            <p className="font-bold mb-4" style={{ color: 'var(--text)' }}>📦 Ringkasan Data Lokal</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Kebiasaan', value: habits.length, icon: '⚡' },
                { label: 'Kategori', value: categories.length, icon: '🏷️' },
                { label: 'Total Log', value: logs.length, icon: '📝' },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-xl text-center" style={{ background: 'var(--surface-tertiary)' }}>
                  <p className="text-2xl">{s.icon}</p>
                  <p className="text-xl font-extrabold mt-1" style={{ color: 'var(--brand)' }}>{s.value}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-5">
            <p className="font-bold mb-3" style={{ color: 'var(--text)' }}>📤 Ekspor Cadangan File</p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleExportJSON}
                className="btn-primary justify-center font-bold"
                id="export-json-btn"
              >
                📄 Unduh File JSON Backup Penuh
              </button>
              <button
                onClick={handleExportCSV}
                className="btn-secondary justify-center font-bold"
                id="export-csv-btn"
              >
                📊 Ekspor Riwayat ke CSV (Excel / Spreadsheet)
              </button>
            </div>
          </div>

          <div className="glass-card p-5">
            <p className="font-bold mb-3" style={{ color: 'var(--text)' }}>📥 Pulihkan dari File JSON</p>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              id="import-file-input"
              onChange={handleImport}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="btn-secondary w-full justify-center font-bold"
              id="import-btn"
            >
              📂 Pilih File JSON Backup dari Perangkat
            </button>
            {importStatus !== 'idle' && (
              <div
                className="mt-3 p-3 rounded-xl text-sm font-medium"
                style={{
                  background: importStatus === 'success' ? '#22c55e18' : '#ef444418',
                  color: importStatus === 'success' ? '#16a34a' : '#dc2626',
                }}
              >
                {importStatus === 'success' ? '✅ ' : '❌ '}{importMsg}
              </div>
            )}
          </div>

          <div className="glass-card p-5" style={{ borderColor: '#ef444444' }}>
            <p className="font-bold mb-3 text-red-500">🗑️ Hapus Seluruh Data</p>
            <button
              onClick={() => setClearConfirm(true)}
              className="btn-danger w-full justify-center"
              id="clear-all-btn"
            >
              Hapus Semua Data dari Browser Ini
            </button>
          </div>
        </div>
      )}

      {/* ── Section: About ───────────────────────────────────────────────── */}
      {activeSection === 'about' && (
        <div className="glass-card p-6 flex flex-col gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-2))' }}
            >
              ⚡
            </div>
            <div>
              <p className="font-extrabold text-base" style={{ color: 'var(--text)' }}>Habit Tracker PWA</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Versi 2.0 (Enhanced Sync & Android Reminders)</p>
            </div>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Aplikasi pelacak kebiasaan modern dengan sinkronisasi multi-perangkat real-time, pengingat Android PWA bersuara & bergetar, pelacakan beruntun (streak), dan analitik grafik mingguan/bulanan.
          </p>
        </div>
      )}

      {/* ── QR Code Modal ────────────────────────────────────────────────── */}
      <Modal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        title="📱 Pindai QR Code untuk Sinkronkan ke HP"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Arahkan kamera HP kamu ke QR Code di bawah. Buka tautan yang muncul untuk memuat semua kebiasaan secara instan!
          </p>

          {qrUrl ? (
            <div className="p-3 bg-white rounded-2xl shadow-md border inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl}
                alt="QR Code Sinkronisasi"
                className="w-56 h-56 object-contain"
              />
            </div>
          ) : (
            <div className="w-56 h-56 flex items-center justify-center bg-gray-100 rounded-2xl text-xs text-gray-500">
              Membuat QR Code…
            </div>
          )}

          <div className="w-full flex flex-col gap-2 pt-2 border-t border-[var(--border-solid)]">
            <button
              onClick={handleCopyLink}
              className="btn-primary w-full justify-center py-2 text-xs font-bold"
            >
              📋 Salin Tautan Sinkronisasi Langsung
            </button>
            {copyFeedback && (
              <p className="text-xs font-semibold text-emerald-500">{copyFeedback}</p>
            )}
            <button
              onClick={() => setShowQRModal(false)}
              className="btn-secondary w-full justify-center py-2 text-xs"
            >
              Tutup
            </button>
          </div>
        </div>
      </Modal>

      {/* Clear confirm dialog */}
      <ConfirmDialog
        isOpen={clearConfirm}
        onCancel={() => setClearConfirm(false)}
        onConfirm={handleClearAll}
        title="Hapus Semua Data?"
        message="Tindakan ini tidak dapat dibatalkan. Semua kebiasaan, kategori, dan log penyelesaian akan dihapus permanen dari browser ini."
        confirmLabel="Ya, Hapus Semua"
        danger
      />

      {/* Unblock Notification Modal */}
      <UnblockNotifModal
        isOpen={showUnblockModal}
        onClose={() => setShowUnblockModal(false)}
      />
    </div>
  )
}
