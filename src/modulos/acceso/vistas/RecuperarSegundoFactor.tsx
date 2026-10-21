import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { ErrorApi } from '../../../nucleo/api/errores'
import { recuperacion2faServicio } from '../servicios/recuperacion2faServicio'
import type { MiRecuperacion } from '../servicios/recuperacion2faServicio'

/**
 * 039 — EL ENLACE DEL CORREO: confirmar la recuperación del segundo factor.
 *
 * Sin sesión. Pide un clic a propósito: hay correos que abren los enlaces
 * solos para revisarlos, y eso no puede cerrar sesiones ni empezar una espera.
 */
export function RecuperarSegundoFactor() {
  const { token = '' } = useParams()
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecha, setHecha] = useState<MiRecuperacion | null>(null)

  async function confirmar() {
    setEnviando(true)
    setError(null)
    try {
      const r = await recuperacion2faServicio.confirmar(token)
      setHecha(r.recuperacion)
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'Este enlace ya no sirve.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="pantalla-centrada">
      <div className="tarjeta-acceso">
        <p className="marca">Reyban Consulting</p>

        {!hecha && (
          <>
            <h1>Recuperar tu segundo factor</h1>
            <p className="bajada">Para cuando perdiste el teléfono y también tus códigos de recuperación.</p>
            <ul className="lista-recuperar">
              <li>Se cierran <strong>todas</strong> tus sesiones abiertas, en cualquier equipo.</li>
              <li>Empieza una espera de seguridad, y avisamos a tu administrador.</li>
              <li>Pasada la espera, entras con tu contraseña y configuras un teléfono nuevo.</li>
            </ul>
            {error && (
              <>
                <Aviso>{error}</Aviso>
                <p className="nota centrado"><Link to="/">Ir a ingresar</Link></p>
              </>
            )}
            {!error && (
              <Boton ancho ocupado={enviando} textoOcupado="Confirmando…" onClick={() => void confirmar()}>
                Confirmar y empezar la espera
              </Boton>
            )}
            <p className="nota">
              <strong>Si no lo pediste tú</strong>, no confirmes: cierra esta página y cambia tu contraseña,
              porque alguien la conoce.
            </p>
          </>
        )}

        {hecha && (
          <>
            <h1>Espera iniciada</h1>
            <Aviso tono="bien">
              Tus sesiones se cerraron. El <strong>{hecha.disponibleTexto}</strong> podrás entrar con tu contraseña
              y configurar un teléfono nuevo.
            </Aviso>
            <p className="nota">
              Mientras tanto, si encuentras el teléfono o tus códigos, entra con ellos y la recuperación se
              cancela sola. Tu administrador también puede cancelarla.
            </p>
            <Link to="/" className="boton ancho">Ir a ingresar</Link>
          </>
        )}
      </div>
    </div>
  )
}