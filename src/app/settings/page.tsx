'use client'

import { useState, useRef } from 'react'
import { useHabits } from '@/lib/context'
import { exportToCSV, downloadFile, formatDate } from '@/lib/utils'
import type { AppDataExport, Theme } from '@/lib/types'
import { ConfirmDialog } from '@/components/Modal'
import { importAllData } from '@/lib/db'

type SettingSection = 'appearance' | 'data' | 'about'

export default function SettingsPage() {
  const { settings, updateSettings, exportData, importData, habits, categories } = useHabits()
  const [activeSection, setActiveSection] = useState<SettingSection>('appearance')
  const [importStatus, setImportStatus]   = useState<'idle'|'success'|'error'>('idle')
  const [importMsg,    setImportMsg]      = useState('')
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

  const sections: { id: SettingSection; label: string; icon: string }[] = [
    { id: 'appearance', label: 'Tampilan', icon: '🎨' },
    { id: 'data',       label: 'Data',     icon: '💾' },
    { id: 'about',      label: 'Tentang',  icon: 'ℹ️' },
  ]

  return (
    <div className="page-container">
      <h1 className="text-2xl font-extrabold mb-1" style={{ color: 'var(--text)' }}>Pengaturan</h1>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>Sesuaikan aplikasi sesuai preferensimu</p>

      {/* Section tabs */}
      <div className="tab-bar mb-6">
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`tab-item ${activeSection === s.id ? 'active' : ''}`}>
            {s.icon} {s.label}
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
                    ? { background: 'var(--brand)', color: '#fff' }
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
                style={{ background: settings.weekStartsOnMonday ? 'var(--brand)' : 'var(--border)' }}
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
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Tampilkan kebiasaan yang sudah dicentang</p>
              </div>
              <button
                onClick={() => updateSettings({ showCompletedHabits: !settings.showCompletedHabits })}
                className="relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0"
                style={{ background: settings.showCompletedHabits ? 'var(--brand)' : 'var(--border)' }}
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

      {/* ── Data ─────────────────────────────────────────────────────── */}
      {activeSection === 'data' && (
        <div className="flex flex-col gap-4">
          {/* Info notice */}
          <div className="glass-card p-4 flex gap-3" style={{ borderColor: '#f59e0b44', background: '#f59e0b08' }}>
            <span className="text-xl flex-shrink-0">⚠️</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#f59e0b' }}>Data Tersimpan Lokal</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Semua data disimpan hanya di perangkat ini menggunakan IndexedDB. Data
                <strong> tidak otomatis tersinkronisasi</strong> antara laptop dan HP.
                Gunakan fitur Ekspor/Impor untuk memindahkan data.
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
                📊 Ekspor CSV (Spreadsheet)
              </button>
            </div>
            <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>
              JSON = backup lengkap untuk dipulihkan. CSV = data log untuk analisis di Excel/Sheets.
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
              📂 Pilih File JSON
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
              ⚠️ Mengimpor akan mengganti seluruh data yang ada. Ekspor dulu sebelum mengimpor.
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
            <p className="text-xs mt-2 text-red-400">Tindakan ini tidak dapat dibatalkan!</p>
          </div>
        </div>
      )}

      {/* ── About ────────────────────────────────────────────────────── */}
      {activeSection === 'about' && (
        <div className="flex flex-col gap-4">
          <div className="glass-card p-6 text-center">
            <div className="text-5xl mb-3">⚡</div>
            <h2 className="text-xl font-extrabold" style={{ color: 'var(--text)' }}>Habit Tracker</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Versi 1.0.0</p>
            <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>
              Bangun kebiasaan positif setiap hari. <br />Lacak progres. Raih tujuanmu.
            </p>
          </div>

          <div className="glass-card p-5">
            <p className="font-bold mb-4" style={{ color: 'var(--text)' }}>📱 Instalasi PWA di Android</p>
            <div className="flex flex-col gap-3">
              {[
                '1. Buka aplikasi ini di Chrome Android',
                '2. Ketuk ikon menu (titik tiga) di pojok kanan atas',
                '3. Pilih "Tambahkan ke Layar Utama" atau "Install App"',
                '4. Konfirmasi instalasi',
                '5. Aplikasi kini tersedia di home screen seperti aplikasi native!',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-5" style={{ background: '#3b63fb08', borderColor: '#3b63fb33' }}>
            <p className="font-bold mb-3" style={{ color: 'var(--brand)' }}>ℹ️ Tentang Notifikasi</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Notifikasi saat aplikasi <strong>ditutup sepenuhnya</strong> tidak didukung oleh PWA
              di Android tanpa server backend (Push Notification API memerlukan server VAPID).
              Gunakan alarm ponsel atau pengingat manual sebagai alternatif.
            </p>
          </div>

          <div className="glass-card p-5" style={{ background: '#22c55e08', borderColor: '#22c55e33' }}>
            <p className="font-bold mb-3" style={{ color: '#16a34a' }}>🔒 Privasi</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Semua data tersimpan 100% di perangkat kamu. Tidak ada data yang dikirim ke server
              manapun. Aplikasi ini sepenuhnya offline-first.
            </p>
          </div>

          <div className="glass-card p-5">
            <p className="font-bold mb-3" style={{ color: 'var(--text)' }}>🛠️ Teknologi</p>
            <div className="flex flex-col gap-1.5">
              {[
                ['Next.js 14', 'Framework React'],
                ['TypeScript', 'Bahasa pemrograman'],
                ['Tailwind CSS', 'Styling'],
                ['IndexedDB (idb)', 'Penyimpanan lokal'],
                ['Recharts', 'Grafik statistik'],
                ['next-pwa', 'Service Worker & PWA'],
                ['Vercel', 'Hosting & deployment'],
              ].map(([tech, desc]) => (
                <div key={tech} className="flex justify-between items-center">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{tech}</span>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{desc}</span>
                </div>
              ))}
            </div>
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
