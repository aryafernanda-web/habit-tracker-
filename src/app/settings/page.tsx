'use client'

import { useState, useRef } from 'react'
import { useHabits } from '@/lib/context'
import { exportToCSV, downloadFile, formatDate } from '@/lib/utils'
import type { AppDataExport, Theme } from '@/lib/types'
import { ConfirmDialog } from '@/components/Modal'
import { importAllData } from '@/lib/db'

type SettingSection = 'appearance' | 'notifications' | 'data' | 'about'

export default function SettingsPage() {
  const {
    settings, updateSettings, exportData, importData, habits, categories,
    notificationStatus, enableNotifications, testNotification,
  } = useHabits()

  const [activeSection, setActiveSection] = useState<SettingSection>('appearance')
  const [importStatus, setImportStatus]   = useState<'idle'|'success'|'error'>('idle')
  const [importMsg,    setImportMsg]      = useState('')
  const [testNotifMsg, setTestNotifMsg]   = useState<string | null>(null)
  const [testingNotif, setTestingNotif]   = useState(false)
  const [clearConfirm, setClearConfirm]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
    downloadFile(JSON.stringify(payload, null, 2), `habit-backup-${formatDate(new Date().toISOString().slice(0,10))}.json`, 'application/json')
  }

  // ── Export CSV ────────────────────────────────────────────────────────────

  const handleExportCSV = async () => {
    const data = await exportData()
    const csv  = exportToCSV(data.habits, data.logs)
    downloadFile(csv, `habit-logs-${new Date().toISOString().slice(0,10)}.csv`, 'text/csv')
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
      const ok = await testNotification()
      if (ok) {
        setTestNotifMsg('✅ Notifikasi terkirim! Cek bilah status HP / browser kamu.')
      } else {
        setTestNotifMsg('⚠️ Izin notifikasi belum diizinkan di browser atau sistem HP kamu.')
      }
    } catch {
      setTestNotifMsg('❌ Terjadi kesalahan saat mengirim notifikasi.')
    } finally {
      setTestingNotif(false)
    }
  }

  const sections: { id: SettingSection; label: string; icon: string }[] = [
    { id: 'appearance',    label: 'Tampilan',   icon: '🎨' },
    { id: 'notifications', label: 'Notifikasi', icon: '🔔' },
    { id: 'data',          label: 'Data',       icon: '💾' },
    { id: 'about',         label: 'Tentang',    icon: 'ℹ️' },
  ]

  const notifWithTimeCount = habits.filter(h => h.reminderEnabled && h.reminderTime).length

  return (
    <div className="page-container">
      <h1 className="text-2xl font-extrabold mb-1" style={{ color: 'var(--text)' }}>Pengaturan</h1>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>Sesuaikan aplikasi sesuai preferensimu</p>

      {/* Section tabs */}
      <div className="tab-bar mb-6">
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`tab-item ${activeSection === s.id ? 'active' : ''}`}>
            {s.icon} <span className="hidden sm:inline">{s.label}</span>
          </button>
        ))}
      </div>

      {/* ── Appearance ───────────────────────────────────────────────── */}
      {activeSection === 'appearance' && (
        <div className="flex flex-col gap-4">
          <div className="glass-card p-5">
            <p className="font-bold mb-3" style={{ color: 'var(--text)' }}>🌗 Tema</p>
            <div className="grid grid-cols-3 gap-3">
              {themeOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => updateSettings({ theme: opt.value })}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl transition-all"
                  style={settings.theme === opt.value
                    ? { background: 'var(--brand)', color: '#fff', boxShadow: '0 4px 12px var(--brand-glow)' }
                    : { background: 'var(--surface-tertiary)', color: 'var(--text)' }}
                >
                  <span className="text-2xl">{opt.icon}</span>
                  <span className="text-xs font-semibold">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card p-5">
            <p className="font-bold mb-4" style={{ color: 'var(--text)' }}>📅 Kalender</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Mulai minggu dari Senin</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Menentukan tampilan kalender mingguan</p>
              </div>
              <button
                onClick={() => updateSettings({ weekStartsOnMonday: !settings.weekStartsOnMonday })}
                className="relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0"
                style={{ background: settings.weekStartsOnMonday ? 'var(--brand)' : 'var(--border-solid)' }}
                role="switch"
                aria-checked={settings.weekStartsOnMonday}
                id="week-monday-toggle"
              >
                <span
                  className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300"
                  style={{ left: settings.weekStartsOnMonday ? '28px' : '4px' }}
                />
              </button>
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Tampilkan yang sudah selesai</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Tampilkan kebiasaan yang sudah dicentang di halaman Hari Ini</p>
              </div>
              <button
                onClick={() => updateSettings({ showCompletedHabits: !settings.showCompletedHabits })}
                className="relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0"
                style={{ background: settings.showCompletedHabits ? 'var(--brand)' : 'var(--border-solid)' }}
                role="switch"
                aria-checked={settings.showCompletedHabits}
                id="show-completed-toggle"
              >
                <span
                  className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300"
                  style={{ left: settings.showCompletedHabits ? '28px' : '4px' }}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Notifications ────────────────────────────────────────────── */}
      {activeSection === 'notifications' && (
        <div className="flex flex-col gap-4 animate-fade-in">

          {/* Status Card */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
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
                      ? 'Izin aktif: Pengingat akan dikirim sesuai waktu'
                      : notificationStatus === 'denied'
                      ? 'Diblokir di pengaturan browser HP kamu'
                      : 'Belum diizinkan'}
                  </p>
                </div>
              </div>

              {notificationStatus === 'granted' ? (
                <span className="badge text-xs" style={{ background: '#10b98120', color: '#10b981' }}>
                  ✓ Aktif
                </span>
              ) : (
                <button
                  onClick={() => enableNotifications()}
                  className="btn-primary py-1.5 px-3.5 text-xs"
                >
                  Izinkan
                </button>
              )}
            </div>

            {/* Test notification button */}
            <div className="pt-3 border-t border-[var(--border-solid)] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    Uji Coba Notifikasi
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Kirim notifikasi tes langsung ke layar HP kamu
                  </p>
                </div>
                <button
                  onClick={handleTestNotification}
                  disabled={testingNotif}
                  className="btn-secondary py-1.5 px-3.5 text-xs"
                >
                  {testingNotif ? 'Mengirim…' : '🧪 Tes Sekarang'}
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
              ⏰ Kebiasaan Dengan Pengingat Waktu ({notifWithTimeCount})
            </p>
            {notifWithTimeCount === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Belum ada kebiasaan yang dipasang jam pengingat. Kamu bisa mengatur jam pengingat saat mengedit atau membuat kebiasaan baru.
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

          {/* How to ensure notifications work on Android */}
          <div className="glass-card p-5" style={{ background: 'rgba(99,102,241,0.04)', borderColor: 'rgba(99,102,241,0.2)' }}>
            <p className="font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--brand)' }}>
              📱 Panduan Notifikasi di Android PWA
            </p>
            <div className="flex flex-col gap-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <div className="flex items-start gap-2">
                <span className="font-bold text-sm" style={{ color: 'var(--brand)' }}>1.</span>
                <span>
                  <strong>Install sebagai Aplikasi:</strong> Buka situs ini di Chrome Android, ketuk menu <strong>⋮ (titik tiga)</strong> di kanan atas, lalu pilih <strong>&quot;Tambahkan ke Layar Utama&quot;</strong> atau <strong>&quot;Install App&quot;</strong>.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-sm" style={{ color: 'var(--brand)' }}>2.</span>
                <span>
                  <strong>Izinkan Notifikasi:</strong> Ketuk tombol <em>&quot;Izinkan&quot;</em> di atas. Pastikan di Pengaturan Android -&gt; Aplikasi -&gt; Habit Tracker -&gt; Notifikasi tidak dibisukan/diblokir.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-sm" style={{ color: 'var(--brand)' }}>3.</span>
                <span>
                  <strong>Pengaturan Waktu:</strong> Atur jam pengingat di menu edit habit. Aplikasi akan memicu notifikasi bergetar saat jadwal tiba!
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Data ─────────────────────────────────────────────────────── */}
      {activeSection === 'data' && (
        <div className="flex flex-col gap-4 animate-fade-in">
          {/* Info notice */}
          <div className="glass-card p-4 flex gap-3" style={{ borderColor: '#f59e0b44', background: '#f59e0b08' }}>
            <span className="text-xl flex-shrink-0">⚠️</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#f59e0b' }}>Data Tersimpan Lokal (IndexedDB)</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Semua data disimpan di perangkat ini tanpa database server eksternal.
                Gunakan fitur Ekspor/Impor di bawah jika ingin memindahkan data ke HP atau laptop lain.
              </p>
            </div>
          </div>

          {/* Stats summary */}
          <div className="glass-card p-5">
            <p className="font-bold mb-4" style={{ color: 'var(--text)' }}>📦 Ringkasan Data</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Kebiasaan', value: habits.length, icon: '⚡' },
                { label: 'Kategori', value: categories.length, icon: '🏷️' },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-xl text-center" style={{ background: 'var(--surface-tertiary)' }}>
                  <p className="text-2xl">{s.icon}</p>
                  <p className="text-xl font-extrabold mt-1" style={{ color: 'var(--brand)' }}>{s.value}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Export */}
          <div className="glass-card p-5">
            <p className="font-bold mb-3" style={{ color: 'var(--text)' }}>📤 Ekspor Data</p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleExportJSON}
                className="btn-primary justify-center"
                id="export-json-btn"
              >
                📄 Ekspor JSON (Backup Penuh)
              </button>
              <button
                onClick={handleExportCSV}
                className="btn-secondary justify-center"
                id="export-csv-btn"
              >
                📊 Ekspor CSV (Spreadsheet / Excel)
              </button>
            </div>
            <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>
              JSON = file backup yang dapat dipulihkan kapan saja. CSV = data riwayat untuk dibuka di Excel atau Google Sheets.
            </p>
          </div>

          {/* Import */}
          <div className="glass-card p-5">
            <p className="font-bold mb-3" style={{ color: 'var(--text)' }}>📥 Impor Data</p>
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
              className="btn-secondary w-full justify-center"
              id="import-btn"
            >
              📂 Pilih File JSON Backup
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
            <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>
              ⚠️ Mengimpor data akan menimpa data yang ada saat ini.
            </p>
          </div>

          {/* Danger zone */}
          <div className="glass-card p-5" style={{ borderColor: '#ef444444' }}>
            <p className="font-bold mb-3 text-red-500">🗑️ Zona Berbahaya</p>
            <button
              onClick={() => setClearConfirm(true)}
              className="btn-danger w-full justify-center"
              id="clear-all-btn"
            >
              Hapus Semua Data
            </button>
            <p className="text-xs mt-2 text-red-400">Semua riwayat dan kebiasaan akan terhapus permanen dari browser ini.</p>
          </div>
        </div>
      )}

      {/* ── About ────────────────────────────────────────────────────── */}
      {activeSection === 'about' && (
        <div className="flex flex-col gap-4 animate-fade-in">
          <div className="glass-card p-6 text-center">
            <div className="text-5xl mb-3">⚡</div>
            <h2 className="text-xl font-extrabold" style={{ color: 'var(--text)' }}>Habit Tracker PWA</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Versi 1.1.0 · Modern &amp; Offline-First</p>
            <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>
              Bangun kebiasaan positif setiap hari.<br />Lacak progres konsisten dan raih tujuan hidupmu.
            </p>
          </div>

          <div className="glass-card p-5">
            <p className="font-bold mb-4" style={{ color: 'var(--text)' }}>📱 Instalasi PWA di HP Android</p>
            <div className="flex flex-col gap-2.5">
              {[
                '1. Buka website di browser Chrome Android',
                '2. Ketuk ikon menu titik tiga (⋮) di pojok kanan atas',
                '3. Pilih "Tambahkan ke Layar Utama" (Install App)',
                '4. Konfirmasi instalasi dan beri nama',
                '5. Ikon aplikasi akan muncul di layar ponsel layaknya aplikasi Play Store!',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-5" style={{ background: '#22c55e08', borderColor: '#22c55e33' }}>
            <p className="font-bold mb-2" style={{ color: '#16a34a' }}>🔒 100% Privasi &amp; Offline</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Semua kebiasaan, catatan, dan riwayat tersimpan murni di perangkat kamu menggunakan IndexedDB lokal.
              Tidak ada data yang dikirim ke cloud atau pihak ketiga mana pun.
            </p>
          </div>
        </div>
      )}

      {/* Confirm clear */}
      <ConfirmDialog
        isOpen={clearConfirm}
        title="Hapus Semua Data?"
        message="Seluruh kebiasaan, kategori, dan riwayat akan dihapus permanen. Ekspor data terlebih dahulu jika ingin membuat cadangan."
        confirmLabel="Ya, Hapus Semua"
        onConfirm={() => { setClearConfirm(false); handleClearAll() }}
        onCancel={() => setClearConfirm(false)}
      />
    </div>
  )
}
