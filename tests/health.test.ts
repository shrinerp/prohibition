import { describe, it, expect } from 'vitest'
import worker from '../src/index'

// index.ts exports a Worker shape { fetch, scheduled }, not a bare Hono app.
// Use worker.fetch() with a real Request to test routes.
const mockEnv = {
  PROHIBITIONDB: null as any,
  ENCRYPTION_KEY: '',
  MAILS_API_KEY: '',
  MAILS_ENDPOINT: '',
  THREEMAILS_API_KEY: '',
  VAPID_PUBLIC_KEY: '',
  VAPID_PRIVATE_KEY: '',
  VAPID_SUBJECT: '',
  ASSETS: { fetch: async () => new Response('', { status: 404 }) },
} as any

describe('health check', () => {
  it('GET /health returns ok', async () => {
    const res = await worker.fetch(new Request('http://localhost/health'), mockEnv, {} as any)
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean; service: string }
    expect(body.ok).toBe(true)
    expect(body.service).toBe('prohibition')
  })
})
