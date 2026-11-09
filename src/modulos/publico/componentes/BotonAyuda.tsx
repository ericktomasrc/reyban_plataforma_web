import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { vitrinaServicio } from '../servicios/vitrinaServicio'
import { numeroPeru } from '../vistas/Vitrina'

/**
 * e236 — «¿Ayuda? Escríbenos por WhatsApp»: un botón flotante abajo a la
 * derecha, con el número de la página pública (Planes y cobros › Página
 * pública). Sin número, no aparece. No sale en el punto de venta (estorbaría
 * los botones de cobrar).
 */
let numeroGuardado: Promise<string | null> | null = null
function leerNumero() {
  numeroGuardado ??= vitrinaServicio.leer().then(v => v.empresa?.whatsapp ?? null).catch(() => null)
  return numeroGuardado
}

export function BotonAyuda({ empresa }: { empresa?: string | null }) {
  const ruta = useLocation()
  const [numero, setNumero] = useState<string | null>(null)
  useEffect(() => { let vivo = true; void leerNumero().then(n => { if (vivo) setNumero(n) }); return () => { vivo = false } }, [])

  if (!numero || ruta.pathname.startsWith('/pos')) return null
  const texto = `Hola, necesito ayuda con Reyban${empresa ? ` (${empresa})` : ''}.`
  return (
    <a className="boton-ayuda" href={`https://wa.me/${numeroPeru(numero)}?text=${encodeURIComponent(texto)}`}
       target="_blank" rel="noreferrer" aria-label="¿Ayuda? Escríbenos por WhatsApp">
      <span aria-hidden="true" className="boton-ayuda-icono">💬</span>
      <span className="boton-ayuda-texto">¿Ayuda? Escríbenos</span>
    </a>
  )
}