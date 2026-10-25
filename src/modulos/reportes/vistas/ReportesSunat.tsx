import { Fragment, useState } from 'react'
import { TablaDatos } from '../../../componentes/TablaDatos'
import { Link } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { Barras, Cifra, dinero } from '../componentes/Graficos'
import { topYOtros } from '../componentes/topYOtros'
import { ResumenDetalle } from '../componentes/ResumenDetalle'
import {
  reportesServicio, type ReporteAnulados, type ReporteIgv, type ReportePersonasNotas, type ReporteProblemas, type ReporteRegistro,
} from '../servicios/reportesServicio'
import { Marco, useReporte, type Busqueda } from './Reportes'

/**
 * 034 — REPORTES, entrega 2: «SUNAT y contabilidad».
 *
 * Montos EN SOLES (lo emitido en dólares, con el tipo de cambio de cada
 * comprobante). Solo lectura.
 */

const TIPO: Record<string, string> = { '01': 'Factura', '03': 'Boleta', '07': 'Nota de crédito', '08': 'Nota de débito' }

// 22 oct: motivos de nota de débito (catálogo 10).
const MOTIVO_DEBITO: Record<string, string> = {
  '01': 'Intereses por mora', '02': 'Aumento en el valor', '03': 'Penalidades u otros conceptos',
}

const ESTADO: Record<string, string> = {
  aceptado: 'Aceptado', observado: 'Con observaciones', encolado: 'En camino', anulado: 'Anulado',
  rechazado: 'Rechazado', error: 'No se pudo enviar', borrador: 'Borrador',
}

const MOTIVO: Record<string, string> = {
  '01': 'Anulación de la operación', '02': 'Error en el RUC', '04': 'Descuento global',
  '05': 'Descuento por ítem', '06': 'Devolución total', '07': 'Devolución por ítem', '09': 'Disminución en el valor',
}

/** Qué hacer con cada problema, en palabras simples. */
function queHacer(estado: string, tipo: string) {
  switch (estado) {
    case 'rechazado': return 'SUNAT no lo aceptó: no vale. Corrige el dato y emite uno nuevo.'
    case 'error': return 'No llegó al servicio. Ábrelo y pulsa «Reintentar».'
    case 'observado': return 'Vale, pero SUNAT dejó observaciones: léelas para la próxima.'
    case 'encolado': return tipo === '03' || tipo === '07' || tipo === '08'
      ? 'Sin respuesta de SUNAT: se acerca el plazo de 7 días. Avisa a soporte.'
      : 'Sin respuesta de SUNAT: se acerca el plazo de 3 días. Avisa a soporte.'
    default: return ''
  }
}

/** 037: los filtros de los reportes de comprobantes. */
const TIPOS_FILTRO: [string, string][] = [['01', 'Facturas'], ['03', 'Boletas'], ['07', 'Notas de crédito'], ['08', 'Notas de débito']]
const BUSCAR_COMPROBANTE = 'Cliente, RUC/DNI o número (F001-123)'

const BUSQUEDA_REGISTRO: Busqueda = {
  texto: BUSCAR_COMPROBANTE, tipos: TIPOS_FILTRO,
  estados: [['aceptado', 'Aceptado'], ['observado', 'Con observaciones'], ['encolado', 'En camino'], ['anulado', 'Anulado']],
}
const BUSQUEDA_PROBLEMAS: Busqueda = {
  texto: BUSCAR_COMPROBANTE, tipos: TIPOS_FILTRO,
  estados: [['rechazado', 'Rechazado'], ['error', 'No se pudo enviar'], ['observado', 'Con observaciones'], ['encolado', 'Sin respuesta de SUNAT']],
}
const BUSQUEDA_ANULADOS: Busqueda = {
  texto: BUSCAR_COMPROBANTE, tipos: TIPOS_FILTRO,
  estados: [['anulado', 'Anulado'], ['aceptado', 'Aceptado'], ['observado', 'Con observaciones'], ['encolado', 'En camino']],
}


