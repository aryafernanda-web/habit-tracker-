'use client'

import { useState, useMemo } from 'react'
import { useHabits } from '@/lib/context'
import HabitCard from '@/components/HabitCard'
import HabitForm from '@/components/HabitForm'
import Modal from '@/components/Modal'
import type { Habit, Category } from '@/lib/types'
import { todayStr } from '@/lib/utils'

const PRESET_COLORS = ['#3b63fb','#d946ef','#22c55e','#f59e0b','#ef4444','#06b6d4','#8b5cf6','#f97316']
const PRESET_ICONS  = ['⭐','🏃','📚','💪','🧘','💧','🥗','😴','💼','🎯','✍️','🎸']

// ── Category Form ──────────────────────────────────────────────────────────────

interface CatFormProps {
  isOpen: boolean
  onClose: () => void
  editCat?: Category | null
  onSave: (data: Omit<Category, 'id' | 'isDefault'>) => void
}

function CategoryForm({ isOpen, onClose, editCat, onSave }: CatFormProps) {
  const [name,  setName]  = useState(editCat?.name  ?? '')
  const [color, setColor] = useState(editCat?.color ?? '#3b63fb')
  const [icon,  setIcon]  = useState(editCat?.icon  ?? '⭐')
  const [err,   setErr]   = useState('')

  const handleSave = () => {
    if (!name.trim()) { setErr('Nama tidak boleh kosong'); return }
    onSave({ name: name.trim(), color, icon })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editCat ? 'Edit Kategori' : 'Tambah Kategori'} size="sm">
      <div className="flex flex-col gap-4">
        <div>
          <label className="label">Nama</label>
          <input className="input-field" placeholder="Nama kategori..." value={name}
            onChange={e => { setName(e.target.value); setErr('') }} />
          {err && <p className="text-xs mt-1 text-red-500">{err}</p>}
        </div>
        <div>
          <label className="label">Ikon</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_ICONS.map(ic => (
              <button key={ic} type="button" onClick={() => setIcon(ic)}
                className="text-xl p-1.5 rounded-lg transition-all hover:scale-110"
                style={icon === ic ? { background: color + '22', outline: `2px solid ${color}` } : {}}>
                {ic}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Warna</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className="w-8 h-8 rounded-full transition-all hover:scale-110"
                style={{ background: c, outline: color === c ? `3px solid ${c}` : 'none', outlineOffset: '2px' }} />
            ))}
          </div>
        </div>
        {/* Preview */}
        <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: color + '18' }}>
          <span className="text-xl">{icon}</span>
          <span className="font-semibold text-sm" style={{ color }}>{name || 'Preview'}</span>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Batal</button>
          <button onClick={handleSave} className="btn-primary flex-1">Simpan</button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main Habits Page ───────────────────────────────────────────────────────────

