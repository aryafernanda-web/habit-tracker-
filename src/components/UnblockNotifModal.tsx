'use client'

import { useState } from 'react'
import Modal from './Modal'
import { playReminderChime } from '@/lib/notifications'

interface UnblockNotifModalProps {
  isOpen: boolean
  onClose: () => void
}

type GuideTab = 'pixel' | 'reset' | 'xiaomi' | 'samsung' | 'oppo' | 'fallback'

export default function UnblockNotifModal({ isOpen, onClose }: UnblockNotifModalProps) {
  const [activeTab, setActiveTab] = useState<GuideTab>('pixel')
  const [soundTested, setSoundTested] = useState(false)

  const handleTestSound = () => {
    playReminderChime()
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 300])
    }
    setSoundTested(true)
    setTimeout(() => setSoundTested(false), 3000)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🔓 Panduan Buka Blokir Notifikasi HP" size="lg">
      <div className="flex flex-col gap-4 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {/* Warning card */}
        <div
          className="p-3.5 rounded-2xl flex items-start gap-3"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          <span className="text-2xl flex-shrink-0">⚠️</span>
          <div>
            <p className="font-bold text-sm text-red-500">Kenapa Tertulis &quot;Tetap Terblokir&quot;?</p>
            <p className="text-[11px] mt-0.5 text-red-400">
              Di Android 13/14/15 (Google Pixel &amp; lainnya), jika notifikasi pernah tertekan &quot;Blokir&quot; atau dinonaktifkan di sistem HP, tombol izin di browser akan terkunci. Ikuti panduan di bawah:
            </p>
          </div>
        </div>

        {/* Brand tabs */}
        <div className="tab-bar overflow-x-auto py-1">
          {[
            { id: 'pixel',   label: '🔥 Google Pixel 7a / Pixel',     icon: '📱' },
            { id: 'reset',   label: '⚡ Cara Paling Ampuh (Reset Izin)', icon: '🔄' },
            { id: 'xiaomi',  label: 'Xiaomi / Redmi / POCO',          icon: '📱' },
            { id: 'samsung', label: 'Samsung Galaxy',                  icon: '📱' },
            { id: 'oppo',    label: 'Oppo / Realme / Vivo',            icon: '📱' },
            { id: 'fallback',label: '🔊 Alarm Suara (Tanpa Izin HP)',   icon: '🔔' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as GuideTab)}
              className={`tab-item text-xs whitespace-nowrap ${activeTab === t.id ? 'active' : ''}`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── Tab: Google Pixel 7a / Pixel (Stock Android 13/14/15) ── */}
        {activeTab === 'pixel' && (
          <div className="glass-card p-4 rounded-2xl flex flex-col gap-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <p className="font-bold text-sm text-indigo-400">
                Panduan Khusus Google Pixel 7a (Android 13 / 14 / 15)
              </p>
            </div>
            <p className="text-xs">
              Pada Google Pixel, Android memiliki sistem keamanan <strong>POST_NOTIFICATIONS</strong> ketat. Lakukan 3 langkah mudah ini:
            </p>

            <div className="flex flex-col gap-3">
              {/* Step 1 */}
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="w-5 h-5 rounded-full bg-indigo-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">1</span>
                <div>
                  <p className="font-bold text-white text-xs">Tekan &amp; Tahan Ikon Chrome / Habit Tracker di Layar HP</p>
                  <p className="text-[11px] mt-0.5 text-gray-300">
                    Di home screen Pixel 7a kamu, <strong>tekan &amp; tahan (long press)</strong> ikon Chrome (atau ikon aplikasi Habit Tracker) &gt; ketuk tombol <strong>(i) Info aplikasi</strong>.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="w-5 h-5 rounded-full bg-indigo-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">2</span>
                <div>
                  <p className="font-bold text-white text-xs">Nyalakan Saklar Notifikasi &amp; Situs</p>
                  <p className="text-[11px] mt-0.5 text-gray-300">
                    Ketuk menu <strong>Notifikasi (Notifications)</strong>. Pastikan saklar paling atas <strong>&quot;Semua notifikasi&quot;</strong> AKTIF. Lalu scroll ke bawah ke bagian <strong>Situs (Sites)</strong>, pastikan web Habit Tracker dalam posisi <strong>ON / Diizinkan</strong>.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="w-5 h-5 rounded-full bg-indigo-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">3</span>
                <div>
                  <p className="font-bold text-white text-xs">Reset Izin di Chrome (Ikon Sliders 🎛️)</p>
                  <p className="text-[11px] mt-0.5 text-gray-300">
                    Buka kembali web ini di Chrome Pixel 7a. Di bilah alamat atas sebelah kiri URL, ketuk ikon <strong>🎛️ (Sliders/Garis Pengaturan)</strong> &gt; ketuk <strong>Izin</strong> &gt; ubah Notifikasi menjadi <strong>Izinkan</strong> (atau ketuk <strong>Hapus data &amp; reset izin</strong>).
                  </p>
                </div>
              </div>

              {/* Tip: Battery unrestricted */}
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px]">
                <strong className="text-emerald-400">💡 Tips Penting Pixel 7a:</strong> Di menu Info aplikasi tadi &gt; ketuk <strong>Penggunaan baterai aplikasi</strong> &gt; pilih <strong>&quot;Tidak dibatasi&quot; (Unrestricted)</strong> agar sistem Pixel tidak mematikan pengingat saat layar HP terkunci / tidur.
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Reset Izin Chrome (Most Effective) ── */}
        {activeTab === 'reset' && (
          <div className="glass-card p-4 rounded-2xl flex flex-col gap-3 animate-fade-in">
            <p className="font-bold text-sm" style={{ color: 'var(--brand)' }}>
              🎯 Trik 1-Klik: Reset Izin Situs di Chrome Android
            </p>
            <p className="text-xs">
              Cara ini akan menghapus riwayat blokir di Chrome sehingga jendela permintaan izin muncul kembali seperti baru:
            </p>

            <div className="flex flex-col gap-2.5">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[var(--brand)] text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">1</span>
                <div>
                  Lihat ke bilah alamat atas browser Chrome (di samping kiri tulisan <code>https://...</code>). Ketuk ikon <strong>🔒 (Gembok)</strong> atau ikon <strong>🎛️ (Garis Pengaturan)</strong>.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[var(--brand)] text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">2</span>
                <div>
                  Ketuk <strong>&quot;Setelan situs&quot; (Site settings)</strong> atau <strong>&quot;Izin&quot;</strong>.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[var(--brand)] text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">3</span>
                <div>
                  Ketuk tombol <strong>&quot;Hapus data &amp; reset izin&quot; (Clear &amp; Reset)</strong> berwarna biru/abu-abu.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[var(--brand)] text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">4</span>
                <div>
                  Tutup jendela tersebut lalu muat ulang halaman. Saat tombol <em>&quot;Izinkan Notifikasi&quot;</em> ditekan, popup izin dari Chrome akan muncul kembali!
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Xiaomi / Redmi / POCO ── */}
        {activeTab === 'xiaomi' && (
          <div className="glass-card p-4 rounded-2xl flex flex-col gap-3 animate-fade-in">
            <p className="font-bold text-sm text-amber-500">
              📱 Khusus HP Xiaomi / Redmi / POCO (MIUI &amp; HyperOS)
            </p>
            <p className="text-xs">
              MIUI/HyperOS memiliki perlindungan ketat yang sering mematikan notifikasi Chrome secara sistem:
            </p>

            <div className="flex flex-col gap-2.5">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">1</span>
                <div>
                  Buka <strong>Setelan HP (Settings)</strong> &gt; pilih <strong>Aplikasi</strong> &gt; <strong>Kelola Aplikasi</strong>.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">2</span>
                <div>
                  Cari dan ketuk aplikasi <strong>Chrome</strong>.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">3</span>
                <div>
                  Ketuk <strong>Notifikasi</strong> &gt; Pastikan <strong>&quot;Tampilkan notifikasi&quot;</strong> dan <strong>&quot;Notifikasi mengambang&quot;</strong> AKTIF (berwarna biru).
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">4</span>
                <div>
                  Scroll ke bawah pada menu yang sama &gt; cari <strong>Penghemat Baterai</strong> &gt; ubah menjadi <strong>&quot;Tidak ada batasan&quot; (No restrictions)</strong> agar pengingat jam tidak dimatikan saat HP tidur.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Samsung Galaxy ── */}
        {activeTab === 'samsung' && (
          <div className="glass-card p-4 rounded-2xl flex flex-col gap-3 animate-fade-in">
            <p className="font-bold text-sm text-blue-500">
              📱 Khusus HP Samsung Galaxy (One UI)
            </p>

            <div className="flex flex-col gap-2.5">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">1</span>
                <div>
                  Buka <strong>Pengaturan HP</strong> &gt; pilih menu <strong>Aplikasi (Apps)</strong>.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">2</span>
                <div>
                  Cari aplikasi <strong>Chrome</strong> (atau <em>Habit Tracker</em> jika sudah di-install).
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">3</span>
                <div>
                  Ketuk <strong>Pemberitahuan (Notifications)</strong> &gt; nyalakan <strong>&quot;Izinkan pemberitahuan&quot;</strong>.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">4</span>
                <div>
                  Ketuk <strong>Kategori notifikasi</strong> &gt; pastikan kategori <strong>Situs Web</strong> aktif dan tidak dalam keadaan dibisukan.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Oppo / Realme / Vivo ── */}
        {activeTab === 'oppo' && (
          <div className="glass-card p-4 rounded-2xl flex flex-col gap-3 animate-fade-in">
            <p className="font-bold text-sm text-emerald-500">
              📱 Khusus HP Oppo, Realme, dan Vivo (ColorOS / Funtouch)
            </p>

            <div className="flex flex-col gap-2.5">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">1</span>
                <div>
                  Buka <strong>Pengaturan</strong> &gt; pilih <strong>Manajemen Aplikasi</strong> &gt; <strong>Daftar Aplikasi</strong>.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">2</span>
                <div>
                  Pilih aplikasi <strong>Chrome</strong> &gt; ketuk <strong>Kelola Notifikasi</strong>.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">3</span>
                <div>
                  Nyalakan saklar <strong>&quot;Izinkan Notifikasi&quot;</strong>, serta aktifkan centang <strong>Spanduk (Banner)</strong> dan <strong>Layar Kunci</strong>.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: In-App Sound Alarm Fallback (Works 100%) ── */}
        {activeTab === 'fallback' && (
          <div className="glass-card p-4 rounded-2xl flex flex-col gap-3 animate-fade-in">
            <p className="font-bold text-sm text-indigo-400">
              🔊 Solusi Pasti Masuk: Alarm Suara &amp; Getar Dalam Aplikasi
            </p>
            <p className="text-xs">
              Jika sistem HP kamu sangat ketat dan tidak mengizinkan notifikasi push eksternal, <strong>kamu tidak perlu khawatir!</strong>
            </p>
            <p className="text-xs leading-relaxed">
              Aplikasi ini sudah dilengkapi dengan <strong>Sistem Alarm Audio &amp; Banner Mengambang Otomatis</strong>:
            </p>

            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs">
              <ul className="list-disc list-inside flex flex-col gap-1.5">
                <li>Saat jam kebiasaan tiba (misal: <em>03:00 Bangun Pagi</em> atau <em>03:15 Sholat Tahajud</em>), aplikasi akan langsung memunculkan kartu pengingat di layar atas.</li>
                <li>Aplikasi memainkan <strong>nada dering ramah bersuara dan getaran</strong>.</li>
                <li>Fitur ini <strong>100% TIDAK BISA DIBLOKIR SISTEM HP</strong> karena berjalan langsung di dalam aplikasi web.</li>
              </ul>
            </div>

            <button
              onClick={handleTestSound}
              className="btn-primary py-2.5 px-4 text-xs font-bold justify-center flex items-center gap-2 mt-1"
            >
              <span>🔊</span>
              <span>{soundTested ? '✅ Suara & Getar Sedang Berbunyi!' : 'Uji Coba Suara & Getar Sekarang'}</span>
            </button>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-[var(--border-solid)]">
          <button onClick={onClose} className="btn-secondary w-full justify-center py-2.5 font-bold">
            Tutup Panduan
          </button>
        </div>
      </div>
    </Modal>
  )
}
