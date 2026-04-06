import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage    from './pages/HomePage'
import LoginPage   from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import GamesPage   from './pages/GamesPage'
import GamePage    from './pages/GamePage'
import EndGamePage from './pages/EndGamePage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-stone-900 text-amber-100">
        <Routes>
          <Route path="/"            element={<HomePage />} />
          <Route path="/login"       element={<LoginPage />} />
          <Route path="/register"    element={<RegisterPage />} />
          <Route path="/games"       element={<GamesPage />} />
          <Route path="/games/:id"   element={<GamePage />} />
          <Route path="/games/:id/end" element={<EndGamePage />} />
          <Route path="*"            element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