export default function HabitsPage() {
  const { habits, categories, todayLogs, toggleHabitLog, incrementLog,
          removeHabit, archiveHabit, addCategory, updateCategory, removeCategory } = useHabits()

  const [tab,        setTab]        = useState<'active'|'archived'|'categories'>('active')
  const [showForm,   setShowForm]   = useState(false)
  const [editHabit,  setEditHabit]  = useState<Habit | null>(null)
  const [catForm,    setCatForm]    = useState(false)
  const [editCat,    setEditCat]    = useState<Category | null>(null)
  const [filterCat,  setFilterCat]  = useState<string>('all')
  const [searchQ,    setSearchQ]    = useState('')

  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])
  const logMap = useMemo(() => new Map(todayLogs.map(l => [l.habitId, l])), [todayLogs])
  const today  = todayStr()

  const activeHabits   = habits.filter(h => !h.archivedAt)
  const archivedHabits = habits.filter(h => !!h.archivedAt)

  const filteredActive = activeHabits
    .filter(h => filterCat === 'all' || h.categoryId === filterCat)
    .filter(h => !searchQ || h.name.toLowerCase().includes(searchQ.toLowerCase()))

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text)' }}>Kebiasaan</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {activeHabits.length} aktif · {archivedHabits.length} arsip
          </p>
        </div>
        <button onClick={() => { setEditHabit(null); setShowForm(true) }} className="btn-primary" id="new-habit-btn">
          + Baru
        </button>
      </div>

      {/* Tabs */}
      <div className="tab-bar mb-5">
        {(['active', 'archived', 'categories'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`tab-item ${tab === t ? 'active' : ''}`}>
            {t === 'active' ? 'Aktif' : t === 'archived' ? 'Arsip' : 'Kategori'}
          </button>
        ))}
      </div>

      {/* ── Active tab ───────────────────────────────────────────────────── */}
      {tab === 'active' && (
        <>
          {/* Search */}
          <div className="relative mb-3">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base" style={{ color: 'var(--text-tertiary)' }}>🔍</span>
            <input
              className="input-field pl-9"
              placeholder="Cari kebiasaan..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              id="search-habits"
            />
          </div>

          {/* Category filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4" style={{ scrollbarWidth: 'none' }}>
            <button
              onClick={() => setFilterCat('all')}
              className="chip flex-shrink-0"
              style={filterCat === 'all'
                ? { background: 'var(--brand)', color: '#fff' }
                : { background: 'var(--surface-tertiary)', color: 'var(--text-secondary)' }}
            >Semua</button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setFilterCat(c.id)}
                className="chip flex-shrink-0"
                style={filterCat === c.id
                  ? { background: c.color, color: '#fff' }
                  : { background: c.color + '18', color: c.color }}
              >{c.icon} {c.name}</button>
            ))}
          </div>

          {filteredActive.length === 0 ? (
            <div className="empty-state glass-card">
              <div className="text-5xl">{searchQ ? '🔍' : '🌱'}</div>
              <div>
                <p className="font-bold" style={{ color: 'var(--text)' }}>
                  {searchQ ? 'Tidak ditemukan' : 'Belum ada kebiasaan'}
                </p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {searchQ ? `Hasil untuk "${searchQ}" kosong` : 'Tambahkan kebiasaan pertamamu'}
                </p>
              </div>
              {!searchQ && <button onClick={() => setShowForm(true)} className="btn-primary">+ Tambah</button>}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredActive.map(habit => (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  log={logMap.get(habit.id)}
                  category={catMap.get(habit.categoryId)}
                  date={today}
                  onToggle={toggleHabitLog}
                  onIncrement={incrementLog}
                  onEdit={h => { setEditHabit(h); setShowForm(true) }}
                  onDelete={h => removeHabit(h.id)}
                  onArchive={h => archiveHabit(h.id)}
                  showActions
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Archived tab ─────────────────────────────────────────────────── */}
      {tab === 'archived' && (
        archivedHabits.length === 0 ? (
          <div className="empty-state glass-card">
            <div className="text-4xl">📦</div>
            <p className="font-bold" style={{ color: 'var(--text)' }}>Tidak ada arsip</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {archivedHabits.map(habit => (
              <div key={habit.id} className="glass-card p-4 flex items-center gap-3 opacity-70">
                <span className="text-2xl">{habit.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold line-through" style={{ color: 'var(--text)' }}>{habit.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Diarsipkan</p>
                </div>
                <button
                  onClick={() => removeHabit(habit.id)}
                  className="text-red-500 text-sm px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                >Hapus</button>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Categories tab ───────────────────────────────────────────────── */}
      {tab === 'categories' && (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={() => { setEditCat(null); setCatForm(true) }} className="btn-secondary text-sm">
              + Kategori Baru
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {categories.map(cat => {
              const count = habits.filter(h => h.categoryId === cat.id && !h.archivedAt).length
              return (
                <div key={cat.id} className="glass-card p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
                    style={{ background: cat.color + '20' }}>
                    {cat.icon}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold" style={{ color: 'var(--text)' }}>{cat.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{count} kebiasaan aktif</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditCat(cat); setCatForm(true) }}
                      className="btn-ghost p-2 text-base"
                    >✏️</button>
                    {!cat.isDefault && (
                      <button
                        onClick={() => removeCategory(cat.id)}
                        className="btn-ghost p-2 text-base text-red-500"
                      >🗑</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Forms */}
      <HabitForm isOpen={showForm} onClose={() => { setShowForm(false); setEditHabit(null) }} editHabit={editHabit} />
      <CategoryForm
        isOpen={catForm}
        onClose={() => { setCatForm(false); setEditCat(null) }}
        editCat={editCat}
        onSave={data => {
          if (editCat) updateCategory({ ...editCat, ...data })
          else addCategory(data)
        }}
      />
    </div>
  )
}
