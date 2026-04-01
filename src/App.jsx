import { useState, useMemo } from 'react'
import logoImg from './assets/logo.png'
import { useClientData } from './hooks/useClientData'
import ClientCard from './components/ClientCard'
import LoginScreen from './components/LoginScreen'
import { Search, RefreshCw, AlertTriangle, Users, DollarSign, Flame, Shield, LogOut } from 'lucide-react'
import { formatFee } from './utils/metrics'

/* ── Logo image ────────────────────────────────────────── */
function Logo({ size = 36 }) {
  return (
    <img
      src={logoImg}
      alt="Sentinela"
      style={{ width: size, height: size }}
      className="rounded-lg object-cover object-center"
    />
  )
}

/* ── Loading ─────────────────────────────────────────────── */
function LoadingScreen({ progress }) {
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8" style={{ background: '#080808' }}>
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 rounded-full border-2 border-red-900/40" />
        <div className="absolute inset-0 rounded-full border-2 border-t-red-500 animate-spin" />
        <img
          src={logoImg}
          alt="logo"
          className="absolute inset-0 m-auto w-14 h-14 rounded-full object-cover object-center"
        />
      </div>
      <div className="text-center">
        <p className="text-white font-bold text-xl tracking-tight mb-1">Sentinela</p>
        <p className="text-gray-600 text-sm">{progress.step || 'Inicializando...'}</p>
      </div>
      <div className="w-56 space-y-2">
        <div className="w-full h-0.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-red-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-center text-[11px] text-gray-700">{pct}%</p>
      </div>
    </div>
  )
}

function ErrorScreen({ error, onRetry }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6" style={{ background: '#080808' }}>
      <AlertTriangle className="w-10 h-10 text-red-500" />
      <p className="text-white font-semibold">Erro ao carregar dados</p>
      <p className="text-gray-500 text-sm text-center max-w-sm font-mono text-xs bg-white/5 p-3 rounded-lg">{error}</p>
      <button onClick={onRetry} className="flex items-center gap-2 px-5 py-2.5 bg-red-700 hover:bg-red-600 text-white text-sm rounded-xl font-medium transition-colors">
        <RefreshCw className="w-4 h-4" /> Tentar novamente
      </button>
    </div>
  )
}

/* ── Summary ─────────────────────────────────────────────── */
function SummaryBar({ clients }) {
  const totalFee = clients.reduce((s, c) => s + (Number(c.fee) || 0), 0)
  const highRisk = clients.filter(c => c.churnRisk.color === 'red').length
  const silent7  = clients.filter(c => c.silentDays >= 7).length
  const active   = clients.filter(c => c.silentDays === 0).length

  const stats = [
    { icon: DollarSign,    label: 'MRR total',    value: formatFee(totalFee), color: '#34d399' },
    { icon: Users,         label: 'Clientes',      value: clients.length,      color: '#94a3b8' },
    { icon: Flame,         label: 'Risco alto',    value: highRisk,            color: '#f43f5e' },
    { icon: AlertTriangle, label: '+7d silêncio',  value: silent7,             color: '#f59e0b' },
    { icon: Shield,        label: 'Ativos hoje',   value: active,              color: '#34d399' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
      {stats.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon className="w-3.5 h-3.5" style={{ color }} />
            <span className="text-[10px] text-gray-600 uppercase tracking-wider">{label}</span>
          </div>
          <span className="text-2xl font-bold" style={{ color }}>{value}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Filters ─────────────────────────────────────────────── */
const SQUAD_OPTIONS  = ['Todos', 'Alpha', 'Midas']
const HEALTH_OPTIONS = ['Todos', 'Green', 'Yellow', 'Red', 'Sem score']
const CHURN_OPTIONS  = ['Todos', 'Alto', 'Médio', 'Baixo']

function FilterPill({ options, value, onChange }) {
  return (
    <div className="flex items-center gap-0.5 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl">
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(opt)}
          className={[
            'px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150',
            value === opt ? 'bg-red-900/50 text-red-300 border border-red-800/40' : 'text-gray-600 hover:text-gray-400',
          ].join(' ')}>
          {opt}
        </button>
      ))}
    </div>
  )
}

