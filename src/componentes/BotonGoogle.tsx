import { useEffect, useState } from 'react'
import { googleServicio } from '../modulos/acceso/servicios/googleServicio'

/**
 * 049 — «ENTRAR CON GOOGLE». Un enlace, no un fetch: el navegador va a Google
 * y vuelve. Si el servidor no tiene las credenciales de Google, no se pinta.
 * Sin el logo de Google (es su marca): solo el texto.
 */
export function BotonGoogle({ texto = 'Entrar con Google', separador, despues }: {
  texto?: string
  /** Una raya con texto antes del botón («o»). */
  separador?: string
  /** Y después («o con tu correo»). Solo salen si sale el botón. */
  despues?: string
}) {
  const [activo, setActivo] = useState(false)

  useEffect(() => {
    let vivo = true
    googleServicio.config().then(c => { if (vivo) setActivo(c.activo) }).catch(() => { /* sin botón */ })
    return () => { vivo = false }
  }, [])

  if (!activo) return null

  return (
    <>
      {separador && <p className="separador"><span>{separador}</span></p>}
      <a className="boton secundario ancho boton-google" href="/api/google/entrar">
        <span className="boton-google-g" aria-hidden="true">G</span>
        {texto}
      </a>
      {despues && <p className="separador"><span>{despues}</span></p>}
    </>
  )
}