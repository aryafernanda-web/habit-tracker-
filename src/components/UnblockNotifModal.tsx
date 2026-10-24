'use client'

import Modal from './Modal'

interface UnblockNotifModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function UnblockNotifModal({ isOpen, onClose }: UnblockNotifModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🔓 Cara Buka Blokir Notifikasi di HP">
      <div className="flex flex-col gap-4 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        <div
          className="p-3.5 rounded-2xl flex items-start gap-3"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <span className="text-2xl flex-shrink-0">⚠️</span>
          <div>
            <p className="font-bold text-sm text-red-500">Notifikasi Diblokir oleh Sistem Android</p>
            <p className="text-[11px] mt-0.5 text-red-400">
              Browser tidak diizinkan menampilkan jendela izin lagi sampai kamu membuka blokir di setelan browser atau HP. Ikuti salah satu cara cepat di bawah:
            </p>
          </div>
        </div>

        {/* Step-by-step Chrome Android */}
        <div className="glass-card p-4 rounded-2xl flex flex-col gap-2.5">
          <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>
            🌐 Cara 1: Buka Blokir Lewat Browser Chrome (Paling Cepat)
          </p>

          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-[var(--brand)] text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">
              1
            </span>
            <div>
              Di bilah atas Chrome (di samping kiri alamat web), ketuk ikon <strong>🔒 (Gembok)</strong> atau ikon <strong>🎛️ (Garis Pengaturan Situs)</strong>.
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-[var(--brand)] text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">
              2
            </span>
            <div>
              Ketuk menu <strong>&quot;Izin&quot; (Permissions)</strong> atau <strong>&quot;Setelan Situs&quot;</strong>.
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-[var(--brand)] text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">
              3
            </span>
            <div>
              Ketuk <strong>&quot;Notifikasi&quot;</strong> lalu ubah dari <em>&quot;Diblokir&quot;</em> menjadi <strong>&quot;Izinkan&quot; (Allow)</strong>.
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-[var(--brand)] text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">
              4
            </span>
            <div>
              Muat ulang (refresh) halaman web ini. Notifikasi kamu kini aktif!
            </div>
          </div>
        </div>

        {/* Step-by-step Android OS Settings */}
        <div className="glass-card p-4 rounded-2xl flex flex-col gap-2.5">
          <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>
            📱 Cara 2: Lewat Pengaturan Sistem HP Android
          </p>

          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">
              1
            </span>
            <div>
              Buka <strong>Pengaturan HP (Settings)</strong> &gt; pilih menu <strong>Aplikasi (Apps)</strong>.
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">
              2
            </span>
            <div>
              Cari aplikasi <strong>Chrome</strong> (atau <strong>Habit Tracker</strong> jika sudah ditambahkan ke Layar Utama).
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">
              3
            </span>
            <div>
              Ketuk menu <strong>Notifikasi</strong> &gt; nyalakan saklar <strong>&quot;Izinkan Notifikasi&quot;</strong>.
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">
              4
            </span>
            <div>
              Buka kembali aplikasi ini dan lakukan uji coba notifikasi.
            </div>
          </div>
        </div>

        {/* In-app fallback note */}
        <div className="p-3 rounded-xl" style={{ background: 'var(--surface-tertiary)' }}>
          <p className="text-[11px] font-medium" style={{ color: 'var(--text)' }}>
            💡 <strong>Solusi Cadangan Otomatis:</strong> Meskipun notifikasi sistem HP diblokir, aplikasi ini tetap memiliki <em>Pengingat Visual &amp; Suara di Dalam Aplikasi</em> saat jam kebiasaan tiba, jadi kamu tidak akan melewatkan jadwal!
          </p>
        </div>

        <button onClick={onClose} className="btn-primary w-full justify-center py-2.5 font-bold">
          Mengerti, Saya Akan Buka Blokir
        </button>
      </div>
    </Modal>
  )
}
