'use client'

export default function OfflinePage() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-dvh text-center p-8"
      style={{ background: 'var(--surface)' }}
    >
      <div className="text-6xl mb-4">📡</div>
      <h1 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--text)' }}>
        Tidak Ada Koneksi
      </h1>
      <p className="text-sm mb-6 max-w-xs" style={{ color: 'var(--text-secondary)' }}>
        Kamu sedang offline. Data yang tersimpan tetap bisa diakses.
        Sambungkan ke internet untuk memuat ulang.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="btn-primary"
      >
        🔄 Coba Lagi
      </button>
    </div>
  )
}
