// Added to the app's service worker (see vite.config.ts → workbox.importScripts).
// Shows goal-time alerts sent by /api/reminders/tick, even when the app is closed,
// and opens the app when one is tapped.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Weekly Goals', {
      body: data.body || "It's time.",
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.goalId || 'goal-reminder', // a newer alert for the same goal replaces the old one
      renotify: true,
      requireInteraction: true, // stays on screen until you act on it (where supported)
      vibrate: [300, 150, 300],
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Reuse an open app window if there is one; the takeover appears there.
      for (const win of windows) {
        if ('focus' in win) return win.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
