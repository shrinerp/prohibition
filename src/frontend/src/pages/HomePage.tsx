import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function HomePage() {
  const nav = useNavigate()
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/games')
      .then(r => {
        if (r.ok) {
          setLoggedIn(true)
        } else if (r.status === 401) {
          setLoggedIn(false)
        }
      })
      .catch(() => setLoggedIn(false))
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-8">
      <div className="flex flex-col items-center gap-4">
        <img src="/logo.png" alt="Prohibition" className="w-96 h-auto drop-shadow-2xl" />
        <p className="text-stone-400 text-lg text-center">
          Build your empire. Outrun the law. Winter 1933 decides it all.
        </p>
      </div>

      {loggedIn === null ? null : loggedIn ? (
        <button
          onClick={() => nav('/games')}
          className="px-8 py-3 bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold rounded uppercase tracking-wide transition"
        >
          Go to App →
        </button>
      ) : (
        <div className="flex gap-4">
          <Link
            to="/login"
            className="px-8 py-3 bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold rounded uppercase tracking-wide transition"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="px-8 py-3 border border-amber-600 hover:bg-amber-900 text-amber-400 font-bold rounded uppercase tracking-wide transition"
          >
            Register
          </Link>
        </div>
      )}
    </div>
  )
}
