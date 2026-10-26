import { Pestanas } from '../../../componentes/Pestanas'
import { TablaDatos } from '../../../componentes/TablaDatos'
import { fechaYHora } from '../../../nucleo/formato/fechas'
import { usePestana } from '../../../nucleo/hooks/usePestana'
import { Barras, Cifra, dinero } from '../componentes/Graficos'
import { topYOtros } from '../componentes/topYOtros'
import type { ReportePos } from '../servicios/reportesServicio'
import { Marco, useReporte } from './Reportes'

/**
 * e178 — REPORTES DEL PUNTO DE VENTA (bloque 4). Seis vistas en pestañas:
 * cajeros, medios de pago, horas, diferencias de caja, retiros y gastos, y
 * lo más vendido en el mostrador. Al imprimir (o «PDF») salen todas; el Excel
 * trae una hoja por cada una.
 */

const MEDIO: Record<string, string> = { efectivo: 'Efectivo', yape: 'Yape / Plin', tarjeta: 'Tarjeta', transferencia: 'Transferencia' }
const VISTAS = ['cajeros', 'medios', 'horas', 'diferencias', 'movimientos', 'productos'] as const

export function ReportePosPagina() {
  const r = useReporte<ReportePos>('pos', true)
  const [ver, setVer] = usePestana(VISTAS, 'vista')
  return (
    <Marco titulo="Punto de venta" reporte="pos" r={r} conMoneda={false}
           pie={<p className="nota pie-reporte">Cuentan las ventas de caja cuyo comprobante está en camino o aceptado por SUNAT (igual que el arqueo). Montos en soles, con IGV. Las horas y los días son de Lima.</p>}>
      {d => {
        const cerradas = d.diferencias.filter(x => x.diferencia !== null)
        const neto = cerradas.reduce((t, x) => t + (x.diferencia ?? 0), 0)
        const clase = (v: (typeof VISTAS)[number]) => ver === v ? undefined : 'rd-oculta'
        return (
          <>
            <div className="cifras-reporte">
              <Cifra titulo="Vendido en caja" valor={`S/ ${dinero(d.total)}`} />
              <Cifra titulo="Ventas" valor={d.ventas} />
              <Cifra titulo="Ticket promedio" valor={`S/ ${dinero(d.ventas ? d.total / d.ventas : 0)}`} />
              <Cifra titulo="Diferencias de caja" valor={`${neto < 0 ? '−' : neto > 0 ? '+' : ''}S/ ${dinero(Math.abs(neto))}`}
                     nota={`${cerradas.filter(x => x.diferencia).length} de ${cerradas.length} cierres con diferencia`} />
            </div>

            <div className="solo-pantalla">
              <Pestanas etiqueta="Reportes del punto de venta" valor={ver} onCambio={setVer} opciones={[
                { valor: 'cajeros', texto: 'Cajeros' },
                { valor: 'medios', texto: 'Medios de pago' },
                { valor: 'horas', texto: 'Por hora' },
                { valor: 'diferencias', texto: 'Diferencias', cuenta: cerradas.filter(x => x.diferencia).length, aviso: neto < 0 },
                { valor: 'movimientos', texto: 'Retiros y gastos' },
                { valor: 'productos', texto: 'Lo más vendido' },
              ]} />
            </div>

            {/* --- Cajeros ------------------------------------------------------ */}
            <div className={clase('cajeros')}>
              <h2 className="subtitulo solo-impresion">Cajeros</h2>
              <div className="bloque">
                <h2 className="subtitulo">Cuánto vendió cada cajero</h2>
                <Barras cabeceras={['Cajero', 'Total']} filas={topYOtros(d.cajeros, c => `${c.cajero} · ${c.caja}`, c => c.total, c => `${c.ventas} ventas`)} />
              </div>
              <TablaDatos filas={d.cajeros} clave={(_, i) => i} ordenInicial={{ clave: 'total', desc: true }} vacio="Sin ventas de caja en este periodo."
                columnas={[
                  { clave: 'cajero', titulo: 'Cajero', celda: c => c.cajero, orden: c => c.cajero },
                  { clave: 'caja', titulo: 'Caja', clase: 'secundario', celda: c => c.caja, orden: c => c.caja },
                  { clave: 'turnos', titulo: 'Turnos', clase: 'derecha mono', celda: c => c.turnos, orden: c => c.turnos },
                  { clave: 'ventas', titulo: 'Ventas', clase: 'derecha mono', celda: c => c.ventas, orden: c => c.ventas },
                  { clave: 'total', titulo: 'Total', clase: 'derecha mono', celda: c => dinero(c.total), orden: c => c.total },
                  { clave: 'prom', titulo: 'Ticket promedio', clase: 'derecha mono', celda: c => dinero(c.promedio), orden: c => c.promedio },
                ]} />
            </div>

            {/* --- Medios de pago ----------------------------------------------- */}
            <div className={clase('medios')}>
              <h2 className="subtitulo solo-impresion">Medios de pago</h2>
              <div className="bloque">
                <h2 className="subtitulo">Cómo te pagaron</h2>
                <Barras cabeceras={['Medio', 'Monto']} filas={d.medios.map(m => ({ etiqueta: MEDIO[m.medio] ?? m.medio, valor: m.monto, nota: `${m.ventas} ventas` }))} />
              </div>
              <PorDia d={d} />
            </div>

            {/* --- Por hora ----------------------------------------------------- */}
            <div className={clase('horas')}>
              <h2 className="subtitulo solo-impresion">Por hora</h2>
              <div className="bloque">
                <h2 className="subtitulo">Las horas pico</h2>
                <Barras cabeceras={['Hora', 'Total']}
                        filas={d.horas.map(h => ({ etiqueta: `${String(h.hora).padStart(2, '0')}:00 – ${String(h.hora + 1).padStart(2, '0')}:00`, valor: h.total, nota: `${h.ventas} ventas` }))} />
                <p className="nota">Sirve para saber cuándo poner más gente en caja.</p>
              </div>
            </div>

            {/* --- Diferencias de caja ------------------------------------------ */}
            <div className={clase('diferencias')}>
              <h2 className="subtitulo solo-impresion">Diferencias de caja</h2>
              <PorCajero d={d} />
              <TablaDatos filas={d.diferencias} clave={x => x.id} ordenInicial={{ clave: 'cerrada', desc: true }} vacio="No se cerró ninguna caja en este periodo."
                columnas={[
                  { clave: 'cerrada', titulo: 'Cierre', clase: 'secundario', celda: x => fechaYHora(x.cerrada), orden: x => x.cerrada },
                  { clave: 'cajero', titulo: 'Cajero', celda: x => x.cajero, orden: x => x.cajero },
                  { clave: 'caja', titulo: 'Caja', clase: 'secundario', celda: x => x.caja },
                  { clave: 'esp', titulo: 'Esperado', clase: 'derecha mono', celda: x => x.esperado === null ? '—' : dinero(x.esperado), orden: x => x.esperado },
                  { clave: 'cont', titulo: 'Contado', clase: 'derecha mono', celda: x => x.contado === null ? '—' : dinero(x.contado), orden: x => x.contado },
                  { clave: 'dif', titulo: 'Diferencia', clase: 'derecha mono', orden: x => x.diferencia,
                    celda: x => <span className={x.diferencia ? (x.diferencia < 0 ? 'texto-mal' : 'texto-ojo') : 'texto-bien'}>{x.diferencia === null ? '—' : dinero(x.diferencia)}</span> },
                  { clave: 'obs', titulo: 'Observación', clase: 'secundario', celda: x => x.observacion ?? '' },
                ]} />
            </div>

            {/* --- Retiros y gastos --------------------------------------------- */}
            <div className={clase('movimientos')}>
              <h2 className="subtitulo solo-impresion">Retiros y gastos</h2>
              <div className="bloque">
                <h2 className="subtitulo">Retiros y gastos por motivo</h2>
                <Barras cabeceras={['Motivo', 'Monto']}
                        filas={topYOtros(d.movimientos.filter(m => m.tipo === 'retiro'), m => m.motivo, m => m.monto, m => `${m.veces} vez(ces)`)} />
              </div>
              <TablaDatos filas={d.movimientos} clave={(_, i) => i} ordenInicial={{ clave: 'monto', desc: true }} vacio="Ningún ingreso ni retiro en este periodo."
                buscar={m => [m.motivo]} textoBuscar="Motivo"
                columnas={[
                  { clave: 'tipo', titulo: 'Tipo', celda: m => m.tipo === 'retiro' ? 'Retiro' : 'Ingreso', orden: m => m.tipo },
                  { clave: 'motivo', titulo: 'Motivo', celda: m => m.motivo, orden: m => m.motivo },
                  { clave: 'veces', titulo: 'Veces', clase: 'derecha mono', celda: m => m.veces, orden: m => m.veces },
                  { clave: 'monto', titulo: 'Monto', clase: 'derecha mono', celda: m => <>{m.tipo === 'retiro' ? '−' : ''}{dinero(m.monto)}</>, orden: m => m.monto },
                ]} />
            </div>

            {/* --- Lo más vendido ----------------------------------------------- */}
            <div className={clase('productos')}>
              <h2 className="subtitulo solo-impresion">Lo más vendido en el mostrador</h2>
              <div className="bloque">
                <h2 className="subtitulo">Los 10 que más se vendieron en caja</h2>
                <Barras cabeceras={['Producto', 'Total']} filas={topYOtros(d.productos, p => p.producto, p => p.total, p => `${Number(p.cantidad)} ${p.unidad}`)} />
              </div>
              <TablaDatos filas={d.productos} clave={(_, i) => i} ordenInicial={{ clave: 'total', desc: true }} vacio="Sin ventas de caja en este periodo."
                buscar={p => [p.producto, p.codigo]} textoBuscar="Producto o código"
                columnas={[
                  { clave: 'producto', titulo: 'Producto', orden: p => p.producto,
                    celda: p => <>{p.producto}{p.codigo && <div className="secundario mono">{p.codigo}</div>}</> },
                  { clave: 'cant', titulo: 'Cantidad', clase: 'derecha mono', celda: p => `${Number(p.cantidad)} ${p.unidad}`, orden: p => p.cantidad },
                  { clave: 'ventas', titulo: 'Ventas', clase: 'derecha mono', celda: p => p.ventas, orden: p => p.ventas },
                  { clave: 'total', titulo: 'Total', clase: 'derecha mono', celda: p => dinero(p.total), orden: p => p.total },
                ]} />
            </div>
          </>
        )
      }}
    </Marco>
  )
}

