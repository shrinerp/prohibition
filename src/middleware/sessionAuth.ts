import { getCookie } from 'hono/cookie'
import type { MiddlewareHandler } from 'hono'
import type { Env } from '../index'
import { AuthService } from '../services/AuthService'

export type AuthVariables = { userId: number }

export const sessionAuth: MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> = async (c, next) => {
  const token = getCookie(c, 'session') ?? c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ success: false, message: 'Unauthorized' }, 401)

  const svc = new AuthService(c.env)
  const userId = await svc.validateSession(token)
  if (!userId) return c.json({ success: false, message: 'Unauthorized' }, 401)

  c.set('userId', userId)
  await next()
}
