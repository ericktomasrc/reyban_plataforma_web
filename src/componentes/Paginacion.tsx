import { Boton } from './Boton'

/**
 * 24 OCT — EL PAGINADOR DE TODAS LAS LISTAS: «1–20 de 134» · Anterior ·
 * «Página 1 de 7» · Siguiente · y cuántas por página (20, 50 o 100).
 *
 * SIN NÚMEROS DE PÁGINA, a propósito (como el de la bitácora): nadie va a la
 * página 3.472. Para llegar a algo se filtra, no se pagina.
 */
const OPCIONES_POR_PAGINA = [20, 50, 100] as const

export function Paginacion({ total, pagina, porPagina, onCambiar, onPorPagina }: {
  total: number
  pagina: number
  porPagina: number
  onCambiar: (pagina: number) => void
  /** Si se pasa, aparece «Ver 20 / 50 / 100». */
  onPorPagina?: (n: number) => void
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina))

  if (total === 0) return null

  const desde = (pagina - 1) * porPagina + 1
  const hasta = Math.min(pagina * porPagina, total)

  return (
    <div className="paginacion">
      <span className="cuenta">
        {desde}–{hasta} de {total.toLocaleString('es-PE')}
        {onPorPagina && (
          <>
            {' · '}
            <label className="por-pagina">
              Ver{' '}
              <select value={porPagina} onChange={e => onPorPagina(Number(e.target.value))} aria-label="Filas por página">
                {OPCIONES_POR_PAGINA.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </>
        )}
      </span>

      {paginas > 1 && (
        <div className="botones">
          <Boton estilo="secundario" disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)}>Anterior</Boton>
          <span className="donde">Página {pagina} de {paginas}</span>
          <Boton estilo="secundario" disabled={pagina >= paginas} onClick={() => onCambiar(pagina + 1)}>Siguiente</Boton>
        </div>
      )}
    </div>
  )
}