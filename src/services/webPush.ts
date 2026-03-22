import { buildPushPayload } from '@block65/webcrypto-web-push'
import type { Env } from '../index'

interface PushSubscriptionRow {
  id: number
  endpoint: string
  p256dh: string
  auth: string
}

type VapidEnv = Pick<Env, 'VAPID_PUBLIC_KEY' | 'VAPID_PRIVATE_KEY' | 'VAPID_SUBJECT'>

/**
 * Send a web push notification to all subscriptions for a given user.
 * 410 Gone responses are cleaned up automatically.
 * All errors are swallowed — push must never block turn resolution.
 */
export async function sendPushToUser(
  db: D1Database,
  userId: number,
  payload: { title: string; body: string; url?: string },
  env: VapidEnv,
): Promise<void> {
  const { results: subs } = await db
    .prepare(`SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?`)
    .bind(userId)
    .all<PushSubscriptionRow>()

  if (!subs.length) return

  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  }

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        const pushPayload = await buildPushPayload(
          { data: payload },
          { endpoint: sub.endpoint, expirationTime: null, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          vapid,
        )
        const res = await fetch(sub.endpoint, {
          method: pushPayload.method,
          headers: pushPayload.headers as Record<string, string>,
          body: pushPayload.body,
        })
        if (res.status === 410) {
          await db
            .prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`)
            .bind(sub.endpoint)
            .run()
        }
      } catch (err) {
        console.error('[webPush] Failed to send push:', err)
      }
    }),
  )
}
