// Update only the app shell; never reload a running editor or touch its records.
export function updateBrandShell(source) {
  const install="self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));});";
  const activate="self.addEventListener('activate',event=>{event.waitUntil(Promise.resolve());});";
  const fetchStart="self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||!urls.has(event.request.url))return;";
  for (const anchor of [install,activate,fetchStart]) if (!source.includes(anchor)) throw new Error('Unexpected service worker structure');
  const sameVersion=`async function sameAppVersion(){
  const active=self.registration.active;
  if(!active)return false;
  return new Promise(resolve=>{
    const finish=value=>{clearTimeout(timer);self.removeEventListener('message',receive);resolve(value);};
    const receive=event=>{if(event.source===active&&event.data?.type==='offlineStatus')finish(event.data.version==='1.3.4'&&event.data.appShellReady===true);};
    const timer=setTimeout(()=>finish(false),2000);
    self.addEventListener('message',receive);
    active.postMessage({type:'offlineCheck'});
  });
}
`;
  return sameVersion+"const BRAND_TAKEOVER=new URL('./.brand-takeover-20261007k',self.registration.scope).href;\n"+source
    .replace(install,"self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(async()=>{if(await sameAppVersion()){await(await caches.open(CACHE)).put(BRAND_TAKEOVER,new Response('1.3.4'));await self.skipWaiting();}}));});")
    .replace(activate,"self.addEventListener('activate',event=>{event.waitUntil(caches.open(CACHE).then(async cache=>{if(await cache.match(BRAND_TAKEOVER))await self.clients.claim();}));});")
    .replace(fetchStart,"self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request,{cache:'no-store'}).catch(async()=>{const cached=await(await caches.open(CACHE)).match(new URL('./index.html',self.registration.scope).href);if(cached)return cached;throw new Error('Offline app shell unavailable');}));return;}if(!urls.has(event.request.url))return;")
    .replace("version:'1.3.4'", "version:'1.3.4',brandRevision:'20261007k'")
    .replace("const FILES=['./'", "const FILES=['./apple-touch-practice-180-20261007k.png','./apple-touch-icon.png','./apple-touch-icon-precomposed.png','./brand-entry.js?v=20261007i','./safari-practice-180-20261007g.png','./safari-practice-192-20261007g.png','./'");
}
