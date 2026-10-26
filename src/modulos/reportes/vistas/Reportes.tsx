import { useEffect, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { Link, Navigate } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { Permisos } from '../../../nucleo/autorizacion/permisos'
import { fecha } from '../../../nucleo/formato/fechas'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { useSesion, useYo } from '../../../nucleo/sesion/SesionContexto'
import { Barras, Cifra, Dona, GraficoLinea, dinero } from '../componentes/Graficos'
import { topYOtros } from '../componentes/topYOtros'
import { ResumenDetalle } from '../componentes/ResumenDetalle'
import { TablaDatos } from '../../../componentes/TablaDatos'
import {
  reportesServicio, type Filtros, type NombreReporte, type ReporteClientes, type ReporteMiDia,
  type ReporteProductos, type ReporteSucursales, type ReporteVendedores, type ReporteVentas,
} from '../servicios/reportesServicio'

/**
 * 032 — REPORTES, entrega 1: «Mi negocio» (maqueta aprobada el 18 oct 2026).
 *
 * Solo lectura. Cuentan los comprobantes del SUNAT en que está la empresa
 * (real o prueba, nunca mezclados); las notas de crédito restan. Cada reporte
 * baja en Excel; «PDF» abre la impresión del navegador («Guardar como PDF»).
 */

/** Los reportes de esta entrega, en el orden del menú, con su permiso. */
export const REPORTES: { ruta: string; nombre: string; permiso: string; grupo: string; conSucursales?: boolean; modulo?: string }[] = [
  { ruta: '/reportes/mi-dia',     nombre: 'Mi día',              permiso: Permisos.Reportes.MiDia,          grupo: 'Mi negocio' },
  { ruta: '/reportes/ventas',     nombre: 'Tablero de ventas',   permiso: Permisos.Reportes.TableroVentas,  grupo: 'Mi negocio' },
  { ruta: '/reportes/comparar',   nombre: 'Comparar periodos',   permiso: Permisos.Reportes.TableroVentas,  grupo: 'Mi negocio' },   // e176
  { ruta: '/reportes/clientes',   nombre: 'Ventas por cliente',  permiso: Permisos.Reportes.VentasCliente,  grupo: 'Mi negocio' },
  { ruta: '/reportes/productos',  nombre: 'Ventas por producto', permiso: Permisos.Reportes.VentasProducto, grupo: 'Mi negocio' },
  { ruta: '/reportes/vendedores', nombre: 'Ventas por vendedor', permiso: Permisos.Reportes.VentasVendedor, grupo: 'Mi negocio' },
  // e147: solo sale si la empresa tiene más de un local.
  { ruta: '/reportes/sucursales', nombre: 'Ventas por sucursal', permiso: Permisos.Reportes.TableroVentas, grupo: 'Mi negocio', conSucursales: true },
  // 034: SUNAT y contabilidad
  { ruta: '/reportes/igv',       nombre: 'Resumen de IGV',              permiso: Permisos.Reportes.ResumenIgv,     grupo: 'SUNAT y contabilidad' },
  { ruta: '/reportes/registro',  nombre: 'Registro de Ventas',          permiso: Permisos.Reportes.RegistroVentas, grupo: 'SUNAT y contabilidad' },
  { ruta: '/reportes/problemas', nombre: 'Comprobantes con problema',   permiso: Permisos.Reportes.ConProblema,    grupo: 'SUNAT y contabilidad' },
  { ruta: '/reportes/anulados',  nombre: 'Anulados y notas de crédito', permiso: Permisos.Reportes.AnuladosNotas,  grupo: 'SUNAT y contabilidad' },
  { ruta: '/reportes/personas-notas', nombre: 'Notas y anulaciones por persona', permiso: Permisos.Reportes.AnuladosNotas, grupo: 'SUNAT y contabilidad' },
  // e179 (060): ganancias.
  { ruta: '/reportes/margen',     nombre: 'Margen bruto',                permiso: Permisos.Reportes.Ganancias,      grupo: 'Ganancias' },
  { ruta: '/reportes/resultados', nombre: 'Estado de resultados',        permiso: Permisos.Reportes.Ganancias,      grupo: 'Ganancias' },
  { ruta: '/reportes/valorizado', nombre: 'Inventario valorizado',       permiso: Permisos.Reportes.Ganancias,      grupo: 'Ganancias', modulo: 'inventario' },
  // e178 (059): compras y gastos.
  { ruta: '/reportes/compras',   nombre: 'Compras y gastos',            permiso: Permisos.Compras.Ver,            grupo: 'Compras' },
  // e178: solo con el módulo «Punto de venta».
  { ruta: '/reportes/pos',       nombre: 'Punto de venta',              permiso: Permisos.Pos.CajasVer,           grupo: 'Punto de venta', modulo: 'pos' },
  { ruta: '/reportes/descarga',  nombre: 'Descarga masiva',             permiso: Permisos.Reportes.DescargaMasiva, grupo: 'SUNAT y contabilidad' },
]

/** /reportes a secas: al primero que se puede ver. */
export function InicioReportes() {
  const { puede } = useSesion()
  const primero = REPORTES.find(r => puede(r.permiso))
  return primero ? <Navigate to={primero.ruta} replace /> : <Navigate to="/" replace />
}

const TIPOS: Record<string, string> = { '01': 'Facturas', '03': 'Boletas', '07': 'Notas de crédito', '08': 'Notas de débito' }

function hoyLima() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
}

