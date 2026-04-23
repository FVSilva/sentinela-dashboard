import { useState, startTransition } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MessageSquare, DollarSign } from 'lucide-react'
import CommunicationCalendar from './CommunicationCalendar'
import HealthBadge from './HealthBadge'
import ChurnBadge from './ChurnBadge'
import ClientModal from './ClientModal'
import { formatFee } from '../utils/metrics'

function StatBox({ label, value, color = 'default' }) {
  const vc = { default: 'text-white', green: 'text-emerald-400', yellow: 'text-amber-400', red: 'text-red-400' }
  return (
    <div className="surface-1 rounded-xl p-3">
      <div className="text-[10px] text-gray-600 mb-1 uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-bold leading-none ${vc[color]}`}>{value}</div>
    </div>
  )
}

export default function ClientCard({ client, onMarkChurn }) {
  const [open, setOpen] = useState(false)
  const silentColor = client.silentDays >= 7 ? 'red' : client.silentDays >= 3 ? 'yellow' : 'green'

  return (
    <>
      <div
        className="card cursor-pointer hover:border-white/[0.12] active:scale-[0.99] transition-all duration-200 select-none"
        onClick={() => startTransition(() => setOpen(true))}
      >
        {/* Accent bar for high churn */}
        {client.churnRisk.color === 'red' && (
          <div className="h-0.5 w-full"
            style={{ background: 'linear-gradient(90deg, #be123c, #f43f5e 40%, transparent)' }} />
        )}

        <div className="p-5">
          {/* Name + fee */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <h3 className="text-[15px] font-bold text-white leading-tight">{client.name}</h3>
                {client.squad && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-500 border border-white/[0.06] uppercase tracking-wide">
                    {client.squad}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <HealthBadge score={client.healthScore} />
                <ChurnBadge risk={client.churnRisk} />
              </div>
            </div>
            <div className="flex flex-col items-end flex-shrink-0">
              <div className="flex items-center gap-1 text-white font-bold text-base leading-tight">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                {formatFee(client.fee)}
              </div>
              <div className="text-[10px] text-gray-600 mt-0.5 uppercase tracking-wider">fee/mês</div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <StatBox label="Sem falar" value={client.silentDays === 0 ? 'Hoje' : `${client.silentDays}d`} color={silentColor} />
            <StatBox label="Check-ins" value={client.checkIns.length} />
            <StatBox label="Msgs" value={client.messages.length || '—'} />
          </div>

          {/* Calendar */}
          <CommunicationCalendar
            communicationDays={client.communicationDays}
            compact
            days={30}
          />

          {/* Footer hint */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
            {client.groupName !== client.name
              ? <span className="text-[10px] text-gray-700 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />{client.groupName}
                </span>
              : <span />}
            <span className="text-[10px] text-gray-700">Clique para detalhes →</span>
          </div>
        </div>
      </div>

      {open && (
        <ClientModal
          client={client}
          onClose={() => setOpen(false)}
          onMarkChurn={onMarkChurn ? (c) => { onMarkChurn(c); setOpen(false) } : null}
        />
      )}
    </>
  )
}
