const GAME_START_YEAR = 1921
const SEASON_NAME_SETS: Record<number, string[]> = {
  1: [],
  2: ['Spring', 'Autumn'],
  3: ['Spring', 'Summer', 'Autumn'],
  4: ['Spring', 'Summer', 'Autumn', 'Winter'],
}

export type NotificationEvent =
  | 'turn_start'
  | 'season_summary'
  | 'double_cross_received'
  | 'jail'
  | 'game_end'

export interface NotificationPayload {
  eventType: NotificationEvent
  gameId: string
  playerId: number
  seasonLabel: string
  subject: string
  details: Record<string, unknown>
}

/**
 * Convert a 1-indexed season number to a human-readable label.
 * totalSeasons determines the granularity: 52→4/year, 26→2/year, 13→1/year, etc.
 */
export function getSeasonLabel(season: number, totalSeasons = 52): string {
  const seasonsPerYear = totalSeasons / 13
  const yearOffset  = Math.floor((season - 1) / seasonsPerYear)
  const seasonIndex = Math.round((season - 1) % seasonsPerYear)
  const names = SEASON_NAME_SETS[seasonsPerYear] ?? []
  const seasonName = names[seasonIndex] ? `${names[seasonIndex]} ` : ''
  return `${seasonName}${GAME_START_YEAR + yearOffset}`
}

const SUBJECT_TEMPLATES: Record<NotificationEvent, (label: string) => string> = {
  turn_start:            (l) => `It's ${l} — Your turn, Boss`,
  season_summary:        (l) => `${l} season resolved — check your empire`,
  double_cross_received: (l) => `${l} — You've been robbed!`,
  jail:                  (l) => `${l} — You're behind bars`,
  game_end:              (l) => `${l} — Prohibition ends. Final tallies are in!`
}

/**
 * Construct a notification payload for a given event.
 */
export function buildNotificationPayload(
  eventType: NotificationEvent,
  gameId: string,
  playerId: number,
  season: number,
  details: Record<string, unknown> = {}
): NotificationPayload {
  const seasonLabel = getSeasonLabel(season)
  return {
    eventType,
    gameId,
    playerId,
    seasonLabel,
    subject:  SUBJECT_TEMPLATES[eventType](seasonLabel),
    details
  }
}

/**
 * Send a notification to the 3mails endpoint.
 * Failures are caught and logged — they must never block turn resolution.
 */
export async function sendNotification(
  endpoint: string,
  apiKey: string,
  payload: NotificationPayload
): Promise<void> {
  try {
    await fetch(endpoint, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key':    apiKey
      },
      body: JSON.stringify(payload)
    })
  } catch (err) {
    console.error('[notifications] Failed to send notification:', err)
  }
}
