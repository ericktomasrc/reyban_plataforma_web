import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { inventarioServicio } from '../../inventario/servicios/inventarioServicio'
import { Cifra, dinero } from '../componentes/Graficos'
import { reportesServicio, type ReporteVentas } from '../servicios/reportesServicio'

/**
 * e176 — COMPARAR DOS PERIODOS. Lo mismo del Tablero de ventas, lado a lado:
 * cuánto se vendió, cuántos comprobantes, el promedio, las notas y el IGV, con
 * cuánto cambió.
 *
 * Atajos: este mes contra el pasado, contra el mismo mes del año pasado y, si
 * la empresa lleva inventario, «antes y después del inventario» (dos tramos
 * del mismo largo, partidos en el día en que se activó).
 */

interface Rango { desde: string; hasta: string }

const hoyLima = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
const dia = (iso: string, mas: number) => {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + mas); return d.toISOString().slice(0, 10)
}
const dias = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

function esteMes(hoy: string): Rango { return { desde: hoy.slice(0, 8) + '01', hasta: hoy } }
function mesPasado(hoy: string): Rango {
  const [a, m] = hoy.split('-').map(Number)
  const fin = new Date(Date.UTC(a, m - 1, 0))
  return { desde: new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), 1)).toISOString().slice(0, 10), hasta: fin.toISOString().slice(0, 10) }
}
function anioPasado(r: Rango): Rango {
  const menos = (s: string) => `${Number(s.slice(0, 4)) - 1}${s.slice(4)}`.replace(/-02-29$/, '-02-28')
  return { desde: menos(r.desde), hasta: menos(r.hasta) }
}

type Atajo = 'mes' | 'anio' | 'inventario' | 'otro'

