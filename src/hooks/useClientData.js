import { useState, useEffect, useCallback } from 'react'
import { fetchClientes, fetchWpp, fetchSentinela } from '../api/nocodb'
import { fetchAllGroups, fetchAllRecentMessages, buildCommunicationDaySet } from '../api/supabase'
import { daysSilent, calcChurnRisk, topSenders } from '../utils/metrics'

/* ─── Retry helper ───────────────────────────────────────────────────────── */
async function withRetry(fn, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i === attempts - 1) throw err
      await new Promise(r => setTimeout(r, 900 * (i + 1)))
    }
  }
}

/* ─── Name normalisation + similarity ───────────────────────────────────── */
function norm(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\b(ltda|me|sa|eireli|epp|s\.a|restaurante|studio|digital|agencia|agência|solucoes|soluções|consulting|consultoria|servicos|serviços|comercio|comércio|grupo|the|de|da|do|e|em|a|o)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function jaccard(a, b) {
  const wa = new Set(norm(a).split(' ').filter(w => w.length >= 3))
  const wb = new Set(norm(b).split(' ').filter(w => w.length >= 3))
  if (wa.size === 0 && wb.size === 0) return 0
  const inter = [...wa].filter(w => wb.has(w)).length
  const union = new Set([...wa, ...wb]).size
  return inter / union
}

function nameSimilarity(clientName, groupName) {
  const cn = norm(clientName)
  const gn = norm(groupName)
  if (!cn || !gn) return 0
  if (cn === gn) return 1.0
  const minLen = Math.min(cn.length, gn.length)
  if (minLen >= 4) {
    const shorter = cn.length <= gn.length ? cn : gn
    const longer  = cn.length <= gn.length ? gn : cn
    if (longer.startsWith(shorter)) return 0.92
    if (longer.includes(shorter) && shorter.length >= 5) return 0.85
  }
  const cw0 = cn.split(' ')[0]
  const gw0 = gn.split(' ')[0]
  if (cw0.length >= 4 && gw0.length >= 4 && (cw0 === gw0 || cw0.startsWith(gw0) || gw0.startsWith(cw0))) return 0.80
  return jaccard(clientName, groupName)
}

function bestSupabaseGroupMatch(clientName, supabaseGroupByName, threshold = 0.25) {
  const cn = norm(clientName)
  let best = null
  let bestScore = threshold
  for (const [gname, g] of Object.entries(supabaseGroupByName)) {
    let score = nameSimilarity(clientName, gname)
    const gn = norm(gname)
    if (cn.length >= 2 && gn.startsWith(cn)) score = Math.max(score, 0.90)
    if (cn.length >= 2 && gn.includes(cn))  score = Math.max(score, 0.80)
    if (cn.length >= 2 && cn.startsWith(gn) && gn.length >= 2) score = Math.max(score, 0.85)
    if (score > bestScore) { bestScore = score; best = g }
  }
  return best
}

function bestWppMatch(clientName, wppByName, threshold = 0.35) {
  let best = null; let bestScore = threshold
  for (const [wname, w] of Object.entries(wppByName)) {
    const score = nameSimilarity(clientName, wname)
    if (score > bestScore) { bestScore = score; best = w }
  }
  return best
}

function bestWppHistoryMatch(clientName, wppHistoryByName, threshold = 0.35) {
  let best = null; let bestScore = threshold
  for (const [wname, list] of Object.entries(wppHistoryByName)) {
    const score = nameSimilarity(clientName, wname)
    if (score > bestScore) { bestScore = score; best = list }
  }
  return best || []
}

const MANUAL_GROUP_MAP = {
  'world sound translation': 'WST',
  'hg': 'HG Acessorios',
}

/* ─── Hook ───────────────────────────────────────────────────────────────── */
export function useClientData() {
  const [clients,  setClients]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [progress, setProgress] = useState({ step: '', done: 0, total: 5 })
  const [tick,     setTick]     = useState(0)

  const retry = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)

        // ── Step 1: fetch all base data in parallel, with retry ──
        setProgress({ step: 'Carregando clientes...', done: 0, total: 5 })
        const [clientes, wppList, sentinelaList, supabaseGroups] = await withRetry(() =>
          Promise.all([fetchClientes(), fetchWpp(), fetchSentinela(), fetchAllGroups()])
        )
        if (cancelled) return

        // ── Step 2: fetch ALL recent messages in ONE bulk call ──
        setProgress({ step: 'Carregando mensagens...', done: 3, total: 5 })
        let allMessages = []
        try {
          allMessages = await withRetry(() => fetchAllRecentMessages(31))
        } catch (e) {
          console.warn('[Sentinela] Mensagens indisponíveis (continuando sem elas):', e.message)
        }
        if (cancelled) return

        // ── Step 3: group messages by group_id (O(n), done once) ──
        setProgress({ step: 'Cruzando dados...', done: 4, total: 5 })

        const messagesByGroupId = {}
        for (const msg of allMessages) {
          const gid = msg.group_id
          if (!gid) continue
          if (!messagesByGroupId[gid]) messagesByGroupId[gid] = []
          messagesByGroupId[gid].push(msg)
        }

        // ── Index wpp ──
        const wppByName = {}
        for (const w of wppList) {
          const name = (w['Nome do grupo'] || '').trim()
          if (!wppByName[name] || (w.Data && (!wppByName[name].Data || w.Data > wppByName[name].Data))) {
            wppByName[name] = w
          }
        }

        const wppHistoryByName = {}
        for (const w of wppList) {
          const name = (w['Nome do grupo'] || '').trim()
          if (!wppHistoryByName[name]) wppHistoryByName[name] = []
          wppHistoryByName[name].push(w)
        }
        for (const key of Object.keys(wppHistoryByName)) {
          wppHistoryByName[key].sort((a, b) => (b.Data || '').localeCompare(a.Data || ''))
        }

        // ── Index supabase groups ──
        const supabaseGroupById   = {}
        const supabaseGroupByName = {}
        for (const g of supabaseGroups) {
          if (g.id) supabaseGroupById[g.id] = g
          const gname = (g.group_name || '').trim()
          if (gname) supabaseGroupByName[gname] = g
        }

        // ── Index sentinela ──
        const sentinelaById = {}
        for (const s of sentinelaList) sentinelaById[s.Id] = s

        // ── Step 4: build client objects (now fully synchronous) ──
        const clientObjects = clientes.map((cliente) => {
          const clientName = (cliente.Cliente || '').trim()

          // Match wpp
          const wpp        = bestWppMatch(clientName, wppByName)
          const wppHistory = bestWppHistoryMatch(clientName, wppHistoryByName)

          // Resolve supabase group UUID
          const searchName = (wpp?.['Nome do grupo'] || clientName).trim()
          let resolvedUUID = null
          let matchVia     = 'none'

          const manualKey = norm(clientName)
          if (MANUAL_GROUP_MAP[manualKey]) {
            const g = supabaseGroupByName[MANUAL_GROUP_MAP[manualKey]]
            if (g?.id) { resolvedUUID = g.id; matchVia = 'manual' }
          }
          if (!resolvedUUID && supabaseGroupByName[searchName]) {
            resolvedUUID = supabaseGroupByName[searchName].id
            matchVia = 'name-exact'
          }
          if (!resolvedUUID) {
            const matched = bestSupabaseGroupMatch(searchName, supabaseGroupByName)
            if (matched?.id) { resolvedUUID = matched.id; matchVia = 'name-fuzzy' }
          }

          // Messages from pre-grouped bulk fetch (O(1) lookup)
          const messages = resolvedUUID ? (messagesByGroupId[resolvedUUID] || []) : []

          // Communication days
          const communicationDays = new Set()
          const matchedGroup = resolvedUUID ? supabaseGroupById[resolvedUUID] : null
          if (matchedGroup?.last_message_at) {
            communicationDays.add(matchedGroup.last_message_at.slice(0, 10))
          }
          for (const d of buildCommunicationDaySet(messages)) communicationDays.add(d)

          // Check-ins: use sentinela name from FK if available, then fuzzy-match ALL records
          const sentinela = cliente.sentinela_id ? sentinelaById[cliente.sentinela_id] : null
          const targetName = sentinela?.cliente || clientName
          const checkIns = sentinelaList
            .filter(s => nameSimilarity(targetName, s.cliente || '') >= 0.30)
            .sort((a, b) => (b.data || '').localeCompare(a.data || ''))

          const silentDays      = daysSilent(communicationDays)
          const healthScore     = wpp?.['Health Score'] || null
          const lastCheckInFlag = checkIns[0]?.flag || sentinela?.flag || null
          const churnRisk       = calcChurnRisk({ healthScore, silentDays, lastCheckInFlag, fee: cliente.Fee })
          const senders         = topSenders(messages)

          return {
            id:               cliente.Id,
            name:             clientName,
            clientCode:       cliente.Client_ID,
            fee:              cliente.Fee,
            squad:            cliente.Squad,
            groupId:          resolvedUUID,
            groupName:        wpp?.['Nome do grupo'] || clientName,
            healthScore,
            hadCommunication: wpp?.['teve comunicação?'] === 'Sim',
            wppHistory,
            communicationDays,
            silentDays,
            messages,
            topSenders:       senders,
            checkIns,
            lastCheckIn:      checkIns[0] || null,
            churnRisk,
            _matchedGroup:    wpp?.['Nome do grupo'] || null,
            _resolvedUUID:    resolvedUUID,
            _groupMatchVia:   matchVia,
          }
        })

        if (cancelled) return

        clientObjects.sort((a, b) => {
          if (b.churnRisk.score !== a.churnRisk.score) return b.churnRisk.score - a.churnRisk.score
          return (Number(b.fee) || 0) - (Number(a.fee) || 0)
        })

        console.table(clientObjects.map(c => ({
          cliente:    c.name,
          grupoWPP:   c._matchedGroup  || '— sem match —',
          matchVia:   c._groupMatchVia,
          silentDays: c.silentDays,
          msgs:       c.messages.length,
          checkIns:   c.checkIns.length,
        })))

        const semMatch = clientObjects.filter(c => !c._resolvedUUID)
        if (semMatch.length > 0) {
          console.warn('[Sentinela] Clientes sem grupo Supabase:', semMatch.map(c => c.name))
        }

        setProgress({ step: 'Pronto', done: 5, total: 5 })
        setClients(clientObjects)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Erro desconhecido')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [tick])

  return { clients, loading, error, progress, retry }
}
