import { scoreColor, scoreLabel } from '../utils/metrics'

const styles = {
  green:  { wrap: 'badge-green',  dot: 'bg-emerald-400' },
  yellow: { wrap: 'badge-yellow', dot: 'bg-amber-400' },
  red:    { wrap: 'badge-red',    dot: 'bg-red-400' },
  gray:   { wrap: 'badge-gray',   dot: 'bg-gray-600' },
}

export default function HealthBadge({ score, size = 'sm' }) {
  const color = scoreColor(score)
  const label = scoreLabel(score)
  const s = styles[color]
  const pad = size === 'lg' ? 'px-3 py-1.5 text-sm gap-2' : 'px-2 py-0.5 text-[11px] gap-1.5'

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${s.wrap} ${pad}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot} ${color !== 'gray' ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  )
}
