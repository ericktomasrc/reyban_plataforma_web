import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { Permisos } from '../../../nucleo/autorizacion/permisos'
import { fecha } from '../../../nucleo/formato/fechas'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { useSesion } from '../../../nucleo/sesion/SesionContexto'
import { Paginacion } from '../../../componentes/Paginacion'
import { BarraLineas, usePaginaLineas } from '../../facturacion/componentes/DetalleLineas'
import { EstadoGuia, explicarEstadoGuia } from '../componentes/EstadoGuia'
import { RechazoGuia } from '../componentes/RechazoGuia'
import { RegistrarEvento } from '../componentes/RegistrarEvento'
import { PanelWhatsappGuia } from '../componentes/PanelWhatsappGuia'
import { guiasServicio, nombreUnidad, type GuiaCompleta } from '../servicios/guiasServicio'
import '../../facturacion/comprobante.css'
import '../guias.css'

const TIPOS_DOC: Record<string, string> = { '6': 'RUC', '1': 'DNI', '4': 'C.E.', '7': 'Pasaporte', '0': 'Doc.' }

/**
 * 050 — UNA GUÍA EMITIDA (maqueta «Ver» del 24 oct).
 *
 * Lo primero que se ve es si el vehículo puede salir. Mientras esté «en
 * camino», la pantalla le pregunta al servicio cada pocos segundos (por si el
 * aviso tarda) y se para sola cuando SUNAT responde.
 *
 * e168: el mismo diseño que el comprobante emitido (lo principal a la
 * izquierda; archivos y acciones en la columna de la derecha; bienes de 10 en
 * 10 con búsqueda y «Ver todo»). Solo cambia cómo se ve.
 */
