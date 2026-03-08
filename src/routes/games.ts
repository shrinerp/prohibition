import { Hono } from 'hono'
import type { Env } from '../index'
import type { AuthVariables } from '../middleware/sessionAuth'
import { sessionAuth } from '../middleware/sessionAuth'
import { GameService } from '../services/GameService'

export const gamesRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>()

gamesRouter.use('*', sessionAuth)

gamesRouter.post('/', async (c) => {
  const svc = new GameService(c.env)
  const result = await svc.createGame(c.get('userId'))
  if (!result.success) return c.json({ success: false, message: result.message }, 400)
  return c.json({ success: true, gameId: result.gameId, inviteCode: result.inviteCode })
})

gamesRouter.post('/join', async (c) => {
  const { inviteCode } = await c.req.json<{ inviteCode: string }>()
  const svc = new GameService(c.env)
  const result = await svc.joinGame(inviteCode, c.get('userId'))
  if (!result.success) return c.json({ success: false, message: result.message }, 400)
  return c.json({ success: true, gameId: result.gameId })
})

gamesRouter.post('/:id/character', async (c) => {
  const { characterClass } = await c.req.json<{ characterClass: string }>()
  const svc = new GameService(c.env)
  const result = await svc.selectCharacter(c.req.param('id'), c.get('userId'), characterClass)
  if (!result.success) return c.json({ success: false, message: result.message }, 400)
  return c.json({ success: true })
})

gamesRouter.post('/:id/start', async (c) => {
  const svc = new GameService(c.env)
  const result = await svc.startGame(c.req.param('id'), c.get('userId'))
  if (!result.success) return c.json({ success: false, message: result.message }, 400)
  return c.json({ success: true })
})
