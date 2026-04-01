const BASE_URL = '/nocodb-api'
const TOKEN = 'A-8J6JLO0Uu43tlHFO-eQubH0RFR2fTv4Fcht3n4'
const BASE_ID = 'pk8e2xhxn15elka'

// Table IDs — we resolve them dynamically on first call
let TABLE_IDS = null

const headers = {
  'xc-token': TOKEN,
  'Content-Type': 'application/json',
}

async function resolveTableIds() {
  if (TABLE_IDS) return TABLE_IDS
  const res = await fetch(`${BASE_URL}/api/v1/db/meta/projects/${BASE_ID}/tables`, { headers })
  if (!res.ok) throw new Error(`NocoDB table list error: ${res.status}`)
  const data = await res.json()
  const map = {}
  for (const t of data.list || []) {
    map[t.title.toLowerCase()] = t.id
  }
  TABLE_IDS = map
  return map
}

async function fetchTable(tableName, params = {}) {
  const ids = await resolveTableIds()
  const tableId = ids[tableName.toLowerCase()]
  if (!tableId) throw new Error(`Table not found: ${tableName}`)

  const query = new URLSearchParams({ limit: 500, ...params }).toString()
  const res = await fetch(`${BASE_URL}/api/v1/db/data/noco/${BASE_ID}/${tableId}?${query}`, { headers })
  if (!res.ok) throw new Error(`NocoDB fetch error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.list || []
}

export async function fetchClientes() {
  return fetchTable('cliente')
}

export async function fetchWpp() {
  return fetchTable('wpp')
}

export async function fetchSentinela() {
  return fetchTable('sentinela')
}
