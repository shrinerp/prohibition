/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

// Inject Workbox precache manifest (replaced at build time by VitePWA)
precacheAndRoute(self.__WB_MANIFEST)

// ── Push event — show notification ──────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return

  let data: { title?: string; body?: string; url?: string } = {}
  try {
    data = event.data.json()
  } catch {
    data = { title: 'Prohibitioner', body: event.data.text() }
  }

  const title = data.title ?? 'Prohibitioner'
  const options: NotificationOptions = {
    body: data.body ?? '',
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    data: { url: data.url ?? '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification click — focus or open the game ──────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url: string = event.notification.data?.url ?? '/'

  event.waitUntil(
    (self.clients as Clients)
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url)
            return client.focus()
          }
        }
        return (self.clients as Clients).openWindow(url)
      })
  )
})
