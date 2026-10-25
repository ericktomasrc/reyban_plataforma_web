/*
 * e171 — EL SERVICE WORKER DE LA APP INSTALABLE (PWA).
 *
 * Hace una sola cosa: que la plataforma abra rápido y se pueda instalar.
 * Lo que NO hace, a propósito:
 *
 *   · No guarda NADA de /api: ni comprobantes, ni clientes, ni la sesión.
 *     Todo eso se pide siempre al servidor, como sin la app.
 *   · No guarda la página (index.html): se pide siempre al servidor. Así,
 *     después de subir una versión nueva nadie se queda con la vieja.
 *
 * Solo guarda lo que nunca cambia: los archivos de /assets (llevan un nombre
 * distinto en cada versión) y los íconos. Sin internet enseña un aviso: emitir
 * necesita a SUNAT, y SUNAT necesita conexión.
 */
const CACHE = 'reyban-estaticos-v1'
const MAXIMO = 80

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith('reyban-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()))
})

const SIN_CONEXION = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Sin conexión · Reyban</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f5f7;color:#1d252c;
font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding:24px;box-sizing:border-box}
.c{max-width:420px;background:#fff;border:1px solid #d9e0e3;border-radius:14px;padding:28px;text-align:center}
h1{font-size:20px;margin:0 0 8px}p{margin:0 0 18px;color:#4a5560}
button{font:inherit;border:0;border-radius:8px;background:#0f6f6c;color:#fff;padding:10px 18px;cursor:pointer}</style>
</head><body><div class="c"><h1>Sin conexión a internet</h1>
<p>Reyban necesita internet para emitir a SUNAT y para mostrar tus datos. Revisa tu conexión y vuelve a intentar.</p>
<button onclick="location.reload()">Volver a intentar</button></div></body></html>`

async function recortar(cache) {
  const llaves = await cache.keys()
  for (let i = 0; i < llaves.length - MAXIMO; i++) await cache.delete(llaves[i])
}

self.addEventListener('fetch', e => {
  const r = e.request
  if (r.method !== 'GET') return
  const u = new URL(r.url)
  if (u.origin !== self.location.origin) return

  // La página: siempre del servidor. Sin conexión, el aviso.
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).catch(() =>
      new Response(SIN_CONEXION, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })))
    return
  }

  // Lo que no cambia: primero la copia guardada.
  if (u.pathname.startsWith('/assets/') || u.pathname.startsWith('/iconos/')) {
    e.respondWith(caches.open(CACHE).then(async cache => {
      const guardada = await cache.match(r)
      if (guardada) return guardada
      const resp = await fetch(r)
      if (resp.ok) { await cache.put(r, resp.clone()); void recortar(cache) }
      return resp
    }))
  }
  // Todo lo demás (/api, descargas, /salud…): directo al servidor, sin tocar.
})