function primeroDelMes(hoy: string) { return hoy.slice(0, 8) + '01' }

type Preset = 'mes' | 'anterior' | 'anio' | 'otro'

function rango(p: Preset, hoy: string): { desde: string; hasta: string } {
  const [a, m] = hoy.split('-').map(Number)
  if (p === 'anterior') {
    const fin = new Date(Date.UTC(a, m - 1, 0))
    const ini = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), 1))
    return { desde: ini.toISOString().slice(0, 10), hasta: fin.toISOString().slice(0, 10) }
  }
  if (p === 'anio') return { desde: `${a}-01-01`, hasta: hoy }
  return { desde: primeroDelMes(hoy), hasta: hoy }
}

/** 037: qué búsqueda y qué filtros lleva cada reporte (lo que no se pasa, no sale). */
export interface Busqueda {
  /** El texto gris de la caja de búsqueda. Sin él, no hay caja. */
  texto?: string
  /** Lista de [valor, nombre] para el filtro «Tipo». */
  tipos?: [string, string][]
  etiquetaTipo?: string
  /** Lista de [valor, nombre] para el filtro «Estado». */
  estados?: [string, string][]
  /** Filtro «SUNAT real / prueba» (cartera y plataforma). */
  sunat?: boolean
}

type ConFiltro = { ambiente?: string; filtrado?: boolean; filas?: unknown[] }

/** Lo que se pide al servidor: sin fechas en los reportes que no las usan. */
function pedido(f: Filtros, conFechas: boolean): Filtros {
  return conFechas ? f : { ...f, desde: undefined, hasta: undefined }
}

