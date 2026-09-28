import { Boton } from '../../../componentes/Boton'

/**
 * Anterior · «página N de M» · Siguiente.
 *
 * DELIBERADAMENTE SIN NÚMEROS DE PÁGINA. En una bitácora con medio millón de
 * filas, una fila de botones del 1 al 10.000 no sirve para nada: nadie va a la
 * página 3.472. Se navega filtrando, no paginando.
 */
export function Paginacion({ total, pagina, porPagina, onCambiar }: {
  total: number
  pagina: number
  porPagina: number
  onCambiar: (pagina: number) => void
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina))

  if (total === 0) return null

  const desde = (pagina - 1) * porPagina + 1
  const hasta = Math.min(pagina * porPagina, total)

  return (
    <div className="paginacion">
      <span className="cuenta">
        {desde}–{hasta} de {total.toLocaleString('es-PE')}
      </span>

      <div className="botones">
        <Boton
          estilo="secundario"
          disabled={pagina <= 1}
          onClick={() => onCambiar(pagina - 1)}
        >
          Anterior
        </Boton>

        <span className="donde">Página {pagina} de {paginas}</span>

        <Boton
          estilo="secundario"
          disabled={pagina >= paginas}
          onClick={() => onCambiar(pagina + 1)}
        >
          Siguiente
        </Boton>
      </div>
    </div>
  )
}
