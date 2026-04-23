import { useMemo } from 'react'
import { buildCalendarDays } from '../utils/metrics'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function DayCell({ day, compact, selected, onClick, todayKey }) {
  const isToday    = todayKey === day.key
  const isSelected = selected === day.key

  return (
    <button
      type="button"
      title={`${format(day.date, "EEEE, d 'de' MMMM", { locale: ptBR })} — ${day.active ? 'Comunicação ativa' : 'Sem comunicação'}`}
      onClick={() => onClick(day.key)}
      className={[
        'flex items-center justify-center rounded-lg select-none transition-all duration-150 font-medium cursor-pointer',
        compact ? 'h-7 w-7 text-[10px]' : 'h-8 w-8 text-[11px]',
        isSelected
          ? 'bg-accent-600 text-white border border-accent-500 shadow-[0_0_12px_rgba(225,29,72,0.5)] scale-110 z-10 relative'
          : day.active
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 hover:scale-105'
            : 'bg-white/[0.03] text-gray-700 border border-white/[0.04] hover:bg-white/[0.07] hover:text-gray-500',
        isToday && !isSelected ? 'ring-2 ring-accent-600/60 ring-offset-1 ring-offset-[#111113]' : '',
      ].filter(Boolean).join(' ')}
    >
      {format(day.date, compact ? 'd' : 'dd')}
    </button>
  )
}

export default function CommunicationCalendar({
  communicationDays,
  compact = false,
  days = 30,
  selectedDay = null,
  onDaySelect,
}) {
  const todayKey = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])
  const calDays  = useMemo(() => buildCalendarDays(communicationDays, days), [communicationDays, days])
  const activeDays = calDays.filter(d => d.active).length
  const pct        = Math.round((activeDays / days) * 100)

  function handleClick(key) {
    if (!onDaySelect) return
    onDaySelect(selectedDay === key ? null : key) // toggle off if same day
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-gray-600">
          {selectedDay
            ? <span className="text-accent-400 font-medium">
                {format(new Date(selectedDay + 'T12:00:00'), "d 'de' MMMM", { locale: ptBR })} selecionado
              </span>
            : `Últimos ${days} dias`}
        </span>
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-14 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11px] font-semibold text-emerald-400">{activeDays}d ativos</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {calDays.map(day => (
          <DayCell
            key={day.key}
            day={day}
            compact={compact}
            selected={selectedDay}
            onClick={handleClick}
            todayKey={todayKey}
          />
        ))}
      </div>
      {selectedDay && onDaySelect && (
        <button
          onClick={() => onDaySelect(null)}
          className="text-[10px] text-gray-700 hover:text-gray-500 transition-colors"
        >
          ✕ limpar seleção
        </button>
      )}
    </div>
  )
}
