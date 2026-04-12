import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import HomePage    from './pages/HomePage'
import LoginPage   from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import GamesPage   from './pages/GamesPage'
import GamePage    from './pages/GamePage'
import EndGamePage from './pages/EndGamePage'
import AdminPage   from './pages/AdminPage'
import HowToPlayPage from './pages/HowToPlayPage'
import ShamePage from './pages/ShamePage'

function StagingBanner() {
  if (!window.location.hostname.includes('staging')) return null
  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}
      className="bg-yellow-400 text-stone-900 text-center text-xs font-bold py-1 uppercase tracking-widest"
    >
      STAGING — not production
    </div>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const [verified, setVerified] = useState(false)
  const nav = useNavigate()
  const location = useLocation()

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (r.status === 401) {
        nav(`/login?redirect=${encodeURIComponent(location.pathname)}`, { replace: true })
      } else {
        setVerified(true)
      }
    })
  }, [])

  if (!verified) return null
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-stone-900 text-amber-100">
        <StagingBanner />
        <Routes>
          <Route path="/"            element={<HomePage />} />
          <Route path="/login"       element={<LoginPage />} />
          <Route path="/register"    element={<RegisterPage />} />
          <Route path="/games"       element={<RequireAuth><GamesPage /></RequireAuth>} />
          <Route path="/games/:id"   element={<RequireAuth><GamePage /></RequireAuth>} />
          <Route path="/games/:id/end" element={<RequireAuth><EndGamePage /></RequireAuth>} />
          <Route path="/admin"       element={<RequireAuth><AdminPage /></RequireAuth>} />
          <Route path="/how-to-play" element={<HowToPlayPage />} />
          <Route path="/results/:gameId" element={<ShamePage />} />
          <Route path="/shame"       element={<ShamePage />} />
          <Route path="*"            element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
