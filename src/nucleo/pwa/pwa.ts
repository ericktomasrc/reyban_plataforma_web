import { useEffect, useState } from 'react'

/**
 * e171 — LA APP INSTALABLE (PWA).
 *
 *   · registrarPwa(): instala el service worker (public/sw.js). Solo en el
 *     build: en desarrollo, Vite sirve los archivos y no hace falta.
 *   · useInstalar(): si el navegador ofrece instalar (Chrome, Edge, Android),
 *     guarda el aviso para el «Instalar la app» del menú. En iPhone no hay
 *     aviso: se explica «Compartir › Agregar a inicio».
 *   · useVersionNueva(): cada cierto tiempo, y al volver a la pestaña, mira
 *     si el servidor ya tiene otra versión. Si la hay, se ofrece «Actualizar».
 *
 * Nada de esto toca la sesión ni los datos: /api no pasa por el service worker.
 */

interface AvisoInstalar extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let aviso: AvisoInstalar | null = null
const oyentes = new Set<() => void>()
const avisar = () => oyentes.forEach(f => f())

export function registrarPwa() {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()             // sin la franja del navegador: lo ofrece el menú
    aviso = e as AvisoInstalar
    avisar()
  })
  window.addEventListener('appinstalled', () => { aviso = null; avisar() })

  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* sin app instalable: la web sigue igual */ })
  })
}

/** Ya se abrió como app (instalada). */
export const esInstalada = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

/** iPhone o iPad (Safari no ofrece instalar solo). */
export const esIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export function useInstalar() {
  const [, setN] = useState(0)
  useEffect(() => {
    const f = () => setN(n => n + 1)
    oyentes.add(f)
    return () => { oyentes.delete(f) }
  }, [])

  const instalada = esInstalada()
  return {
    /** El navegador deja instalar con un clic. */
    puede: !instalada && !!aviso,
    /** iPhone: se muestran los pasos. */
    soloPasos: !instalada && !aviso && esIos(),
    instalar: async () => {
      if (!aviso) return false
      await aviso.prompt()
      const r = await aviso.userChoice
      aviso = null; avisar()
      return r.outcome === 'accepted'
    },
  }
}

/** El script principal de la página (cambia de nombre en cada versión). */
const scriptDe = (html: string) => /<script[^>]+src="(\/assets\/[^"]+\.js)"/.exec(html)?.[1] ?? null

export function useVersionNueva(cadaMinutos = 10) {
  const [nueva, setNueva] = useState(false)
  useEffect(() => {
    if (!import.meta.env.PROD) return
    const actual = scriptDe(document.documentElement.outerHTML)
    if (!actual) return
    let vivo = true
    const mirar = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const r = await fetch('/', { cache: 'no-store', headers: { Accept: 'text/html' } })
        if (!r.ok) return
        const otro = scriptDe(await r.text())
        if (vivo && otro && otro !== actual) setNueva(true)
      } catch { /* sin conexión: se mira después */ }
    }
    const t = setInterval(() => void mirar(), cadaMinutos * 60_000)
    document.addEventListener('visibilitychange', mirar)
    return () => { vivo = false; clearInterval(t); document.removeEventListener('visibilitychange', mirar) }
  }, [cadaMinutos])
  return nueva
}