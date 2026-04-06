import bcrypt from 'bcryptjs'
import type { Env } from '../index'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export interface AuthResult {
  success: boolean
  message?: string
  sessionToken?: string
  userId?: number
}

export class AuthService {
  constructor(private env: Env) {}

  async register(email: string, password: string, dateOfBirth: string): Promise<AuthResult> {
    // Check existing user
    const existing = await this.env.PROHIBITIONDB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first<{ id: number }>()

    if (existing) {
      return { success: false, message: 'Email already registered' }
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const inserted = await this.env.PROHIBITIONDB.prepare(
      'INSERT INTO users (email, password_hash, date_of_birth) VALUES (?, ?, ?) RETURNING id'
    ).bind(email, passwordHash, dateOfBirth).first<{ id: number }>()

    const userId = inserted?.id ?? 0
    const sessionToken = await this.createSession(userId)
    return { success: true, sessionToken, userId }
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.env.PROHIBITIONDB.prepare(
      'SELECT id, password_hash FROM users WHERE email = ?'
    ).bind(email).first<{ id: number; password_hash: string }>()

    if (!user) {
      return { success: false, message: 'Invalid email or password' }
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return { success: false, message: 'Invalid email or password' }
    }

    const sessionToken = await this.createSession(user.id)
    return { success: true, sessionToken, userId: user.id }
  }

  async logout(sessionToken: string): Promise<void> {
    await this.env.PROHIBITIONDB.prepare(
      'DELETE FROM sessions WHERE id = ?'
    ).bind(sessionToken).run()
  }

  async validateSession(sessionToken: string): Promise<number | null> {
    const session = await this.env.PROHIBITIONDB.prepare(
      'SELECT user_id, expires_at FROM sessions WHERE id = ?'
    ).bind(sessionToken).first<{ user_id: number; expires_at: string }>()

    if (!session) return null
    if (new Date(session.expires_at) < new Date()) return null

    return session.user_id
  }

  private async createSession(userId: number): Promise<string> {
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
    await this.env.PROHIBITIONDB.prepare(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
    ).bind(token, userId, expiresAt).run()
    return token
  }
}
