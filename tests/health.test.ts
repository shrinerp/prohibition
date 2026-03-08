import { describe, it, expect } from 'vitest'
import app from '../src/index'

describe('health check', () => {
  it('GET /health returns ok', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean; service: string }
    expect(body.ok).toBe(true)
    expect(body.service).toBe('prohibition')
  })
})
