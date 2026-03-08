import { describe, it, expect } from 'vitest'
import { ageGateMiddleware, calculateAge } from '../src/middleware/ageGate'
import { Hono } from 'hono'
import type { Env } from '../src/index'

describe('calculateAge()', () => {
  it('returns correct age for a known date', () => {
    // Fix reference date to 2026-03-08
    const age = calculateAge('2005-03-07', new Date('2026-03-08'))
    expect(age).toBe(21)
  })

  it('birthday not yet reached this year gives one less', () => {
    const age = calculateAge('2005-03-09', new Date('2026-03-08'))
    expect(age).toBe(20)
  })

  it('exact birthday today counts as that age', () => {
    const age = calculateAge('2005-03-08', new Date('2026-03-08'))
    expect(age).toBe(21)
  })
})

describe('ageGateMiddleware', () => {
  function makeApp() {
    const app = new Hono<{ Bindings: Env }>()
    app.post('/auth/register', ageGateMiddleware, (c) => c.json({ ok: true }))
    return app
  }

  it('allows requests where user is 21+', async () => {
    const app = makeApp()
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'x', date_of_birth: '2000-01-01' })
    })
    expect(res.status).toBe(200)
  })

  it('blocks requests where user is under 21', async () => {
    const app = makeApp()
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'x', date_of_birth: '2010-01-01' })
    })
    expect(res.status).toBe(403)
    const body = await res.json() as { message: string }
    expect(body.message).toBe('You must be 21 or older to play')
  })

  it('returns 400 when date_of_birth is missing', async () => {
    const app = makeApp()
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'x' })
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid date format', async () => {
    const app = makeApp()
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'x', date_of_birth: 'not-a-date' })
    })
    expect(res.status).toBe(400)
  })
})
