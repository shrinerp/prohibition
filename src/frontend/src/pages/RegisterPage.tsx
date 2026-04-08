import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { identify, capture } from '../analytics'

export default function RegisterPage() {
  const nav = useNavigate()
  const [email, setEmail]                 = useState('')
  const [password, setPassword]           = useState('')
  const [dob, setDob]                     = useState('')
  const [emailMarketing, setEmailMarketing] = useState(false)
  const [error, setError]                 = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, date_of_birth: dob, email_marketing: emailMarketing })
    })
    const data = await res.json()
    if (data.success) {
      identify(email)
      capture('register_completed')
      nav('/games')
    } else {
      capture('register_failed', { reason: data.message })
      setError(data.message ?? 'Registration failed')
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <form onSubmit={handleSubmit} className="bg-stone-800 p-8 rounded-lg w-full max-w-sm space-y-4">
        <div className="flex justify-center mb-2">
          <img src="/logo.png" alt="Prohibitioner" className="h-20 w-auto object-contain drop-shadow-lg" />
        </div>
        <h2 className="text-2xl font-bold text-amber-400 text-center">Join the Syndicate</h2>

        {/* Age gate — clear 21+ messaging */}
        <div className="bg-amber-900/40 border border-amber-600 rounded p-3 text-sm text-amber-300">
          <p className="font-semibold">You must be 21 or older to play.</p>
          <p className="text-stone-400 mt-1">Enter your date of birth to verify your age.</p>
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <div>
          <label className="text-stone-400 text-xs uppercase tracking-wider">Date of Birth</label>
          <input
            type="date"
            value={dob}
            onChange={e => setDob(e.target.value)}
            required
            className="w-full mt-1 px-4 py-2 bg-stone-700 rounded border border-stone-600 focus:outline-none focus:border-amber-400"
          />
        </div>

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
          placeholder="Password (min 8 chars)"
          value={password}
          onChange={e => setPassword(e.target.value)}
          minLength={8}
          required
          className="w-full px-4 py-2 bg-stone-700 rounded border border-stone-600 focus:outline-none focus:border-amber-400"
        />

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={emailMarketing}
            onChange={e => setEmailMarketing(e.target.checked)}
            className="mt-0.5 accent-amber-500 w-4 h-4 flex-shrink-0"
          />
          <span className="text-stone-400 text-xs leading-snug">
            Send me occasional updates about new features, game invites, and Prohibition-era trivia. No spam — unsubscribe anytime.
          </span>
        </label>

        <button
          type="submit"
          className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold rounded uppercase tracking-wide transition"
        >
          Register
        </button>
        <p className="text-stone-400 text-sm text-center">
          Already in? <Link to="/login" className="text-amber-400 hover:underline">Sign In</Link>
        </p>
      </form>
    </div>
  )
}
