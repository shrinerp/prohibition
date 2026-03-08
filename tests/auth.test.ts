import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthService } from '../src/services/AuthService'

// Mock D1
function makeDb(overrides: Partial<{ firstResult: unknown; runResult: unknown }> = {}) {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(overrides.firstResult ?? null),
    run: vi.fn().mockResolvedValue(overrides.runResult ?? { success: true })
  }
  return {
    prepare: vi.fn().mockReturnValue(stmt),
    _stmt: stmt
  }
}

const BASE_ENV = {
  PROHIBITIONDB: null as any,
  ENCRYPTION_KEY: 'test-key',
  MAILS_API_KEY: '',
  MAILS_ENDPOINT: ''
}

describe('AuthService.register()', () => {
  it('returns success and a session token for valid input', async () => {
    const db = makeDb()
    const svc = new AuthService({ ...BASE_ENV, PROHIBITIONDB: db as any })
    const result = await svc.register('user@example.com', 'Password1!', '1990-01-01')
    expect(result.success).toBe(true)
    expect(typeof result.sessionToken).toBe('string')
    expect(result.sessionToken!.length).toBeGreaterThan(10)
  })

  it('hashes the password (does not store plaintext)', async () => {
    const db = makeDb()
    const svc = new AuthService({ ...BASE_ENV, PROHIBITIONDB: db as any })
    await svc.register('user@example.com', 'Password1!', '1990-01-01')
    // Find the INSERT call for users
    const calls = db._stmt.bind.mock.calls
    const userInsertArgs = calls.find((args: unknown[]) => {
      return args.some(a => typeof a === 'string' && a.startsWith('$2'))
    })
    expect(userInsertArgs).toBeDefined()
  })

  it('returns error when email already exists', async () => {
    const db = makeDb({ firstResult: { id: 1, email: 'user@example.com' } })
    const svc = new AuthService({ ...BASE_ENV, PROHIBITIONDB: db as any })
    const result = await svc.register('user@example.com', 'Password1!', '1990-01-01')
    expect(result.success).toBe(false)
    expect(result.message).toMatch(/already registered/i)
  })
})

describe('AuthService.login()', () => {
  it('returns session token for valid credentials', async () => {
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.hash('Password1!', 10)
    const db = makeDb({ firstResult: { id: 1, email: 'user@example.com', password_hash: hash } })
    const svc = new AuthService({ ...BASE_ENV, PROHIBITIONDB: db as any })
    const result = await svc.login('user@example.com', 'Password1!')
    expect(result.success).toBe(true)
    expect(typeof result.sessionToken).toBe('string')
  })

  it('returns error for wrong password', async () => {
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.hash('correct-password', 10)
    const db = makeDb({ firstResult: { id: 1, email: 'user@example.com', password_hash: hash } })
    const svc = new AuthService({ ...BASE_ENV, PROHIBITIONDB: db as any })
    const result = await svc.login('user@example.com', 'wrong-password')
    expect(result.success).toBe(false)
    expect(result.message).toMatch(/invalid/i)
  })

  it('returns error when user not found', async () => {
    const db = makeDb({ firstResult: null })
    const svc = new AuthService({ ...BASE_ENV, PROHIBITIONDB: db as any })
    const result = await svc.login('ghost@example.com', 'Password1!')
    expect(result.success).toBe(false)
  })
})

describe('AuthService.validateSession()', () => {
  it('returns user_id for a valid non-expired session', async () => {
    const future = new Date(Date.now() + 3600_000).toISOString()
    const db = makeDb({ firstResult: { user_id: 42, expires_at: future } })
    const svc = new AuthService({ ...BASE_ENV, PROHIBITIONDB: db as any })
    const userId = await svc.validateSession('valid-token')
    expect(userId).toBe(42)
  })

  it('returns null for expired session', async () => {
    const past = new Date(Date.now() - 3600_000).toISOString()
    const db = makeDb({ firstResult: { user_id: 42, expires_at: past } })
    const svc = new AuthService({ ...BASE_ENV, PROHIBITIONDB: db as any })
    const userId = await svc.validateSession('expired-token')
    expect(userId).toBeNull()
  })

  it('returns null when session not found', async () => {
    const db = makeDb({ firstResult: null })
    const svc = new AuthService({ ...BASE_ENV, PROHIBITIONDB: db as any })
    const userId = await svc.validateSession('missing-token')
    expect(userId).toBeNull()
  })
})
