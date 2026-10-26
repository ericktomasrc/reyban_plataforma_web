import { Aviso } from '../../../componentes/Aviso'
import { Pestanas } from '../../../componentes/Pestanas'
import { TablaDatos } from '../../../componentes/TablaDatos'
import { fecha } from '../../../nucleo/formato/fechas'
import { usePestana } from '../../../nucleo/hooks/usePestana'
import { NOMBRE_CATEGORIA } from '../../compras/comprasServicio'
import { Barras, Cifra, dinero } from '../componentes/Graficos'
import { topYOtros } from '../componentes/topYOtros'
import type { FuenteCosto, ReporteMargen, ReporteResultados, ReporteValorizado } from '../servicios/reportesServicio'
import { Marco, useReporte } from './Reportes'

/**
 * e179 (060) — GANANCIAS (bloque 5): margen bruto, estado de resultados simple
 * e inventario valorizado. Montos en soles y SIN IGV.
 *
 * El costo de cada venta: REAL (promedio de las compras del inventario, desde
 * que se activó), «≈» MANUAL (el escrito en el producto) o SIN COSTO (aparte:
 * no entra al margen para no inventar una ganancia del 100 %).
 */

const pct = (venta: number, costo: number) => venta ? `${(((venta - costo) / venta) * 100).toFixed(1)} %` : '—'
const CHIP: Record<FuenteCosto, [string, string]> = {
  real: ['etiqueta acento', 'Real'], manual: ['etiqueta', '≈ Manual'], sin: ['etiqueta aviso', 'Sin costo'],
}
const Chip = ({ f }: { f: FuenteCosto }) => <span className={CHIP[f][0]}>{CHIP[f][1]}</span>

function AvisoCostos({ activadoEn, manual, sinCosto }: { activadoEn: string | null; manual: number; sinCosto: number }) {
  return (
    <>
      {activadoEn
        ? <p className="nota">El inventario se activó el <strong>{fecha(activadoEn)}</strong>: desde entonces el costo es el <strong>real</strong> (promedio de tus compras). Antes, o en productos sin compras, se usa el costo escrito en el producto (marcado «≈ Manual»).</p>
        : <p className="nota">Sin inventario, el costo es el que escribiste en cada producto («≈»). Con el inventario activo, saldrá el costo real de tus compras.</p>}
      {manual > 0 && <p className="nota">S/ {dinero(manual)} de ventas usan el costo escrito a mano: el margen de esa parte es aproximado.</p>}
      {sinCosto > 0 && (
        <Aviso tono="ojo">
          S/ {dinero(sinCosto)} de ventas no tienen costo (ni del inventario ni escrito en el producto) y quedan fuera del margen.
          Escríbelo en Productos para que cuenten.
        </Aviso>
      )}
    </>
  )
}

