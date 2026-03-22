import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @block65/webcrypto-web-push before importing the service
vi.mock('@block65/webcrypto-web-push', () => ({
  buildPushPayload: vi.fn().mockResolvedValue({
    method: 'POST',
    headers: {
      'content-type': 'application/octet-stream',
      'content-encoding': 'aes128gcm',
      'content-length': '100',
      'crypto-key': 'dh=fake',
      encryption: 'salt=fake',
      ttl: '86400',
      authorization: 'vapid t=fake.token',
    },
    body: new Uint8Array([1, 2, 3]),
  }),
}))

import { sendPushToUser } from '../src/services/webPush'

function makeDb(subs: { id: number; endpoint: string; p256dh: string; auth: string }[] = []) {
  const allStmt = { bind: vi.fn().mockReturnThis(), all: vi.fn().mockResolvedValue({ results: subs }) }
  const runStmt = { bind: vi.fn().mockReturnThis(), run: vi.fn().mockResolvedValue({ success: true }) }
  const db = {
    prepare: vi.fn((sql: string) => {
      if (sql.includes('DELETE')) return runStmt
      return allStmt
    }),
    _allStmt: allStmt,
    _runStmt: runStmt,
  }
  return db
}

const VAPID_ENV = {
  VAPID_PUBLIC_KEY: 'fake-public-key',
  VAPID_PRIVATE_KEY: 'fake-private-key',
  VAPID_SUBJECT: 'mailto:test@example.com',
}

describe('sendPushToUser()', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 201 })))
  })

  it('does nothing when user has no subscriptions', async () => {
    const db = makeDb([])
    await sendPushToUser(db as any, 1, { title: 'Test', body: 'Hello' }, VAPID_ENV)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('sends a push to each subscription endpoint', async () => {
    const db = makeDb([
      { id: 1, endpoint: 'https://push.example.com/sub/1', p256dh: 'key1', auth: 'auth1' },
      { id: 2, endpoint: 'https://push.example.com/sub/2', p256dh: 'key2', auth: 'auth2' },
    ])
    await sendPushToUser(db as any, 1, { title: 'Your turn', body: 'It is your turn' }, VAPID_ENV)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('https://push.example.com/sub/1')
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[1][0]).toBe('https://push.example.com/sub/2')
  })

  it('removes subscription from DB on 410 Gone response', async () => {
    const db = makeDb([
      { id: 5, endpoint: 'https://push.example.com/gone', p256dh: 'key', auth: 'auth' },
    ])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 410 })))
    await sendPushToUser(db as any, 1, { title: 'Test', body: 'msg' }, VAPID_ENV)
    expect(db._runStmt.bind).toHaveBeenCalledWith('https://push.example.com/gone')
  })

  it('does not throw on network error', async () => {
    const db = makeDb([
      { id: 1, endpoint: 'https://push.example.com/sub', p256dh: 'key', auth: 'auth' },
    ])
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    await expect(
      sendPushToUser(db as any, 1, { title: 'Test', body: 'msg' }, VAPID_ENV)
    ).resolves.toBeUndefined()
  })
})
