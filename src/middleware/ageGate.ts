import type { MiddlewareHandler } from 'hono'
import type { Env } from '../index'

const DOB_REGEX = /^\d{4}-\d{2}-\d{2}$/

export function calculateAge(dob: string, now: Date = new Date()): number {
  const birth = new Date(dob)
  let age = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--
  }
  return age
}

type RegisterBody = { email?: string; password?: string; date_of_birth?: string }

export const ageGateMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const body = await c.req.json<RegisterBody>().catch(() => ({} as RegisterBody))

  const dob = body?.date_of_birth
  if (typeof dob !== 'string' || !DOB_REGEX.test(dob)) {
    return c.json({ message: 'date_of_birth is required (YYYY-MM-DD)' }, 400)
  }

  const date = new Date(dob)
  if (isNaN(date.getTime())) {
    return c.json({ message: 'date_of_birth is required (YYYY-MM-DD)' }, 400)
  }

  if (calculateAge(dob) < 21) {
    return c.json({ message: 'You must be 21 or older to play' }, 403)
  }

  await next()
}
