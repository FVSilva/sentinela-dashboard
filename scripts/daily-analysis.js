#!/usr/bin/env node
/**
 * daily-analysis.js
 *
 * Roda diariamente. Para cada grupo WhatsApp no Supabase:
 *  1. Busca as mensagens do dia
 *  2. Se houver mensagens, gera análise via Claude
 *  3. Salva o resultado na tabela `wpp` do NocoDB
 *
 * Configuração:
 *   Defina ANTHROPIC_KEY como variável de ambiente, ou edite ANTHROPIC_KEY abaixo.
 *   Agende no Windows Task Scheduler ou cron para rodar diariamente (ex: 23:30).
 *
 * Uso manual:
 *   node scripts/daily-analysis.js
 *   node scripts/daily-analysis.js --date 2026-04-10   (analisar outro dia)
 */

// ─── Configuração ────────────────────────────────────────────────────────────
const OPENAI_KEY     = process.env.OPENAI_KEY     || 'sua-chave-aqui'
const NOCODB_URL     = 'https://nocodb.munizcotech.com.br'
const NOCODB_TOKEN   = 'A-8J6JLO0Uu43tlHFO-eQubH0RFR2fTv4Fcht3n4'
const NOCODB_BASE_ID = 'pk8e2xhxn15elka'
const SUPABASE_URL   = 'https://vujbplitmkbfomqhyvcg.supabase.co'
const SUPABASE_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1amJwbGl0bWtiZm9tcWh5dmNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDk4NjIsImV4cCI6MjA4NzE4NTg2Mn0.bVM74S0LXUNc333TrGWYAlyhgD1s10D-vGnE3Hjh6Jw'
const OPENAI_MODEL   = 'gpt-4o-mini'

// ─── Data alvo ───────────────────────────────────────────────────────────────
const _dateEqArg = process.argv.find(a => a.startsWith('--date='))?.split('=')[1]
const _dateIdx   = process.argv.indexOf('--date')
const _dateArg   = _dateIdx !== -1 ? process.argv[_dateIdx + 1] : undefined
const TODAY      = _dateEqArg || _dateArg || new Date().toISOString().slice(0, 10)
const TODAY_DISPLAY = (() => {
  const [y, m, d] = TODAY.split('-')
  return `${d}/${m}/${y}`
})()

