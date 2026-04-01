const styles = {
  green:  { badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25', bar: 'bg-emerald-500' },
  yellow: { badge: 'bg-amber-500/10   text-amber-400   border-amber-500/25',   bar: 'bg-amber-500' },
  red:    { badge: 'bg-red-500/10     text-red-400     border-red-500/25',     bar: 'bg-red-500' },
}

export default function ChurnBadge({ risk, showBar = false }) {
  const { score, label, color } = risk
  const s = styles[color] || styles.green

  return (
    <div className="flex flex-col gap-1.5">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium border ${s.badge}`}>
        <span className="opacity-60">churn</span>
        <span className="font-semibold">{label}</span>
      </span>
      {showBar && (
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${s.bar}`}
            style={{ width: `${score}%` }}
          />
        </div>
      )}
    </div>
  )
}
