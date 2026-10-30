// Service worker de Salud en mi Vereda (RNF03: funcionamiento sin conexión)
// - La aplicación (HTML, JS, CSS, íconos) se guarda en el teléfono.
// - El directorio, las veredas y los contenidos se piden a la red y, si no hay señal,
//   se entrega la última copia guardada.
const VERSION = 'v1';
const CACHE_APP = `app-${VERSION}`;
const CACHE_DATOS = `datos-${VERSION}`;
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icono.svg', '/icono-192.png'];
const DATOS_OFFLINE = ['/api/servicios', '/api/contenidos', '/api/veredas', '/api/tipos-solicitud'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_APP).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((c) => ![CACHE_APP, CACHE_DATOS].includes(c)).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

async function redPrimero(request, nombreCache) {
  const cache = await caches.open(nombreCache);
  try {
    const respuesta = await fetch(request);
    if (respuesta.ok) cache.put(request, respuesta.clone());
    return respuesta;
  } catch {
    const guardada = await cache.match(request);
    if (guardada) return guardada;
    throw new Error('Sin conexión y sin copia guardada');
  }
}

async function cachePrimero(request) {
  const guardada = await caches.match(request);
  if (guardada) return guardada;
  const respuesta = await fetch(request);
  if (respuesta.ok) (await caches.open(CACHE_APP)).put(request, respuesta.clone());
  return respuesta;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (DATOS_OFFLINE.includes(url.pathname)) {
    event.respondWith(redPrimero(request, CACHE_DATOS));
  } else if (url.pathname.startsWith('/api/')) {
    // Datos privados: siempre desde la red, nunca se guardan en caché
  } else if (request.mode === 'navigate') {
    event.respondWith(redPrimero(request, CACHE_APP).catch(() => caches.match('/index.html')));
  } else if (url.pathname.startsWith('/assets/') || APP_SHELL.includes(url.pathname)) {
    event.respondWith(cachePrimero(request));
  }
});
