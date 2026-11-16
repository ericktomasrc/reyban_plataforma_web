import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { SoloEnSol } from '../../../componentes/SoloEnSol'
import { Paginacion } from '../../../componentes/Paginacion'
import { FiltroFechas, FiltroSucursal } from '../../../componentes/FiltrosComunes'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { Si } from '../../../nucleo/autorizacion/Protegido'
import { Permisos } from '../../../nucleo/autorizacion/permisos'
import { fecha } from '../../../nucleo/formato/fechas'
import { EstadoGuia } from '../componentes/EstadoGuia'
import { guiasServicio, type PaginaGuias } from '../servicios/guiasServicio'
import '../guias.css'
import '../../facturacion/comprobantes-lista.css'

/** Diseño 15 nov: el motivo de traslado (catálogo 20) con su nombre corto; el código queda en el «title». */
const MOTIVO: Record<string, string> = {
  '01': 'Venta', '02': 'Compra', '03': 'Venta a terceros', '04': 'Entre establecimientos', '05': 'Consignación',
  '06': 'Devolución', '07': 'Recojo de transformados', '08': 'Importación', '09': 'Exportación', '13': 'Otros',
  '14': 'Venta por confirmar', '17': 'Para transformación', '18': 'Emisor itinerante',
}

/**
 * 050 — GUÍAS DE REMISIÓN (maqueta del 24 oct).
 *
 * Lo que sustenta cada traslado ante SUNAT. Sin importes: de dónde sale, a
 * dónde va, quién lo lleva y qué va dentro. El vehículo sale solo con la guía
 * «Aceptada».
 */
