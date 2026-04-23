import { useState, useMemo, useEffect } from 'react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  X, Users, Calendar, AlertTriangle, CheckCircle,
  Clock, Layers, Sparkles, MessageSquare, Info, DollarSign, TrendingDown
} from 'lucide-react'
import CommunicationCalendar from './CommunicationCalendar'
import HealthBadge from './HealthBadge'
import ChurnBadge from './ChurnBadge'
import { formatFee, scoreColor } from '../utils/metrics'

/* ── date helpers ────────────────────────────────────────── */
/** Normalize any date string to "YYYY-MM-DD" */
function toYMD(d) {
  if (!d) return null
  const s = String(d).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return null
}

/* ── helpers ────────────────────────────────────────────── */
function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-3.5 h-3.5 text-red-600" />
      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">{children}</span>
    </div>
  )
}

function SenderBar({ name, count, max, rank }) {
  const pct = max ? Math.round((count / max) * 100) : 0
  const rankColors = ['text-red-400', 'text-gray-300', 'text-gray-500']
  return (
    <div className="flex items-center gap-2.5">
      <span className={`text-xs font-bold w-4 text-center ${rankColors[rank] || 'text-gray-600'}`}>{rank + 1}</span>
      <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-gray-400 flex-shrink-0">
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-300 truncate max-w-[160px]">{name}</span>
          <span className="text-[10px] text-gray-600 ml-2">{count}</span>
        </div>
        <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: rank === 0 ? '#e11d48' : '#374151' }} />
        </div>
      </div>
    </div>
  )
}