export function VerGuia() {
  const { id } = useParams()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const mensaje = useMensaje()
  const { puede } = useSesion()

  const [g, setG] = useState<GuiaCompleta>()
  const [error, setError] = useState<string>()
  const [ocupado, setOcupado] = useState<string>()
  const [anulando, setAnulando] = useState(false)
  const [conEvento, setConEvento] = useState(false)   // 051
  const [motivo, setMotivo] = useState('')
  const [fechaAnulacion, setFechaAnulacion] = useState('')
  const [falloAnular, setFalloAnular] = useState<string>()
  const preguntas = useRef(0)

  const cargar = useCallback(async () => {
    if (!id) return
    try {
      setG(await guiasServicio.ver(id))
      setError(undefined)
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar la guía.')
    }
  }, [id])

  useEffect(() => { preguntas.current = 0; void cargar() }, [cargar])

  // El mensaje de «enviada» que trae la pantalla de emitir.
  const reciente = (ubicacion.state as { reciente?: string } | null)?.reciente
  useEffect(() => {
    if (!reciente) return
    mensaje.bien(reciente)
    navegar(ubicacion.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reciente])

  // EN CAMINO: preguntar al servicio cada 4 s, como mucho 2 minutos.
  useEffect(() => {
    if (!id || g?.estado !== 'encolado') return
    const t = setInterval(async () => {
      if (++preguntas.current > 30) { clearInterval(t); return }
      try {
        const r = await guiasServicio.actualizar(id)
        if (r.cambio || r.estado !== 'encolado') void cargar()
      } catch { /* se vuelve a intentar */ }
    }, 4000)
    return () => clearInterval(t)
  }, [id, g?.estado, cargar])

  // e168: los bienes de 10 en 10, con búsqueda.
  const pb = usePaginaLineas(g?.bienes ?? [])

  if (error) return <Aviso>{error}</Aviso>
  if (!g) return <Cargando />

  async function bajar(archivo: 'pdf' | 'xml' | 'cdr') {
    setOcupado(archivo)
    try { await guiasServicio.descargar(g!.id, archivo) }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo descargar.') }
    finally { setOcupado(undefined) }
  }

  async function reintentar() {
    setOcupado('reintentar')
    try { const r = await guiasServicio.reintentar(g!.id); mensaje.bien(r.mensaje ?? 'Enviada.'); preguntas.current = 0; await cargar() }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo reintentar.'); await cargar() }
    finally { setOcupado(undefined) }
  }

  async function actualizar() {
    setOcupado('actualizar')
    try { const r = await guiasServicio.actualizar(g!.id); if (!r.cambio) mensaje.ojo('Sigue igual: SUNAT todavía no responde.'); await cargar() }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo consultar.') }
    finally { setOcupado(undefined) }
  }

  async function anular() {
    setOcupado('anular'); setFalloAnular(undefined)
    try {
      const r = await guiasServicio.anular(g!.id, motivo, fechaAnulacion)
      setAnulando(false); mensaje.bien(r.mensaje); await cargar()
    } catch (e) {
      setFalloAnular(e instanceof ErrorApi ? e.message : 'No se pudo registrar.')
    } finally { setOcupado(undefined) }
  }

  const aceptada = g.estado === 'aceptado' || g.estado === 'observado'
  const publico = g.tipo === '09' && g.modalidad === '01'
  const p = g.peticion

  return (
    <>
      <Link to="/guias" className="enlace-volver">← Guías de remisión</Link>

      <div className="encabezado-pagina vc-encabezado">
        <div>
          <p className="vc-tipo">{g.tipo === '31' ? 'Guía del transportista' : 'Guía de remisión · remitente'}</p>
          <h1 className="titulo-pagina">
            <span className={`mono${g.estado === 'anulado' ? ' tachado' : ''}`}>{g.numero ?? `${g.serie} (sin número)`}</span>
            {g.ambiente === 'beta' && <> <span className="etiqueta aviso" title="SUNAT beta: sin valor legal">prueba</span></>}
          </h1>
          <p className="vc-resumen">
            <EstadoGuia estado={g.estado} />
            <span>{g.destinatario.razonSocial}</span>
            <span>Traslado {fecha(g.fechaTraslado)}</span>
            <strong className="mono">{g.pesoBruto.toFixed(2)} {p?.unidadPeso === 'TNE' ? 't' : 'kg'}</strong>
          </p>
          <p className="secundario vc-detalle-guia">
            {g.tipo === '31' ? 'Guía del transportista' : 'Guía del remitente'} · {g.motivoNombre}
            {g.motivoDescripcion && g.motivo === '13' && <> ({g.motivoDescripcion})</>}
            {g.documento && <> · de la {g.documento.tipo === '03' ? 'boleta' : 'factura'} <Link className="mono" to={`/facturacion/comprobantes/${g.documento.id}`}>{g.documento.numero}</Link></>}
            {g.tipo === '31' && g.documentoRelacionado && <> · ampara la guía <span className="mono">{g.documentoRelacionado}</span></>}
            {g.sucursal && <> · desde {g.sucursal}</>}
          </p>
        </div>
        <Boton estilo="secundario" onClick={() => navegar('/guias')}>Volver</Boton>
      </div>

      <div className="vc-cuerpo">
        <div className="vc-principal">
      {/* --- ¿Puede salir? ----------------------------------------------------- */}
      {aceptada && (
        <Aviso tono="bien">
          <strong>● {g.estado === 'observado' ? 'Aceptada con observaciones' : 'Aceptada por SUNAT'}.</strong> El vehículo ya puede salir.
          Lleva el PDF (o el QR en el celular).
          {g.estado === 'observado' && g.mensajeSunat && <div>Observación: {g.mensajeSunat}</div>}
        </Aviso>
      )}
      {g.estado === 'encolado' && (
        <Aviso tono="ojo">
          <div className="fila-aviso">
            <span><strong>En camino a SUNAT: no salgas todavía.</strong> Responde en unos segundos; esta pantalla se actualiza sola.</span>
            <Boton estilo="secundario" onClick={() => void actualizar()} ocupado={ocupado === 'actualizar'}>Preguntar ahora</Boton>
          </div>
        </Aviso>
      )}
      {g.estado === 'rechazado' && (
        <Aviso>
          <div className="fila-aviso">
            {/* 24 oct: el rechazo en palabras: qué dato y cómo corregirlo. */}
            <RechazoGuia codigo={g.codigoSunat} mensaje={g.mensajeSunat} />
            {/* 24 oct: la guía rechazada no se edita (ya gastó su número): se copia a una nueva. */}
            {puede(Permisos.Guias.Emitir) && p && (
              <Boton onClick={() => navegar(`${g.tipo === '31' ? '/guias/transportista' : '/guias/nueva'}?copiar=${g.id}`)}>
                Corregir y emitir otra
              </Boton>
            )}
          </div>
        </Aviso>
      )}
      {g.estado === 'error' && (
        <Aviso>
          <div className="fila-aviso">
            <span><strong>No llegó al servicio de facturación.</strong> {g.mensajeSunat}</span>
            {puede(Permisos.Guias.Emitir) && (
              <span className="acciones-guia">
                <Boton onClick={() => void reintentar()} ocupado={ocupado === 'reintentar'} textoOcupado="Enviando…">Reintentar</Boton>
                {p && (
                  <Boton estilo="secundario" onClick={() => navegar(`${g.tipo === '31' ? '/guias/transportista' : '/guias/nueva'}?copiar=${g.id}`)}>
                    Corregir y emitir otra
                  </Boton>
                )}
              </span>
            )}
          </div>
        </Aviso>
      )}
      {g.estado === 'anulado' && (
        <Aviso tono="ojo">
          <strong>Anulada en SOL</strong>{g.anuladaEn && <> el {fecha(g.anuladaEn)}</>}{g.anuladaMotivo && <> · {g.anuladaMotivo}</>}. Ya no sustenta ningún traslado.
        </Aviso>
      )}

      {/* --- recorrido, destinatario, transporte ------------------------------- */}
      <div className="tarjetas-guia en-detalle">
        <section className="bloque">
          <h2 className="rotulo">Recorrido</h2>
          <p><strong>Sale:</strong> {g.partida.direccion}{g.partida.lugar && <span className="secundario"> · {g.partida.lugar}</span>}</p>
          <p><strong>Llega:</strong> {g.llegada.direccion}{g.llegada.lugar && <span className="secundario"> · {g.llegada.lugar}</span>}</p>
          <p className="secundario">Traslado: {fecha(g.fechaTraslado)} · emitida el {fecha(g.fechaEmision)}</p>
        </section>
        <section className="bloque">
          <h2 className="rotulo">Destinatario</h2>
          <p><strong>{g.destinatario.razonSocial}</strong></p>
          <p>{TIPOS_DOC[g.destinatario.tipoDocumento] ?? 'Doc.'} {g.destinatario.numeroDocumento}</p>
          {g.tipo === '31' && p?.remitente && (
            <p className="secundario">Remitente: {p.remitente.razonSocial} · RUC {p.remitente.numeroDocumento}</p>
          )}
        </section>
        <section className="bloque">
          <h2 className="rotulo">{g.tipo === '31' ? 'Transporte' : publico ? 'Transporte público' : 'Transporte privado'}</h2>
          {publico && g.transportista ? (
            <>
              <p><strong>{g.transportista.razonSocial}</strong></p>
              <p>RUC {g.transportista.ruc}{p?.transportista?.mtc && <> · MTC {p.transportista.mtc}</>}</p>
            </>
          ) : p?.vehiculoMenor ? (
            <p>Vehículo menor (M1 o L): sin placa ni conductor.</p>
          ) : (
            <>
              {g.placa && <p>Placa <strong className="mono">{g.placa}</strong>{p?.vehiculo?.tuc && <span className="secundario"> · TUC {p.vehiculo.tuc}</span>}</p>}
              {g.conductor && <p>{g.conductor} · {g.conductorDoc}</p>}
              {p?.conductor?.licencia && <p className="secundario">Licencia {p.conductor.licencia}</p>}
              {(p?.relevos ?? []).map(r => <p key={r.numeroDocumento} className="secundario">Relevo: {r.nombres} {r.apellidos} · {r.licencia}</p>)}
            </>
          )}
        </section>
      </div>

      <div className="bloque sin-relleno lineas-emitidas">
        <div className="lineas-barra-guia">
          <BarraLineas cuantas={g.bienes.length} q={pb.q} onBuscar={pb.buscar} moneda="" sinPrecios nombres={['bien', 'bienes']}
                       filas={g.bienes.map(b => ({ numero: b.numero, codigo: b.codigo, descripcion: b.descripcion, cantidad: b.cantidad,
                                                   unidad: b.unidad, valorUnitario: 0, descuento: 0, total: 0 }))} />
        </div>
        <table className="tabla">
          <thead><tr><th>#</th><th>Producto</th><th>Unidad</th><th className="derecha">Cantidad</th></tr></thead>
          <tbody>
            {pb.visibles.map(b => (
              <tr key={b.numero}>
                <td className="secundario">{b.numero}</td>
                <td>{b.descripcion}{b.codigo && <div className="secundario mono">{b.codigo}</div>}{b.series?.length ? <div className="secundario mono">{b.series.length === 1 ? 'Serie' : 'Series'}: {b.series.join(', ')}</div> : null}</td>
                <td>{nombreUnidad(b.unidad)}</td>
                <td className="derecha mono">{b.cantidad}</td>
              </tr>
            ))}
            {pb.visibles.length === 0 && (
              <tr><td colSpan={4} className="vacio">Ningún bien con «{pb.q.trim()}».</td></tr>
            )}
            <tr className="fila-total">
              <td /><td><strong>Peso bruto total</strong></td><td>{p?.unidadPeso === 'TNE' ? 'toneladas' : 'kg'}</td>
              <td className="derecha mono"><strong>{g.pesoBruto.toFixed(2)}</strong>{g.bultos != null && <> · {g.bultos} bultos</>}</td>
            </tr>
          </tbody>
        </table>
        {pb.hayMas && <div className="lineas-pie"><Paginacion {...pb.paginacion} /></div>}
      </div>

      {p?.observaciones && <p className="secundario">Observaciones: {p.observaciones}</p>}
      {/* 24 oct: las casillas y los otros documentos relacionados. */}
      {(p?.transbordoProgramado || p?.retornoVacio || p?.retornoConEnvases) && (
        <p className="secundario">
          Indicadores: {[
            p.transbordoProgramado && 'transbordo programado',
            p.retornoVacio && 'retorno de vehículo vacío',
            p.retornoConEnvases && 'retorno con envases o embalajes vacíos',
          ].filter(Boolean).join(' · ')}
        </p>
      )}
      {(p?.documentos?.length ?? 0) > 0 && (
        <p className="secundario">
          Documentos relacionados: {p!.documentos!.map(d => `${d.numero}${d.ruc ? ` (RUC ${d.ruc})` : ''}`).join(' · ')}
        </p>
      )}

      {/* --- 051: GRE por evento (hecha en SOL) -------------------------------- */}
      {(g.eventos?.length ?? 0) > 0 && (
        <div className="bloque">
          <h2 className="rotulo">Eventos en el camino (GRE por evento, SOL)</h2>
          <ul className="lista-nota">
            {g.eventos!.map(e => (
              <li key={e.id}>
                <span className="mono">{e.numeroSol}</span> · {fecha(e.fecha)} ·{' '}
                {e.tipo === 'transbordo' ? 'transbordo' : e.tipo === 'arribo' ? 'no se pudo llegar' : 'no se pudo llegar y transbordo'}
                {' '}· se reinició en {e.reinicioDireccion}
                {e.llegadaDireccion && <> · nueva llegada: {e.llegadaDireccion}</>}
                {e.placa && <> · placa <span className="mono">{e.placa}</span></>}
                {e.conductorNombre && <> · {e.conductorNombre} ({e.licencia})</>}
                {e.observacion && <span className="secundario"> · {e.observacion}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
        </div>

        <aside className="vc-lado">
          {/* --- Archivos ------------------------------------------------------- */}
          {g.numero && g.estado !== 'error' && (
            <div className="bloque vc-tarjeta">
              <h2 className="subtitulo">Archivos</h2>
              <div className="vc-botones">
                <Boton onClick={() => void bajar('pdf')} ocupado={ocupado === 'pdf'} textoOcupado="Generando…">PDF para el conductor</Boton>
                <Boton estilo="secundario" onClick={() => void bajar('xml')} ocupado={ocupado === 'xml'}>XML</Boton>
                {aceptada && <Boton estilo="secundario" onClick={() => void bajar('cdr')} ocupado={ocupado === 'cdr'}>CDR</Boton>}
              </div>
            </div>
          )}

          {/* --- e174 (057): la guía por WhatsApp, al conductor o al cliente ----- */}
          {g.numero && ['encolado', 'aceptado', 'observado'].includes(g.estado) && puede(Permisos.Guias.Emitir) && (
            <PanelWhatsappGuia guiaId={g.id} conductor={g.conductor} clienteWhatsapp={g.clienteWhatsapp} />
          )}

          {/* --- Acciones: evento (051), anulación y otra guía ------------------ */}
          <div className="bloque vc-tarjeta">
            <h2 className="subtitulo">Acciones</h2>
            <div className="vc-botones">
              {aceptada && puede(Permisos.Guias.Emitir) && (
                <Boton estilo="secundario" onClick={() => setConEvento(true)}>Registrar evento hecho en SOL</Boton>
              )}
              {aceptada && puede(Permisos.Guias.Anular) && (
                <Boton estilo="secundario" onClick={() => { setAnulando(true); setFalloAnular(undefined) }}>Registrar anulación hecha en SOL</Boton>
              )}
              <Boton estilo="secundario" onClick={() => navegar(g.tipo === '31' ? '/guias/transportista' : '/guias/nueva')}>Hacer otra guía</Boton>
            </div>
            <ul className="vc-explica">
              {aceptada && puede(Permisos.Guias.Emitir) && (
                <li>
                  <strong>¿Pasó algo en el camino?</strong> Si no se pudo llegar o hubo que pasar la carga a otro vehículo, se emite una
                  GRE por evento en SOL (SUNAT no la recibe por sistema) antes de seguir. Después regístrala aquí.
                </li>
              )}
              {aceptada && puede(Permisos.Guias.Anular) && (
                <li>
                  <strong>¿Hay que anularla?</strong> SUNAT no tiene servicio para dar de baja guías: se anula en SOL (Clave SOL ›
                  Guía de remisión electrónica). Después regístralo aquí para que deje de figurar viva.
                </li>
              )}
              <li><strong>Estado:</strong> {explicarEstadoGuia(g.estado)}</li>
            </ul>
          </div>
        </aside>
      </div>

      {conEvento && (
        <RegistrarEvento guiaId={g.id} numero={g.numero} abierto={conEvento} onCerrar={() => setConEvento(false)}
          onHecho={m => { setConEvento(false); mensaje.bien(m); void cargar() }} />
      )}

      <Dialogo titulo="Registrar anulación hecha en SOL" abierto={anulando} onCerrar={() => setAnulando(false)}
        acciones={<>
          <Boton estilo="secundario" onClick={() => setAnulando(false)}>Cancelar</Boton>
          <Boton estilo="peligro" onClick={() => void anular()} ocupado={ocupado === 'anular'} disabled={motivo.trim().length < 5}>Registrar anulación</Boton>
        </>}>
        <p>Primero anúlala en SOL. Esto solo deja constancia aquí: la guía deja de figurar viva y lo que llevaba vuelve a quedar pendiente de su factura.</p>
        <div className="campo">
          <label htmlFor="motivo-anular">Motivo (el mismo que pusiste en SOL)</label>
          <input id="motivo-anular" value={motivo} maxLength={250} onChange={e => setMotivo(e.target.value)} placeholder="Ej.: el traslado no se realizó" />
        </div>
        <div className="campo">
          <label htmlFor="fecha-anular">Fecha en que la anulaste en SOL</label>
          <input id="fecha-anular" type="date" value={fechaAnulacion} onChange={e => setFechaAnulacion(e.target.value)} />
          <span className="pista">Si la dejas vacía, hoy.</span>
        </div>
        {falloAnular && <Aviso>{falloAnular}</Aviso>}
      </Dialogo>
    </>
  )
}