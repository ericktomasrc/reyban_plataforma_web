import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { recuperarAccesoServicio } from '../servicios/recuperarAccesoServicio'
import type { EnlaceClave } from '../servicios/recuperarAccesoServicio'

/** La misma que el back (EndpointsInvitacion.LongitudMinimaClave). */
const MINIMO = 8

/**
 * 038 — ELEGIR UNA CONTRASEÑA NUEVA desde el enlace del correo.
 *
 * Solo la contraseña: el segundo factor sigue igual y se pide al entrar.
 */
export function Restablecer() {
  const { token = '' } = useParams()
  const [datos, setDatos] = useState<EnlaceClave | null>(null)
  const [noSirve, setNoSirve] = useState<string | null>(null)
  const [clave, setClave] = useState('')
  const [repetida, setRepetida] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState<string | null>(null)

  useEffect(() => {
    recuperarAccesoServicio.revisar(token)
      .then(setDatos)
      .catch(e => setNoSirve(e instanceof ErrorApi ? e.message : 'Este enlace ya no sirve.'))
  }, [token])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (clave.length < MINIMO) { setError(`La contraseña tiene que tener al menos ${MINIMO} caracteres.`); return }
    if (clave !== repetida) { setError('Las dos contraseñas no coinciden.'); return }

    setEnviando(true)
    try {
      const r = await recuperarAccesoServicio.cambiar(token, clave)
      setListo(r.mensaje)
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cambiar la contraseña.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="pantalla-centrada">
      <div className="tarjeta-acceso">
        <p className="marca">Reyban Consulting</p>

        {noSirve && (
          <>
            <h1>Este enlace ya no sirve</h1>
            <Aviso>{noSirve}</Aviso>
            <p className="nota centrado"><Link to="/recuperar-acceso">Pedir un enlace nuevo</Link></p>
          </>
        )}

        {!noSirve && !datos && <Cargando />}

        {datos && !listo && (
          <form onSubmit={enviar}>
            <h1>Elige tu contraseña nueva</h1>
            <p className="bajada">
              Hola, <strong>{datos.nombre}</strong>. Es para <strong>{datos.correo}</strong>.
            </p>
            <Campo etiqueta="Contraseña nueva" type="password" autoComplete="new-password" required autoFocus
                   pista={`Al menos ${MINIMO} caracteres. Una frase larga es mejor que símbolos raros.`}
                   value={clave} onChange={e => setClave(e.target.value)} />
            <Campo etiqueta="Repítela" type="password" autoComplete="new-password" required
                   value={repetida} onChange={e => setRepetida(e.target.value)} />
            {error && <Aviso>{error}</Aviso>}
            <Boton type="submit" ancho ocupado={enviando} textoOcupado="Guardando…">
              Guardar mi contraseña
            </Boton>
            <p className="nota">
              Tu segundo factor no cambia: al entrar te pedirá el código de tu teléfono, como siempre.
              Las sesiones que tengas abiertas se cerrarán.
            </p>
          </form>
        )}

        {listo && (
          <>
            <h1>Listo</h1>
            <Aviso tono="bien">{listo}</Aviso>
            <Link to="/" className="boton ancho">Ir a ingresar</Link>
          </>
        )}
      </div>
    </div>
  )
}