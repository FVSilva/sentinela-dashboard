import { differenceInDays, parseISO, format, subDays, startOfDay } from 'date-fns'

/**
 * Build last N days array with communication flag
 */
export function buildCalendarDays(communicationDaySet, days = 30) {
  const today = startOfDay(new Date())
  const result = []
  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(today, i)
    const key = format(date, 'yyyy-MM-dd')
    result.push({ date, key, active: communicationDaySet.has(key) })
  }
  return result
}

/**
 * Count consecutive days without communication up to today
 */
export function daysSilent(communicationDaySet) {
  const today = startOfDay(new Date())
  let count = 0
  for (let i = 0; i < 365; i++) {
    const key = format(subDays(today, i), 'yyyy-MM-dd')
    if (communicationDaySet.has(key)) break
    count++
  }
  return count
}

/**
 * Calculate churn risk score 0–100 and label
 */
export function calcChurnRisk({ healthScore, silentDays, lastCheckInFlag, fee }) {
  let score = 0

  // Silent days weight
  if (silentDays >= 14) score += 40
  else if (silentDays >= 7) score += 25
  else if (silentDays >= 3) score += 10

  // Health score weight
  if (healthScore === 'Red') score += 30
  else if (healthScore === 'Yellow') score += 15

  // Last check-in flag
  if (lastCheckInFlag === 'Red') score += 20
  else if (lastCheckInFlag === 'Yellow') score += 10

  // Fee amplifier: high-value clients have lower tolerance
  const feeNum = Number(fee) || 0
  if (feeNum >= 20000) score = Math.round(score * 1.1)
  else if (feeNum < 5000) score = Math.round(score * 0.85)

  score = Math.min(100, score)

  let label, color
  if (score >= 60) { label = 'Alto'; color = 'red' }
  else if (score >= 30) { label = 'Médio'; color = 'yellow' }
  else { label = 'Baixo'; color = 'green' }

  return { score, label, color }
}

/**
 * Top senders from messages array
 */
export function topSenders(messages, limit = 5) {
  const counts = {}
  for (const msg of messages) {
    const name = msg.sender_name || msg.sender_phone || 'Desconhecido'
    counts[name] = (counts[name] || 0) + 1
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }))
}

/**
 * Format fee as Brazilian currency
 */
export function formatFee(fee) {
  const n = Number(fee)
  if (!n) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)
}

/**
 * Health/flag color helpers
 */
export function scoreColor(score) {
  if (!score) return 'gray'
  const s = score.toLowerCase()
  if (s === 'green') return 'green'
  if (s === 'yellow') return 'yellow'
  if (s === 'red') return 'red'
  return 'gray'
}

export function scoreLabel(score) {
  if (!score) return '—'
  const map = { green: 'Saudável', yellow: 'Atenção', red: 'Crítico' }
  return map[score.toLowerCase()] || score
}