console.log(`\n🗓  Análise diária — ${TODAY_DISPLAY}\n`)

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
async function httpGet(url, headers) {
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function httpPost(url, headers, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${url} → ${res.status}: ${await res.text()}`)
  return res.json()
}

// ─── NocoDB helpers ──────────────────────────────────────────────────────────
const nocoHeaders = { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' }
let _tableIds = null

async function getTableIds() {
  if (_tableIds) return _tableIds
  const data = await httpGet(
    `${NOCODB_URL}/api/v1/db/meta/projects/${NOCODB_BASE_ID}/tables`,
    nocoHeaders
  )
  _tableIds = {}
  for (const t of data.list || []) _tableIds[t.title.toLowerCase()] = t.id
  return _tableIds
}

async function nocoInsert(tableName, record) {
  const ids = await getTableIds()
  const tableId = ids[tableName.toLowerCase()]
  if (!tableId) throw new Error(`Tabela não encontrada: ${tableName}`)
  return httpPost(
    `${NOCODB_URL}/api/v1/db/data/noco/${NOCODB_BASE_ID}/${tableId}`,
    nocoHeaders,
    record
  )
}

async function nocoFetch(tableName, params = '') {
  const ids = await getTableIds()
  const tableId = ids[tableName.toLowerCase()]
  if (!tableId) throw new Error(`Tabela não encontrada: ${tableName}`)
  const data = await httpGet(
    `${NOCODB_URL}/api/v1/db/data/noco/${NOCODB_BASE_ID}/${tableId}?limit=5000${params}`,
    nocoHeaders
  )
  return data.list || []
}

// ─── Supabase helpers ────────────────────────────────────────────────────────
const supaHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
}

async function fetchGroups() {
  return httpGet(`${SUPABASE_URL}/rest/v1/groups?select=*&limit=5000`, supaHeaders)
}

async function fetchAllDayMessages(date) {
  const from = `${date}T00:00:00`
  const to   = `${date}T23:59:59`
  return httpGet(
    `${SUPABASE_URL}/rest/v1/messages?select=*&created_at=gte.${from}&created_at=lte.${to}&order=created_at.asc&limit=10000`,
    supaHeaders
  )
}

// ─── OpenAI helpers ──────────────────────────────────────────────────────────
async function callAI(prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`OpenAI API → ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

function buildPrompt(groupName, messagesText) {
  return `Você é um analista estratégico especializado em análise de comunidades, grupos de clientes e comportamento de usuários.

Sua missão é analisar as mensagens trocadas em um grupo ao longo do dia e gerar um diagnóstico claro, direto e acionável.

Seja EXTREMAMENTE curto, direto e estratégico.

NÃO USE MARKDOWN.

Use títulos com emoji e quebras de linha exatamente como instruído.

NÃO faça introdução.

Comece DIRETAMENTE na resposta.

📊 Análise do Grupo: ${groupName}

📅 Data da análise:
${TODAY_DISPLAY}

💬 Teve comunicação?
(Responda apenas: "Sim" ou "Não")

🚩 Health Score do Grupo

(Classifique a saúde do grupo com base nas mensagens do dia:)

Green ✅ → Grupo ativo, engajado, positivo
Yellow ⚠️ → Baixo engajamento ou sinais leves de problema
Red ‼️ → Desengajamento, reclamações ou risco claro

Se NÃO houver mensagens → Red Flag 🚨

(Coloque apenas uma das opções acima)

---

🧠 Análise geral

${messagesText}

---

⚠️ Pontos críticos

(Liste problemas, reclamações, dúvidas ignoradas, falta de resposta, etc)

---

💰 Oportunidades de monetização

(Identifique oportunidades como:
- Upsell
- Cross-sell
- Interesse em novos serviços
- Dores que podem virar oferta)

---

🚨 Alertas de risco

(Identifique riscos como:
- Possível churn
- Cliente ignorado
- Insatisfação
- Falta de resposta da equipe
- Queda de engajamento)

---

🎯 Ações recomendadas

(Seja direto. Liste ações práticas e imediatas)

---

REGRAS IMPORTANTES:

- Se houver menos de 3 mensagens → considere baixo engajamento
- Se houver perguntas sem resposta → sinalize risco
- Se houver reclamação → peso alto para Red
- Se houver interação ativa → puxe para Green
- Seja objetivo, sem enrolação`
}

function parseAnalysis(text) {
  const healthScore = text.includes('Green') ? 'Green'
    : text.includes('Yellow') ? 'Yellow'
    : 'Red'
  const teveComunicacao = /Teve comunicação\?[\s\S]*?Sim/i.test(text) ? 'Sim' : 'Não'
  return { healthScore, teveComunicacao }
}

function formatMessages(messages) {
  return messages.map(msg => {
    const text   = msg.message_text || msg.body || msg.text || msg.message || msg.content || ''
    const sender = msg.sender_name  || msg.sender_phone || 'Desconhecido'
    const ts     = msg.sent_at || msg.created_at
    const time   = ts ? ts.slice(11, 16) : ''
    return `[${time}] ${sender}: ${text || '[mídia/arquivo]'}`
  }).join('\n')
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!OPENAI_KEY || OPENAI_KEY === 'sua-chave-aqui') {
    console.error('❌  Configure a variável OPENAI_KEY antes de rodar.')
    console.error('   Linux/Mac: export OPENAI_KEY=sk-proj-...')
    process.exit(1)
  }

  console.log(`📥 Buscando mensagens do dia ${TODAY_DISPLAY}...`)
  const allMessages = await fetchAllDayMessages(TODAY)
  console.log(`📨 ${allMessages.length} mensagens encontradas\n`)

  if (!allMessages.length) {
    console.log('ℹ️  Nenhuma mensagem hoje. Encerrando.\n')
    return
  }

  const byGroup = {}
  for (const msg of allMessages) {
    const gid = msg.group_id
    if (!gid) continue
    if (!byGroup[gid]) byGroup[gid] = []
    byGroup[gid].push(msg)
  }

  const activeGroupIds = Object.keys(byGroup)
  console.log(`📋 ${activeGroupIds.length} grupos com mensagens hoje\n`)

  const groups = await fetchGroups()
  const groupById = {}
  for (const g of groups) groupById[g.id] = g

  let saved = 0, errors = 0

  for (const groupId of activeGroupIds) {
    const group    = groupById[groupId]
    const name     = group?.group_name || groupId
    const messages = byGroup[groupId]

    try {
      console.log(`  🔄 ${name} — ${messages.length} msgs — gerando análise...`)

      const messagesText = formatMessages(messages)
      const prompt       = buildPrompt(name, messagesText)
      const analysis     = await callAI(prompt)
      const { healthScore, teveComunicacao } = parseAnalysis(analysis)

      await nocoInsert('wpp', {
        'Nome do grupo':      name,
        'Data':               TODAY,
        'Health Score':       healthScore,
        'Analise I.A':        analysis,
        'teve comunicação?':  teveComunicacao,
        'idGroup':            groupId,
      })

      console.log(`  ✅ ${name} — ${healthScore} — salvo`)
      saved++

      await new Promise(r => setTimeout(r, 500))

    } catch (err) {
      console.error(`  ❌ ${name} — ${err.message}`)
      errors++
    }
  }

  console.log(`\n📊 Resumo: ${saved} análises salvas | ${errors} erros\n`)
}

main().catch(err => {
  console.error('\n💥 Erro fatal:', err.message)
  process.exit(1)
})
