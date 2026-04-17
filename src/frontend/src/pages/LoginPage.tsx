import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { identify, capture } from '../analytics'

export default function LoginPage() {
  const nav = useNavigate()
  const location = useLocation()
  const redirect = new URLSearchParams(location.search).get('redirect') ?? '/games'
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (data.success) {
      identify(email)
      capture('login_success')
      nav(redirect)
    } else {
      capture('login_failed', { reason: data.message })
      setError(data.message ?? 'Login failed')
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <form onSubmit={handleSubmit} className="bg-stone-800 p-8 rounded-lg w-full max-w-sm space-y-4">
        <div className="flex justify-center mb-2">
          <img src="/logo.png" alt="Prohibitioner" className="h-20 w-auto object-contain drop-shadow-lg" />
        </div>
        <h2 className="text-2xl font-bold text-amber-400 text-center">Sign In</h2>
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full px-4 py-2 bg-stone-700 rounded border border-stone-600 focus:outline-none focus:border-amber-400"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="w-full px-4 py-2 bg-stone-700 rounded border border-stone-600 focus:outline-none focus:border-amber-400"
        />
        <button
          type="submit"
          className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold rounded uppercase tracking-wide transition"
        >
          Enter
        </button>
        <p className="text-stone-400 text-sm text-center">
          New here? <Link to="/register" className="text-amber-400 hover:underline">Register</Link>
        </p>
      </form>
    </div>
  )
}
