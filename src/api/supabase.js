const SUPABASE_URL = 'https://vujbplitmkbfomqhyvcg.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1amJwbGl0bWtiZm9tcWh5dmNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDk4NjIsImV4cCI6MjA4NzE4NTg2Mn0.bVM74S0LXUNc333TrGWYAlyhgD1s10D-vGnE3Hjh6Jw'

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
}

async function query(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params ? '?' + params : ''}`, { headers })
  if (!res.ok) throw new Error(`Supabase error: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function fetchAllGroups() {
  return query('groups', 'select=*&order=created_at.desc&limit=5000')
}

export async function fetchMessagesForGroup(groupId) {
  return query('messages', `select=*&group_id=eq.${groupId}&order=sent_at.asc&limit=5000`)
}

export async function fetchAllMessages() {
  // Fetch all messages with group info — paginated to 3000
  return query('messages', 'select=*,groups(group_name)&order=sent_at.desc&limit=3000')
}

/**
 * For a given groupId, returns a Set of date strings 'YYYY-MM-DD'
 * on which at least one message was sent.
 */
export function buildCommunicationDaySet(messages) {
  const days = new Set()
  for (const msg of messages) {
    const ts = msg.sent_at || msg.created_at
    if (ts) {
      days.add(ts.slice(0, 10))
    }
  }
  return days
}
