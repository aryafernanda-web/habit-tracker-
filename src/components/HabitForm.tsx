'use client'

import { useState, useEffect } from 'react'
import Modal, { ConfirmDialog } from './Modal'
import type { Habit } from '@/lib/types'
import { useHabits } from '@/lib/context'
import { generateId, validateHabitName } from '@/lib/utils'

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#84cc16',
]

const PRESET_ICONS = [
  '⭐', '🏃', '📚', '💪', '🧘', '💧', '🥗', '😴', '💼', '🎯',
  '✍️', '🎸', '🌱', '🧹', '💰', '📝', '🏊', '🚴', '🙏', '❤️',
  '🧠', '🏋️', '🎨', '🎵', '🌅',
]

interface HabitFormProps {
  isOpen: boolean
  onClose: () => void
  editHabit?: Habit | null
  onDelete?: (habitId: string) => Promise<void> | void
}

const emptyForm = () => ({
  name: '',
  description: '',
  categoryId: '',
  color: '#6366f1',
  icon: '⭐',
  frequencyType: 'daily' as 'daily' | 'weekly' | 'custom',
  daysOfWeek: [1, 2, 3, 4, 5] as number[],
  intervalDays: 2,
  targetCount: 1,
  reminderEnabled: true,
  reminderTime: '08:00',
})

