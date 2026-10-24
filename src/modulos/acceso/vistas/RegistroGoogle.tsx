import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { googleServicio } from '../servicios/googleServicio'

/**
 * 049 — CREAR LA CUENTA CON GOOGLE, EN UN PASO.
 *
 * Google ya dijo quién es y que el correo es suyo: aquí solo se elige el tipo
 * de cuenta y se aceptan los términos. El DNI o RUC se pide al agregar la
 * primera empresa (la ficha), y de esa empresa sale el titular de la cuenta.
 * El enlace dura 15 minutos y sirve una vez.
 */
export function RegistroGoogle() {
  const { token = '' } = useParams()
  const mensaje = useMensaje()
  const [datos, setDatos] = useState<{ correo: string; nombre: string | null }>()
  const [fallo, setFallo] = useState<string>()
  const [tipo, setTipo] = useState<'negocio' | 'profesional'>()
  const [acepta, setAcepta] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    googleServicio.pendiente(token)
      .then(setDatos)
      .catch(e => setFallo(e instanceof ErrorApi ? e.message : 'No se pudo leer el registro.'))
  }, [token])

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    if (!tipo) { mensaje.error('Elige para quién vas a facturar.'); return }
    setEnviando(true)
    try {
      await googleServicio.registro(token, tipo, acepta)
      window.location.replace('/')
    } catch (err) {
      mensaje.error(err instanceof ErrorApi ? err.message : 'No se pudo crear la cuenta.')
      setEnviando(false)
    }
  }

  if (fallo) {
    return (
      <div className="pantalla-centrada">
        <div className="tarjeta-acceso">
          <p className="marca">Reyban Consulting</p>
          <h1>Crear tu cuenta</h1>
          <Aviso tono="ojo">{fallo}</Aviso>
          <Link to="/" className="boton secundario ancho">Volver a ingresar</Link>
        </div>
      </div>
    )
  }
  if (!datos) return <Cargando />

  return (
    <div className="pantalla-centrada">
      <form className="tarjeta-acceso ancha" onSubmit={e => void crear(e)}>
        <p className="marca">Reyban Consulting</p>
        <h1>Crea tu cuenta</h1>
        <p className="bajada">
          {datos.nombre ? <>Hola, <strong>{datos.nombre}</strong>. </> : null}
          Entrarás con tu cuenta de Google <strong>{datos.correo}</strong>.
        </p>

        <fieldset className="grupo-registro">
          <legend>¿Para quién vas a facturar?</legend>
          <div className="opciones-cuenta">
            <button type="button" aria-pressed={tipo === 'negocio'}
                    className={tipo === 'negocio' ? 'opcion-cuenta elegida' : 'opcion-cuenta'}
                    onClick={() => setTipo('negocio')}>
              <strong>Cuenta Negocio</strong>
              <span>Facturo para mi negocio. Una empresa, la mía.</span>
            </button>
            <button type="button" aria-pressed={tipo === 'profesional'}
                    className={tipo === 'profesional' ? 'opcion-cuenta elegida' : 'opcion-cuenta'}
                    onClick={() => setTipo('profesional')}>
              <strong>Cuenta Profesional</strong>
              <span>Facturo para mis clientes. Varias empresas y colaboradores.</span>
            </button>
          </div>
        </fieldset>

        <p className="nota">
          Tu DNI o RUC te lo pedimos al agregar tu primera empresa. Entras con Google: no necesitas otra contraseña
          (si algún día quieres una, usa «¿Olvidaste tu contraseña?»).
        </p>

        <label className="casilla-terminos">
          <input type="checkbox" checked={acepta} onChange={e => setAcepta(e.target.checked)} />
          <span>Acepto los términos de uso y la política de privacidad.</span>
        </label>

        <Boton type="submit" ancho ocupado={enviando} textoOcupado="Creando tu cuenta…" disabled={!acepta || !tipo}>
          Crear mi cuenta
        </Boton>
        <p className="enlace-olvido"><Link to="/">Cancelar</Link></p>
      </form>
    </div>
  )
}