import { getCookie } from 'hono/cookie'
import type { MiddlewareHandler } from 'hono'
import type { Env } from '../index'
import { AuthService } from '../services/AuthService'

export type AdminVariables = { userId: number }

export const adminAuth: MiddlewareHandler<{ Bindings: Env; Variables: AdminVariables }> = async (c, next) => {
  const token = getCookie(c, 'session') ?? c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ success: false, message: 'Unauthorized' }, 401)

  const svc = new AuthService(c.env)
  const userId = await svc.validateSession(token)
  if (!userId) return c.json({ success: false, message: 'Unauthorized' }, 401)

  const user = await c.env.PROHIBITIONDB.prepare(
    `SELECT is_admin FROM users WHERE id = ?`
  ).bind(userId).first<{ is_admin: number }>()

  if (!user?.is_admin) return c.json({ success: false, message: 'Forbidden' }, 403)

  c.set('userId', userId)
  await next()
}