function CheckInRow({ checkIn, isLatest }) {
  const color     = scoreColor(checkIn.flag)
  const dotColors = { green: 'bg-emerald-400', yellow: 'bg-amber-400', red: 'bg-red-400', gray: 'bg-gray-600' }
  const date      = checkIn.data
    ? (() => { try { return format(parseISO(checkIn.data), "d MMM yy", { locale: ptBR }) } catch { return checkIn.data } })()
    : '—'
  const duration = checkIn.Tempo ? `${Math.round(Number(checkIn.Tempo) / 60)}min` : null

  return (
    <div className={`flex items-start gap-3 py-3 border-b border-white/[0.04] last:border-0 ${isLatest ? '' : 'opacity-60'}`}>
      <div className="flex flex-col items-center gap-1 mt-0.5 flex-shrink-0">
        <span className={`w-2 h-2 rounded-full ${dotColors[color]}`} />
        {isLatest && <span className="text-[8px] text-red-500 font-bold">NOW</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-xs font-semibold text-gray-200">{date}</span>
          {checkIn.account && <span className="text-[11px] text-gray-500">{checkIn.account}</span>}
          {duration && <span className="text-[10px] text-gray-600 flex items-center gap-1 ml-auto"><Clock className="w-3 h-3" />{duration}</span>}
        </div>
        {checkIn.analise_sentinela && (
          <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-3">{checkIn.analise_sentinela}</p>
        )}
      </div>
    </div>
  )
}

/* ── Conversation Log ────────────────────────────────────── */
function ConversationLog({ messages, selectedDay }) {
  const dayMessages = useMemo(() => {
    if (!selectedDay || !messages?.length) return []
    return messages.filter(msg => {
      const ts = msg.sent_at || msg.created_at
      return ts && ts.slice(0, 10) === selectedDay
    })
  }, [messages, selectedDay])

  if (!selectedDay || dayMessages.length === 0) return null

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-3.5 h-3.5 text-gray-600" />
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
          Conversa do dia
        </span>
        <span className="text-[10px] text-gray-700 ml-1">({dayMessages.length} mensagens)</span>
      </div>
      <div className="surface-1 rounded-xl max-h-72 overflow-y-auto divide-y divide-white/[0.03]">
        {dayMessages.map((msg, i) => {
          const text   = msg.body || msg.text || msg.message || msg.content || ''
          const sender = msg.sender_name || msg.sender_phone || 'Desconhecido'
          const ts     = msg.sent_at || msg.created_at
          const time   = ts ? (() => { try { return format(parseISO(ts), 'HH:mm') } catch { return '' } })() : ''
          return (
            <div key={i} className="px-3 py-2 flex gap-2.5">
              <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[9px] font-bold text-gray-500 flex-shrink-0 mt-0.5">
                {sender.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-semibold text-gray-400 truncate max-w-[140px]">{sender}</span>
                  {time && <span className="text-[9px] text-gray-700 ml-auto flex-shrink-0">{time}</span>}
                </div>
                {text
                  ? <p className="text-[11px] text-gray-400 leading-relaxed break-words">{text}</p>
                  : <p className="text-[10px] text-gray-700 italic">— mídia/arquivo —</p>
                }
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── AI Panel ────────────────────────────────────────────── */
function AIPanel({ client, selectedDay }) {
  const [tab, setTab] = useState('grupo')

  const wppForDay = useMemo(() => {
    if (!selectedDay) return client.wppHistory[0] || null
    // Exact day match only — no fallback when a specific day is selected
    return client.wppHistory.find(w => toYMD(w.Data) === selectedDay) || null
  }, [selectedDay, client.wppHistory])

  const checkInForDay = useMemo(() => {
    if (!selectedDay) return client.checkIns[0] || null
    if (!client.checkIns.length) return null
    return client.checkIns.reduce((closest, ci) => {
      if (!ci.data) return closest
      const diff    = Math.abs(differenceInDays(parseISO(ci.data), new Date(selectedDay)))
      const bestDiff = closest?.data ? Math.abs(differenceInDays(parseISO(closest.data), new Date(selectedDay))) : Infinity
      return diff < bestDiff ? ci : closest
    }, null)
  }, [selectedDay, client.checkIns])

  const grupoText   = wppForDay?.['Analise I.A'] || null
  const checkinText = checkInForDay?.analise_sentinela || null
  const hasGrupo    = Boolean(grupoText)
  const hasCheckin  = Boolean(checkinText)

  const dayLabel = selectedDay
    ? (() => { try { return format(new Date(selectedDay + 'T12:00:00'), "d 'de' MMMM", { locale: ptBR }) } catch { return selectedDay } })()
    : 'mais recente'

  const activeTab = (tab === 'grupo' && !hasGrupo && hasCheckin) ? 'checkin'
    : (tab === 'checkin' && !hasCheckin && hasGrupo) ? 'grupo'
    : tab

  const content = activeTab === 'grupo' ? grupoText : checkinText

  return (
    <div className="space-y-3">
      {selectedDay && (
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-white/[0.05]" />
          <span className="text-[10px] text-red-500 font-medium px-2 py-0.5 rounded-full border border-red-900/40 bg-red-950/20">
            {dayLabel}
          </span>
          <div className="h-px flex-1 bg-white/[0.05]" />
        </div>
      )}
      <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/[0.05] rounded-xl w-fit">
        {[
          { id: 'grupo', label: 'WhatsApp', icon: MessageSquare, ok: hasGrupo },
          { id: 'checkin', label: 'Check-in', icon: CheckCircle, ok: hasCheckin },
        ].map(t => (
          <button key={t.id} onClick={() => t.ok && setTab(t.id)} disabled={!t.ok}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all',
              activeTab === t.id ? 'tab-active border' : t.ok ? 'text-gray-500 hover:text-gray-300' : 'text-gray-800 cursor-not-allowed',
            ].join(' ')}>
            <t.icon className="w-3 h-3" />{t.label}
          </button>
        ))}
      </div>
      <div className="surface-1 rounded-xl p-4 min-h-[100px] max-h-64 overflow-y-auto"
        style={selectedDay ? { borderColor: 'rgba(159,18,57,0.2)' } : {}}>
        {content
          ? <p key={`${activeTab}-${selectedDay}`} className="text-[12px] text-gray-300 leading-relaxed whitespace-pre-wrap animate-fade-in">{content}</p>
          : <div className="flex flex-col items-center justify-center h-16 gap-2 opacity-40">
              <Info className="w-4 h-4 text-gray-600" />
              <p className="text-[11px] text-gray-700 italic">
                {selectedDay ? 'Transcrição indisponível para este dia.' : 'Sem análise disponível.'}
              </p>
            </div>
        }
      </div>
      {(wppForDay || checkInForDay) && (
        <div className="flex items-center gap-4 text-[10px] text-gray-700">
          {wppForDay?.Data && <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />WPP: {wppForDay.Data} · {wppForDay['Health Score'] || '—'}</span>}
          {checkInForDay?.data && <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" />Check-in: {(() => { try { return format(parseISO(checkInForDay.data), "d MMM", { locale: ptBR }) } catch { return checkInForDay.data } })()}</span>}
        </div>
      )}
    </div>
  )
}

/* ── Modal ───────────────────────────────────────────────── */
export default function ClientModal({ client, onClose, onMarkChurn }) {
  const [selectedDay,   setSelectedDay]   = useState(null)
  const [confirmChurn,  setConfirmChurn]  = useState(false)
  const maxMessages = client.topSenders[0]?.count || 1
  const silentColor = client.silentDays >= 7 ? 'red' : client.silentDays >= 3 ? 'yellow' : 'green'
  const silentVC    = { red: 'text-red-400', yellow: 'text-amber-400', green: 'text-emerald-400' }

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-white/[0.08] overflow-hidden animate-fade-in"
        style={{ background: '#111113', boxShadow: '0 0 0 1px rgba(225,29,72,0.08), 0 40px 120px rgba(0,0,0,0.8)' }}>

        {/* ── Modal header ── */}
        <div className="flex items-start justify-between p-6 border-b border-white/[0.06]"
          style={{ background: 'linear-gradient(180deg, #161618, #111113)' }}>

          {client.churnRisk.color === 'red' && (
            <div className="absolute top-0 left-0 right-0 h-0.5"
              style={{ background: 'linear-gradient(90deg, transparent, #be123c 30%, #f43f5e 60%, transparent)' }} />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h2 className="text-xl font-black text-white">{client.name}</h2>
              {client.squad && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-500 border border-white/[0.06] uppercase tracking-wide">
                  {client.squad}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <HealthBadge score={client.healthScore} />
              <ChurnBadge risk={client.churnRisk} />
              {client.groupName !== client.name && (
                <span className="text-[10px] text-gray-600 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />{client.groupName}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 ml-4 flex-shrink-0">
            <div className="text-right">
              <div className="flex items-center gap-1 text-white font-bold text-lg">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                {formatFee(client.fee)}
              </div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider">fee/mês</div>
            </div>

            {/* Churn button */}
            {onMarkChurn && (
              confirmChurn ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onMarkChurn(client)}
                    className="px-2.5 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-[10px] font-bold transition-colors"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => setConfirmChurn(false)}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 text-[10px] transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmChurn(true)}
                  title="Marcar como Churn"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-950/30 hover:bg-red-900/40 text-red-500 border border-red-900/30 text-[10px] font-medium transition-colors"
                >
                  <TrendingDown className="w-3 h-3" /> Churn
                </button>
              )
            )}

            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-red-950/40 text-gray-500 hover:text-red-400 transition-colors border border-white/[0.06]">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Modal body (scrollable) ── */}
        <div className="overflow-y-auto flex-1">
          <div className="p-6">

            {/* Top stats + calendar */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="surface-1 rounded-xl p-3">
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Sem falar</div>
                <div className={`text-2xl font-bold ${silentVC[silentColor]}`}>
                  {client.silentDays === 0 ? 'Hoje' : `${client.silentDays}d`}
                </div>
              </div>
              <div className="surface-1 rounded-xl p-3">
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Check-ins</div>
                <div className="text-2xl font-bold text-white">{client.checkIns.length}</div>
                {client.lastCheckIn?.data && (
                  <div className="text-[10px] text-gray-600 mt-0.5">
                    {(() => { try { return format(parseISO(client.lastCheckIn.data), "d MMM", { locale: ptBR }) } catch { return null } })()}
                  </div>
                )}
              </div>
              <div className="surface-1 rounded-xl p-3">
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Mensagens</div>
                <div className="text-2xl font-bold text-white">{client.messages.length || '—'}</div>
              </div>
            </div>

            {/* Calendar — full width, clicável */}
            <div className="mb-6">
              <SectionTitle icon={Calendar}>Calendário de comunicação — clique num dia</SectionTitle>
              <CommunicationCalendar
                communicationDays={client.communicationDays}
                compact={false}
                days={30}
                selectedDay={selectedDay}
                onDaySelect={setSelectedDay}
              />
            </div>

            <div className="h-px bg-white/[0.04] mb-6" />

            {/* Two columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

              {/* AI Analysis */}
              <div>
                <SectionTitle icon={Sparkles}>Análise I.A</SectionTitle>
                <AIPanel client={client} selectedDay={selectedDay} />
                <ConversationLog messages={client.messages} selectedDay={selectedDay} />
              </div>

              {/* Churn risk */}
              <div>
                <SectionTitle icon={AlertTriangle}>Risco de Churn</SectionTitle>
                <div className="surface-1 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{client.churnRisk.score}<span className="text-gray-600 font-normal text-xs">/100</span></span>
                    <ChurnBadge risk={client.churnRisk} />
                  </div>
                  <ChurnBadge risk={client.churnRisk} showBar />
                  <div className="space-y-2 pt-1">
                    {[
                      ['Dias sem comunicar', `${client.silentDays}d`],
                      ['Health WPP', null, <HealthBadge key="h" score={client.healthScore} />],
                      client.lastCheckIn ? ['Último check-in', null, <HealthBadge key="c" score={client.lastCheckIn.flag} />] : null,
                    ].filter(Boolean).map(([lbl, val, node]) => (
                      <div key={lbl} className="flex items-center justify-between">
                        <span className="text-[11px] text-gray-600">{lbl}</span>
                        {node || <span className="text-[11px] font-medium text-gray-300">{val}</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top senders */}
                {client.topSenders.length > 0 && (
                  <div className="mt-4">
                    <SectionTitle icon={Users}>Quem mais fala</SectionTitle>
                    <div className="space-y-3">
                      {client.topSenders.map((s, i) => (
                        <SenderBar key={s.name} name={s.name} count={s.count} max={maxMessages} rank={i} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="h-px bg-white/[0.04] mb-6" />

            {/* Check-in history */}
            <div className="mb-6">
              <SectionTitle icon={CheckCircle}>Histórico de Check-ins</SectionTitle>
              {client.checkIns.length === 0
                ? <p className="text-[11px] text-gray-700 italic">Nenhum check-in registrado</p>
                : <div className="max-h-64 overflow-y-auto">
                    {client.checkIns.map((ci, i) => <CheckInRow key={ci.Id} checkIn={ci} isLatest={i === 0} />)}
                  </div>
              }
            </div>

            {/* WPP history */}
            {client.wppHistory.length > 0 && (
              <>
                <div className="h-px bg-white/[0.04] mb-6" />
                <div>
                  <SectionTitle icon={Layers}>Histórico WPP</SectionTitle>
                  <div className="max-h-48 overflow-y-auto">
                    {client.wppHistory.slice(0, 15).map((w, i) => {
                      const c = scoreColor(w['Health Score'])
                      const dotC = { green: 'bg-emerald-400', yellow: 'bg-amber-400', red: 'bg-red-400', gray: 'bg-gray-600' }
                      const wYMD = toYMD(w.Data)
                      const isSel = selectedDay && wYMD === selectedDay
                      return (
                        <div key={i}
                          onClick={() => setSelectedDay(isSel ? null : (wYMD || w.Data))}
                          className={`flex items-center gap-3 py-2 border-b border-white/[0.03] last:border-0 cursor-pointer transition-colors rounded px-1 ${isSel ? 'bg-red-950/20' : 'hover:bg-white/[0.02]'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotC[c]}`} />
                          <span className="text-[10px] text-gray-600 w-20 flex-shrink-0">{w.Data || '—'}</span>
                          <span className="text-[11px] text-gray-400 flex-1">{w['Health Score'] || '—'}</span>
                          <span className={`text-[10px] ${w['teve comunicação?'] === 'Sim' ? 'text-emerald-500' : 'text-gray-700'}`}>
                            {w['teve comunicação?'] === 'Sim' ? '● ativo' : '○ silêncio'}
                          </span>
                          {isSel && <span className="text-[9px] text-red-500">✓</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
