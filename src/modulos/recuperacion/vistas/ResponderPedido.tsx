import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { pedidosServicio } from '../../cartera/servicios/pedidosServicio'
import type { InfoPedido } from '../../cartera/servicios/pedidosServicio'

/**
 * EL TITULAR RESPONDE EL PEDIDO (fase 4d, camino B; lienzo «Fase 4», pantalla 11).
 *
 * Llega desde el correo «… pide llevar tu empresa». Sin sesión: tener el
 * enlace del correo del titular ya prueba quién es. Aprobar mueve la empresa
 * entera a la cuenta que la pidió; «No, gracias» no cambia nada.
 *
 * «Quiero seguir entrando a ver mi empresa»: según su correo, se le crea un
 * usuario de la empresa (Administrador), su usuario de siempre pasa a ser de
 * la empresa, o ya entra y no hace falta nada.
 */
export function ResponderPedido() {
  const { token = '' } = useParams()
  const navegar = useNavigate()

  const [info, setInfo] = useState<InfoPedido>()
  const [fallo, setFallo] = useState<string | null>(null)
  const [seguir, setSeguir] = useState(true)
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<'aprobar' | 'rechazar' | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)

  useEffect(() => {
    pedidosServicio.ver(token)
      .then(setInfo)
      .catch(e => setFallo(e instanceof ErrorApi ? e.message : 'No se pudo abrir el enlace.'))
  }, [token])

  if (fallo) return <Marco titulo="Tu empresa"><Aviso>{fallo}</Aviso></Marco>
  if (!info) return <Cargando texto="Abriendo el pedido…" />

  if (hecho) {
    return (
      <Marco titulo={info.empresa ?? 'Tu empresa'}>
        <div className="aviso bien">{hecho}</div>
        <Link to="/" className="boton">Ir al ingreso</Link>
      </Marco>
    )
  }

  if (info.estado !== 'ok') {
    const texto = {
      vencido:   'Este enlace venció. Si quieres que la lleven, pídeles que te la pidan otra vez.',
      usado:     'Ya respondiste este pedido.',
      cancelado: 'Este pedido se canceló. No tienes que hacer nada: tu empresa sigue donde está.',
      no_existe: 'Este enlace no existe. Revisa que lo copiaste entero.',
    }[info.estado]
    return (
      <Marco titulo={info.empresa ?? 'Tu empresa'}>
        <div className="aviso ojo">{texto}</div>
        <Link to="/" className="boton secundario">Ir al ingreso</Link>
      </Marco>
    )
  }

  const pideCasilla = info.titular === 'crear' || info.titular === 'mover'
  const quien = info.cuenta && info.cuenta !== info.quien ? `${info.quien}, de ${info.cuenta}` : info.quien
  const cuenta = info.cuenta || info.quien || 'esa cuenta'

  async function responder(aprobar: boolean) {
    setError(null)
    if (aprobar && seguir && info?.titular === 'crear' && nombre.trim().length < 2) {
      setError('Escribe tu nombre y apellido para crear tu usuario.'); return
    }
    setOcupado(aprobar ? 'aprobar' : 'rechazar')
    try {
      const r = await pedidosServicio.responder(token, aprobar, aprobar && seguir && pideCasilla, nombre.trim())
      if (r.invitacion) { navegar(r.invitacion); return }
      setHecho(r.mensaje)
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo enviar tu respuesta.')
      setOcupado(null)
    }
  }

  return (
    <Marco titulo={info.empresa ?? 'Tu empresa'} antetitulo={`Pedido de ${cuenta}`}>
      <p className="bajada-recuperar">
        <span className="mono">RUC {info.ruc}</span>
        {info.hoyLaTiene && <> · hoy la lleva <strong>{info.hoyLaTiene}</strong></>}
        {info.pausada && <> · en pausa</>}
      </p>

      <div className="resumen-recuperar">
        <div><strong>{info.comprobantes.toLocaleString('es-PE')}</strong><span>comprobantes</span></div>
        <div><strong>{info.clientes.toLocaleString('es-PE')}</strong><span>clientes</span></div>
        <div><strong className="mono">{info.series?.length ? info.series.join(' · ') : '—'}</strong><span>series</span></div>
      </div>

      <p className="texto-paso"><strong>{quien}</strong> pidió llevar la facturación de tu empresa en Reyban.</p>
      {info.mensaje && <blockquote className="cita-pedido">«{info.mensaje}»</blockquote>}

      <section className="bloque formulario-panel">
        <h2>Si apruebas</h2>
        <ul className="lista-nota">
          <li>La empresa pasa <strong>entera</strong> a la cartera de {cuenta}: comprobantes, clientes, productos y series.</li>
          {info.hoyLaTiene && <li>{info.hoyLaTiene} deja de verla. Le avisamos por correo.</li>}
          {info.pausada && <li>Sale de la pausa y vuelve a poder emitir.</li>}
          <li>Los usuarios de la empresa (tu cajera, por ejemplo) siguen igual.</li>
          <li>Sigues siendo el titular: si algún día quieres llevártela, la recuperas con «Recupérala».</li>
        </ul>

        {pideCasilla && (
          <label className="casilla-terminos">
            <input type="checkbox" checked={seguir} onChange={e => setSeguir(e.target.checked)} />
            <span>
              <strong>Quiero seguir entrando a ver mi empresa</strong><br />
              <span className="secundario">
                {info.titular === 'crear'
                  ? 'Te creamos un usuario de la empresa con rol Administrador, con este correo. Después eliges tu contraseña.'
                  : 'Tu usuario (este mismo correo) pasa a ser Administrador de la empresa. Tu Cuenta Negocio queda sin empresa.'}
              </span>
            </span>
          </label>
        )}
        {pideCasilla && seguir && info.titular === 'crear' && (
          <Campo etiqueta="Tu nombre" value={nombre} onChange={e => setNombre(e.target.value)}
                 placeholder="Nombres y apellidos" />
        )}
        {info.titular === 'ya_entra' && (
          <p className="nota">Ya entras a la empresa con tu usuario: sigues entrando como hasta hoy.</p>
        )}
        {info.titular === 'otra_cuenta' && (
          <p className="nota">
            Tu correo ya es de otra cuenta en Reyban. Si quieres ver la empresa, pide a {cuenta} que te invite.
          </p>
        )}

        {error && <Aviso>{error}</Aviso>}

        <div className="pie-panel">
          <Boton onClick={() => void responder(true)} ocupado={ocupado === 'aprobar'} textoOcupado="Aprobando…"
                 disabled={ocupado !== null}>
            Aprobar: que la lleve {cuenta}
          </Boton>
          <Boton estilo="secundario" onClick={() => void responder(false)} ocupado={ocupado === 'rechazar'}
                 textoOcupado="Enviando…" disabled={ocupado !== null}>
            No, gracias
          </Boton>
        </div>
        <span className="nota">
          «No, gracias» le avisa a quien lo pidió que no aceptaste; no le contamos nada más.
          {info.expiraEn && <> El enlace vale hasta el {fecha(info.expiraEn)}.</>}
        </span>
      </section>
    </Marco>
  )
}


function Marco({ titulo, antetitulo, children }: { titulo: string; antetitulo?: string; children: React.ReactNode }) {
  return (
    <div className="pantalla-centrada">
      <div className="tarjeta-acceso registro">
        <Link to="/" className="volver-arriba">← Ir al ingreso</Link>
        <p className="marca">{antetitulo ?? 'Reyban Consulting'}</p>
        <h1>{titulo}</h1>
        {children}
      </div>
    </div>
  )
}