import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { SoloEnSol } from '../../../componentes/SoloEnSol'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useCargar } from '../../../nucleo/hooks/useCargar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { guiasServicio, type ConfiguracionGuias as Config } from '../servicios/guiasServicio'
import '../guias.css'
import '../../facturacion/comprobantes-lista.css'

/**
 * 050 — CONFIGURACIÓN DE GUÍAS (maqueta «Config» del 24 oct).
 *
 *   1. Credenciales de guías (API SUNAT): ID y clave que da SOL. Solo para
 *      SUNAT real; en prueba no hacen falta. La clave va al servicio, que la
 *      cifra; aquí no se guarda ni se vuelve a mostrar.
 *   2. Las series T y V: se crean en Sucursales (o solas con la primera guía).
 *   3. ¿Tu empresa también lleva carga de otros? Activa la guía del
 *      transportista, con su registro MTC.
 */
export function ConfiguracionGuias() {
  const mensaje = useMensaje()
  const datos = useCargar<Config>(() => guiasServicio.configuracion())
  const [clientId, setClientId] = useState('')
  const [secreto, setSecreto] = useState('')
  const [transporta, setTransporta] = useState(false)
  const [mtc, setMtc] = useState('')
  const [ocupado, setOcupado] = useState<string>()
  const [fallo, setFallo] = useState<{ donde: string; texto: string }>()

  useEffect(() => {
    if (!datos.datos) return
    setTransporta(datos.datos.transportaCarga)
    setMtc(datos.datos.registroMtc ?? '')
    setClientId(datos.datos.gre.clientId ?? '')
  }, [datos.datos])

  if (datos.error) return <Aviso>{datos.error}</Aviso>
  if (!datos.datos) return <Cargando />
  const c = datos.datos

  async function guardarGre() {
    setOcupado('gre'); setFallo(undefined)
    try { const r = await guiasServicio.guardarGre(clientId, secreto); setSecreto(''); mensaje.bien(r.mensaje); datos.recargar() }
    catch (e) { setFallo({ donde: 'gre', texto: e instanceof ErrorApi ? e.message : 'No se pudo guardar.' }) }
    finally { setOcupado(undefined) }
  }

  async function guardarTransporte() {
    setOcupado('mtc'); setFallo(undefined)
    try { const r = await guiasServicio.guardarTransporteEmpresa(transporta, mtc); mensaje.bien(r.mensaje); datos.recargar() }
    catch (e) { setFallo({ donde: 'mtc', texto: e instanceof ErrorApi ? e.message : 'No se pudo guardar.' }) }
    finally { setOcupado(undefined) }
  }

  return (
    <>
      <div className="encabezado-pagina cmp-encab">
        <div>
          <h1 className="titulo-pagina">Configuración de guías</h1>
          <p className="bajada-pagina">Lo que las guías necesitan para salir: credenciales, series y, si llevas carga de otros, tu registro MTC.</p>
        </div>
      </div>

      {/* 16 nov: de un vistazo, cómo está cada cosa. Solo muestra. */}
      <div className="cmp-mes estatico gr-estado" aria-label="Estado de las guías">
        <div className={`cmp-mes-dato${c.ambiente === 'beta' ? ' ojo' : ' bien'}`}>
          <span>Las guías van a</span><strong>{c.ambiente === 'beta' ? 'Prueba' : 'SUNAT real'}</strong>
          <small>{c.ambiente === 'beta' ? 'simulador de SUNAT, sin valor legal' : 'con valor legal'}</small>
        </div>
        <div className={`cmp-mes-dato${!c.gre.leido ? '' : c.gre.habilitado && c.gre.tieneSecreto ? ' bien' : c.ambiente === 'beta' ? '' : ' mal'}`}>
          <span>Credenciales de guías</span>
          <strong>{!c.gre.leido ? 'Sin consultar' : c.gre.habilitado && c.gre.tieneSecreto ? 'Guardadas' : 'Faltan'}</strong>
          <small>{c.gre.habilitado && c.gre.tieneSecreto ? `ID ${c.gre.clientId}` : c.ambiente === 'beta' ? 'en prueba no hacen falta' : 'sin ellas no salen guías'}</small>
        </div>
        <div className={`cmp-mes-dato${c.transportaCarga ? ' bien' : ''}`}>
          <span>Guía del transportista</span><strong>{c.transportaCarga ? 'Activa' : 'No usa'}</strong>
          <small>{c.transportaCarga ? (c.registroMtc ? `MTC ${c.registroMtc}` : 'falta el registro MTC') : 'solo si llevas carga de otros'}</small>
        </div>
      </div>

      {/* Diseño 15 nov: una sola ficha en secciones (título a la izquierda). Mismos campos. */}
      <div className="bloque dlg-secciones gr-config">
        <section className="dlg-sec">
          <div className="dlg-sec-t"><b>Credenciales de guías</b><small>API de SUNAT. Distintas de tu clave SOL.</small></div>
          <div className="dlg-sec-c">
          <p className="secundario">
            Las guías van por otro canal que las facturas y piden sus propias credenciales, además de tu clave SOL.
            Se sacan en SOL: <strong>Credenciales de API SUNAT › Gestión de credenciales</strong>, registrando una aplicación
            «GRE Emisión de comprobantes» con alcance <strong>Desktop</strong>.
          </p>
          {c.ambiente === 'beta' && (
            <Aviso tono="ojo">Tu empresa está en <strong>prueba</strong>: las guías van al simulador y no piden credenciales. Hacen falta al pasar a SUNAT real.</Aviso>
          )}
          {!c.gre.leido ? (
            <Aviso tono="ojo">No se pudo consultar el servicio de facturación. Inténtalo en unos minutos.</Aviso>
          ) : c.gre.habilitado && c.gre.tieneSecreto ? (
            <p className="estado bueno">Guardadas (ID {c.gre.clientId}). Para cambiarlas, pega las nuevas.</p>
          ) : (
            <p className="estado aviso">Todavía no hay credenciales de guías.</p>
          )}
          {c.puedeGestionar ? (
            <>
              <div className="pareja">
              <Campo etiqueta="ID (client_id)" obligatorio value={clientId} className="mono" onChange={e => setClientId(e.target.value.trim())} autoComplete="off" />
              <Campo etiqueta="Clave (client_secret)" obligatorio type="password" value={secreto} onChange={e => setSecreto(e.target.value)}
                     autoComplete="new-password" pista="Se guarda cifrada en el servicio de facturación; no se vuelve a mostrar." />
              </div>
              {fallo?.donde === 'gre' && <Aviso>{fallo.texto}</Aviso>}
              <div><Boton onClick={() => void guardarGre()} ocupado={ocupado === 'gre'} disabled={!clientId || !secreto}>Guardar credenciales</Boton></div>
            </>
          ) : (
            <p className="nota">Las pone el administrador de la empresa.</p>
          )}
          </div>
        </section>

        <section className="dlg-sec">
          <div className="dlg-sec-t"><b>Series por sucursal</b><small>T001 para el remitente, V001 para el transportista.</small></div>
          <div className="dlg-sec-c">
          <p className="secundario">
            La guía del remitente usa series <strong className="mono">T001</strong>, <strong className="mono">T002</strong>…; la del transportista,
            <strong className="mono"> V001</strong>… Cada sucursal tiene las suyas, como las de facturas. Se crean en{' '}
            <Link to="/facturacion/sucursales">Sucursales</Link>, o solas al emitir la primera guía.
          </p>
          </div>
        </section>

        <section className="dlg-sec">
          <div className="dlg-sec-t"><b>Transporte de carga</b><small>¿Tu empresa también lleva carga de otros?</small></div>
          <div className="dlg-sec-c">
          <label className="casilla">
            <input type="checkbox" checked={transporta} disabled={!c.puedeGestionar} onChange={e => setTransporta(e.target.checked)} />
            {' '}Sí: llevamos carga ajena por encargo (activa la guía del transportista)
          </label>
          <Campo etiqueta="Registro MTC de tu empresa" value={mtc} disabled={!c.puedeGestionar} className="mono"
                 placeholder="Solo si transportas carga de otros" onChange={e => setMtc(e.target.value.toUpperCase())} />
          {fallo?.donde === 'mtc' && <Aviso>{fallo.texto}</Aviso>}
          {c.puedeGestionar && <div><Boton estilo="secundario" onClick={() => void guardarTransporte()} ocupado={ocupado === 'mtc'}>Guardar</Boton></div>}
          </div>
        </section>
      </div>

      <p className="secundario">
        Los vehículos, conductores y empresas de transporte que uses se guardan solos: los ves y corriges en{' '}
        <Link to="/guias/transporte">Transporte guardado</Link>.
      </p>

      <SoloEnSol temas={['guias']} />
    </>
  )
}