// =============================================================================
export function ReporteMargenPagina() {
  const r = useReporte<ReporteMargen>('margen', true)
  const [ver, setVer] = usePestana(['resumen', 'productos', 'clientes', 'meses'] as const, 'vista')
  return (
    <Marco titulo="Margen bruto" reporte="margen" r={r} conMoneda={false}
           pie={<p className="nota pie-reporte">Margen = ventas sin IGV − costo de lo vendido. Las notas de crédito restan la venta y el costo. Los regalos tienen costo y no venta. Cuentan los comprobantes en camino o aceptados.</p>}>
      {d => {
        const margen = d.ventas - d.costo
        const oculto = (v: string) => ver === v ? undefined : 'rd-oculta'
        return (
          <>
            <div className="cifras-reporte">
              <Cifra titulo="Ventas con costo" valor={`S/ ${dinero(d.ventas)}`} nota="sin IGV" />
              <Cifra titulo="Costo de lo vendido" valor={`S/ ${dinero(d.costo)}`} />
              <Cifra titulo="Margen bruto" valor={`S/ ${dinero(margen)}`} nota={pct(d.ventas, d.costo)} />
              <Cifra titulo="Ventas sin costo" valor={`S/ ${dinero(d.ventasSinCosto)}`} nota="fuera del margen" />
            </div>
            <AvisoCostos activadoEn={d.activadoEn} manual={d.ventasManual} sinCosto={d.ventasSinCosto} />

            <div className="solo-pantalla">
              <Pestanas etiqueta="Margen" valor={ver} onCambio={setVer} opciones={[
                { valor: 'resumen', texto: 'Resumen' },
                { valor: 'productos', texto: 'Por producto', cuenta: d.porProducto.length },
                { valor: 'clientes', texto: 'Por cliente', cuenta: d.porCliente.length },
                { valor: 'meses', texto: 'Por mes', cuenta: d.porMes.length },
              ]} />
            </div>

            <div className={oculto('resumen')}>
              <div className="dos-reporte">
                <div className="bloque">
                  <h2 className="subtitulo">Los productos que más dejan</h2>
                  <Barras cabeceras={['Producto', 'Margen']}
                          filas={topYOtros(d.porProducto.filter(p => p.fuente !== 'sin'), p => p.producto, p => p.venta - (p.costo ?? 0), p => pct(p.venta, p.costo ?? 0))} />
                </div>
                <div className="bloque">
                  <h2 className="subtitulo">Margen por mes</h2>
                  <Barras cabeceras={['Mes', 'Margen']} filas={d.porMes.map(m => ({ etiqueta: m.mes, valor: m.venta - m.costo, nota: pct(m.venta, m.costo) }))} />
                </div>
              </div>
            </div>

            <div className={oculto('productos')}>
              <h2 className="subtitulo solo-impresion">Por producto</h2>
              <TablaDatos filas={d.porProducto} clave={(_, i) => i} ordenInicial={{ clave: 'margen', desc: true }} vacio="Sin ventas en este periodo."
                buscar={p => [p.producto, p.codigo]} textoBuscar="Producto o código"
                columnas={[
                  { clave: 'producto', titulo: 'Producto', orden: p => p.producto, celda: p => <>{p.producto}{p.codigo && <div className="secundario mono">{p.codigo}</div>}</> },
                  { clave: 'cant', titulo: 'Cantidad', clase: 'derecha mono', celda: p => `${Number(p.cantidad)} ${p.unidad}`, orden: p => p.cantidad },
                  { clave: 'venta', titulo: 'Ventas', clase: 'derecha mono', celda: p => dinero(p.venta), orden: p => p.venta },
                  { clave: 'costo', titulo: 'Costo', clase: 'derecha mono', celda: p => p.fuente === 'sin' ? '—' : dinero(p.costo ?? 0), orden: p => p.costo },
                  { clave: 'margen', titulo: 'Margen', clase: 'derecha mono', orden: p => p.fuente === 'sin' ? null : p.venta - (p.costo ?? 0),
                    celda: p => p.fuente === 'sin' ? '—' : <span className={p.venta - (p.costo ?? 0) < 0 ? 'texto-mal' : undefined}>{dinero(p.venta - (p.costo ?? 0))}</span> },
                  { clave: 'pct', titulo: '%', clase: 'derecha mono secundario', celda: p => p.fuente === 'sin' ? '' : pct(p.venta, p.costo ?? 0),
                    orden: p => p.fuente === 'sin' || !p.venta ? null : (p.venta - (p.costo ?? 0)) / p.venta },
                  { clave: 'fuente', titulo: 'Costo', celda: p => <Chip f={p.fuente} />, orden: p => p.fuente },
                ]} />
            </div>

            <div className={oculto('clientes')}>
              <h2 className="subtitulo solo-impresion">Por cliente</h2>
              <TablaDatos filas={d.porCliente} clave={(_, i) => i} ordenInicial={{ clave: 'margen', desc: true }} vacio="Sin ventas en este periodo."
                buscar={c => [c.cliente, c.documento]} textoBuscar="Cliente, RUC o DNI"
                columnas={[
                  { clave: 'cliente', titulo: 'Cliente', orden: c => c.cliente, celda: c => <>{c.cliente}<div className="secundario mono">{c.documento}</div></> },
                  { clave: 'venta', titulo: 'Ventas con costo', clase: 'derecha mono', celda: c => dinero(c.venta ?? 0), orden: c => c.venta },
                  { clave: 'costo', titulo: 'Costo', clase: 'derecha mono', celda: c => dinero(c.costo ?? 0), orden: c => c.costo },
                  { clave: 'margen', titulo: 'Margen', clase: 'derecha mono', celda: c => dinero((c.venta ?? 0) - (c.costo ?? 0)), orden: c => (c.venta ?? 0) - (c.costo ?? 0) },
                  { clave: 'pct', titulo: '%', clase: 'derecha mono secundario', celda: c => pct(c.venta ?? 0, c.costo ?? 0) },
                  { clave: 'sin', titulo: 'Sin costo', clase: 'derecha mono secundario', celda: c => c.sinCosto ? dinero(c.sinCosto) : '', orden: c => c.sinCosto },
                ]} />
            </div>

            <div className={oculto('meses')}>
              <h2 className="subtitulo solo-impresion">Por mes</h2>
              <TablaDatos filas={d.porMes} clave={m => m.mes} ordenInicial={{ clave: 'mes' }} vacio="Sin ventas en este periodo."
                columnas={[
                  { clave: 'mes', titulo: 'Mes', clase: 'mono', celda: m => m.mes, orden: m => m.mes },
                  { clave: 'venta', titulo: 'Ventas con costo', clase: 'derecha mono', celda: m => dinero(m.venta), orden: m => m.venta },
                  { clave: 'costo', titulo: 'Costo', clase: 'derecha mono', celda: m => dinero(m.costo), orden: m => m.costo },
                  { clave: 'margen', titulo: 'Margen', clase: 'derecha mono', celda: m => dinero(m.venta - m.costo), orden: m => m.venta - m.costo },
                  { clave: 'pct', titulo: '%', clase: 'derecha mono secundario', celda: m => pct(m.venta, m.costo) },
                  { clave: 'manual', titulo: 'Con costo ≈', clase: 'derecha mono secundario', celda: m => m.manual ? dinero(m.manual) : '' },
                  { clave: 'sin', titulo: 'Sin costo', clase: 'derecha mono secundario', celda: m => m.sinCosto ? dinero(m.sinCosto) : '' },
                ]} />
            </div>
          </>
        )
      }}
    </Marco>
  )
}

