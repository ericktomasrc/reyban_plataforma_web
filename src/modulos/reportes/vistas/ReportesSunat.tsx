import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { Barras, Cifra, dinero } from '../componentes/Graficos'
import {
  reportesServicio, type ReporteAnulados, type ReporteIgv, type ReporteProblemas, type ReporteRegistro,
} from '../servicios/reportesServicio'
import { Marco, useReporte, type Busqueda } from './Reportes'

/**
 * 034 — REPORTES, entrega 2: «SUNAT y contabilidad».
 *
 * Montos EN SOLES (lo emitido en dólares, con el tipo de cambio de cada
 * comprobante). Solo lectura.
 */

const TIPO: Record<string, string> = { '01': 'Factura', '03': 'Boleta', '07': 'Nota de crédito' }

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
    case 'encolado': return tipo === '03' || tipo === '07'
      ? 'Sin respuesta de SUNAT: se acerca el plazo de 7 días. Avisa a soporte.'
      : 'Sin respuesta de SUNAT: se acerca el plazo de 3 días. Avisa a soporte.'
    default: return ''
  }
}

/** 037: los filtros de los reportes de comprobantes. */
const TIPOS_FILTRO: [string, string][] = [['01', 'Facturas'], ['03', 'Boletas'], ['07', 'Notas de crédito']]
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

            <div className="bloque sin-relleno">
              <table className="tabla">
                <thead><tr><th>Mes</th><th className="derecha">Comprobantes</th><th className="derecha">Notas</th>
                  <th className="derecha">Base gravada</th><th className="derecha">Exonerado</th><th className="derecha">Inafecto</th>
                  <th className="derecha">Exportación</th><th className="derecha">IGV</th><th className="derecha">Total</th></tr></thead>
                <tbody>
                  {d.filas.map(f => (
                    <tr key={f.mes}>
                      <td className="mono">{f.mes}</td><td className="derecha mono">{f.comprobantes}</td>
                      <td className="derecha mono">{f.notas}</td><td className="derecha mono">{dinero(f.gravado)}</td>
                      <td className="derecha mono">{dinero(f.exonerado)}</td><td className="derecha mono">{dinero(f.inafecto)}</td>
                      <td className="derecha mono">{dinero(f.exportacion)}</td><td className="derecha mono">{dinero(f.igv)}</td>
                      <td className="derecha mono">{dinero(f.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="nota">Referencial, para cuadrar. La declaración la hace tu contador.</p>
          </>
        )
      }}
    </Marco>
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
          <div className="bloque sin-relleno tabla-ancha">
            <table className="tabla">
              <thead><tr><th>Fecha</th><th>Comprobante</th><th>Cliente</th><th className="derecha">Base</th>
                <th className="derecha">IGV</th><th className="derecha">Total</th><th>Modifica a</th><th>Estado</th></tr></thead>
              <tbody>
                {d.filas.length === 0 && <tr><td colSpan={8} className="vacio">No hay comprobantes en este periodo.</td></tr>}
                {d.filas.map(f => (
                  <tr key={f.id}>
                    <td className="secundario">{fecha(f.fecha)}</td>
                    <td className="mono"><Link to={`/facturacion/comprobantes/${f.id}`}>{f.serie}-{String(f.numero).padStart(8, '0')}</Link>
                      <div className="secundario">{TIPO[f.tipo] ?? f.tipo}{f.moneda !== 'PEN' ? ` · ${f.moneda} a ${f.tipoCambio ?? '?'}` : ''}</div></td>
                    <td>{f.cliente}<div className="secundario mono">{f.documento}</div></td>
                    <td className="derecha mono">{dinero(f.gravado + f.exonerado + f.inafecto + f.exportacion)}</td>
                    <td className="derecha mono">{dinero(f.igv)}</td>
                    <td className="derecha mono">{dinero(f.total)}</td>
                    <td className="mono secundario">{f.refSerie ? `${f.refSerie}-${String(f.refNumero).padStart(8, '0')}` : ''}</td>
                    <td>{ESTADO[f.estado] ?? f.estado}</td>
                  </tr>
                ))}
                {d.filas.length > 0 && (
                  <tr className="fila-total">
                    <td colSpan={3}>Total ({d.filas.length})</td>
                    <td className="derecha mono">{dinero(d.filas.reduce((t, f) => t + f.gravado + f.exonerado + f.inafecto + f.exportacion, 0))}</td>
                    <td className="derecha mono">{dinero(d.filas.reduce((t, f) => t + f.igv, 0))}</td>
                    <td className="derecha mono">{dinero(d.filas.reduce((t, f) => t + f.total, 0))}</td>
                    <td colSpan={2} />
                  </tr>
                )}
              </tbody>
            </table>
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
        <div className="bloque sin-relleno">
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Comprobante</th><th>Cliente</th><th>Qué pasó</th><th>Qué hacer</th></tr></thead>
            <tbody>
              {d.filas.map(f => (
                <tr key={f.id}>
                  <td className="secundario">{fecha(f.fecha)}</td>
                  <td className="mono"><Link to={`/facturacion/comprobantes/${f.id}`}>{f.numero ?? '(sin número)'}</Link>
                    <div className="secundario">{TIPO[f.tipo] ?? f.tipo} · {f.moneda} {dinero(f.total)}</div></td>
                  <td>{f.cliente}</td>
                  <td><strong>{ESTADO[f.estado] ?? f.estado}</strong>
                    {(f.codigo || f.mensaje) && <div className="secundario">{f.codigo && `[${f.codigo}] `}{f.mensaje}</div>}
                    {f.observaciones?.map((o, i) => <div key={i} className="secundario">· {o}</div>)}</td>
                  <td className="secundario">{queHacer(f.estado, f.tipo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
        <div className="bloque sin-relleno">
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Comprobante</th><th>Cliente</th><th>Modifica a</th><th>Motivo</th>
              <th className="derecha">Total</th><th>Estado</th></tr></thead>
            <tbody>
              {d.filas.map(f => (
                <tr key={f.id}>
                  <td className="secundario">{fecha(f.fecha)}</td>
                  <td className="mono"><Link to={`/facturacion/comprobantes/${f.id}`}>{f.numero}</Link>
                    <div className="secundario">{TIPO[f.tipo] ?? f.tipo}</div></td>
                  <td>{f.cliente}</td>
                  <td className="mono">{f.afectaId ? <Link to={`/facturacion/comprobantes/${f.afectaId}`}>{f.afecta}</Link> : ''}</td>
                  <td className="secundario">{f.tipoNota ? (MOTIVO[f.tipoNota] ?? f.tipoNota) : ''}{f.motivo && <div>{f.motivo}</div>}</td>
                  <td className="derecha mono">{f.moneda} {dinero(f.total)}</td>
                  <td>{ESTADO[f.estado] ?? f.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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