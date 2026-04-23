import { useState, useCallback, useMemo } from 'react'

const STORAGE_KEY = 'sentinela_churned_clients'

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}

function save(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function useChurnedClients() {
  const [churned, setChurned] = useState(load)

  const markChurned = useCallback((client) => {
    setChurned(prev => {
      if (prev.some(c => c.id === client.id)) return prev
      const next = [...prev, {
        id:    client.id,
        name:  client.name,
        fee:   client.fee,
        squad: client.squad,
        date:  new Date().toISOString().slice(0, 10),
      }]
      save(next)
      return next
    })
  }, [])

  const restoreClient = useCallback((clientId) => {
    setChurned(prev => {
      const next = prev.filter(c => c.id !== clientId)
      save(next)
      return next
    })
  }, [])

  const churnedIds = useMemo(() => new Set(churned.map(c => c.id)), [churned])

  return { churned, churnedIds, markChurned, restoreClient }
}
