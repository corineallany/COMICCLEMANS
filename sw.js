const CACHE='com-icc-le-mans-v71';
const CORE=['./','./index.html','./manifest.webmanifest','./push.js','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{}));});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{let x=r.clone();caches.open(CACHE).then(c=>c.put('./index.html',x));return r;}).catch(()=>caches.match('./index.html')));return;}e.respondWith(fetch(e.request).then(r=>{let x=r.clone();caches.open(CACHE).then(c=>c.put(e.request,x));return r;}).catch(()=>caches.match(e.request)));});
self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?event.data.json():{};}catch(e){data={title:'COM Le Mans',body:event.data?event.data.text():'Nouvelle notification'};}
  const title=data.title||'COM Le Mans';
  const options={
    body:data.body||'Nouvelle information dans COM Le Mans',
    icon:'./icons/icon-192.png',
    badge:'./icons/icon-192.png',
    data:{url:data.url||'./'},
    tag:data.tag||undefined,
    renotify:!!data.renotify
  };
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=event.notification.data?.url||'./';
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){if('focus' in c){c.navigate(url);return c.focus();}}
    return clients.openWindow?clients.openWindow(url):undefined;
  }));
});