// =============================================================================
export function ReporteIgvPagina() {
  const r = useReporte<ReporteIgv>('igv', true)
  return (
    <Marco titulo="Resumen de IGV" reporte="igv" r={r} conMoneda={false} pie={<p className="nota pie-reporte">Montos en soles: lo emitido en dólares va con el tipo de cambio de cada comprobante. Las notas de crédito restan. No van los rechazados (no existen para SUNAT).</p>}>
      {d => {
        const t = d.filas.reduce((a, f) => ({
          gravado: a.gravado + f.gravado, igv: a.igv + f.igv, total: a.total + f.total,
          otros: a.otros + f.exonerado + f.inafecto + f.exportacion,
        }), { gravado: 0, igv: 0, total: 0, otros: 0 })
        return (
          <>
            {d.sinTipoCambio > 0 && (
              <Aviso tono="ojo">
                {d.sinTipoCambio} comprobante(s) en dólares no tienen tipo de cambio guardado y salen en 0. Revísalos.
              </Aviso>
            )}
            <ResumenDetalle filas={d.filas.length}
              resumen={<>
            <div className="cifras-reporte">
              <Cifra titulo="Base gravada" valor={`S/ ${dinero(t.gravado)}`} />
              <Cifra titulo="IGV" valor={`S/ ${dinero(t.igv)}`} />
              <Cifra titulo="Exonerado, inafecto y exportación" valor={`S/ ${dinero(t.otros)}`} />
              <Cifra titulo="Total" valor={`S/ ${dinero(t.total)}`} />
            </div>

            <div className="dos-reporte">
              <div className="bloque">
                <h2 className="subtitulo">IGV por mes (S/)</h2>
                <Barras cabeceras={['Mes', 'IGV (S/)']}
                        filas={d.filas.map(f => ({ etiqueta: f.mes, valor: f.igv }))} />
              </div>
              <div className="bloque">
                <h2 className="subtitulo">Por tipo de comprobante</h2>
                <table className="tabla">
                  <thead><tr><th>Tipo</th><th className="derecha">Cantidad</th><th className="derecha">Base</th>
                    <th className="derecha">IGV</th><th className="derecha">Total</th></tr></thead>
                  <tbody>
                    {d.porTipo.map(p => (
                      <tr key={p.tipo}>
                        <td>{TIPO[p.tipo] ?? p.tipo}</td><td className="derecha mono">{p.cantidad}</td>
                        <td className="derecha mono">{dinero(p.base)}</td><td className="derecha mono">{dinero(p.igv)}</td>
                        <td className="derecha mono">{dinero(p.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
              </>}
              detalle={<IgvPorMes d={d} t={t} />} />
            <p className="nota">Referencial, para cuadrar. La declaración la hace tu contador.</p>
          </>
        )
      }}
    </Marco>
  )
}


// =============================================================================
/**
 * e176: el detalle del IGV, un renglón por mes; cada mes se abre en sus días
 * (antes la tabla crecía por días y no acababa). Al imprimir salen abiertos
 * los que estén abiertos.
 */
function IgvPorMes({ d, t }: { d: ReporteIgv; t: { gravado: number; igv: number; total: number; otros: number } }) {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const cambiar = (mes: string) => setAbiertos(a => { const n = new Set(a); if (n.has(mes)) n.delete(mes); else n.add(mes); return n })
  const celdas = (f: { comprobantes: number; notas: number; gravado: number; exonerado: number; inafecto: number; exportacion: number; igv: number; total: number }) => (
    <>
      <td className="derecha mono">{f.comprobantes}</td><td className="derecha mono">{f.notas}</td>
      <td className="derecha mono">{dinero(f.gravado)}</td><td className="derecha mono">{dinero(f.exonerado)}</td>
      <td className="derecha mono">{dinero(f.inafecto)}</td><td className="derecha mono">{dinero(f.exportacion)}</td>
      <td className="derecha mono">{dinero(f.igv)}</td><td className="derecha mono">{dinero(f.total)}</td>
    </>
  )
  const dias = d.dias ?? []
  return (
    <div className="bloque sin-relleno">
      <div className="tabla-envoltura">
        <table className="tabla tabla-igv">
          <thead><tr><th>Mes</th><th className="derecha">Comprobantes</th><th className="derecha">Notas</th>
            <th className="derecha">Base gravada</th><th className="derecha">Exonerado</th><th className="derecha">Inafecto</th>
            <th className="derecha">Exportación</th><th className="derecha">IGV</th><th className="derecha">Total</th></tr></thead>
          <tbody>
            {d.filas.length === 0 && <tr><td colSpan={9} className="vacio">Sin comprobantes en este periodo.</td></tr>}
            {d.filas.map(f => {
              const abierto = abiertos.has(f.mes)
              const suyos = dias.filter(x => x.fecha.startsWith(f.mes))
              return (
                <Fragment key={f.mes}>
                  <tr className="fila-mes">
                    <td>
                      {suyos.length > 0 ? (
                        <button type="button" className="enlace abrir-mes" aria-expanded={abierto} onClick={() => cambiar(f.mes)}
                                title={`${suyos.length} día(s) con comprobantes`}>
                          <span aria-hidden>{abierto ? '▾' : '▸'}</span> <span className="mono">{f.mes}</span>
                        </button>
                      ) : <span className="mono">{f.mes}</span>}
                    </td>
                    {celdas(f)}
                  </tr>
                  {abierto && suyos.map(x => (
                    <tr key={x.fecha} className="fila-dia">
                      <td className="secundario">{fecha(x.fecha)}</td>
                      {celdas(x)}
                    </tr>
                  ))}
                </Fragment>
              )
            })}
            {d.filas.length > 1 && (
              <tr className="fila-total">
                <td>Total</td>
                <td className="derecha mono">{d.filas.reduce((a, f) => a + f.comprobantes, 0)}</td>
                <td className="derecha mono">{d.filas.reduce((a, f) => a + f.notas, 0)}</td>
                <td className="derecha mono">{dinero(t.gravado)}</td>
                <td colSpan={3} className="derecha mono secundario">{dinero(t.otros)}</td>
                <td className="derecha mono">{dinero(t.igv)}</td><td className="derecha mono">{dinero(t.total)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {dias.length > 0 && (
        <div className="lineas-pie solo-pantalla">
          <button type="button" className="enlace" onClick={() => setAbiertos(a => a.size ? new Set() : new Set(d.filas.map(f => f.mes)))}>
            {abiertos.size ? 'Cerrar todos los meses' : 'Abrir todos los meses en días'}
          </button>
        </div>
      )}
    </div>
  )
}


// =============================================================================
export function ReporteRegistroPagina() {
  const r = useReporte<ReporteRegistro>('registro', true)
  return (
    <Marco titulo="Registro de Ventas" reporte="registro" r={r} conMoneda={false} horizontal busqueda={BUSQUEDA_REGISTRO} pie={<p className="nota pie-reporte">Montos en soles: lo emitido en dólares va con el tipo de cambio de cada comprobante. Las notas de crédito restan. No van los rechazados (no existen para SUNAT).</p>}>
      {d => (
        <>
          <p className="nota solo-pantalla">
            Para el contador: baja el <strong>Excel</strong> con todas las columnas (tipo y número de documento
            del cliente, base, IGV, total, moneda, tipo de cambio y el comprobante que modifica cada nota).
            Montos en soles; las notas en negativo; los anulados en 0. Sirve para cuadrar con la propuesta del SIRE.
          </p>
          <div className="tabla-ancha">
          <TablaDatos filas={d.filas} clave={f => f.id} vacio="No hay comprobantes en este periodo."
            columnas={[
              { clave: 'fecha', titulo: 'Fecha', clase: 'secundario', celda: f => fecha(f.fecha), orden: f => f.fecha },
              { clave: 'numero', titulo: 'Comprobante', clase: 'mono', orden: f => `${f.serie}-${String(f.numero).padStart(8, '0')}`,
                celda: f => <><Link to={`/facturacion/comprobantes/${f.id}`}>{f.serie}-{String(f.numero).padStart(8, '0')}</Link>
                  <div className="secundario">{TIPO[f.tipo] ?? f.tipo}{f.moneda !== 'PEN' ? ` · ${f.moneda} a ${f.tipoCambio ?? '?'}` : ''}</div></> },
              { clave: 'cliente', titulo: 'Cliente', orden: f => f.cliente, celda: f => <>{f.cliente}<div className="secundario mono">{f.documento}</div></> },
              { clave: 'base', titulo: 'Base', clase: 'derecha mono', orden: f => f.gravado + f.exonerado + f.inafecto + f.exportacion,
                celda: f => dinero(f.gravado + f.exonerado + f.inafecto + f.exportacion) },
              { clave: 'igv', titulo: 'IGV', clase: 'derecha mono', orden: f => f.igv, celda: f => dinero(f.igv) },
              { clave: 'total', titulo: 'Total', clase: 'derecha mono', orden: f => f.total, celda: f => dinero(f.total) },
              { clave: 'ref', titulo: 'Modifica a', clase: 'mono secundario', celda: f => f.refSerie ? `${f.refSerie}-${String(f.refNumero).padStart(8, '0')}` : '' },
              { clave: 'estado', titulo: 'Estado', orden: f => ESTADO[f.estado] ?? f.estado, celda: f => ESTADO[f.estado] ?? f.estado },
            ]}
            pie={d.filas.length > 0 && (
              <tr className="fila-total">
                <td colSpan={3}>Total ({d.filas.length})</td>
                <td className="derecha mono">{dinero(d.filas.reduce((t, f) => t + f.gravado + f.exonerado + f.inafecto + f.exportacion, 0))}</td>
                <td className="derecha mono">{dinero(d.filas.reduce((t, f) => t + f.igv, 0))}</td>
                <td className="derecha mono">{dinero(d.filas.reduce((t, f) => t + f.total, 0))}</td>
                <td colSpan={2} />
              </tr>
            )} />
          </div>
        </>
      )}
    </Marco>
  )
}


// =============================================================================
export function ReporteProblemasPagina() {
  const r = useReporte<ReporteProblemas>('problemas', true)
  return (
    <Marco titulo="Comprobantes con problema" reporte="problemas" r={r} conMoneda={false} busqueda={BUSQUEDA_PROBLEMAS} pie={<p className="nota pie-reporte">Salen los rechazados, los que no se pudieron enviar, los que tienen observaciones y los que se acercan al plazo sin respuesta de SUNAT.</p>}>
      {d => d.filas.length === 0 ? (
        <Aviso tono="bien">Ningún comprobante con problema en este periodo.</Aviso>
      ) : (
        <TablaDatos filas={d.filas} clave={f => f.id}
          columnas={[
            { clave: 'fecha', titulo: 'Fecha', clase: 'secundario', celda: f => fecha(f.fecha), orden: f => f.fecha },
            { clave: 'numero', titulo: 'Comprobante', clase: 'mono', orden: f => f.numero,
              celda: f => <><Link to={`/facturacion/comprobantes/${f.id}`}>{f.numero ?? '(sin número)'}</Link>
                <div className="secundario">{TIPO[f.tipo] ?? f.tipo} · {f.moneda} {dinero(f.total)}</div></> },
            { clave: 'cliente', titulo: 'Cliente', celda: f => f.cliente, orden: f => f.cliente },
            { clave: 'que', titulo: 'Qué pasó', orden: f => ESTADO[f.estado] ?? f.estado,
              celda: f => <><strong>{ESTADO[f.estado] ?? f.estado}</strong>
                {(f.codigo || f.mensaje) && <div className="secundario">{f.codigo && `[${f.codigo}] `}{f.mensaje}</div>}
                {f.observaciones?.map((o, i) => <div key={i} className="secundario">· {o}</div>)}</> },
            { clave: 'hacer', titulo: 'Qué hacer', clase: 'secundario', celda: f => queHacer(f.estado, f.tipo) },
          ]} />
      )}
    </Marco>
  )
}


// =============================================================================
export function ReporteAnuladosPagina() {
  const r = useReporte<ReporteAnulados>('anulados', true)
  return (
    <Marco titulo="Anulados y notas de crédito" reporte="anulados" r={r} conMoneda={false} busqueda={BUSQUEDA_ANULADOS} pie={null}>
      {d => d.filas.length === 0 ? (
        <p className="nota">Ningún anulado ni nota de crédito en este periodo.</p>
      ) : (
        <TablaDatos filas={d.filas} clave={f => f.id}
          columnas={[
            { clave: 'fecha', titulo: 'Fecha', clase: 'secundario', celda: f => fecha(f.fecha), orden: f => f.fecha },
            { clave: 'numero', titulo: 'Comprobante', clase: 'mono', orden: f => f.numero,
              celda: f => <><Link to={`/facturacion/comprobantes/${f.id}`}>{f.numero}</Link>
                <div className="secundario">{TIPO[f.tipo] ?? f.tipo}</div>
                {f.sucursal && <div className="secundario">{f.sucursal}</div>}</> },
            { clave: 'cliente', titulo: 'Cliente', celda: f => f.cliente, orden: f => f.cliente },
            { clave: 'afecta', titulo: 'Modifica a', clase: 'mono',
              celda: f => f.afectaId ? <Link to={`/facturacion/comprobantes/${f.afectaId}`}>{f.afecta}</Link> : '' },
            { clave: 'motivo', titulo: 'Motivo', clase: 'secundario',
              celda: f => <>{f.tipoNota ? ((f.tipo === '08' ? MOTIVO_DEBITO : MOTIVO)[f.tipoNota] ?? f.tipoNota) : ''}{f.motivo && <div>{f.motivo}</div>}</> },
            { clave: 'total', titulo: 'Total', clase: 'derecha mono', orden: f => f.total, celda: f => <>{f.moneda} {dinero(f.total)}</> },
            { clave: 'estado', titulo: 'Estado', orden: f => ESTADO[f.estado] ?? f.estado, celda: f => ESTADO[f.estado] ?? f.estado },
            { clave: 'quien', titulo: 'Quién', clase: 'secundario',
              celda: f => f.estado === 'anulado'
                ? <>Anuló: {f.anulo ?? '—'}{f.tipo === '07' || f.tipo === '08' ? <div>Emitió: {f.emitio}</div> : null}</>
                : <>Emitió: {f.emitio ?? '—'}</> },
          ]} />
      )}
    </Marco>
  )
}


// =============================================================================
/**
 * e147 — NOTAS Y ANULACIONES POR PERSONA (en soles). Las notas, de quien las
 * emitió; las anulaciones, de quien las pidió (registrado desde el 23 oct).
 */
export function ReportePersonasNotasPagina() {
  const r = useReporte<ReportePersonasNotas>('personas-notas', true)
  return (
    <Marco titulo="Notas y anulaciones por persona" reporte="personas-notas" r={r} conMoneda={false}
           busqueda={{ texto: 'Nombre de la persona' }}
           pie={<p className="nota">Montos en soles. El detalle de cada una está en «Anulados y notas de crédito».</p>}>
      {d => d.filas.length === 0 ? (
        <p className="nota">Nadie hizo notas ni anulaciones en este periodo.</p>
      ) : (
        <ResumenDetalle filas={d.filas.length}
          resumen={<>
            <div className="cifras-reporte">
              <Cifra titulo="Notas de crédito" valor={d.filas.reduce((t, f) => t + f.notasCredito, 0)}
                     nota={`S/ ${dinero(d.filas.reduce((t, f) => t + f.montoNotasCredito, 0))}`} />
              <Cifra titulo="Notas de débito" valor={d.filas.reduce((t, f) => t + f.notasDebito, 0)}
                     nota={`S/ ${dinero(d.filas.reduce((t, f) => t + f.montoNotasDebito, 0))}`} />
              <Cifra titulo="Anulaciones" valor={d.filas.reduce((t, f) => t + f.anulaciones, 0)}
                     nota={`S/ ${dinero(d.filas.reduce((t, f) => t + f.montoAnulaciones, 0))}`} />
            </div>
            <div className="bloque">
              <h2 className="subtitulo">Quién corrige más</h2>
              <Barras cabeceras={['Persona', 'Notas y anulaciones']} formato={n => String(n)}
                      filas={topYOtros(d.filas, f => f.persona, f => f.acciones)} />
            </div>
          </>}
          detalle={
            <TablaDatos filas={d.filas} clave={(_, i) => i} ordenInicial={{ clave: 'acc', desc: true }}
              columnas={[
                { clave: 'persona', titulo: 'Persona', orden: f => f.persona, celda: f => <>{f.persona}{f.cargo && <div className="secundario">{f.cargo}</div>}</> },
                { clave: 'nc', titulo: 'Notas de crédito', clase: 'derecha mono', celda: f => f.notasCredito, orden: f => f.notasCredito },
                { clave: 'mnc', titulo: 'Monto', clase: 'derecha mono', celda: f => dinero(f.montoNotasCredito), orden: f => f.montoNotasCredito },
                { clave: 'nd', titulo: 'Notas de débito', clase: 'derecha mono', celda: f => f.notasDebito, orden: f => f.notasDebito },
                { clave: 'mnd', titulo: 'Monto', clase: 'derecha mono', celda: f => dinero(f.montoNotasDebito), orden: f => f.montoNotasDebito },
                { clave: 'an', titulo: 'Anulaciones', clase: 'derecha mono', celda: f => f.anulaciones, orden: f => f.anulaciones },
                { clave: 'man', titulo: 'Monto', clase: 'derecha mono', celda: f => dinero(f.montoAnulaciones), orden: f => f.montoAnulaciones },
                { clave: 'acc', titulo: 'Total', clase: 'derecha mono', celda: f => f.acciones, orden: f => f.acciones },
              ]} />
          } />
      )}
    </Marco>
  )
}


// =============================================================================
/** Descarga masiva: un .zip con los XML, CDR y PDF del periodo (hasta 200). */
export function ReporteDescargaPagina() {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
  const [desde, setDesde] = useState(hoy.slice(0, 8) + '01')
  const [hasta, setHasta] = useState(hoy)
  const [xml, setXml] = useState(true)
  const [cdr, setCdr] = useState(true)
  const [pdf, setPdf] = useState(false)
  const [bajando, setBajando] = useState(false)
  const [error, setError] = useState<string>()

  const bajar = async () => {
    setBajando(true); setError(undefined)
    try { await reportesServicio.descargaMasiva({ desde, hasta, xml, cdr, pdf }) }
    catch (e) { setError(e instanceof ErrorApi ? e.message : 'No se pudo preparar la descarga.') }
    finally { setBajando(false) }
  }

  return (
    <div className="reporte">
      <div className="encabezado-pagina"><h1 className="titulo-pagina">Descarga masiva</h1></div>
      <div className="bloque">
        <p>Un archivo <strong>.zip</strong> con los comprobantes del periodo, en carpetas XML, CDR y PDF. Hasta 200 comprobantes por vez.</p>
        <div className="filtros">
          <label><span>Desde</span><input type="date" value={desde} max={hoy} onChange={e => setDesde(e.target.value)} /></label>
          <label><span>Hasta</span><input type="date" value={hasta} max={hoy} onChange={e => setHasta(e.target.value)} /></label>
        </div>
        <div className="casillas-descarga">
          <label><input type="checkbox" checked={xml} onChange={e => setXml(e.target.checked)} /> XML firmado</label>
          <label><input type="checkbox" checked={cdr} onChange={e => setCdr(e.target.checked)} /> CDR (constancia de SUNAT)</label>
          <label><input type="checkbox" checked={pdf} onChange={e => setPdf(e.target.checked)} /> PDF (tarda más: se genera cada uno)</label>
        </div>
        {error && <Aviso>{error}</Aviso>}
        <div className="acciones-linea">
          <Boton onClick={() => void bajar()} ocupado={bajando} textoOcupado="Preparando el .zip… (puede tardar un minuto)"
                 disabled={!xml && !cdr && !pdf}>⬇ Descargar .zip</Boton>
        </div>
        <p className="nota">Si algún archivo no se pudo bajar, el .zip trae un «LEEME-faltantes.txt» con la lista.</p>
      </div>
    </div>
  )
}