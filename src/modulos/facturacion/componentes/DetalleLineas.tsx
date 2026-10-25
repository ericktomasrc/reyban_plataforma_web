import { useState } from 'react'
import { Boton } from '../../../componentes/Boton'
import { Dialogo } from '../../../componentes/Dialogo'
import { Paginacion } from '../../../componentes/Paginacion'

/**
 * e163 — LAS LÍNEAS DE UN COMPROBANTE: buscar, de 10 en 10, y el «ojito».
 *
 * Una factura de cuarenta líneas no cabe a la vista. En la pantalla se ven de
 * diez en diez y se busca entre ellas; el ojo de arriba abre TODAS en una
 * ventana, para revisarlas de corrido sin paginar.
 *
 * Sirve para el comprobante que se está armando (solo lectura en la ventana)
 * y para el emitido.
 */

export const LINEAS_POR_PAGINA = 10

export interface FilaDetalle {
  numero: number
  codigo: string | null
  descripcion: string
  cantidad: number
  unidad: string
  valorUnitario: number
  descuento: number
  /** Valor de venta: sin IGV. */
  valorVenta: number
  igv: number
  total: number
  afectacion?: string
}

const n2 = (x: number) => x.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const cant = (x: number) => x.toLocaleString('es-PE', { maximumFractionDigits: 4 })

/** Buscar por descripción o código, sin distinguir mayúsculas. */
export function filtrarLineas<T extends { descripcion: string; codigo: string | null }>(lista: T[], q: string): T[] {
  const t = q.trim().toLocaleLowerCase('es')
  if (!t) return lista
  return lista.filter(x => x.descripcion.toLocaleLowerCase('es').includes(t) || (x.codigo ?? '').toLocaleLowerCase('es').includes(t))
}

/** El botón del ojo (arriba de la grilla) y la ventana con todas las líneas. */
export function VerTodasLasLineas({ filas, moneda }: { filas: FilaDetalle[]; moneda: string }) {
  const [abierto, setAbierto] = useState(false)
  const [q, setQ] = useState('')
  const visibles = filtrarLineas(filas, q)
  const suma = (k: 'valorVenta' | 'igv' | 'total') => visibles.reduce((s, f) => s + f[k], 0)

  return (
    <>
      <button type="button" className="ojo-lineas" onClick={() => setAbierto(true)} disabled={filas.length === 0}
              title="Ver todas las líneas" aria-label="Ver todas las líneas">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="1.8" d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
        <span>Ver todo ({filas.length})</span>
      </button>

      <Dialogo titulo={`Todas las líneas (${filas.length})`} abierto={abierto} onCerrar={() => setAbierto(false)} ancho="grande"
               acciones={<Boton onClick={() => setAbierto(false)}>Cerrar</Boton>}>
        <div className="detalle-lineas">
          <input className="detalle-lineas-buscar" value={q} onChange={e => setQ(e.target.value)}
                 placeholder="Buscar por descripción o código…" aria-label="Buscar entre las líneas" />
          <div className="detalle-lineas-tabla">
            <table className="tabla">
              <thead>
                <tr>
                  <th>#</th><th>Descripción</th><th className="derecha">Cantidad</th>
                  <th className="derecha">V. unitario</th><th className="derecha">Desc.</th>
                  <th className="derecha">Valor venta</th><th className="derecha">IGV</th><th className="derecha">Total</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(f => (
                  <tr key={f.numero}>
                    <td className="secundario">{f.numero}</td>
                    <td>
                      <div className="principal">{f.descripcion || '(sin descripción)'}</div>
                      <div className="secundario">{[f.codigo, f.afectacion].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="derecha mono">{cant(f.cantidad)} {f.unidad}</td>
                    <td className="derecha mono">{f.valorUnitario.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</td>
                    <td className="derecha mono">{f.descuento ? n2(f.descuento) : '—'}</td>
                    <td className="derecha mono">{n2(f.valorVenta)}</td>
                    <td className="derecha mono">{n2(f.igv)}</td>
                    <td className="derecha mono"><strong>{n2(f.total)}</strong></td>
                  </tr>
                ))}
                {visibles.length === 0 && (
                  <tr><td colSpan={8} className="vacio">Ninguna línea con «{q.trim()}».</td></tr>
                )}
              </tbody>
              {visibles.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={5}>{q.trim() ? `${visibles.length} de ${filas.length} líneas` : `${filas.length} líneas`}</td>
                    <td className="derecha mono">{n2(suma('valorVenta'))}</td>
                    <td className="derecha mono">{n2(suma('igv'))}</td>
                    <td className="derecha mono"><strong>{moneda} {n2(suma('total'))}</strong></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </Dialogo>
    </>
  )
}

/** La grilla del comprobante emitido: buscar, de 10 en 10 y el ojo. */
export function LineasEmitidas({ filas, moneda }: { filas: FilaDetalle[]; moneda: string }) {
  const [q, setQ] = useState('')
  const [pagina, setPagina] = useState(1)
  const filtradas = filtrarLineas(filas, q)
  const paginas = Math.max(1, Math.ceil(filtradas.length / LINEAS_POR_PAGINA))
  const real = Math.min(pagina, paginas)
  const visibles = filtradas.slice((real - 1) * LINEAS_POR_PAGINA, real * LINEAS_POR_PAGINA)

  return (
    <div className="bloque sin-relleno lineas-emitidas">
      <div className="lineas-barra">
        <strong>{filas.length} {filas.length === 1 ? 'línea' : 'líneas'}</strong>
        <input value={q} onChange={e => { setQ(e.target.value); setPagina(1) }}
               placeholder="Buscar en las líneas…" aria-label="Buscar en las líneas" />
        <VerTodasLasLineas filas={filas} moneda={moneda} />
      </div>
      <table className="tabla">
        <thead>
          <tr>
            <th>#</th>
            <th>Descripción</th>
            <th className="derecha">Cantidad</th>
            <th className="derecha">Valor unitario</th>
            <th className="derecha">Importe</th>
          </tr>
        </thead>
        <tbody>
          {visibles.map(f => (
            <tr key={f.numero}>
              <td className="secundario">{f.numero}</td>
              <td>
                <div className="principal">{f.descripcion}</div>
                {f.codigo && <div className="secundario mono">{f.codigo}</div>}
              </td>
              <td className="derecha mono">{cant(f.cantidad)} {f.unidad}</td>
              <td className="derecha mono">{f.valorUnitario.toFixed(4)}</td>
              <td className="derecha mono">{n2(f.valorVenta)}</td>
            </tr>
          ))}
          {visibles.length === 0 && (
            <tr><td colSpan={5} className="vacio">Ninguna línea con «{q.trim()}».</td></tr>
          )}
        </tbody>
      </table>
      {filtradas.length > LINEAS_POR_PAGINA && (
        <div className="lineas-pie">
          <Paginacion total={filtradas.length} pagina={real} porPagina={LINEAS_POR_PAGINA} onCambiar={setPagina} />
        </div>
      )}
    </div>
  )
}