export function CompararPeriodosPagina() {
  const hoy = hoyLima()
  const [atajo, setAtajo] = useState<Atajo>('mes')
  const [a, setA] = useState<Rango>(mesPasado(hoy))
  const [b, setB] = useState<Rango>(esteMes(hoy))
  const [moneda, setMoneda] = useState<'PEN' | 'USD'>('PEN')
  const [datos, setDatos] = useState<{ a: ReporteVentas; b: ReporteVentas }>()
  const [error, setError] = useState<string>()
  const [cargando, setCargando] = useState(true)
  const [inventarioDesde, setInventarioDesde] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    inventarioServicio.estado()
      .then(e => { if (vivo && e.encendido && e.contratado !== false && e.activadoEn) setInventarioDesde(e.activadoEn.slice(0, 10)) })
      .catch(() => { /* sin inventario */ })
    return () => { vivo = false }
  }, [])

  useEffect(() => {
    let vivo = true
    setCargando(true)
    Promise.all([
      reportesServicio.obtener<ReporteVentas>('ventas', { ...a, moneda }),
      reportesServicio.obtener<ReporteVentas>('ventas', { ...b, moneda }),
    ])
      .then(([x, y]) => { if (vivo) { setDatos({ a: x, b: y }); setError(undefined) } })
      .catch(e => { if (vivo) setError(e instanceof ErrorApi ? e.message : 'No se pudo comparar.') })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [a, b, moneda])

  function elegir(x: Atajo) {
    setAtajo(x)
    if (x === 'mes') { setA(mesPasado(hoy)); setB(esteMes(hoy)) }
    if (x === 'anio') { const e = esteMes(hoy); setA(anioPasado(e)); setB(e) }
    if (x === 'inventario' && inventarioDesde) {
      // Después: desde que se activó hasta hoy. Antes: los mismos días justo antes.
      const largo = Math.max(dias(inventarioDesde, hoy), 0)
      setB({ desde: inventarioDesde, hasta: hoy })
      setA({ desde: dia(inventarioDesde, -largo - 1), hasta: dia(inventarioDesde, -1) })
    }
  }

  const s = moneda === 'USD' ? 'US$' : 'S/'
  const nombreA = atajo === 'inventario' ? 'Antes del inventario' : 'Periodo A'
  const nombreB = atajo === 'inventario' ? 'Con inventario' : 'Periodo B'

  const filas: [string, (d: ReporteVentas) => number, boolean][] = [
    ['Vendido', d => d.kpis.total, true],
    ['Comprobantes', d => d.kpis.facturas + d.kpis.boletas, false],
    ['Facturas', d => d.kpis.facturas, false],
    ['Boletas', d => d.kpis.boletas, false],
    ['Venta promedio', d => d.kpis.promedio, true],
    ['Notas de crédito (monto)', d => d.kpis.montoNotas, true],
    ['Base gravada', d => d.igv.gravado, true],
    ['IGV', d => d.igv.igv, true],
  ]

  return (
    <div className="reporte">
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">Comparar periodos</h1>
          <p className="secundario">Lo del <Link to="/reportes/ventas">Tablero de ventas</Link>, de dos periodos lado a lado.</p>
        </div>
      </div>

      <div className="filtros filtros-reporte">
        <label>
          <span>Comparar</span>
          <select value={atajo} onChange={e => elegir(e.target.value as Atajo)}>
            <option value="mes">Este mes con el pasado</option>
            <option value="anio">Este mes con el mismo del año pasado</option>
            {inventarioDesde && <option value="inventario">Antes y después del inventario</option>}
            <option value="otro">Elegir fechas</option>
          </select>
        </label>
        <fieldset className="rango-comparar">
          <legend>{nombreA}</legend>
          <input type="date" value={a.desde} max={hoy} aria-label={`${nombreA}: desde`} onChange={e => { setAtajo('otro'); setA(x => ({ ...x, desde: e.target.value })) }} />
          <input type="date" value={a.hasta} max={hoy} aria-label={`${nombreA}: hasta`} onChange={e => { setAtajo('otro'); setA(x => ({ ...x, hasta: e.target.value })) }} />
        </fieldset>
        <fieldset className="rango-comparar">
          <legend>{nombreB}</legend>
          <input type="date" value={b.desde} max={hoy} aria-label={`${nombreB}: desde`} onChange={e => { setAtajo('otro'); setB(x => ({ ...x, desde: e.target.value })) }} />
          <input type="date" value={b.hasta} max={hoy} aria-label={`${nombreB}: hasta`} onChange={e => { setAtajo('otro'); setB(x => ({ ...x, hasta: e.target.value })) }} />
        </fieldset>
        <label>
          <span>Moneda</span>
          <select value={moneda} onChange={e => setMoneda(e.target.value as 'PEN' | 'USD')}>
            <option value="PEN">Soles</option>
            <option value="USD">Dólares</option>
          </select>
        </label>
      </div>

      {atajo === 'inventario' && inventarioDesde && (
        <p className="nota">
          El inventario se activó el <strong>{fecha(inventarioDesde)}</strong>. Se comparan los {dias(inventarioDesde, hoy) + 1} días
          desde entonces con los mismos días justo antes.
        </p>
      )}

      {error && <Aviso>{error}</Aviso>}
      {cargando && !datos ? <Cargando /> : datos && (() => {
        const va = datos.a.kpis.total, vb = datos.b.kpis.total
        const cambio = va !== 0 ? ((vb - va) / Math.abs(va)) * 100 : null
        return (
          <>
            <div className="cifras-reporte">
              <Cifra titulo={nombreA} valor={`${s} ${dinero(va)}`} nota={`${fecha(a.desde)} – ${fecha(a.hasta)}`} />
              <Cifra titulo={nombreB} valor={`${s} ${dinero(vb)}`} nota={`${fecha(b.desde)} – ${fecha(b.hasta)}`} />
              <Cifra titulo="Cambio" valor={cambio === null ? '—' : `${cambio >= 0 ? '+' : ''}${cambio.toFixed(1)} %`}
                     nota={`${vb - va >= 0 ? '+' : '−'}${s} ${dinero(Math.abs(vb - va))}`} />
            </div>
            <div className="bloque sin-relleno">
              <div className="tabla-envoltura">
                <table className="tabla tabla-comparar">
                  <thead><tr><th /><th className="derecha">{nombreA}</th><th className="derecha">{nombreB}</th>
                    <th className="derecha">Diferencia</th><th className="derecha">Cambio</th></tr></thead>
                  <tbody>
                    {filas.map(([nombre, v, plata]) => {
                      const x = v(datos.a), y = v(datos.b), dif = y - x
                      const pct = x !== 0 ? (dif / Math.abs(x)) * 100 : null
                      const f = (n: number) => plata ? dinero(n) : n.toLocaleString('es-PE')
                      return (
                        <tr key={nombre}>
                          <td>{nombre}</td>
                          <td className="derecha mono">{f(x)}</td><td className="derecha mono">{f(y)}</td>
                          <td className={`derecha mono${dif > 0 ? ' texto-bien' : dif < 0 ? ' texto-mal' : ''}`}>{dif > 0 ? '+' : dif < 0 ? '−' : ''}{f(Math.abs(dif))}</td>
                          <td className="derecha mono secundario">{pct === null ? '—' : `${pct >= 0 ? '+' : ''}${pct.toFixed(1)} %`}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="nota">
              Cuentan las facturas, boletas y notas de crédito en camino o aceptadas por SUNAT; las notas restan. Montos con IGV.
              {' '}En «Notas de crédito», que baje es bueno.
            </p>
          </>
        )
      })()}
    </div>
  )
}