/** Lo común: título, filtros, Excel/PDF, aviso de modo prueba, cargando y error. */
export function useReporte<T extends ConFiltro>(reporte: NombreReporte, conFechas: boolean) {
  const hoy = hoyLima()
  const [preset, setPreset] = useState<Preset>('mes')
  const [filtros, setFiltros] = useState<Filtros>({ ...rango('mes', hoy), moneda: 'PEN' })
  const [datos, setDatos] = useState<T>()
  const [error, setError] = useState<string>()
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    reportesServicio.obtener<T>(reporte, pedido(filtros, conFechas))
      .then(d => { if (vigente) { setDatos(d); setError(undefined) } })
      .catch(e => { if (vigente) setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar el reporte.') })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [reporte, conFechas, filtros])

  const elegir = (p: Preset) => {
    setPreset(p)
    if (p !== 'otro') setFiltros(f => ({ ...f, ...rango(p, hoy) }))
  }

  return { hoy, preset, elegir, filtros, setFiltros, datos, error, cargando }
}

const NOMBRE_PERIODO: Record<Preset, string> = { mes: 'Este mes', anterior: 'Mes pasado', anio: 'Este año', otro: '' }

/** Para el CSS de la impresión: las comillas y barras no rompen el texto. */
function textoCss(s: string) { return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ') + '"' }

function ahoraLima() {
  return new Date().toLocaleString('es-PE', {
    timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export function Marco<T extends ConFiltro>({ titulo, reporte, r, conFechas = true, conMoneda = true, pie, busqueda, horizontal = false, children }: {
  titulo: string
  reporte: NombreReporte
  r: ReturnType<typeof useReporte<T>>
  conFechas?: boolean
  /** 034: los de SUNAT y contabilidad van en soles: sin elegir moneda. */
  conMoneda?: boolean
  /** 034: la nota de abajo, si es otra que la de ventas (null = ninguna). */
  pie?: ReactNode
  /** 037: la búsqueda y los filtros de este reporte. */
  busqueda?: Busqueda
  /** 037: el PDF sale en hoja horizontal (tablas anchas). */
  horizontal?: boolean
  children: (d: T) => ReactNode
}) {
  const mensaje = useMensaje()
  const { usuario, empresa } = useYo()
  const [bajando, setBajando] = useState(false)
  const [texto, setTexto] = useState(r.filtros.q ?? '')
  const [generado, setGenerado] = useState(ahoraLima)
  const { setFiltros } = r

  // La búsqueda sale sola, 0,4 s después de dejar de escribir.
  useEffect(() => {
    const limpio = texto.trim()
    const t = window.setTimeout(() => setFiltros(f => (f.q ?? '') === limpio ? f : { ...f, q: limpio || undefined }), 400)
    return () => window.clearTimeout(t)
  }, [texto, setFiltros])

  // De quién es el reporte: la empresa abierta, la cartera o la plataforma.
  const de = reporte.startsWith('admin/') ? { nombre: 'Plataforma Reyban · Facturación', ruc: null as string | null }
    : reporte === 'cartera' ? { nombre: `Cartera de ${usuario.nombre}`, ruc: null as string | null }
    : { nombre: empresa?.razonSocial || empresa?.nombre || 'Reyban · Facturación', ruc: empresa?.ruc ?? null }

  const f = r.filtros
  const nombreDe = (lista: [string, string][] | undefined, v?: string) => lista?.find(x => x[0] === v)?.[1] ?? v
  const lineaFiltros = [
    f.q && `Búsqueda: «${f.q}»`,
    f.tipo && `${busqueda?.etiquetaTipo ?? 'Tipo'}: ${nombreDe(busqueda?.tipos, f.tipo)}`,
    f.estado && `Estado: ${nombreDe(busqueda?.estados, f.estado)}`,
    f.sunat && `SUNAT: ${f.sunat === 'real' ? 'real' : 'prueba'}`,
  ].filter(Boolean).join(' · ')
  const periodo = conFechas && f.desde && f.hasta
    ? `Del ${fecha(f.desde)} al ${fecha(f.hasta)}${r.preset !== 'otro' ? ` (${NOMBRE_PERIODO[r.preset].toLowerCase()})` : ''}`
    : `Al ${fecha(r.hoy)}`
  const moneda = conMoneda ? (f.moneda === 'USD' ? 'Dólares' : 'Soles') : null
  const hayFiltro = !!(f.q || f.tipo || f.estado || f.sunat)

  // El nombre del archivo PDF sale del título de la pestaña: que diga qué es.
  useEffect(() => {
    let antes = document.title
    const alImprimir = () => {
      antes = document.title
      flushSync(() => setGenerado(ahoraLima()))
      document.title = [titulo, de.nombre, conFechas && f.desde && f.hasta ? `${f.desde} a ${f.hasta}` : r.hoy].join(' - ')
    }
    const alTerminar = () => { document.title = antes }
    window.addEventListener('beforeprint', alImprimir)
    window.addEventListener('afterprint', alTerminar)
    return () => { window.removeEventListener('beforeprint', alImprimir); window.removeEventListener('afterprint', alTerminar) }
  }, [titulo, de.nombre, conFechas, f.desde, f.hasta, r.hoy])

  const excel = async () => {
    setBajando(true)
    try { await reportesServicio.excel(reporte, pedido(r.filtros, conFechas)) }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo bajar el Excel.') }
    finally { setBajando(false) }
  }

  const limpiar = () => {
    setTexto('')
    setFiltros(x => ({ ...x, q: undefined, tipo: undefined, estado: undefined, sunat: undefined }))
  }

  // Pie y número de página de cada hoja del PDF (márgenes de la página).
  const pieImpresion = `Generado el ${generado} (hora de Lima) por ${usuario.nombre} · Reyban · Facturación`
  const cssImpresion = `@media print { @page { size: A4 ${horizontal ? 'landscape' : 'portrait'}; margin: 14mm 12mm 16mm 12mm;
    @bottom-left { content: ${textoCss(pieImpresion)}; font: 7.5pt Arial, sans-serif; color: #6b7480; }
    @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 7.5pt Arial, sans-serif; color: #6b7480; } } }`

  const beta = r.datos?.ambiente === 'beta'

  return (
    <div className={`reporte${horizontal ? ' reporte-horizontal' : ''}`}>
      <style>{cssImpresion}</style>

      {/* Solo en el PDF: la cabecera del documento. */}
      <header className="impresion-cabecera solo-impresion">
        <div className="impresion-marca">
          <div>
            <div className="impresion-empresa">{de.nombre}</div>
            {de.ruc && <div className="impresion-ruc">RUC {de.ruc}</div>}
          </div>
          <div className="impresion-logo">Reyban <span>· Facturación</span></div>
        </div>
        <h1 className="impresion-titulo">{titulo}</h1>
        <div className="impresion-datos">
          <span>{periodo}</span>
          {moneda && <span>Moneda: {moneda}</span>}
          {lineaFiltros && <span>{lineaFiltros}</span>}
        </div>
        {beta && (
          <div className="impresion-prueba">
            MODO PRUEBA · comprobantes de prueba (SUNAT beta), sin valor ante SUNAT
          </div>
        )}
      </header>

      <div className="encabezado-pagina">
        <h1 className="titulo-pagina">{titulo}</h1>
      </div>

      <div className="filtros filtros-reporte">
        {conFechas && (
          <>
            <label>
              <span>Periodo</span>
              <select value={r.preset} onChange={e => r.elegir(e.target.value as Preset)}>
                <option value="mes">Este mes</option>
                <option value="anterior">Mes pasado</option>
                <option value="anio">Este año</option>
                <option value="otro">Elegir fechas</option>
              </select>
            </label>
            <label>
              <span>Desde</span>
              <input type="date" value={r.filtros.desde} max={r.hoy}
                     onChange={e => { r.elegir('otro'); r.setFiltros(x => ({ ...x, desde: e.target.value })) }} />
            </label>
            <label>
              <span>Hasta</span>
              <input type="date" value={r.filtros.hasta} max={r.hoy}
                     onChange={e => { r.elegir('otro'); r.setFiltros(x => ({ ...x, hasta: e.target.value })) }} />
            </label>
          </>
        )}
        {conMoneda && (
          <label>
            <span>Moneda</span>
            <select value={r.filtros.moneda} onChange={e => r.setFiltros(x => ({ ...x, moneda: e.target.value as 'PEN' | 'USD' }))}>
              <option value="PEN">Soles</option>
              <option value="USD">Dólares</option>
            </select>
          </label>
        )}
        <span className="hueco" />
        <div className="acciones-reporte">
          <Boton estilo="secundario" onClick={() => void excel()} ocupado={bajando} textoOcupado="Preparando…">⬇ Excel</Boton>
          <Boton estilo="secundario" onClick={() => window.print()}>⬇ PDF</Boton>
        </div>
      </div>

      {busqueda && (
        <div className="filtros busqueda-reporte">
          {busqueda.texto && (
            <label className="caja-busqueda">
              <span>Buscar</span>
              <input type="search" value={texto} placeholder={busqueda.texto} maxLength={80}
                     onChange={e => setTexto(e.target.value)} />
            </label>
          )}
          {busqueda.tipos && (
            <label>
              <span>{busqueda.etiquetaTipo ?? 'Tipo'}</span>
              <select value={f.tipo ?? ''} onChange={e => r.setFiltros(x => ({ ...x, tipo: e.target.value || undefined }))}>
                <option value="">Todos</option>
                {busqueda.tipos.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </label>
          )}
          {busqueda.estados && (
            <label>
              <span>Estado</span>
              <select value={f.estado ?? ''} onChange={e => r.setFiltros(x => ({ ...x, estado: e.target.value || undefined }))}>
                <option value="">Todos</option>
                {busqueda.estados.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </label>
          )}
          {busqueda.sunat && (
            <label>
              <span>SUNAT</span>
              <select value={f.sunat ?? ''}
                      onChange={e => r.setFiltros(x => ({ ...x, sunat: (e.target.value || undefined) as Filtros['sunat'] }))}>
                <option value="">Real y prueba</option>
                <option value="real">Solo SUNAT real</option>
                <option value="prueba">Solo prueba</option>
              </select>
            </label>
          )}
          {(hayFiltro || texto) && (
            <button type="button" className="enlace-tabla limpiar-busqueda" onClick={limpiar}>Quitar filtros</button>
          )}
        </div>
      )}

      {hayFiltro && r.datos?.filas && (
        <p className="nota resultado-busqueda">
          {r.cargando ? 'Buscando…' : r.datos.filas.length === 1 ? '1 resultado.' : `${r.datos.filas.length} resultados.`}
          {' '}El Excel y el PDF salen igual: solo con estos, y con los totales de estos.
        </p>
      )}

      {beta && (
        <div className="solo-pantalla">
          <Aviso tono="ojo">
            <strong>Modo prueba:</strong> estos números son de comprobantes de prueba (SUNAT beta), sin valor
            ante SUNAT. Cuando la empresa pase a SUNAT real, aquí saldrán solo los reales.
          </Aviso>
        </div>
      )}

      {r.error && <Aviso>{r.error}</Aviso>}
      {r.cargando && !r.datos ? <Cargando /> : r.datos ? children(r.datos) : null}

      {pie === undefined ? (
        <p className="nota pie-reporte">
          Cuentan las facturas, boletas y notas de crédito en camino o aceptadas por SUNAT. Las notas de crédito
          restan. No cuentan los rechazados, anulados ni borradores. Montos con IGV.
        </p>
      ) : pie}
    </div>
  )
}


// =============================================================================
export function ReporteMiDiaPagina() {
  const r = useReporte<ReporteMiDia>('mi-dia', false)
  return (
    <Marco titulo={`Mi día · ${fecha(r.hoy)}`} reporte="mi-dia" r={r} conFechas={false}>
      {d => (
        <>
          <div className="cifras-reporte">
            <Cifra titulo="Vendido hoy" valor={`${d.moneda === 'USD' ? 'US$' : 'S/'} ${dinero(d.total)}`} />
            <Cifra titulo="Facturas" valor={d.facturas} />
            <Cifra titulo="Boletas" valor={d.boletas} />
            <Cifra titulo="Notas de crédito" valor={d.notas} />
          </div>

          {d.enCamino > 0 && (
            <p className="nota">{d.enCamino} en camino a SUNAT (las boletas viajan en el resumen diario de mañana).</p>
          )}
          {d.problemas > 0 && (
            <Aviso tono="ojo">
              {d.problemas === 1 ? 'Hay 1 comprobante rechazado o sin enviar' : `Hay ${d.problemas} comprobantes rechazados o sin enviar`}
              {' '}en los últimos 7 días. <Link to="/facturacion/comprobantes">Revisarlos</Link>
            </Aviso>
          )}

          <div className="dos-reporte">
            <div className="bloque">
              <h2 className="subtitulo">Por hora</h2>
              <Barras cabeceras={['Hora', 'Vendido']}
                      filas={d.porHora.map(h => ({ etiqueta: `${String(h.hora).padStart(2, '0')}:00`, valor: h.total }))} />
            </div>
            <div className="bloque">
              <h2 className="subtitulo">Los últimos de hoy</h2>
              {d.ultimos.length === 0 ? <p className="nota">Todavía no hay comprobantes hoy.</p> : (
                <table className="tabla">
                  <thead><tr><th>Hora</th><th>Comprobante</th><th>Cliente</th><th className="derecha">Total</th></tr></thead>
                  <tbody>
                    {d.ultimos.map(u => (
                      <tr key={u.id}>
                        <td className="secundario">{u.hora}</td>
                        <td className="mono"><Link to={`/facturacion/comprobantes/${u.id}`}>{u.numero}</Link></td>
                        <td>{u.cliente}</td>
                        <td className="derecha mono">{u.tipo === '07' ? '−' : ''}{dinero(u.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </Marco>
  )
}


// =============================================================================
export function ReporteVentasPagina() {
  const r = useReporte<ReporteVentas>('ventas', true)
  return (
    <Marco titulo="Tablero de ventas" reporte="ventas" r={r}>
      {d => {
        const s = d.moneda === 'USD' ? 'US$' : 'S/'
        const cambio = d.anterior.total !== 0 ? ((d.kpis.total - d.anterior.total) / Math.abs(d.anterior.total)) * 100 : null
        return (
          <>
            <div className="cifras-reporte">
              <Cifra titulo="Ventas del periodo" valor={`${s} ${dinero(d.kpis.total)}`}
                     nota={cambio === null ? 'sin ventas en el periodo anterior'
                       : `${cambio >= 0 ? '+' : ''}${cambio.toFixed(0)} % vs. ${fecha(d.anterior.desde)} – ${fecha(d.anterior.hasta)}`} />
              <Cifra titulo="Comprobantes" valor={d.kpis.facturas + d.kpis.boletas}
                     nota={`${d.kpis.facturas} facturas · ${d.kpis.boletas} boletas`} />
              <Cifra titulo="Venta promedio" valor={`${s} ${dinero(d.kpis.promedio)}`} nota="por comprobante" />
              <Cifra titulo="Notas de crédito" valor={`−${s} ${dinero(d.kpis.montoNotas)}`} nota={`${d.kpis.notas} nota(s)`} />
            </div>

            <p className="nota solo-pantalla"><Link to="/reportes/comparar">Comparar con otro periodo →</Link></p>

            <div className="dos-reporte">
              <div className="bloque">
                <h2 className="subtitulo">Ventas por día ({s})</h2>
                <GraficoLinea etiquetaValor={`Vendido (${s})`}
                              puntos={d.porDia.map(p => ({ etiqueta: fecha(p.fecha).slice(0, 5), valor: p.total }))} />
              </div>
              <div className="bloque">
                <h2 className="subtitulo">Por tipo de comprobante</h2>
                <Dona partes={['01', '03', '07'].map(t => {
                  const x = d.porTipo.find(p => p.tipo === t)
                  return { etiqueta: TIPOS[t], valor: x?.total ?? 0, detalle: `${x?.cantidad ?? 0} · ${s} ${dinero(x?.total ?? 0)}` }
                })} />
              </div>
            </div>

            <div className="dos-reporte">
              <div className="bloque">
                <h2 className="subtitulo">Los 5 clientes que más compraron</h2>
                <Barras cabeceras={['Cliente', `Total (${s})`]}
                        filas={d.topClientes.map(c => ({ etiqueta: c.cliente, valor: c.total }))} />
              </div>
              <div className="bloque">
                <h2 className="subtitulo">IGV del periodo</h2>
                <dl className="datos totales">
                  <div className="fila"><dt>Base gravada</dt><dd className="mono">{dinero(d.igv.gravado)}</dd></div>
                  <div className="fila"><dt>IGV</dt><dd className="mono">{dinero(d.igv.igv)}</dd></div>
                  <div className="fila"><dt>Exonerado / inafecto</dt><dd className="mono">{dinero(d.igv.exonerado)}</dd></div>
                  {d.igv.exportacion !== 0 && <div className="fila"><dt>Exportación</dt><dd className="mono">{dinero(d.igv.exportacion)}</dd></div>}
                  <div className="fila grande"><dt>Total</dt><dd className="mono">{s} {dinero(d.igv.total)}</dd></div>
                </dl>
                <p className="nota">Referencial. La declaración la hace tu contador.</p>
              </div>
            </div>
          </>
        )
      }}
    </Marco>
  )
}


// =============================================================================
export function ReporteClientesPagina() {
  const r = useReporte<ReporteClientes>('clientes', true)
  return (
    <Marco titulo="Ventas por cliente" reporte="clientes" r={r} busqueda={{ texto: 'Nombre, RUC o DNI del cliente' }}>
      {d => {
        const s = d.moneda === 'USD' ? 'US$' : 'S/'
        const comprobantes = d.filas.reduce((t, f) => t + f.comprobantes, 0)
        return (
          <ResumenDetalle filas={d.filas.length}
            resumen={<>
              <div className="cifras-reporte">
                <Cifra titulo="Vendido" valor={`${s} ${dinero(d.total)}`} />
                <Cifra titulo="Clientes" valor={d.filas.length} />
                <Cifra titulo="Comprobantes" valor={comprobantes} />
                <Cifra titulo="Promedio por cliente" valor={`${s} ${dinero(d.filas.length ? d.total / d.filas.length : 0)}`} />
              </div>
              <div className="bloque">
                <h2 className="subtitulo">Los 10 que más compraron</h2>
                <Barras cabeceras={['Cliente', 'Total']} filas={topYOtros(d.filas, f => f.cliente, f => f.total, f => `${f.comprobantes} comp.`)} />
              </div>
            </>}
            detalle={
              <TablaDatos filas={d.filas} clave={(_, i) => i} ordenInicial={{ clave: 'total', desc: true }}
                vacio="Sin ventas en este periodo."
                columnas={[
                  { clave: 'cliente', titulo: 'Cliente', celda: f => f.cliente, orden: f => f.cliente },
                  { clave: 'doc', titulo: 'RUC / DNI', clase: 'mono secundario', celda: f => f.documento },
                  { clave: 'comp', titulo: 'Comprobantes', clase: 'derecha mono', celda: f => f.comprobantes, orden: f => f.comprobantes },
                  { clave: 'base', titulo: 'Base', clase: 'derecha mono', celda: f => dinero(f.base), orden: f => f.base },
                  { clave: 'igv', titulo: 'IGV', clase: 'derecha mono', celda: f => dinero(f.igv), orden: f => f.igv },
                  { clave: 'total', titulo: 'Total', clase: 'derecha mono', celda: f => dinero(f.total), orden: f => f.total },
                  { clave: 'pct', titulo: '%', clase: 'derecha mono secundario', celda: f => d.total ? ((f.total / d.total) * 100).toFixed(1) : '0' },
                ]}
                pie={<tr className="fila-total"><td colSpan={5}>Total</td><td className="derecha mono">{dinero(d.total)}</td><td /></tr>} />
            } />
        )
      }}
    </Marco>
  )
}


// =============================================================================
export function ReporteProductosPagina() {
  const r = useReporte<ReporteProductos>('productos', true)
  return (
    <Marco titulo="Ventas por producto" reporte="productos" r={r} busqueda={{ texto: 'Nombre o código del producto' }}>
      {d => {
        const s = d.moneda === 'USD' ? 'US$' : 'S/'
        return (
          <ResumenDetalle filas={d.filas.length}
            resumen={<>
              <div className="cifras-reporte">
                <Cifra titulo="Vendido" valor={`${s} ${dinero(d.total)}`} />
                <Cifra titulo="Productos distintos" valor={d.filas.length} />
                <Cifra titulo="El que más vendió" valor={d.filas[0]?.producto ?? '—'}
                       nota={d.filas[0] ? `${s} ${dinero(d.filas[0].total)}` : undefined} />
              </div>
              <div className="bloque">
                <h2 className="subtitulo">Los 10 que más se vendieron</h2>
                <Barras cabeceras={['Producto', 'Total']} filas={topYOtros(d.filas, f => f.producto, f => f.total)} />
              </div>
            </>}
            detalle={
              <TablaDatos filas={d.filas} clave={(_, i) => i} ordenInicial={{ clave: 'total', desc: true }}
                vacio="Sin ventas en este periodo."
                columnas={[
                  { clave: 'producto', titulo: 'Producto', celda: f => f.producto, orden: f => f.producto },
                  { clave: 'codigo', titulo: 'Código', clase: 'mono secundario', celda: f => f.codigo ?? '', orden: f => f.codigo },
                  { clave: 'cant', titulo: 'Cantidad', clase: 'derecha mono', orden: f => f.cantidad,
                    celda: f => f.cantidad === null ? '' : `${Number(f.cantidad)} ${f.unidad}` },
                  { clave: 'base', titulo: 'Base', clase: 'derecha mono', celda: f => dinero(f.base), orden: f => f.base },
                  { clave: 'total', titulo: 'Total', clase: 'derecha mono', celda: f => dinero(f.total), orden: f => f.total },
                ]}
                pie={<tr className="fila-total"><td colSpan={4}>Total</td><td className="derecha mono">{dinero(d.total)}</td></tr>} />
            } />
        )
      }}
    </Marco>
  )
}


// =============================================================================
export function ReporteVendedoresPagina() {
  const r = useReporte<ReporteVendedores>('vendedores', true)
  return (
    <Marco titulo="Ventas por vendedor" reporte="vendedores" r={r} busqueda={{ texto: 'Nombre de quien emitió' }}>
      {d => {
        const s = d.moneda === 'USD' ? 'US$' : 'S/'
        const personas = porPersona(d.filas)
        return (
          <ResumenDetalle filas={d.filas.length}
            resumen={<>
              <div className="cifras-reporte">
                <Cifra titulo="Vendido" valor={`${s} ${dinero(d.total)}`} />
                <Cifra titulo="Personas que emitieron" valor={personas.length} />
                <Cifra titulo="Comprobantes" valor={d.filas.reduce((t, f) => t + f.comprobantes, 0)} />
              </div>
              <div className="bloque">
                <h2 className="subtitulo">Quién emitió más</h2>
                <Barras cabeceras={['Vendedor', 'Total']} filas={topYOtros(personas, p => p.etiqueta, p => p.valor, p => p.nota)} />
              </div>
            </>}
            detalle={
              <TablaDatos filas={d.filas} clave={(_, i) => i} ordenInicial={{ clave: 'total', desc: true }}
                vacio="Sin ventas en este periodo."
                columnas={[
                  { clave: 'vendedor', titulo: 'Quién emitió', celda: f => f.vendedor, orden: f => f.vendedor },
                  ...(d.variasSucursales ? [{ clave: 'suc', titulo: 'Sucursal', clase: 'secundario',
                      celda: (f: ReporteVendedores['filas'][number]) => f.sucursal, orden: (f: ReporteVendedores['filas'][number]) => f.sucursal }] : []),
                  { clave: 'comp', titulo: 'Comprobantes', clase: 'derecha mono', celda: f => f.comprobantes, orden: f => f.comprobantes },
                  { clave: 'notas', titulo: 'Notas de crédito', clase: 'derecha mono', celda: f => f.notas, orden: f => f.notas },
                  { clave: 'total', titulo: 'Total', clase: 'derecha mono', celda: f => dinero(f.total), orden: f => f.total },
                ]}
                pie={<tr className="fila-total"><td colSpan={d.variasSucursales ? 4 : 3}>Total</td><td className="derecha mono">{dinero(d.total)}</td></tr>} />
            } />
        )
      }}
    </Marco>
  )
}


/** e147: el gráfico, una barra por persona (la tabla la parte por sucursal). */
function porPersona(filas: ReporteVendedores['filas']) {
  const m = new Map<string, { total: number; n: number }>()
  for (const f of filas) {
    const x = m.get(f.vendedor) ?? { total: 0, n: 0 }
    m.set(f.vendedor, { total: x.total + f.total, n: x.n + f.comprobantes })
  }
  return [...m].sort((a, b) => b[1].total - a[1].total)
    .map(([etiqueta, x]) => ({ etiqueta, valor: x.total, nota: `${x.n} comprobantes` }))
}


// =============================================================================
/** e147: VENTAS POR SUCURSAL. Salen también los locales que no vendieron en el periodo. */
export function ReporteSucursalesPagina() {
  const r = useReporte<ReporteSucursales>('sucursales', true)
  return (
    <Marco titulo="Ventas por sucursal" reporte="sucursales" r={r} busqueda={{ texto: 'Nombre o código del local' }}>
      {d => {
        const s = d.moneda === 'USD' ? 'US$' : 'S/'
        return (
          <ResumenDetalle filas={d.filas.length}
            resumen={<>
              <div className="cifras-reporte">
                <Cifra titulo="Vendido" valor={`${s} ${dinero(d.total)}`} />
                <Cifra titulo="Locales que vendieron" valor={d.filas.filter(f => f.total !== 0).length} nota={`de ${d.filas.length}`} />
                <Cifra titulo="Comprobantes" valor={d.filas.reduce((t, f) => t + f.facturas + f.boletas, 0)} />
              </div>
              <div className="bloque">
                <h2 className="subtitulo">Cuánto vendió cada local</h2>
                <Barras cabeceras={['Sucursal', 'Total']}
                        filas={topYOtros(d.filas, f => `${f.codigo ?? ''} ${f.sucursal}`.trim(), f => f.total, f => `${f.facturas + f.boletas} comprobantes`)} />
              </div>
            </>}
            detalle={
              <TablaDatos filas={d.filas} clave={(_, i) => i} ordenInicial={{ clave: 'total', desc: true }}
                columnas={[
                  { clave: 'suc', titulo: 'Sucursal', orden: f => `${f.codigo ?? ''} ${f.sucursal}`,
                    celda: f => <><span className="mono secundario">{f.codigo}</span> {f.sucursal}{!f.activa && <span className="secundario"> · desactivada</span>}</> },
                  { clave: 'fac', titulo: 'Facturas', clase: 'derecha mono', celda: f => f.facturas, orden: f => f.facturas },
                  { clave: 'bol', titulo: 'Boletas', clase: 'derecha mono', celda: f => f.boletas, orden: f => f.boletas },
                  { clave: 'notas', titulo: 'Notas', clase: 'derecha mono', celda: f => f.notas, orden: f => f.notas },
                  { clave: 'base', titulo: 'Base', clase: 'derecha mono', celda: f => dinero(f.base), orden: f => f.base },
                  { clave: 'igv', titulo: 'IGV', clase: 'derecha mono', celda: f => dinero(f.igv), orden: f => f.igv },
                  { clave: 'total', titulo: 'Total', clase: 'derecha mono', celda: f => dinero(f.total), orden: f => f.total },
                  { clave: 'pct', titulo: '%', clase: 'derecha mono secundario', celda: f => d.total ? ((f.total / d.total) * 100).toFixed(1) : '0' },
                ]}
                pie={<tr className="fila-total"><td colSpan={6}>Total</td><td className="derecha mono">{dinero(d.total)}</td><td /></tr>} />
            } />
        )
      }}
    </Marco>
  )
}