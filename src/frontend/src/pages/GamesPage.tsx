import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function GamesPage() {
  const nav = useNavigate()
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')

  async function createGame() {
    setError('')
    const res = await fetch('/api/games', { method: 'POST' })
    const data = await res.json()
    if (data.success && data.gameId) {
      nav(`/games/${data.gameId}`)
    } else {
      setError(data.message ?? 'Failed to create game')
    }
  }

  async function joinGame(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/games/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode })
    })
    const data = await res.json()
    if (data.success && data.gameId) {
      nav(`/games/${data.gameId}`)
    } else {
      setError(data.message ?? 'Failed to join game')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-8">
      <h2 className="text-3xl font-bold text-amber-400">Your Syndicate</h2>
      {error && <p className="text-red-400">{error}</p>}

      <button
        onClick={createGame}
        className="px-8 py-3 bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold rounded uppercase tracking-wide transition"
      >
        Start New Game
      </button>

      <div className="text-stone-400">— or —</div>

      <form onSubmit={joinGame} className="flex gap-2">
        <input
          type="text"
          placeholder="Invite Code"
          value={inviteCode}
          onChange={e => setInviteCode(e.target.value)}
          className="px-4 py-2 bg-stone-800 rounded border border-stone-600 focus:outline-none focus:border-amber-400"
        />
        <button
          type="submit"
          className="px-6 py-2 border border-amber-600 hover:bg-amber-900 text-amber-400 font-bold rounded uppercase tracking-wide transition"
        >
          Join
        </button>
      </form>
    </div>
  )
}
