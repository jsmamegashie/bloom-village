// Bloom Village service worker: opens fast and offline, shows phone notifications.
const C = 'bloom-v4';
const SHELL = ['/', '/shim.js', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.pathname.startsWith('/api/') || u.hostname.endsWith('supabase.co') || u.hostname.includes('blob.vercel-storage')) return;
  const put = (r) => { if (r && r.ok) { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); } return r; };
  if (u.origin === location.origin) e.respondWith(fetch(e.request).then(put).catch(() => caches.match(e.request).then(m => m || caches.match('/'))));
  else if (/jsdelivr|cdnjs|fonts\.(googleapis|gstatic)|esm\.sh/.test(u.hostname)) e.respondWith(caches.match(e.request).then(m => m || fetch(e.request).then(put)));
});
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch (x) { d = { title: 'Bloom Village', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Bloom Village', { body: d.body || '', tag: d.tag || 'bloom', renotify: true, icon: '/icon-192.png', badge: '/icon-192.png', data: { url: d.url || '/#today' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const url = (e.notification.data && e.notification.data.url) || '/#today';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => { for (const w of ws) { if ('focus' in w) { w.postMessage({ open: (url.split('#')[1] || 'today') }); return w.focus(); } } return self.clients.openWindow(url); }));
});
