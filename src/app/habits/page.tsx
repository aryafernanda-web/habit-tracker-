'use client'

import { useState, useMemo, useEffect } from 'react'
import { useHabits } from '@/lib/context'
import HabitCard from '@/components/HabitCard'
import HabitForm from '@/components/HabitForm'
import Modal from '@/components/Modal'
import type { Habit, Category } from '@/lib/types'
import { todayStr } from '@/lib/utils'

const PRESET_COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316','#f59e0b','#10b981','#06b6d4','#3b82f6','#84cc16']
const PRESET_ICONS  = ['⭐','🏃','📚','💪','🧘','💧','🥗','😴','💼','🎯','✍️','🎸','🌱','🧹','💰','📝','🏊','🚴','🙏','❤️']

// ── Category Form ──────────────────────────────────────────────────────────────

interface CatFormProps {
  isOpen: boolean
  onClose: () => void
  editCat?: Category | null
  onSave: (data: Omit<Category, 'id' | 'isDefault'>) => void
}

function CategoryForm({ isOpen, onClose, editCat, onSave }: CatFormProps) {
  const [name,  setName]  = useState(editCat?.name  ?? '')
  const [color, setColor] = useState(editCat?.color ?? '#6366f1')
  const [icon,  setIcon]  = useState(editCat?.icon  ?? '⭐')
  const [err,   setErr]   = useState('')

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setName(editCat?.name  ?? '')
      setColor(editCat?.color ?? '#6366f1')
      setIcon(editCat?.icon  ?? '⭐')
      setErr('')
    }
  }, [isOpen, editCat])

  const handleSave = () => {
    if (!name.trim()) { setErr('Nama tidak boleh kosong'); return }
    onSave({ name: name.trim(), color, icon })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editCat ? 'Edit Kategori' : 'Tambah Kategori'} size="sm">
      <div className="flex flex-col gap-4">
        <div>
          <label className="label">Nama Kategori</label>
          <input
            className="input-field"
            placeholder="Nama kategori..."
            value={name}
            onChange={e => { setName(e.target.value); setErr('') }}
            autoFocus
          />
          {err && <p className="text-xs mt-1.5 text-red-500 font-medium">⚠ {err}</p>}
        </div>

        <div>
          <label className="label">Ikon</label>
          <div className="flex flex-wrap gap-1.5 p-2 rounded-2xl" style={{ background: 'var(--surface-tertiary)' }}>
            {PRESET_ICONS.map(ic => (
              <button
                key={ic} type="button"
                onClick={() => setIcon(ic)}
                className="text-xl p-1.5 rounded-xl transition-all hover:scale-110"
                style={icon === ic
                  ? { background: color + '22', boxShadow: `0 0 0 2px ${color}` }
                  : {}}
              >{ic}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Warna</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map(c => (
              <button
                key={c} type="button"
                onClick={() => setColor(c)}
                className="w-9 h-9 rounded-full transition-all hover:scale-110"
                style={{
                  background: c,
                  transform: color === c ? 'scale(1.2)' : undefined,
                  boxShadow: color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : undefined,
                }}
              />
            ))}
          </div>
        </div>

        {/* Preview */}
        <div
          className="flex items-center gap-3 p-3 rounded-2xl"
          style={{ background: color + '15', border: `1.5px solid ${color}30` }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{ background: color + '30' }}
          >{icon}</div>
          <div>
            <p className="font-bold text-sm" style={{ color }}>{name || 'Preview Kategori'}</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Kategori kebiasaan</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Batal</button>
          <button onClick={handleSave} className="btn-primary flex-1">
            {editCat ? 'Simpan Perubahan' : 'Tambah Kategori'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main Habits Page ───────────────────────────────────────────────────────────

export default function HabitsPage() {
  const {
    habits, categories, logs, toggleHabitLog, incrementLog,
    removeHabit, archiveHabit, addCategory, updateCategory, removeCategory,
  } = useHabits()

  const [tab,       setTab]       = useState<'active' | 'archived' | 'categories'>('active')
  const [showForm,  setShowForm]  = useState(false)
  const [editHabit, setEditHabit] = useState<Habit | null>(null)
  const [catForm,   setCatForm]   = useState(false)
  const [editCat,   setEditCat]   = useState<Category | null>(null)
  const [filterCat, setFilterCat] = useState<string>('all')
  const [searchQ,   setSearchQ]   = useState('')

  const today  = todayStr()
  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])
  const logMap = useMemo(() => {
    const map = new Map()
    logs.forEach(l => {
      if (l.date === today) map.set(l.habitId, l)
    })
    return map
  }, [logs, today])

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
          <h1 className="text-2xl font-black" style={{ color: 'var(--text)' }}>Kebiasaan</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {activeHabits.length} aktif · {archivedHabits.length} diarsipkan
          </p>
        </div>
        <button
          onClick={() => { setEditHabit(null); setShowForm(true) }}
          className="btn-primary gap-1.5"
          id="new-habit-btn"
        >
          + Baru
        </button>
      </div>

      {/* Tabs */}
      <div className="tab-bar mb-5">
        {(['active', 'archived', 'categories'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`tab-item ${tab === t ? 'active' : ''}`}
          >
            {t === 'active' ? `✓ Aktif (${activeHabits.length})` : t === 'archived' ? `📦 Arsip` : '🏷 Kategori'}
          </button>
        ))}
      </div>

      {/* ── Active tab ────────────────────────────────────────────────── */}
      {tab === 'active' && (
        <>
          {/* Search */}
          <div className="relative mb-3">
            <span
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm"
              style={{ color: 'var(--text-tertiary)' }}
            >🔍</span>
            <input
              className="input-field pl-9"
              placeholder="Cari kebiasaan..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              id="search-habits"
            />
          </div>

          {/* Category filter chips */}
          <div
            className="flex gap-2 overflow-x-auto pb-2 mb-4"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <button
              onClick={() => setFilterCat('all')}
              className="chip flex-shrink-0"
              style={filterCat === 'all'
                ? { background: 'var(--brand)', color: '#fff' }
                : { background: 'var(--surface-tertiary)', color: 'var(--text-secondary)' }}
            >
              Semua
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setFilterCat(c.id)}
                className="chip flex-shrink-0"
                style={filterCat === c.id
                  ? { background: c.color, color: '#fff', boxShadow: `0 4px 12px ${c.color}44` }
                  : { background: c.color + '18', color: c.color }}
              >
                {c.icon} {c.name}
              </button>
            ))}
          </div>

          {filteredActive.length === 0 ? (
            <div className="empty-state glass-card">
              <div className="text-5xl">{searchQ ? '🔍' : '🌱'}</div>
              <div>
                <p className="font-bold" style={{ color: 'var(--text)' }}>
                  {searchQ ? 'Tidak ditemukan' : 'Belum ada kebiasaan'}
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {searchQ
                    ? `Tidak ada hasil untuk "${searchQ}"`
                    : 'Tambahkan kebiasaan pertamamu'}
                </p>
              </div>
              {!searchQ && (
                <button onClick={() => setShowForm(true)} className="btn-primary">
                  + Tambah Kebiasaan
                </button>
              )}
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

      {/* ── Archived tab ──────────────────────────────────────────────── */}
      {tab === 'archived' && (
        archivedHabits.length === 0 ? (
          <div className="empty-state glass-card">
            <div className="text-4xl">📦</div>
            <p className="font-bold" style={{ color: 'var(--text)' }}>Tidak ada arsip</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Kebiasaan yang diarsipkan akan muncul di sini
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {archivedHabits.map(habit => (
              <div key={habit.id} className="glass-card p-4 flex items-center gap-3 opacity-60">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: habit.color + '20' }}
                >
                  {habit.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm line-through truncate" style={{ color: 'var(--text)' }}>
                    {habit.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Diarsipkan</p>
                </div>
                <button
                  onClick={() => removeHabit(habit.id)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex-shrink-0"
                >Hapus</button>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Categories tab ────────────────────────────────────────────── */}
      {tab === 'categories' && (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => { setEditCat(null); setCatForm(true) }}
              className="btn-secondary text-sm"
            >
              + Kategori Baru
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {categories.map(cat => {
              const count = habits.filter(h => h.categoryId === cat.id && !h.archivedAt).length
              return (
                <div key={cat.id} className="glass-card p-4 flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ background: cat.color + '20' }}
                  >
                    {cat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold" style={{ color: 'var(--text)' }}>{cat.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {count} kebiasaan aktif
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => { setEditCat(cat); setCatForm(true) }}
                      className="btn-ghost p-2 text-base rounded-xl"
                    >✏️</button>
                    {!cat.isDefault && (
                      <button
                        onClick={() => removeCategory(cat.id)}
                        className="btn-ghost p-2 text-base rounded-xl text-red-400"
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
      <HabitForm
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditHabit(null) }}
        editHabit={editHabit}
      />
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
