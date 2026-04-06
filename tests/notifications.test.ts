import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getSeasonLabel,
  buildNotificationPayload,
  sendNotification,
  type NotificationEvent,
  type NotificationPayload
} from '../src/services/notifications'

describe('getSeasonLabel()', () => {
  it('returns Spring 1921 for season 1', () => {
    expect(getSeasonLabel(1)).toBe('Spring 1921')
  })

  it('returns Summer 1921 for season 2', () => {
    expect(getSeasonLabel(2)).toBe('Summer 1921')
  })

  it('returns Autumn 1921 for season 3', () => {
    expect(getSeasonLabel(3)).toBe('Autumn 1921')
  })

  it('returns Winter 1921 for season 4', () => {
    expect(getSeasonLabel(4)).toBe('Winter 1921')
  })

  it('returns Spring 1922 for season 5', () => {
    expect(getSeasonLabel(5)).toBe('Spring 1922')
  })

  it('returns Winter 1933 for season 52', () => {
    expect(getSeasonLabel(52)).toBe('Winter 1933')
  })
})

describe('buildNotificationPayload()', () => {
  it('builds a turn_start payload', () => {
    const payload = buildNotificationPayload('turn_start', 'game-1', 42, 7)
    expect(payload.eventType).toBe('turn_start')
    expect(payload.gameId).toBe('game-1')
    expect(payload.playerId).toBe(42)
    expect(payload.seasonLabel).toBe('Autumn 1922')  // season 7
    expect(payload.subject).toContain('Your turn')
  })

  it('builds a jail payload', () => {
    const payload = buildNotificationPayload('jail', 'game-1', 42, 3, { seasons: 2 })
    expect(payload.eventType).toBe('jail')
    expect(payload.details).toMatchObject({ seasons: 2 })
  })

  it('builds a game_end payload', () => {
    const payload = buildNotificationPayload('game_end', 'game-1', 42, 52)
    expect(payload.eventType).toBe('game_end')
    expect(payload.seasonLabel).toBe('Winter 1933')
  })
})

describe('sendNotification()', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('POSTs payload to 3mails endpoint with API key header', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }))

    const payload: NotificationPayload = {
      eventType: 'turn_start',
      gameId: 'g1',
      playerId: 1,
      seasonLabel: 'Spring 1920',
      subject: 'Your turn',
      details: {}
    }

    await sendNotification('https://3mails.example.com', 'key-123', payload)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://3mails.example.com',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-API-Key': 'key-123' })
      })
    )
  })

  it('does not throw when 3mails endpoint fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

    const payload: NotificationPayload = {
      eventType: 'turn_start',
      gameId: 'g1',
      playerId: 1,
      seasonLabel: 'Spring 1920',
      subject: 'Your turn',
      details: {}
    }

    // Should not throw
    await expect(sendNotification('https://3mails.example.com', 'key', payload)).resolves.toBeUndefined()
  })
})
