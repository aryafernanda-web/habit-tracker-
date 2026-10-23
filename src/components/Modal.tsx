'use client'

import { useEffect, useRef } from 'react'

// ── Track how many modals are open so we never reset overflow too early ──────
let openModalCount = 0

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export default function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      openModalCount++
      document.body.style.overflow = 'hidden'
    }
    return () => {
      if (isOpen) {
        openModalCount--
        if (openModalCount <= 0) {
          openModalCount = 0
          document.body.style.overflow = ''
        }
      }
    }
  }, [isOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizeClass = {
    sm: 'md:max-w-sm',
    md: 'md:max-w-lg',
    lg: 'md:max-w-2xl',
  }[size]

  return (
    <div
      ref={overlayRef}
      className="modal-overlay"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      role="dialog"
      aria-modal="true"
    >
      <div className={`modal-box ${sizeClass}`}>
        {/* Drag handle + header — pinned at top, never scrolls */}
        <div className="px-6 pt-5 pb-1 flex-shrink-0">
          <div className="flex justify-center mb-3 md:hidden">
            <div className="w-10 h-1 rounded-full opacity-40" style={{ background: 'var(--border)' }} />
          </div>

          {title && (
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{title}</h2>
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-[var(--surface-tertiary)]"
                style={{ color: 'var(--text-secondary)' }}
                aria-label="Tutup"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Scrollable body — extra bottom padding so nav bar never clips content */}
        <div className="modal-scroll px-6 pb-10">
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
// Renders as a SIBLING of any parent modal (via its own modal-overlay).
// This avoids the nested-modal body.overflow bug on Android.

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

export function ConfirmDialog({
  isOpen, title, message, confirmLabel = 'Hapus', cancelLabel = 'Batal',
  onConfirm, onCancel, danger = true,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} size="sm">
      <div className="text-center py-2">
        <div className="text-4xl mb-4">{danger ? '⚠️' : '❓'}</div>
        <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>{title}</h3>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1">{cancelLabel}</button>
          <button
            onClick={onConfirm}
            className={danger ? 'btn-danger flex-1' : 'btn-primary flex-1'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
