import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { useSesion } from '../../../nucleo/sesion/SesionContexto'
import { ENLACE_PENDIENTE, recuperacionServicio } from '../servicios/recuperacionServicio'
import type { InfoRecuperacion } from '../servicios/recuperacionServicio'

/**
 * «SEGUIR YO MISMO»: LA PÁGINA DEL ENLACE (lienzo «Fase 4», pantalla 2).
 *
 * Tres casos, según el correo del titular:
 *
 *   · No tiene cuenta  → «Crea tu Cuenta Negocio»: solo el nombre; el correo
 *                        es el del titular. Después, la pantalla de siempre
 *                        para elegir contraseña y segundo factor.
 *   · Tiene cuenta y ya entró → «Agregar a mi cuenta».
 *   · Tiene cuenta y no entró → «Entrar»: se guarda el enlace en la pestaña
 *                        y, al entrar, el Inicio lo trae de vuelta aquí.
 *
 * Fuera de la puerta (como la invitación): funciona con sesión y sin ella.
 */
export function RecuperarEmpresa() {
  const { token = '' } = useParams()
  const { estado, refrescar } = useSesion()
  const mensaje = useMensaje()
  const navegar = useNavigate()

  const [info, setInfo] = useState<InfoRecuperacion>()
  const [fallo, setFallo] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [acepta, setAcepta] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    recuperacionServicio.ver(token)
      .then(setInfo)
      .catch(e => setFallo(e instanceof ErrorApi ? e.message : 'No se pudo abrir el enlace.'))
  }, [token])

  if (fallo) return <Marco titulo="Recuperar tu empresa"><Aviso>{fallo}</Aviso></Marco>
  if (!info || estado.fase === 'cargando') return <Cargando texto="Abriendo el enlace…" />

  if (info.estado !== 'ok') {
    const texto = {
      vencido:    'Este enlace venció. Pide otro: vale 7 días.',
      usado:      'Este enlace ya se usó. Si la empresa ya es tuya, entra con el correo del titular.',
      no_pausada: 'Esta empresa ya no está en pausa.',
      no_existe:  'Este enlace no existe. Revisa que lo copiaste entero.',
    }[info.estado]
    return (
      <Marco titulo="Recuperar tu empresa">
        <div className="aviso ojo">{texto}</div>
        <Link to="/recuperar" className="boton">Pedir un enlace nuevo</Link>
      </Marco>
    )
  }

  const dentro = estado.fase === 'dentro'
  const mismoCorreo = dentro && estado.yo.usuario.correo.toLowerCase() === (info.correo ?? '').toLowerCase()

  async function crearCuenta(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (nombre.trim().length < 2) { setError('Escribe tu nombre y apellido.'); return }
    if (!acepta) { setError('Para seguir tienes que aceptar los términos de uso y la política de privacidad.'); return }

    setOcupado(true)
    try {
      const r = await recuperacionServicio.cuentaNueva(token, nombre.trim(), acepta)
      mensaje.bien(r.mensaje)
      navegar(r.invitacion)
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo recuperar la empresa.')
      setOcupado(false)
    }
  }

  async function agregar() {
    setError(null)
    setOcupado(true)
    try {
      const r = await recuperacionServicio.aMiCuenta(token)
      try { sessionStorage.removeItem(ENLACE_PENDIENTE) } catch { /* sin almacenamiento */ }
      mensaje.bien(r.mensaje)
      await refrescar()
      navegar('/')
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo recuperar la empresa.')
      setOcupado(false)
    }
  }

  function entrarPrimero() {
    try { sessionStorage.setItem(ENLACE_PENDIENTE, token) } catch { /* sin almacenamiento: tocará volver a abrir el correo */ }
    navegar('/')
  }

  return (
    <Marco titulo={info.nombre ?? 'Tu empresa'} antetitulo="Recuperar tu empresa" ancha>
      <p className="bajada-recuperar">
        <span className="mono">RUC {info.ruc}</span>
        {info.pausadaEn && <> · en pausa desde el {fecha(info.pausadaEn)}</>}
        {info.quien && <> · la gestionaba {info.quien}</>}
      </p>

      <div className="resumen-recuperar">
        <div><strong>{info.comprobantes.toLocaleString('es-PE')}</strong><span>comprobantes</span></div>
        <div><strong>{info.clientes.toLocaleString('es-PE')}</strong><span>clientes</span></div>
        <div><strong className="mono">{info.series?.length ? info.series.join(' · ') : '—'}</strong><span>series</span></div>
      </div>

      {/* SIN CUENTA: se crea, con el correo del titular. */}
      {!info.correoConCuenta && (
        <form onSubmit={crearCuenta} className="bloque formulario-panel">
          <h2>Crea tu Cuenta Negocio</h2>
          <Campo etiqueta="Tu nombre" value={nombre} onChange={e => setNombre(e.target.value)}
                 placeholder="Nombres y apellidos" />
          <Campo etiqueta="Correo" value={info.correo ?? ''} readOnly
                 pista="Es el correo del titular: con él entrarás." />
          <label className="casilla-terminos">
            <input type="checkbox" checked={acepta} onChange={e => setAcepta(e.target.checked)} />
            Acepto los términos de uso y la política de privacidad.
          </label>
          {error && <Aviso>{error}</Aviso>}
          <Boton type="submit" ancho ocupado={ocupado} textoOcupado="Recuperando…">
            Crear mi cuenta y recuperar la empresa
          </Boton>
          <p className="nota">Después eliges tu contraseña y activas tu segundo factor.</p>
        </form>
      )}

      {/* CON CUENTA Y DENTRO CON ESE CORREO: se agrega. */}
      {info.correoConCuenta && mismoCorreo && (
        <section className="bloque formulario-panel">
          <h2>Agrégala a tu cuenta</h2>
          <p className="texto-paso">Entraste como <strong>{info.correo}</strong>. La empresa pasa a tu cuenta y queda abierta.</p>
          {error && <Aviso>{error}</Aviso>}
          <Boton ancho onClick={() => void agregar()} ocupado={ocupado} textoOcupado="Recuperando…">
            Agregar a mi cuenta
          </Boton>
        </section>
      )}

      {/* CON CUENTA PERO SIN ENTRAR, O DENTRO CON OTRO CORREO. */}
      {info.correoConCuenta && !mismoCorreo && (
        <section className="bloque formulario-panel">
          <h2>Entra con el correo del titular</h2>
          <p className="texto-paso">
            <strong>{info.correo}</strong> ya tiene cuenta.
            {dentro ? ' Ahora estás dentro con otro correo: sal y entra con ese.' : ' Entra con él y volvemos aquí.'}
          </p>
          {!dentro && <Boton ancho onClick={entrarPrimero}>Entrar</Boton>}
        </section>
      )}

      <div className="aviso bien">
        Después revisas tus series y la clave SOL, y <strong>emites como siempre</strong>. Los usuarios de la
        empresa (tu cajera, por ejemplo) siguen igual.
      </div>
    </Marco>
  )
}


function Marco({ titulo, antetitulo, ancha, children }: {
  titulo: string
  antetitulo?: string
  ancha?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="pantalla-centrada">
      <div className={ancha ? 'tarjeta-acceso registro' : 'tarjeta-acceso'}>
        <Link to="/" className="volver-arriba">← Ir al ingreso</Link>
        <p className="marca">{antetitulo ?? 'Reyban Consulting'}</p>
        <h1>{titulo}</h1>
        {children}
      </div>
    </div>
  )
}