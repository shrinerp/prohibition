import { Hono } from 'hono'
import type { Env } from '../index'
import type { AuthVariables } from '../middleware/sessionAuth'
import { sessionAuth } from '../middleware/sessionAuth'

export const pushRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>()

pushRouter.use('*', sessionAuth)

// ── Return VAPID public key ───────────────────────────────────────────────────
pushRouter.get('/vapid-public-key', (c) => {
  return c.json({ publicKey: c.env.VAPID_PUBLIC_KEY })
})

// ── Save a push subscription ──────────────────────────────────────────────────
pushRouter.post('/subscribe', async (c) => {
  const userId = c.get('userId')
  const { endpoint, p256dh, auth } = await c.req.json<{ endpoint: string; p256dh: string; auth: string }>()

  if (!endpoint || !p256dh || !auth) {
    return c.json({ success: false, message: 'Missing subscription fields' }, 400)
  }

  await c.env.PROHIBITIONDB.prepare(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`
  ).bind(userId, endpoint, p256dh, auth).run()

  return c.json({ success: true })
})

// ── Remove a push subscription ────────────────────────────────────────────────
pushRouter.delete('/unsubscribe', async (c) => {
  const userId = c.get('userId')
  const { endpoint } = await c.req.json<{ endpoint: string }>()

  if (!endpoint) {
    return c.json({ success: false, message: 'Missing endpoint' }, 400)
  }

  await c.env.PROHIBITIONDB.prepare(
    `DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?`
  ).bind(userId, endpoint).run()

  return c.json({ success: true })
})
