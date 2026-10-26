import { TablaDatos } from '../../../componentes/TablaDatos'
import { fecha } from '../../../nucleo/formato/fechas'
import { NOMBRE_CATEGORIA, NOMBRE_TIPO } from '../../compras/comprasServicio'
import { Barras, Cifra, dinero } from '../componentes/Graficos'
import { ResumenDetalle } from '../componentes/ResumenDetalle'
import { topYOtros } from '../componentes/topYOtros'
import type { ReporteCompras } from '../servicios/reportesServicio'
import { Marco, useReporte } from './Reportes'

/**
 * e178 (059) — COMPRAS Y GASTOS. Resumen: cuánto se compró y gastó, por
 * proveedor, por categoría y por mes. Detalle: el Registro de Compras. El
 * Excel trae el registro (para el contador) y los tres resúmenes.
 */
export function ReporteComprasPagina() {
  const r = useReporte<ReporteCompras>('compras', true)
  return (
    <Marco titulo="Compras y gastos" reporte="compras" r={r} conMoneda={false} horizontal busqueda={{ texto: 'Proveedor, RUC o descripción' }}
           pie={<p className="nota pie-reporte">Montos en soles: lo comprado en dólares va con su tipo de cambio. No cuentan las anuladas. El IGV es el de las facturas (el que se puede usar como crédito fiscal, si cumple los requisitos: lo confirma tu contador).</p>}>
      {d => (
        <ResumenDetalle filas={d.registro.length}
          resumen={<>
            <div className="cifras-reporte">
              <Cifra titulo="Compras" valor={`S/ ${dinero(d.compras)}`} />
              <Cifra titulo="Gastos" valor={`S/ ${dinero(d.gastos)}`} />
              <Cifra titulo="Total" valor={`S/ ${dinero(d.compras + d.gastos)}`} nota={`${d.registro.length} comprobante(s)`} />
              <Cifra titulo="IGV de facturas" valor={`S/ ${dinero(d.igv)}`} />
            </div>
            <div className="dos-reporte">
              <div className="bloque">
                <h2 className="subtitulo">A quién le compraste más</h2>
                <Barras cabeceras={['Proveedor', 'Total']} filas={topYOtros(d.porProveedor, p => p.proveedor, p => p.total, p => `${p.comprobantes} comp.`)} />
              </div>
              <div className="bloque">
                <h2 className="subtitulo">En qué se fue</h2>
                <Barras cabeceras={['Categoría', 'Total']}
                        filas={d.porCategoria.map(c => ({ etiqueta: NOMBRE_CATEGORIA[c.categoria] ?? c.categoria, valor: c.total, nota: c.clase === 'gasto' ? 'gasto' : 'compra' }))} />
              </div>
            </div>
            <div className="bloque sin-relleno">
              <div className="tabla-envoltura">
                <table className="tabla">
                  <thead><tr><th>Mes</th><th className="derecha">Compras</th><th className="derecha">Gastos</th><th className="derecha">IGV de facturas</th></tr></thead>
                  <tbody>
                    {d.porMes.length === 0 && <tr><td colSpan={4} className="vacio">Nada anotado en este periodo.</td></tr>}
                    {d.porMes.map(m => (
                      <tr key={m.mes}><td className="mono">{m.mes}</td><td className="derecha mono">{dinero(m.compras ?? 0)}</td>
                        <td className="derecha mono">{dinero(m.gastos ?? 0)}</td><td className="derecha mono">{dinero(m.igv ?? 0)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>}
          detalle={
            <div className="tabla-ancha">
              <TablaDatos filas={d.registro} clave={f => f.id} ordenInicial={{ clave: 'fecha', desc: false }} vacio="Nada anotado en este periodo."
                columnas={[
                  { clave: 'fecha', titulo: 'Fecha', clase: 'secundario', celda: f => fecha(f.fecha), orden: f => f.fecha },
                  { clave: 'comp', titulo: 'Comprobante', orden: f => `${f.serie}-${f.numero}`,
                    celda: f => f.tipo === '00' ? <span className="secundario">Sin comprobante</span>
                      : <><span className="mono">{f.serie}-{f.numero}</span><div className="secundario">{NOMBRE_TIPO[f.tipo] ?? f.tipo}</div></> },
                  { clave: 'prov', titulo: 'Proveedor', orden: f => f.proveedor,
                    celda: f => <>{f.proveedor ?? '—'}{f.documento && <div className="secundario mono">{f.documento}</div>}{f.descripcion && <div className="secundario">{f.descripcion}</div>}</> },
                  { clave: 'cat', titulo: 'Categoría', clase: 'secundario', celda: f => NOMBRE_CATEGORIA[f.categoria] ?? f.categoria, orden: f => f.categoria },
                  { clave: 'base', titulo: 'Base', clase: 'derecha mono', celda: f => dinero(f.base), orden: f => f.base },
                  { clave: 'igv', titulo: 'IGV', clase: 'derecha mono', celda: f => dinero(f.igv), orden: f => f.igv },
                  { clave: 'ng', titulo: 'No gravado', clase: 'derecha mono', celda: f => dinero(f.noGravado), orden: f => f.noGravado },
                  { clave: 'total', titulo: 'Total', clase: 'derecha mono', celda: f => dinero(f.total), orden: f => f.total },
                ]}
                pie={d.registro.length > 0 && (
                  <tr className="fila-total"><td colSpan={4}>Total ({d.registro.length})</td>
                    <td className="derecha mono">{dinero(d.registro.reduce((t, f) => t + f.base, 0))}</td>
                    <td className="derecha mono">{dinero(d.registro.reduce((t, f) => t + f.igv, 0))}</td>
                    <td className="derecha mono">{dinero(d.registro.reduce((t, f) => t + f.noGravado, 0))}</td>
                    <td className="derecha mono">{dinero(d.registro.reduce((t, f) => t + f.total, 0))}</td></tr>
                )} />
            </div>
          } />
      )}
    </Marco>
  )
}