/* ── Dashboard (only mounts after login → data fetches) ── */
function Dashboard({ onLogout }) {
  const { clients, loading, error, progress } = useClientData()
  const [search,       setSearch]  = useState('')
  const [squadFilter,  setSquad]   = useState('Todos')
  const [healthFilter, setHealth]  = useState('Todos')
  const [churnFilter,  setChurn]   = useState('Todos')
  const [sortBy,       setSortBy]  = useState('churn')

  const filtered = useMemo(() => {
    let list = clients
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.squad?.toLowerCase().includes(q) ||
        c.groupName?.toLowerCase().includes(q)
      )
    }
    if (squadFilter  !== 'Todos') list = list.filter(c => c.squad === squadFilter)
    if (healthFilter !== 'Todos') {
      list = list.filter(c =>
        healthFilter === 'Sem score'
          ? !c.healthScore
          : (c.healthScore || '').toLowerCase() === healthFilter.toLowerCase()
      )
    }
    if (churnFilter !== 'Todos') list = list.filter(c => c.churnRisk.label === churnFilter)
    if (sortBy === 'churn')  list = [...list].sort((a, b) => b.churnRisk.score - a.churnRisk.score)
    if (sortBy === 'fee')    list = [...list].sort((a, b) => (Number(b.fee)||0) - (Number(a.fee)||0))
    if (sortBy === 'silent') list = [...list].sort((a, b) => b.silentDays - a.silentDays)
    if (sortBy === 'name')   list = [...list].sort((a, b) => (a.name||'').localeCompare(b.name||''))
    return list
  }, [clients, search, squadFilter, healthFilter, churnFilter, sortBy])

  if (loading) return <LoadingScreen progress={progress} />
  if (error)   return <ErrorScreen error={error} onRetry={() => window.location.reload()} />

  return (
    <div className="min-h-screen" style={{ background: '#080808' }}>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/[0.05]"
        style={{ background: 'rgba(8,8,8,0.92)', backdropFilter: 'blur(16px)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">

          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <Logo size={36} />
            <div className="leading-tight">
              <div className="text-white font-bold text-[13px] tracking-tight">Sentinela</div>
              <div className="text-gray-600 text-[10px] uppercase tracking-widest">Customer Intelligence</div>
            </div>
          </div>

          <div className="h-5 w-px bg-white/10 mx-1" />

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-gray-600 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar cliente ou squad..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-9 pr-4 py-2 text-[13px] text-gray-300 placeholder-gray-700 focus:outline-none focus:border-red-800 transition-colors"
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-[11px] text-gray-600 hidden sm:block">
              {filtered.length}/{clients.length} clientes
            </span>
            <button
              onClick={onLogout}
              title="Sair"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-950/30 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <SummaryBar clients={filtered.length < clients.length ? filtered : clients} />

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <FilterPill options={SQUAD_OPTIONS}  value={squadFilter}  onChange={setSquad} />
          <FilterPill options={HEALTH_OPTIONS} value={healthFilter} onChange={setHealth} />
          <FilterPill options={CHURN_OPTIONS}  value={churnFilter}  onChange={setChurn} />
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-gray-600">Ordenar</span>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.07] text-gray-400 text-[11px] rounded-lg px-3 py-1.5 focus:outline-none focus:border-red-800 cursor-pointer">
              <option value="churn">Risco churn</option>
              <option value="fee">Maior fee</option>
              <option value="silent">Mais silêncio</option>
              <option value="name">Nome A–Z</option>
            </select>
          </div>
        </div>

        {/* Cards */}
        {clients.length === 0 ? (
          <div className="text-center py-24 space-y-3">
            <Users className="w-10 h-10 mx-auto text-gray-800" />
            <p className="text-gray-600 text-sm">Nenhum cliente carregado.</p>
            <p className="text-gray-700 text-xs">Verifique as credenciais das APIs no console (F12).</p>
            <button onClick={() => window.location.reload()}
              className="text-xs text-red-700 hover:text-red-500 underline">
              Recarregar
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <Users className="w-10 h-10 mx-auto mb-3 text-gray-800" />
            <p className="text-gray-600 text-sm">Nenhum cliente com esses filtros.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(client => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

/* ── App root ────────────────────────────────────────────── */
export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => sessionStorage.getItem('sentinela_auth') === '1')

  if (!loggedIn) {
    return (
      <LoginScreen onLogin={() => {
        sessionStorage.setItem('sentinela_auth', '1')
        setLoggedIn(true)
      }} />
    )
  }

  return (
    <Dashboard onLogout={() => {
      sessionStorage.removeItem('sentinela_auth')
      setLoggedIn(false)
    }} />
  )
}
