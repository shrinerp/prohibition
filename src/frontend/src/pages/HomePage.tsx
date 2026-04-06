import React from 'react'
import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-8">
      <div className="text-center">
        <h1 className="text-6xl font-black tracking-widest uppercase text-amber-400 mb-2">
          Prohibition
        </h1>
        <p className="text-stone-400 text-lg">
          Build your empire. Outrun the law. Winter 1933 decides it all.
        </p>
      </div>
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
    </div>
  )
}
