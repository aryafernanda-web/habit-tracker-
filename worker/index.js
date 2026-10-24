// worker/index.js - custom worker logic bundled by next-pwa

self.addEventListener('message', (event) => {
  if (!event.data) return

  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data
    self.registration.showNotification(title, {
      body: options?.body || '',
      icon: options?.icon || '/icons/icon-192x192.png',
      badge: options?.badge || '/icons/icon-96x96.png',
      tag: options?.tag || `habit-${Date.now()}`,
      renotify: true,
      vibrate: [200, 100, 200, 100, 200],
      data: options?.data || { url: '/' },
    })
  }

  if (event.data.type === 'SCHEDULE_REMINDERS') {
    // Cache reminder list in service worker if needed
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})
