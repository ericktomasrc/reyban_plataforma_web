import { useMemo, useState, type ReactNode } from 'react'
import { contiene, usePaginaLocal } from '../nucleo/hooks/usePaginaLocal'
import { Paginacion } from './Paginacion'

/**
 * e175 — LA TABLA DE LAS LISTAS QUE YA ESTÁN EN PANTALLA: de 20 en 20 (o 50 /
 * 100), con búsqueda y orden por columna. Pensada para que una lista de 500
 * filas no haga eterna la página.
 *
 * Trabaja con lo que ya se cargó (no vuelve a la API). Para listas que pueden
 * ser de miles, la API pagina y se usa <Paginacion> directamente.
 */
export interface Columna<T> {
  /** Única; también la clave del orden. */
  clave: string
  titulo: ReactNode
  celda: (f: T) => ReactNode
  /** Si se da, la columna se puede ordenar con un clic en el título. */
  orden?: (f: T) => string | number | null | undefined
  /** «derecha» para números. */
  clase?: string
}

export function TablaDatos<T>({
  filas, columnas, clave, buscar, textoBuscar = 'Buscar…', vacio = 'No hay nada que mostrar.',
  ordenInicial, onFila, pie, porPagina = 20, barra, sinRelleno = true,
}: {
  filas: T[]
  columnas: Columna<T>[]
  /** La clave de React de cada fila. */
  clave: (f: T, i: number) => string | number
  /** Los textos en los que busca (si no se da, no hay buscador). */
  buscar?: (f: T) => (string | null | undefined)[]
  textoBuscar?: string
  vacio?: ReactNode
  /** Columna y sentido de partida: { clave: 'total', desc: true }. */
  ordenInicial?: { clave: string; desc?: boolean }
  onFila?: (f: T) => void
  /** Una fila de total, siempre al final (no se pagina). */
  pie?: ReactNode
  porPagina?: number
  /** Algo más en la barra, a la derecha del buscador (filtros, botones). */
  barra?: ReactNode
  sinRelleno?: boolean
}) {
  const [q, setQ] = useState('')
  const [orden, setOrden] = useState(ordenInicial ?? null)

  const ordenadas = useMemo(() => {
    const filtradas = buscar && q.trim() ? filas.filter(f => contiene(q, ...buscar(f))) : filas
    const col = orden && columnas.find(c => c.clave === orden.clave)
    if (!col?.orden) return filtradas
    const v = col.orden
    const signo = orden?.desc ? -1 : 1
    return [...filtradas].sort((a, b) => {
      const x = v(a), y = v(b)
      if (x == null && y == null) return 0
      if (x == null) return 1
      if (y == null) return -1
      return (typeof x === 'number' && typeof y === 'number'
        ? x - y
        : String(x).localeCompare(String(y), 'es', { numeric: true, sensitivity: 'base' })) * signo
    })
  }, [filas, q, orden, columnas, buscar])

  const { visibles, paginacion } = usePaginaLocal(ordenadas, `${q}|${orden?.clave}|${orden?.desc}`, porPagina)

  const partida = ordenadas.length > visibles.length

  function ordenar(c: Columna<T>) {
    if (!c.orden) return
    // Números: primero de mayor a menor (lo que se busca casi siempre).
    const primero = filas.length > 0 && typeof c.orden(filas[0]) === 'number'
    setOrden(o => o?.clave === c.clave ? { clave: c.clave, desc: !o.desc } : { clave: c.clave, desc: primero })
  }

  return (
    <div className="tabla-datos">
      {(buscar || barra) && (
        <div className="filtros-lista">
          {buscar && (
            <label className="buscar">
              <span>Buscar</span>
              <input type="search" value={q} placeholder={textoBuscar} aria-label={textoBuscar}
                     onChange={e => setQ(e.target.value)} />
            </label>
          )}
          {barra}
        </div>
      )}
      <div className={`bloque${sinRelleno ? ' sin-relleno' : ''}`}>
        <div className="tabla-envoltura">
          <table className={`tabla${onFila ? ' tabla-clic' : ''}${partida ? ' paginada' : ''}`}>
            <thead>
              <tr>
                {columnas.map(c => {
                  const activa = orden?.clave === c.clave
                  return (
                    <th key={c.clave} className={[c.clase?.includes('derecha') ? 'derecha' : '', c.orden ? 'ordenable' : ''].filter(Boolean).join(' ') || undefined}
                        aria-sort={activa ? (orden?.desc ? 'descending' : 'ascending') : undefined}>
                      {c.orden ? (
                        <button type="button" className="th-orden" onClick={() => ordenar(c)}>
                          {c.titulo}<span className="flecha" aria-hidden>{activa ? (orden?.desc ? '↓' : '↑') : '↕'}</span>
                        </button>
                      ) : c.titulo}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="tbody-pantalla">
              {visibles.map((f, i) => (
                <tr key={clave(f, i)} onClick={onFila ? () => onFila(f) : undefined}>
                  {columnas.map(c => <td key={c.clave} className={c.clase}>{c.celda(f)}</td>)}
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr><td colSpan={columnas.length} className="vacio">
                  {q.trim() ? <>Nada con «{q.trim()}».</> : vacio}
                </td></tr>
              )}
              {pie}
            </tbody>
            {/* Al imprimir (o «PDF»), todas las filas, no solo la página. */}
            {partida && (
              <tbody className="tbody-impresion">
                {ordenadas.map((f, i) => (
                  <tr key={clave(f, i)}>{columnas.map(c => <td key={c.clave} className={c.clase}>{c.celda(f)}</td>)}</tr>
                ))}
                {pie}
              </tbody>
            )}
          </table>
        </div>
        {paginacion.total > 0 && (
          <div className="lineas-pie"><Paginacion {...paginacion} /></div>
        )}
      </div>
    </div>
  )
}