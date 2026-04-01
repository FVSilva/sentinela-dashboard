import { useState } from 'react'
import logoImg from '../assets/logo.png'

const PASS = 'CsMuniz'

export default function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(false)
  const [loading,  setLoading]  = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(false)
    setTimeout(() => {
      if (password === PASS || password === '') {
        onLogin()
      } else {
        setError(true)
        setLoading(false)
        setPassword('')
      }
    }, 800)
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden">

      {/* ── Background: dragon image ── */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${logoImg})` }}
      />
      {/* Dark overlay gradient */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(135deg, rgba(0,0,0,0.82) 0%, rgba(20,0,5,0.75) 50%, rgba(0,0,0,0.88) 100%)'
      }} />
      {/* Bottom fade */}
      <div className="absolute inset-x-0 bottom-0 h-48"
        style={{ background: 'linear-gradient(to top, #080808, transparent)' }} />
      {/* Top fade */}
      <div className="absolute inset-x-0 top-0 h-32"
        style={{ background: 'linear-gradient(to bottom, #080808, transparent)' }} />

      {/* ── Glowing red orb behind card ── */}
      <div className="absolute w-96 h-96 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(220,38,38,0.18) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* ── Login card ── */}
      <div className="relative z-10 w-full max-w-sm mx-4">

        {/* Logo area */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative mb-5">
            {/* Glow ring */}
            <div className="absolute inset-0 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(220,38,38,0.4) 0%, transparent 70%)',
                filter: 'blur(20px)',
                transform: 'scale(1.8)',
              }}
            />
            <img
              src={logoImg}
              alt="Sentinela"
              className="relative w-20 h-20 rounded-2xl object-cover object-center"
              style={{ boxShadow: '0 0 32px rgba(220,38,38,0.4), 0 0 0 1px rgba(220,38,38,0.2)' }}
            />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white mb-1"
            style={{ textShadow: '0 0 40px rgba(220,38,38,0.5)' }}>
            SENTINELA
          </h1>
          <p className="text-xs text-gray-500 uppercase tracking-[0.25em]">Customer Intelligence</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-7 border"
          style={{
            background: 'rgba(10,10,12,0.85)',
            backdropFilter: 'blur(24px)',
            borderColor: 'rgba(255,255,255,0.07)',
            boxShadow: '0 0 0 1px rgba(220,38,38,0.1), 0 32px 80px rgba(0,0,0,0.6)',
          }}>

          <p className="text-sm text-gray-400 mb-6 text-center leading-relaxed">
            Acesse o painel de monitoramento<br />
            <span className="text-gray-600">e inteligência dos seus clientes</span>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] text-gray-600 uppercase tracking-wider mb-1.5">
                Senha de acesso
              </label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(false) }}
                placeholder="••••••••••••"
                autoFocus
                className={`w-full rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-700
                  focus:outline-none transition-all duration-200
                  ${error
                    ? 'border border-red-500/60 bg-red-950/30 focus:border-red-500'
                    : 'border border-white/8 bg-white/5 focus:border-red-700/60 focus:bg-white/8'
                  }`}
              />
              {error && (
                <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1.5 animate-fade-in">
                  <span className="w-1 h-1 rounded-full bg-red-400 inline-block" />
                  Senha incorreta
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white relative overflow-hidden transition-all duration-200 disabled:opacity-70"
              style={{
                background: loading
                  ? 'rgba(159,18,57,0.6)'
                  : 'linear-gradient(135deg, #9f1239, #e11d48)',
                boxShadow: loading ? 'none' : '0 0 24px rgba(220,38,38,0.35)',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Entrando...
                </span>
              ) : (
                'Acessar Painel'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-gray-800 mt-6 uppercase tracking-widest">
          Muniz &amp; Co · Powered by Nexus Forge
        </p>
      </div>
    </div>
  )
}
