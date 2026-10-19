import { useEffect, useRef } from 'react'

/**
 * La comprobación anti-robot: Cloudflare Turnstile.
 *
 * AQUÍ SOLO SE CONSIGUE UN TOKEN. Quien decide si vale es el back, que se lo
 * pregunta a Cloudflare con la clave secreta. Un captcha que solo se mirara en
 * el navegador se saltaría llamando a la API directamente.
 *
 * EL TOKEN SIRVE UNA VEZ. Si el registro falla (correo ocupado, por ejemplo),
 * hay que pedir otro: quien use este componente le cambia la `key` y se monta
 * de nuevo.
 *
 * El script se carga una sola vez por página, la primera vez que hace falta:
 * nadie que solo entra a facturar lo descarga.
 */

interface Turnstile {
  render: (el: HTMLElement, opciones: Record<string, unknown>) => string
  remove: (id: string) => void
}

declare global {
  interface Window { turnstile?: Turnstile }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let cargando: Promise<void> | null = null

function cargarScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (cargando) return cargando

  cargando = new Promise((resolver, rechazar) => {
    const s = document.createElement('script')
    s.src = SCRIPT
    s.async = true
    s.onload = () => resolver()
    s.onerror = () => { cargando = null; rechazar(new Error('No se pudo cargar el captcha')) }
    document.head.appendChild(s)
  })

  return cargando
}

export function Captcha({ sitio, onToken }: {
  sitio: string

  /** Vacío cuando caduca o falla: hay que volver a resolverlo. */
  onToken: (token: string) => void
}) {
  const caja = useRef<HTMLDivElement>(null)

  // La última función, sin volver a pintar el captcha cada vez que cambia.
  const avisar = useRef(onToken)
  avisar.current = onToken

  useEffect(() => {
    let vivo = true
    let id: string | undefined

    cargarScript()
      .then(() => {
        if (!vivo || !caja.current || !window.turnstile) return

        id = window.turnstile.render(caja.current, {
          sitekey: sitio,
          language: 'es',
          callback: (t: string) => avisar.current(t),
          'expired-callback': () => avisar.current(''),
          'error-callback': () => avisar.current(''),
        })
      })
      .catch(() => avisar.current(''))

    return () => {
      vivo = false
      if (id && window.turnstile) window.turnstile.remove(id)
    }
  }, [sitio])

  return <div ref={caja} className="captcha" />
}