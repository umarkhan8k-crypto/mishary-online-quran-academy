self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {title:'International Learning Platform', body:event.data?.text() || 'You have a new notification.'}; }
  const title = data.title || 'International Learning Platform';
  const options = {
    body: data.body || 'You have a new tutor request.',
    icon: data.icon || 'icon-192.png',
    badge: data.badge || 'icon-192.png',
    data: { url: data.url || '/dashboard.html' },
    tag: data.tag || 'ilp-notification',
    renotify: true
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || '/dashboard.html';
  event.waitUntil(clients.matchAll({type:'window', includeUncontrolled:true}).then(list => {
    for (const client of list) {
      if ('focus' in client) { client.navigate(target); return client.focus(); }
    }
    return clients.openWindow(target);
  }));
});