export default function HabitForm({ isOpen, onClose, editHabit, onDelete }: HabitFormProps) {
  const { addHabit, updateHabit, removeHabit, categories } = useHabits()
  const [form,          setForm]          = useState(emptyForm())
  const [errors,        setErrors]        = useState<Record<string, string>>({})
  const [saving,        setSaving]        = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (editHabit) {
        setForm({
          name:            editHabit.name || '',
          description:     editHabit.description || '',
          categoryId:      editHabit.categoryId || (categories[0]?.id ?? ''),
          color:           editHabit.color || '#6366f1',
          icon:            editHabit.icon || '⭐',
          frequencyType:   editHabit.frequency?.type ?? 'daily',
          daysOfWeek:      editHabit.frequency?.daysOfWeek ?? [1, 2, 3, 4, 5],
          intervalDays:    editHabit.frequency?.intervalDays ?? 2,
          targetCount:     editHabit.targetCount ?? 1,
          reminderEnabled: editHabit.reminderEnabled ?? true,
          reminderTime:    editHabit.reminderTime ?? '08:00',
        })
      } else {
        setForm({
          ...emptyForm(),
          categoryId: categories[0]?.id ?? '',
        })
      }
      setErrors({})
      setConfirmDelete(false)
    }
  }, [editHabit, isOpen, categories])

  function validate(): boolean {
    const e: Record<string, string> = {}
    const nameErr = validateHabitName(form.name)
    if (nameErr) e.name = nameErr
    if (!form.categoryId) e.categoryId = 'Pilih kategori'
    if (form.frequencyType === 'weekly' && form.daysOfWeek.length === 0)
      e.days = 'Pilih minimal 1 hari'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      const habitData = {
        name:            form.name.trim(),
        description:     form.description.trim() || '',
        categoryId:      form.categoryId,
        color:           form.color,
        icon:            form.icon,
        frequency: {
          type:         form.frequencyType,
          ...(form.frequencyType === 'weekly' ? { daysOfWeek: form.daysOfWeek } : {}),
          ...(form.frequencyType === 'custom'  ? { intervalDays: form.intervalDays } : {}),
        },
        targetCount:     Number(form.targetCount) || 1,
        reminderEnabled: Boolean(form.reminderEnabled),
        reminderTime:    form.reminderTime || '08:00',
      }
      if (editHabit) {
        await updateHabit({ ...editHabit, ...habitData })
      } else {
        await addHabit(habitData)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editHabit) return
    setSaving(true)
    try {
      if (onDelete) {
        await onDelete(editHabit.id)
      } else {
        await removeHabit(editHabit.id)
      }
      setConfirmDelete(false)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const toggleDay = (d: number) => {
    setForm(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(d)
        ? prev.daysOfWeek.filter(x => x !== d)
        : [...prev.daysOfWeek, d].sort(),
    }))
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editHabit ? 'Edit Kebiasaan' : 'Tambah Kebiasaan Baru'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* ── Icon + Color ───────────────────────────────────────────────── */}
        <div className="flex gap-4">
          {/* Icon picker */}
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <label className="label">Ikon</label>
            <div
              className="grid grid-cols-5 gap-1 p-2 rounded-2xl"
              style={{ background: 'var(--surface-tertiary)', maxHeight: '160px', overflowY: 'auto' }}
            >
              {PRESET_ICONS.map(ic => (
                <button
                  key={ic} type="button"
                  onClick={() => setForm(p => ({ ...p, icon: ic }))}
                  className="text-xl p-1.5 rounded-xl transition-all hover:scale-110"
                  style={form.icon === ic
                    ? { boxShadow: `0 0 0 2px ${form.color}`, background: form.color + '22', transform: 'scale(1.15)' }
                    : {}}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker + preview */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <label className="label">Warna</label>
            <div className="grid grid-cols-5 gap-2 mb-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c} type="button"
                  onClick={() => setForm(p => ({ ...p, color: c }))}
                  className="aspect-square rounded-xl transition-all hover:scale-110"
                  style={{
                    background: c,
                    transform: form.color === c ? 'scale(1.2)' : undefined,
                    boxShadow: form.color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : undefined,
                  }}
                />
              ))}
            </div>
            {/* Preview card */}
            <div
              className="flex items-center gap-2.5 p-3 rounded-2xl flex-1"
              style={{ background: form.color + '18' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: form.color + '30' }}
              >
                {form.icon}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: form.color }}>
                  {form.name || 'Preview kebiasaan'}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {form.description || 'Deskripsi kebiasaan'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Name ──────────────────────────────────────────────────────── */}
        <div>
          <label className="label" htmlFor="habit-name">Nama Kebiasaan *</label>
          <input
            id="habit-name"
            className="input-field"
            placeholder="Contoh: Olahraga 30 menit"
            value={form.name}
            onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setErrors(x => ({ ...x, name: '' })) }}
            maxLength={100}
          />
          {errors.name && <p className="text-xs mt-1.5 text-red-500 font-medium">⚠ {errors.name}</p>}
        </div>

        {/* ── Description ───────────────────────────────────────────────── */}
        <div>
          <label className="label" htmlFor="habit-desc">Deskripsi (opsional)</label>
          <textarea
            id="habit-desc"
            className="input-field resize-none"
            placeholder="Catatan singkat tentang kebiasaan ini..."
            rows={2}
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          />
        </div>

        {/* ── Category ──────────────────────────────────────────────────── */}
        <div>
          <label className="label" htmlFor="habit-cat">Kategori *</label>
          <select
            id="habit-cat"
            className="input-field"
            value={form.categoryId}
            onChange={e => { setForm(p => ({ ...p, categoryId: e.target.value })); setErrors(x => ({ ...x, categoryId: '' })) }}
          >
            <option value="">— Pilih Kategori —</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
          {errors.categoryId && <p className="text-xs mt-1.5 text-red-500 font-medium">⚠ {errors.categoryId}</p>}
        </div>

        {/* ── Frequency ─────────────────────────────────────────────────── */}
        <div>
          <label className="label">Frekuensi</label>
          <div className="tab-bar">
            {(['daily', 'weekly', 'custom'] as const).map(t => (
              <button
                key={t} type="button"
                className={`tab-item ${form.frequencyType === t ? 'active' : ''}`}
                onClick={() => setForm(p => ({ ...p, frequencyType: t }))}
              >
                {t === 'daily' ? '📅 Harian' : t === 'weekly' ? '📆 Mingguan' : '🔄 Kustom'}
              </button>
            ))}
          </div>

          {form.frequencyType === 'weekly' && (
            <div className="mt-3">
              <p className="text-xs mb-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>Pilih hari:</p>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map((day, i) => (
                  <button
                    key={i} type="button"
                    onClick={() => toggleDay(i)}
                    className="w-10 h-10 rounded-full text-xs font-bold transition-all hover:scale-105"
                    style={form.daysOfWeek.includes(i)
                      ? { background: form.color, color: '#fff', boxShadow: `0 4px 12px ${form.color}44` }
                      : { background: 'var(--surface-tertiary)', color: 'var(--text-secondary)' }
                    }
                  >{day}</button>
                ))}
              </div>
              {errors.days && <p className="text-xs mt-1.5 text-red-500 font-medium">⚠ {errors.days}</p>}
            </div>
          )}

          {form.frequencyType === 'custom' && (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Setiap</span>
              <input
                type="number" min={1} max={90}
                className="input-field w-20 text-center"
                value={form.intervalDays}
                onChange={e => setForm(p => ({ ...p, intervalDays: Math.max(1, Math.min(90, Number(e.target.value))) }))}
              />
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>hari sekali</span>
            </div>
          )}
        </div>

        {/* ── Target count ───────────────────────────────────────────────── */}
        <div>
          <label className="label">Target Per Hari</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="w-10 h-10 rounded-xl font-bold text-lg transition-all hover:scale-105"
              style={{ background: 'var(--surface-tertiary)', color: 'var(--text)' }}
              onClick={() => setForm(p => ({ ...p, targetCount: Math.max(1, p.targetCount - 1) }))}
            >−</button>
            <div
              className="w-16 h-10 rounded-xl flex items-center justify-center text-xl font-extrabold"
              style={{ background: form.color + '15', color: form.color }}
            >
              {form.targetCount}
            </div>
            <button
              type="button"
              className="w-10 h-10 rounded-xl font-bold text-lg transition-all hover:scale-105"
              style={{ background: 'var(--surface-tertiary)', color: 'var(--text)' }}
              onClick={() => setForm(p => ({ ...p, targetCount: Math.min(99, p.targetCount + 1) }))}
            >+</button>
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>kali/hari</span>
          </div>
        </div>

        {/* ── Reminder / Notification time ────────────────────────────────── */}
        <div
          className="rounded-2xl p-4"
          style={{ background: 'var(--surface-secondary)', border: '1.5px solid var(--border-solid)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔔</span>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>Pengingat Harian</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Notifikasi di waktu tertentu
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.reminderEnabled}
              onClick={() => setForm(p => ({ ...p, reminderEnabled: !p.reminderEnabled }))}
              className="toggle"
              style={{ background: form.reminderEnabled ? form.color : 'var(--border-solid)' }}
            >
              <span
                className="toggle-knob"
                style={{ left: form.reminderEnabled ? '26px' : '4px' }}
              />
            </button>
          </div>

          {form.reminderEnabled && (
            <div className="animate-fade-in">
              <label className="label" htmlFor="reminder-time">Waktu Pengingat</label>
              <input
                id="reminder-time"
                type="time"
                className="input-field"
                value={form.reminderTime}
                onChange={e => setForm(p => ({ ...p, reminderTime: e.target.value }))}
              />
              <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                ⚠️ Notifikasi hanya berfungsi saat aplikasi terbuka atau diinstal sebagai PWA
              </p>
            </div>
          )}
        </div>

        {/* ── Actions ───────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 pt-2">
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3 text-sm">
              Batal
            </button>
            <button type="submit" className="btn-primary flex-1 py-3 text-sm font-bold" disabled={saving}>
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin text-xs">◌</span> Menyimpan…
                </span>
              ) : editHabit ? '✓ Simpan Perubahan' : '+ Tambah Kebiasaan'}
            </button>
          </div>

          {/* Delete button when editing */}
          {editHabit && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2 border border-red-500/25 mt-1"
            >
              🗑 Hapus Kebiasaan Ini
            </button>
          )}
        </div>
      </form>

      {/* Confirmation Dialog for Delete from Form */}
      {editHabit && (
        <ConfirmDialog
          isOpen={confirmDelete}
          title="Hapus Kebiasaan?"
          message={`"${editHabit.name}" dan riwayatnya akan dihapus permanen.`}
          confirmLabel="Hapus Permanen"
          cancelLabel="Batal"
          danger
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </Modal>
  )
}
