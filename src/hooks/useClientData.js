import { useState, useEffect } from 'react'
import { fetchClientes, fetchWpp, fetchSentinela } from '../api/nocodb'
import { fetchAllGroups, fetchMessagesForGroup, buildCommunicationDaySet } from '../api/supabase'
import { daysSilent, calcChurnRisk, topSenders } from '../utils/metrics'

/* ─────────────────────────────────────────────────────────
   Name normalisation + similarity
   ───────────────────────────────────────────────────────── */

/** Remove acentos, lowercase, só letras/números, espaço único */
function norm(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // acentos
    .replace(/[^a-z0-9]/g, ' ')        // não-alfanumérico → espaço
    .replace(/\b(ltda|me|sa|eireli|epp|s\.a|restaurante|studio|digital|agencia|agência|solucoes|soluções|consulting|consultoria|servicos|serviços|comercio|comércio|grupo|the|de|da|do|e|em|a|o)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Jaccard similarity sobre tokens com ≥ 3 chars */
function jaccard(a, b) {
  const wa = new Set(norm(a).split(' ').filter(w => w.length >= 3))
  const wb = new Set(norm(b).split(' ').filter(w => w.length >= 3))
  if (wa.size === 0 && wb.size === 0) return 0
  const inter = [...wa].filter(w => wb.has(w)).length
  const union = new Set([...wa, ...wb]).size
  return inter / union
}

/** Score 0–1 entre dois nomes usando várias estratégias */
function nameSimilarity(clientName, groupName) {
  const cn = norm(clientName)
  const gn = norm(groupName)
  if (!cn || !gn) return 0

  // Exact after normalisation
  if (cn === gn) return 1.0

  // One is full prefix of the other (min 4 chars)
  const minLen = Math.min(cn.length, gn.length)
  if (minLen >= 4) {
    const shorter = cn.length <= gn.length ? cn : gn
    const longer  = cn.length <= gn.length ? gn : cn
    if (longer.startsWith(shorter)) return 0.92
    if (longer.includes(shorter) && shorter.length >= 5) return 0.85
  }

  // First word of client matches first word of group (min 4 chars)
  const cw0 = cn.split(' ')[0]
  const gw0 = gn.split(' ')[0]
  if (cw0.length >= 4 && gw0.length >= 4 && (cw0 === gw0 || cw0.startsWith(gw0) || gw0.startsWith(cw0))) return 0.80

  // Jaccard on word tokens
  const j = jaccard(clientName, groupName)
  return j
}

/** Find best matching Supabase group for a client name */
function bestSupabaseGroupMatch(clientName, supabaseGroupByName, threshold = 0.25) {
  const cn = norm(clientName)
  let best = null
  let bestScore = threshold

  for (const [gname, g] of Object.entries(supabaseGroupByName)) {
    let score = nameSimilarity(clientName, gname)

    // Boost: group name starts with client name (handles "HG CS", "Martini CS", etc.)
    const gn = norm(gname)
    if (cn.length >= 2 && gn.startsWith(cn)) score = Math.max(score, 0.90)
    if (cn.length >= 2 && gn.includes(cn))  score = Math.max(score, 0.80)

    // Boost: client name starts with group name
    if (cn.length >= 2 && cn.startsWith(gn) && gn.length >= 2) score = Math.max(score, 0.85)

    if (score > bestScore) {
      bestScore = score
      best = g
    }
  }
  return best
}

/** Find best matching wpp record for a client name */
function bestWppMatch(clientName, wppByName, threshold = 0.35) {
  let best = null
  let bestScore = threshold

  for (const [wname, w] of Object.entries(wppByName)) {
    const score = nameSimilarity(clientName, wname)
    if (score > bestScore) {
      bestScore = score
      best = w
    }
  }
  return best
}

function bestWppHistoryMatch(clientName, wppHistoryByName, threshold = 0.35) {
  let best = null
  let bestScore = threshold

  for (const [wname, list] of Object.entries(wppHistoryByName)) {
    const score = nameSimilarity(clientName, wname)
    if (score > bestScore) {
      bestScore = score
      best = list
    }
  }
  return best || []
}

/**
 * Manual overrides: client name (normalised) → Supabase group_name exact string
 * Add here when abbreviations or completely different names prevent auto-matching.
 */
const MANUAL_GROUP_MAP = {
  'world sound translation': 'WST',
  'hg': 'HG Acessorios',
}

/** Find sentinela records that best match this client name */
function matchSentinela(clientName, sentinelaList, threshold = 0.35) {
  return sentinelaList.filter(s => nameSimilarity(clientName, s.cliente || '') >= threshold)
}

/* ─────────────────────────────────────────────────────────
   Hook
   ───────────────────────────────────────────────────────── */

export function useClientData() {
  const [clients,  setClients]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [progress, setProgress] = useState({ step: '', done: 0, total: 0 })

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)

        setProgress({ step: 'Carregando clientes...', done: 0, total: 4 })
        const [clientes, wppList, sentinelaList, supabaseGroups] = await Promise.all([
          fetchClientes(),
          fetchWpp(),
          fetchSentinela(),
          fetchAllGroups(),
        ])

        if (cancelled) return

        setProgress({ step: 'Cruzando dados...', done: 2, total: 4 })

        // sentinela by Id
        const sentinelaById = {}
        for (const s of sentinelaList) sentinelaById[s.Id] = s

        // wpp latest per group name
        const wppByName = {}
        for (const w of wppList) {
          const name = (w['Nome do grupo'] || '').trim()
          if (!wppByName[name] || (w.Data && (!wppByName[name].Data || w.Data > wppByName[name].Data))) {
            wppByName[name] = w
          }
        }

        // wpp history per group name (sorted desc)
        const wppHistoryByName = {}
        for (const w of wppList) {
          const name = (w['Nome do grupo'] || '').trim()
          if (!wppHistoryByName[name]) wppHistoryByName[name] = []
          wppHistoryByName[name].push(w)
        }
        for (const key of Object.keys(wppHistoryByName)) {
          wppHistoryByName[key].sort((a, b) => (b.Data || '').localeCompare(a.Data || ''))
        }

        // supabase groups indexed by:
        //   g.id         → UUID used in messages.group_id (primary lookup key)
        //   g.group_name → for fuzzy name matching
        const supabaseGroupById   = {}   // by UUID
        const supabaseGroupByName = {}   // by group_name (fuzzy fallback)
        for (const g of supabaseGroups) {
          if (g.id) supabaseGroupById[g.id] = g
          const gname = (g.group_name || '').trim()
          if (gname) supabaseGroupByName[gname] = g
        }

        setProgress({ step: 'Carregando mensagens WhatsApp...', done: 3, total: 4 })

        const clientObjects = await Promise.all(
          clientes.map(async (cliente) => {
            const clientName = (cliente.Cliente || '').trim()

            // Fuzzy-match wpp
            const wpp        = bestWppMatch(clientName, wppByName)
            const wppHistory = bestWppHistoryMatch(clientName, wppHistoryByName)

            // Direct sentinela link (FK) or fuzzy
            const sentinela = cliente.sentinela_id ? sentinelaById[cliente.sentinela_id] : null

            // Fetch WhatsApp messages from Supabase
            // messages.group_id is UUID → references groups.id
            let messages         = []
            let communicationDays = new Set()
            let matchVia         = 'none'
            let resolvedUUID     = null

            // Match by group name: manual → exact → fuzzy
            const searchName = (wpp?.['Nome do grupo'] || clientName).trim()

            // 1. Manual override (abbreviations / completely different names)
            const manualKey = norm(clientName)
            if (MANUAL_GROUP_MAP[manualKey]) {
              const g = supabaseGroupByName[MANUAL_GROUP_MAP[manualKey]]
              if (g?.id) { resolvedUUID = g.id; matchVia = 'manual' }
            }

            // 2. Exact match against Supabase group_name
            if (!resolvedUUID && supabaseGroupByName[searchName]) {
              resolvedUUID = supabaseGroupByName[searchName].id
              matchVia = 'name-exact'
            }

            // 3. Fuzzy match
            if (!resolvedUUID) {
              const matched = bestSupabaseGroupMatch(searchName, supabaseGroupByName)
              if (matched?.id) {
                resolvedUUID = matched.id
                matchVia = 'name-fuzzy'
              }
            }

            if (resolvedUUID) {
              const matchedGroup = supabaseGroupById[resolvedUUID]

              // Use last_message_at from group as a reliable communication marker
              // (most messages have sent_at: null, so this is the ground truth)
              if (matchedGroup?.last_message_at) {
                communicationDays.add(matchedGroup.last_message_at.slice(0, 10))
              }

              // Fetch individual messages for calendar + sender info
              try {
                messages = await fetchMessagesForGroup(resolvedUUID)
                const msgDays = buildCommunicationDaySet(messages)
                // Merge: keep last_message_at day + all message days
                for (const d of msgDays) communicationDays.add(d)
              } catch { /* non-fatal */ }
            }

            const silentDays      = daysSilent(communicationDays)
            const healthScore     = wpp?.['Health Score'] || null
            const lastCheckInFlag = sentinela?.flag || null
            const fee             = cliente.Fee

            const churnRisk = calcChurnRisk({ healthScore, silentDays, lastCheckInFlag, fee })
            const senders   = topSenders(messages)

            // Sentinela / check-ins (FK first, then fuzzy fallback)
            const checkIns = (
              sentinela
                ? sentinelaList.filter(s => s.Id === sentinela.Id || nameSimilarity(clientName, s.cliente || '') >= 0.35)
                : matchSentinela(clientName, sentinelaList)
            ).sort((a, b) => (b.data || '').localeCompare(a.data || ''))

            return {
              id:         cliente.Id,
              name:       clientName,
              clientCode: cliente.Client_ID,
              fee:        cliente.Fee,
              squad:      cliente.Squad,
              // WhatsApp
              groupId:          resolvedUUID,
              groupName:        wpp?.['Nome do grupo'] || clientName,
              healthScore,
              hadCommunication: wpp?.['teve comunicação?'] === 'Sim',
              latestAiAnalysis: wppHistory.find(w => w['Analise I.A'])?.['Analise I.A'] || null,
              wppHistory,
              // Communication
              communicationDays,
              silentDays,
              messages,
              topSenders: senders,
              // Check-ins
              checkIns,
              lastCheckIn: checkIns[0] || null,
              // Churn
              churnRisk,
              // Debug info (useful in console)
              _matchedGroup:   wpp?.['Nome do grupo'] || null,
              _resolvedUUID:   resolvedUUID,
              _groupMatchVia:  matchVia,
            }
          })
        )

        if (cancelled) return

        clientObjects.sort((a, b) => {
          if (b.churnRisk.score !== a.churnRisk.score) return b.churnRisk.score - a.churnRisk.score
          return (Number(b.fee) || 0) - (Number(a.fee) || 0)
        })

        // Log matches to console for debugging
        console.table(clientObjects.map(c => ({
          cliente:    c.name,
          grupoWPP:   c._matchedGroup  || '— sem match —',
          matchVia:   c._groupMatchVia,
          uuid:       c._resolvedUUID  || '—',
          silentDays: c.silentDays,
          msgs:       c.messages.length,
          checkIns:   c.checkIns.length,
        })))

        // Log clientes sem match e grupos órfãos (não linkados a nenhum cliente)
        const semMatch = clientObjects.filter(c => c.silentDays >= 365 && !c._resolvedUUID)
        if (semMatch.length > 0) {
          console.warn('[Sentinela] Clientes sem grupo:', semMatch.map(c => c.name))
          const uuidsUsados = new Set(clientObjects.map(c => c._resolvedUUID).filter(Boolean))
          const gruposOrfaos = supabaseGroups.filter(g => !uuidsUsados.has(g.id))
          console.warn('[Sentinela] Grupos no Supabase SEM cliente linkado:\n' + gruposOrfaos.map(g => `  "${g.group_name}"`).join('\n'))
        }

        setProgress({ step: 'Pronto', done: 4, total: 4 })
        setClients(clientObjects)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Erro desconhecido')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return { clients, loading, error, progress }
}
