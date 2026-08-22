self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) { data = {body: event.data ? event.data.text() : ''}; }
  const title = data.title || 'COM Le Mans';
  const options = { body: data.body || 'Nouvelle information disponible.', icon: './icon-192.png', badge: './icon-192.png', tag: data.tag || 'icc-'+Date.now(), data: { url: data.url || './' } };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || './';
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list => {
    for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus(); } }
    return clients.openWindow ? clients.openWindow(url) : null;
  }));
});
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
