import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { perfilServicio } from '../servicios/perfilServicio'

/**
 * 048 — EL ENLACE QUE LLEGA AL CORREO NUEVO.
 *
 * Fuera de la puerta: se puede abrir en el teléfono, sin sesión. El cambio
 * vale en el momento en que se abre; a la dirección anterior le llega el aviso.
 */
export function ConfirmarCorreo() {
  const { token } = useParams()
  const [resultado, setResultado] = useState<{ bien: boolean; texto: string }>()
  const hecho = useRef(false)

  useEffect(() => {
    // Una sola vez, aunque React monte dos veces en desarrollo: el enlace vale una vez.
    if (hecho.current) return
    hecho.current = true
    perfilServicio.confirmarCorreo(token ?? '')
      .then(r => setResultado({ bien: true, texto: r.mensaje }))
      .catch(err => setResultado({
        bien: false,
        texto: err instanceof ErrorApi ? err.message : 'No se pudo confirmar el correo.',
      }))
  }, [token])

  if (!resultado) return <Cargando texto="Confirmando tu correo nuevo…" />

  return (
    <div className="pantalla-centrada">
      <div className="tarjeta-acceso">
        <p className="marca">Reyban Consulting</p>
        <h1>{resultado.bien ? 'Correo cambiado' : 'No se cambió el correo'}</h1>
        <Aviso tono={resultado.bien ? 'bien' : 'ojo'}>{resultado.texto}</Aviso>
        <Boton ancho onClick={() => { window.location.href = '/' }}>Ir a la plataforma</Boton>
      </div>
    </div>
  )
}