/** Medios de pago por día: una fila por día, una columna por medio. */
function PorDia({ d }: { d: ReportePos }) {
  const medios = [...new Set(d.mediosPorDia.map(x => x.medio))]
  const dias = [...new Set(d.mediosPorDia.map(x => x.fecha))].sort()
  const filas = dias.map(f => ({ fecha: f, ...Object.fromEntries(medios.map(m => [m, d.mediosPorDia.find(x => x.fecha === f && x.medio === m)?.monto ?? 0])) })) as ({ fecha: string } & Record<string, number | string>)[]
  return (
    <TablaDatos filas={filas} clave={f => f.fecha} ordenInicial={{ clave: 'fecha', desc: true }} vacio="Sin ventas de caja en este periodo."
      columnas={[
        { clave: 'fecha', titulo: 'Día', clase: 'secundario', celda: f => new Date(f.fecha + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }), orden: f => f.fecha },
        ...medios.map(m => ({ clave: m, titulo: MEDIO[m] ?? m, clase: 'derecha mono', celda: (f: typeof filas[number]) => dinero(Number(f[m])), orden: (f: typeof filas[number]) => Number(f[m]) })),
        { clave: 'total', titulo: 'Total', clase: 'derecha mono', celda: f => dinero(medios.reduce((t, m) => t + Number(f[m]), 0)), orden: f => medios.reduce((t, m) => t + Number(f[m]), 0) },
      ]} />
  )
}

