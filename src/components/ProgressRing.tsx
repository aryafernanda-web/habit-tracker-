'use client'

interface ProgressRingProps {
  percent: number
  size?: number
  strokeWidth?: number
  color?: string
  trackColor?: string
  children?: React.ReactNode
}

export default function ProgressRing({
  percent,
  size = 120,
  strokeWidth = 10,
  color = '#3b63fb',
  trackColor,
  children,
}: ProgressRingProps) {
  const r      = (size - strokeWidth) / 2
  const circ   = 2 * Math.PI * r
  const offset = circ - (percent / 100) * circ
  const center = size / 2

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx={center} cy={center} r={r}
          fill="none"
          stroke={trackColor || 'var(--surface-tertiary)'}
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={center} cy={center} r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.7s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  )
}