// =============================================================================
export function ReporteResultadosPagina() {
  const r = useReporte<ReporteResultados>('resultados', true)
  return (
    <Marco titulo="Estado de resultados" reporte="resultados" r={r} conMoneda={false}
           pie={<p className="nota pie-reporte">Simple y referencial: ventas sin IGV − costo de lo vendido − gastos anotados en «Compras y gastos». No reemplaza la contabilidad de tu contador (no incluye depreciación, impuesto a la renta ni ajustes).</p>}>
      {d => {
        const t = d.meses.reduce((a, m) => ({ ventas: a.ventas + m.ventas, costo: a.costo + m.costo, sin: a.sin + m.sinCosto, gastos: a.gastos + m.gastos }),
                                 { ventas: 0, costo: 0, sin: 0, gastos: 0 })
        const bruta = t.ventas - t.costo
        const resultado = bruta - t.gastos
        return (
          <>
            <div className="cifras-reporte">
              <Cifra titulo="Ventas (sin IGV)" valor={`S/ ${dinero(t.ventas)}`} />
              <Cifra titulo="Utilidad bruta" valor={`S/ ${dinero(bruta)}`} nota={pct(t.ventas, t.costo)} />
              <Cifra titulo="Gastos" valor={`S/ ${dinero(t.gastos)}`} />
              <Cifra titulo={resultado >= 0 ? 'Ganancia' : 'Pérdida'} valor={`S/ ${dinero(resultado)}`} />
            </div>
            {t.sin > 0 && (
              <Aviso tono="ojo">
                S/ {dinero(t.sin)} de ventas no tienen costo: la utilidad sale más alta de lo real. Escribe el costo en Productos
                (o activa el inventario) para que cuadre.
              </Aviso>
            )}
            {d.activadoEn && <p className="nota">El inventario se activó el {fecha(d.activadoEn)}: desde entonces el costo es el real de tus compras.</p>}

            <div className="bloque sin-relleno">
              <div className="tabla-envoltura">
                <table className="tabla tabla-resultados">
                  <thead><tr><th /> {d.meses.map(m => <th key={m.mes} className="derecha mono">{m.mes}</th>)}<th className="derecha">Total</th></tr></thead>
                  <tbody>
                    <tr><td>Ventas (sin IGV)</td>{d.meses.map(m => <td key={m.mes} className="derecha mono">{dinero(m.ventas)}</td>)}<td className="derecha mono"><strong>{dinero(t.ventas)}</strong></td></tr>
                    <tr><td>− Costo de lo vendido</td>{d.meses.map(m => <td key={m.mes} className="derecha mono">{dinero(m.costo)}</td>)}<td className="derecha mono">{dinero(t.costo)}</td></tr>
                    <tr className="fila-total"><td>Utilidad bruta</td>{d.meses.map(m => <td key={m.mes} className="derecha mono">{dinero(m.ventas - m.costo)}</td>)}<td className="derecha mono">{dinero(bruta)}</td></tr>
                    <tr><td>− Gastos</td>{d.meses.map(m => <td key={m.mes} className="derecha mono">{dinero(m.gastos)}</td>)}<td className="derecha mono">{dinero(t.gastos)}</td></tr>
                    <tr className="fila-total"><td>Resultado (ganancia o pérdida)</td>
                      {d.meses.map(m => { const x = m.ventas - m.costo - m.gastos; return <td key={m.mes} className={`derecha mono${x < 0 ? ' texto-mal' : ''}`}>{dinero(x)}</td> })}
                      <td className={`derecha mono${resultado < 0 ? ' texto-mal' : ''}`}><strong>{dinero(resultado)}</strong></td></tr>
                    {t.sin > 0 && <tr><td className="secundario">Ventas sin costo (incluidas arriba)</td>{d.meses.map(m => <td key={m.mes} className="derecha mono secundario">{m.sinCosto ? dinero(m.sinCosto) : ''}</td>)}<td className="derecha mono secundario">{dinero(t.sin)}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {d.gastos.length > 0 && (
              <div className="bloque">
                <h2 className="subtitulo">En qué se fueron los gastos</h2>
                <Barras cabeceras={['Categoría', 'Monto']} filas={d.gastos.map(g => ({ etiqueta: NOMBRE_CATEGORIA[g.categoria] ?? g.categoria, valor: g.monto }))} />
              </div>
            )}
          </>
        )
      }}
    </Marco>
  )
}

// =============================================================================
export function ReporteValorizadoPagina() {
  const r = useReporte<ReporteValorizado>('valorizado', false)
  return (
    <Marco titulo="Inventario valorizado" reporte="valorizado" r={r} conFechas={false} conMoneda={false}
           pie={<p className="nota pie-reporte">El stock físico de hoy por su costo unitario sin IGV: el promedio ponderado de tus compras (real) o, si no hay compras con costo, el escrito en el producto («≈»).</p>}>
      {d => {
        const total = d.filas.reduce((t, f) => t + (f.valor ?? 0), 0)
        const sin = d.filas.filter(f => f.fuente === 'sin').length
        return (
          <>
            <div className="cifras-reporte">
              <Cifra titulo="Valor del inventario" valor={`S/ ${dinero(total)}`} nota="sin IGV" />
              <Cifra titulo="Productos con stock" valor={d.filas.length} />
              <Cifra titulo="Sin costo" valor={sin} nota={sin ? 'no suman al valor' : undefined} />
            </div>
            <TablaDatos filas={d.filas} clave={(f, i) => `${f.id}-${i}`} ordenInicial={{ clave: 'valor', desc: true }} vacio="No hay stock."
              buscar={f => [f.producto, f.codigo, f.sucursal]} textoBuscar="Producto, código o sucursal"
              columnas={[
                { clave: 'producto', titulo: 'Producto', orden: f => f.producto, celda: f => <>{f.producto}<div className="secundario mono">{f.codigo}</div></> },
                { clave: 'suc', titulo: 'Sucursal', clase: 'secundario', celda: f => f.sucursal, orden: f => f.sucursal },
                { clave: 'stock', titulo: 'Stock', clase: 'derecha mono', celda: f => `${Number(f.fisico)} ${f.unidad}`, orden: f => f.fisico },
                { clave: 'costo', titulo: 'Costo unit.', clase: 'derecha mono', celda: f => f.costo == null ? '—' : dinero(f.costo), orden: f => f.costo },
                { clave: 'fuente', titulo: 'Costo', celda: f => <Chip f={f.fuente} />, orden: f => f.fuente },
                { clave: 'valor', titulo: 'Valor', clase: 'derecha mono', celda: f => f.valor == null ? '—' : dinero(f.valor), orden: f => f.valor },
              ]}
              pie={<tr className="fila-total"><td colSpan={5}>Total</td><td className="derecha mono">{dinero(total)}</td></tr>} />
          </>
        )
      }}
    </Marco>
  )
}