import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Env } from '../index'
import { ageGateMiddleware } from '../middleware/ageGate'
import { AuthService } from '../services/AuthService'

export const authRouter = new Hono<{ Bindings: Env }>()

authRouter.post('/register', ageGateMiddleware, async (c) => {
  const body = await c.req.json<{ email: string; password: string; date_of_birth: string }>()
  const svc = new AuthService(c.env)
  const result = await svc.register(body.email, body.password, body.date_of_birth)
  if (!result.success) return c.json({ success: false, message: result.message }, 400)
  setCookie(c, 'session', result.sessionToken!, { httpOnly: true, path: '/', sameSite: 'Lax', secure: true, maxAge: 30 * 24 * 60 * 60 })
  return c.json({ success: true })
})

authRouter.post('/login', async (c) => {
  const body = await c.req.json<{ email: string; password: string }>()
  const svc = new AuthService(c.env)
  const result = await svc.login(body.email, body.password)
  if (!result.success) return c.json({ success: false, message: result.message }, 401)
  setCookie(c, 'session', result.sessionToken!, { httpOnly: true, path: '/', sameSite: 'Lax', secure: true, maxAge: 30 * 24 * 60 * 60 })
  return c.json({ success: true })
})

authRouter.post('/logout', async (c) => {
  const token = getCookie(c, 'session')
  if (token) {
    const svc = new AuthService(c.env)
    await svc.logout(token)
  }
  deleteCookie(c, 'session')
  return c.json({ success: true })
})