/** Faltantes y sobrantes acumulados por cajero. */
function PorCajero({ d }: { d: ReportePos }) {
  const m = new Map<string, { faltante: number; sobrante: number; cierres: number }>()
  for (const x of d.diferencias) {
    const a = m.get(x.cajero) ?? { faltante: 0, sobrante: 0, cierres: 0 }
    const dif = x.diferencia ?? 0
    m.set(x.cajero, { faltante: a.faltante + Math.min(0, dif), sobrante: a.sobrante + Math.max(0, dif), cierres: a.cierres + 1 })
  }
  const filas = [...m].map(([cajero, a]) => ({ cajero, ...a })).sort((a, b) => a.faltante - b.faltante)
  if (filas.length === 0) return null
  return (
    <div className="bloque">
      <h2 className="subtitulo">Por cajero</h2>
      <Barras cabeceras={['Cajero', 'Faltante']} filas={filas.filter(f => f.faltante < 0).map(f => ({ etiqueta: f.cajero, valor: f.faltante, nota: `${f.cierres} cierres` }))} />
      <p className="nota">
        {filas.map(f => `${f.cajero}: faltó S/ ${dinero(Math.abs(f.faltante))} y sobró S/ ${dinero(f.sobrante)} en ${f.cierres} cierre(s)`).join(' · ')}
      </p>
    </div>
  )
}