export function Guias() {
  const navegar = useNavigate()
  const [tipo, setTipo] = useState('')
  const [estado, setEstado] = useState('')
  const [q, setQ] = useState('')
  const [pagina, setPagina] = useState(1)
  // 24 oct: fechas, sucursal y cuántos por página.
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [sucursal, setSucursal] = useState('')
  const [porPagina, setPorPagina] = useState(20)
  const [datos, setDatos] = useState<PaginaGuias>()
  const [error, setError] = useState<string>()
  const [cargando, setCargando] = useState(true)
  const primera = useRef(true)

  async function cargar() {
    setCargando(true)
    try {
      setDatos(await guiasServicio.listar({ tipo, estado, q, pagina, desde, hasta, sucursalId: sucursal, porPagina }))
      setError(undefined)
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudieron cargar las guías.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    if (primera.current) { primera.current = false; void cargar(); return }
    const t = setTimeout(() => { void cargar() }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, estado, q, pagina, desde, hasta, sucursal, porPagina])

  // Mientras alguna esté en camino, se recarga sola (y se para cuando no queda ninguna).
  const hayEnCamino = datos?.filas.some(g => g.estado === 'encolado') ?? false
  useEffect(() => {
    if (!hayEnCamino) return
    const t = setInterval(() => { void cargar() }, 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayEnCamino, tipo, estado, q, pagina, desde, hasta, sucursal, porPagina])

  const c = datos?.conteo

  const filtro = (t: string, e: string, texto: string, n?: number, peligro?: boolean) => (
    <button type="button" className={`cmp-chip${tipo === t && estado === e ? ' elegido' : ''}${peligro ? ' gr-chip-peligro' : ''}`}
            onClick={() => { setTipo(t); setEstado(e); setPagina(1) }}>
      {texto}{n !== undefined && <span className="cmp-chip-n">{n}</span>}
    </button>
  )

  return (
    <>
      <div className="encabezado-pagina cmp-encab">
        <div>
          <h1 className="titulo-pagina">Guías de remisión{(c?.todas ?? 0) > 0 && <span className="lst-cuenta">{c?.todas} en total</span>}</h1>
          <p className="bajada-pagina">De dónde sale la mercadería, a dónde va, quién la lleva y qué va dentro.</p>
        </div>
        <Si puede={Permisos.Guias.Emitir}>
          <div className="acciones-guia">
            <Boton estilo="secundario" onClick={() => navegar('/guias/transportista')}>Guía de transportista</Boton>
            <Boton onClick={() => navegar('/guias/nueva')}>Nueva guía</Boton>
          </div>
        </Si>
      </div>

      <p className="gr-recuerda">
        <strong>El vehículo sale solo con la guía «Aceptada».</strong> La guía se emite antes del traslado: es lo que se
        muestra en un control en carretera.
      </p>

      {error && <Aviso>{error}</Aviso>}

      {/* Diseño 15 nov: pastillas, filtros y tabla en una sola caja. */}
      <div className="lst-caja">
      <div className="filtros-guias gr-filtros">
        <div className="cmp-chips">
          {filtro('', '', 'Todas', c?.todas)}
          {filtro('09', '', 'Remitente', c?.remitente)}
          {(c?.transportista ?? 0) > 0 && filtro('31', '', 'Transportista', c?.transportista)}
          {(c?.enCamino ?? 0) > 0 && filtro('', 'encolado', 'En camino', c?.enCamino)}
          {(c?.rechazadas ?? 0) > 0 && filtro('', 'rechazado', 'Rechazadas', undefined, true)}
        </div>
      </div>
      {/* 24 oct: fechas y sucursal */}
      <div className="filtros-lista lst-filtros gr-fechas">
        <input className="buscar-bandeja" value={q} placeholder="Buscar por número, destinatario, RUC o placa"
               onChange={e => { setQ(e.target.value); setPagina(1) }} aria-label="Buscar guías" />
        <FiltroFechas desde={desde} hasta={hasta}
                      onDesde={v => { setDesde(v); setPagina(1) }} onHasta={v => { setHasta(v); setPagina(1) }} />
        <FiltroSucursal valor={sucursal} onCambio={v => { setSucursal(v); setPagina(1) }} />
      </div>

      <div className="bloque sin-relleno lst-tabla">
        {cargando && !datos ? (
          <div className="relleno"><Cargando /></div>
        ) : datos && datos.filas.length > 0 ? (
          <table className="tabla lst lista-comprobantes">
            <thead>
              <tr>
                <th>Guía</th><th>Traslado</th><th>Destinatario · llegada</th><th>Motivo</th><th>Transporte</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {datos.filas.map(g => (
                <tr key={g.id} className="fila-clic" onClick={() => navegar(`/guias/${g.id}`)}>
                  <td>
                    <div className={`principal mono${g.estado === 'anulado' ? ' tachado' : ''}`}>{g.numero ?? <span className="vacio">Sin número</span>}</div>
                    <div className="secundario">
                      {g.tipo === '31' ? 'Transportista' : 'Remitente'}
                      {g.documento && <> · de <span className="mono">{g.documento}</span></>}
                      {g.tipo === '31' && g.documentoRelacionado && <> · ampara <span className="mono">{g.documentoRelacionado}</span></>}
                      {g.ambiente === 'beta' && <> <span className="etiqueta aviso" title="Emitida en SUNAT beta: sin valor legal">prueba</span></>}
                    </div>
                  </td>
                  <td>
                    {fecha(g.fechaTraslado)}
                    {g.sucursal && <div className="secundario">desde {g.sucursal}</div>}
                  </td>
                  <td className="lst-nombre">
                    <div className="principal" title={g.destinatario}>{g.destinatario}</div>
                    <div className="secundario" title={g.llegada}>{g.llegada}</div>
                  </td>
                  <td><span className="lst-igv" title={`Motivo ${g.motivo}`}>{MOTIVO[g.motivo] ?? g.motivo}</span></td>
                  <td>
                    {g.tipo === '31' ? 'Propio' : g.modalidad === '01' ? 'Público' : 'Privado'}
                    <div className="secundario">
                      {g.modalidad === '01' && g.tipo === '09' ? g.transportista : [g.placa, g.conductor].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </td>
                  <td>
                    <EstadoGuia estado={g.estado} />
                    {(g.estado === 'rechazado' || g.estado === 'error') && g.mensajeSunat && (
                      <div className="secundario detalle">{g.codigoSunat ? `${g.codigoSunat} · ` : ''}{g.mensajeSunat}</div>
                    )}
                    {g.estado === 'encolado' && <div className="secundario">no salgas todavía</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="relleno">
            <Vacio>{q || tipo || estado ? 'Ninguna guía cuadra con eso.' : 'Todavía no has emitido ninguna guía. Puedes hacerla desde una factura («Hacer guía de remisión») o con «Nueva guía».'}</Vacio>
          </div>
        )}
      </div>

      </div>

      {datos && (
        <Paginacion total={datos.total} pagina={datos.pagina} porPagina={datos.porPagina}
                    onCambiar={setPagina} onPorPagina={n => { setPorPagina(n); setPagina(1) }} />
      )}

      {/* 24 oct: lo que no se hace aquí sino en el portal de SUNAT. */}
      <SoloEnSol temas={['guias']} />
    </>
  )
}