import posthog from 'posthog-js'

const key = (import.meta as { env: Record<string, string> }).env.VITE_POSTHOG_KEY

export function initAnalytics() {
  if (!key) return
  posthog.init(key, {
    api_host: 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false, // we fire page_view manually
    autocapture: false,
    cross_subdomain_cookie: true, // share cookie with prohibitioner.com
  })
}

export function identify(email: string) {
  if (!key) return
  posthog.identify(email)
}

export function reset() {
  if (!key) return
  posthog.reset()
}

export function capture(event: string, properties?: Record<string, unknown>) {
  if (!key) return
  posthog.capture(event, properties)
}
