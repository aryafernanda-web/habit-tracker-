'use client'

import { useState, useEffect } from 'react'
import Modal from './Modal'
import type { Habit, Category } from '@/lib/types'
import { useHabits } from '@/lib/context'
import { generateId, validateHabitName } from '@/lib/utils'

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const PRESET_COLORS = [
  '#3b63fb', '#d946ef', '#22c55e', '#f59e0b', '#ef4444',
  '#06b6d4', '#8b5cf6', '#f97316', '#14b8a6', '#ec4899',
]
const PRESET_ICONS = ['⭐', '🏃', '📚', '💪', '🧘', '💧', '🥗', '😴', '💼', '🎯',
                       '✍️', '🎸', '🌱', '🧹', '💰', '📝', '🏊', '🚴', '🙏', '❤️']

interface HabitFormProps {
  isOpen: boolean
  onClose: () => void
  editHabit?: Habit | null
}

const emptyForm = () => ({
  name: '',
  description: '',
  categoryId: '',
  color: '#3b63fb',
  icon: '⭐',
  frequencyType: 'daily' as 'daily' | 'weekly' | 'custom',
  daysOfWeek: [1, 2, 3, 4, 5] as number[],
  intervalDays: 2,
  targetCount: 1,
  reminderTime: '',
})

export default function HabitForm({ isOpen, onClose, editHabit }: HabitFormProps) {
  const { addHabit, updateHabit, categories } = useHabits()
  const [form, setForm] = useState(emptyForm())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editHabit) {
      setForm({
        name: editHabit.name,
        description: editHabit.description ?? '',
        categoryId: editHabit.categoryId,
        color: editHabit.color,
        icon: editHabit.icon,
        frequencyType: editHabit.frequency.type,
        daysOfWeek: editHabit.frequency.daysOfWeek ?? [1,2,3,4,5],
        intervalDays: editHabit.frequency.intervalDays ?? 2,
        targetCount: editHabit.targetCount,
        reminderTime: editHabit.reminderTime ?? '',
      })
    } else {
      setForm(emptyForm())
    }
    setErrors({})
  }, [editHabit, isOpen])

  useEffect(() => {
    if (!form.categoryId && categories.length > 0) {
      setForm(prev => ({ ...prev, categoryId: categories[0].id }))
    }
  }, [categories, form.categoryId])

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
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        categoryId: form.categoryId,
        color: form.color,
        icon: form.icon,
        frequency: {
          type: form.frequencyType,
          ...(form.frequencyType === 'weekly' ? { daysOfWeek: form.daysOfWeek } : {}),
          ...(form.frequencyType === 'custom' ? { intervalDays: form.intervalDays } : {}),
        },
        targetCount: form.targetCount,
        reminderTime: form.reminderTime || undefined,
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

  const toggleDay = (d: number) => {
    setForm(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(d)
        ? prev.daysOfWeek.filter(x => x !== d)
        : [...prev.daysOfWeek, d].sort(),
    }))
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editHabit ? 'Edit Kebiasaan' : 'Tambah Kebiasaan'} size="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Icon & Color row */}
        <div className="flex items-center gap-4">
          {/* Icon picker */}
          <div className="flex flex-col gap-1.5">
            <label className="label">Ikon</label>
            <div className="grid grid-cols-5 gap-1 p-2 rounded-xl" style={{ background: 'var(--surface-tertiary)' }}>
              {PRESET_ICONS.map(ic => (
                <button
                  key={ic} type="button"
                  onClick={() => setForm(p => ({ ...p, icon: ic }))}
                  className={`text-lg p-1.5 rounded-lg transition-all ${form.icon === ic ? 'scale-110' : 'hover:scale-105'}`}
                  style={form.icon === ic ? { boxShadow: `0 0 0 2px ${form.color}`, background: form.color + '22' } : {}}
                >{ic}</button>
              ))}
            </div>
          </div>
          {/* Color picker */}
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="label">Warna</label>
            <div className="grid grid-cols-5 gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c} type="button"
                  onClick={() => setForm(p => ({ ...p, color: c }))}
                  className="aspect-square rounded-lg transition-all hover:scale-110"
                  style={{
                    background: c,
                    outline: form.color === c ? `3px solid ${c}` : 'none',
                    outlineOffset: '2px',
                    transform: form.color === c ? 'scale(1.15)' : undefined,
                  }}
                />
              ))}
            </div>
            {/* Preview */}
            <div className="flex items-center gap-2 mt-1 p-2 rounded-lg" style={{ background: form.color + '18' }}>
              <span className="text-xl">{form.icon}</span>
              <span className="text-sm font-semibold" style={{ color: form.color }}>
                {form.name || 'Preview kebiasaan'}
              </span>
            </div>
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="label" htmlFor="habit-name">Nama Kebiasaan *</label>
          <input
            id="habit-name"
            className="input-field"
            placeholder="Contoh: Olahraga 30 menit"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            maxLength={100}
          />
          {errors.name && <p className="text-xs mt-1 text-red-500">{errors.name}</p>}
        </div>

        {/* Description */}
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

        {/* Category */}
        <div>
          <label className="label" htmlFor="habit-cat">Kategori *</label>
          <select
            id="habit-cat"
            className="input-field"
            value={form.categoryId}
            onChange={e => setForm(p => ({ ...p, categoryId: e.target.value }))}
          >
            <option value="">— Pilih Kategori —</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
          {errors.categoryId && <p className="text-xs mt-1 text-red-500">{errors.categoryId}</p>}
        </div>

        {/* Frequency */}
        <div>
          <label className="label">Frekuensi</label>
          <div className="tab-bar">
            {(['daily', 'weekly', 'custom'] as const).map(t => (
              <button
                key={t} type="button"
                className={`tab-item ${form.frequencyType === t ? 'active' : ''}`}
                onClick={() => setForm(p => ({ ...p, frequencyType: t }))}
              >
                {t === 'daily' ? 'Setiap Hari' : t === 'weekly' ? 'Mingguan' : 'Kustom'}
              </button>
            ))}
          </div>

          {form.frequencyType === 'weekly' && (
            <div className="mt-3">
              <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>Pilih hari:</p>
              <div className="flex gap-1.5 flex-wrap">
                {DAYS.map((day, i) => (
                  <button
                    key={i} type="button"
                    onClick={() => toggleDay(i)}
                    className="w-9 h-9 rounded-full text-xs font-bold transition-all"
                    style={form.daysOfWeek.includes(i)
                      ? { background: form.color, color: '#fff' }
                      : { background: 'var(--surface-tertiary)', color: 'var(--text-secondary)' }
                    }
                  >{day}</button>
                ))}
              </div>
              {errors.days && <p className="text-xs mt-1 text-red-500">{errors.days}</p>}
            </div>
          )}

          {form.frequencyType === 'custom' && (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Setiap</span>
              <input
                type="number" min={1} max={90}
                className="input-field w-20 text-center"
                value={form.intervalDays}
                onChange={e => setForm(p => ({ ...p, intervalDays: Number(e.target.value) }))}
              />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>hari</span>
            </div>
          )}
        </div>

        {/* Target count */}
        <div>
          <label className="label">Target Per Hari</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="w-9 h-9 rounded-xl font-bold text-lg transition-all hover:scale-105"
              style={{ background: 'var(--surface-tertiary)', color: 'var(--text)' }}
              onClick={() => setForm(p => ({ ...p, targetCount: Math.max(1, p.targetCount - 1) }))}
            >−</button>
            <span className="text-xl font-bold w-8 text-center" style={{ color: 'var(--text)' }}>
              {form.targetCount}
            </span>
            <button
              type="button"
              className="w-9 h-9 rounded-xl font-bold text-lg transition-all hover:scale-105"
              style={{ background: 'var(--surface-tertiary)', color: 'var(--text)' }}
              onClick={() => setForm(p => ({ ...p, targetCount: Math.min(99, p.targetCount + 1) }))}
            >+</button>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>kali/hari</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Batal</button>
          <button type="submit" className="btn-primary flex-1" disabled={saving}>
            {saving ? '⏳ Menyimpan…' : editHabit ? '✓ Simpan' : '+ Tambah'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
