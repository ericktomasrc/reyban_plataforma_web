import { useEffect, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fechaYHora } from '../../../nucleo/formato/fechas'
import { auditoriaServicio } from '../servicios/auditoriaServicio'
import type { CambioDetalle } from '../tipos'

/**
 * El antes y el después de un cambio.
 *
 * LO QUE SE ENSEÑA POR DEFECTO SON LAS COLUMNAS QUE CAMBIARON, no la fila
 * entera. Una fila de `usuarios` tiene veintidós columnas y en un cambio de
 * nombre cambió una: enseñar las veintidós obliga a buscar la diferencia a
 * ojo, que es justo lo que la bitácora ya calculó.
 *
 * Los valores sensibles llegan tapados desde la base. Aquí no hay nada que
 * ocultar: lo que viene es `[oculto]`, y por eso se puede saber que alguien
 * cambió una contraseña sin poder saber cuál.
 */
export function DialogoCambio({ id, onCerrar }: { id: number; onCerrar: () => void }) {
  const [cambio, setCambio] = useState<CambioDetalle>()
  const [error, setError]   = useState<string>()
  const [todo, setTodo]     = useState(false)

  useEffect(() => {
    let vivo = true

    void (async () => {
      try {
        const d = await auditoriaServicio.detalle(id)
        if (vivo) setCambio(d)
      } catch (e) {
        if (vivo) setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar.')
      }
    })()

    return () => { vivo = false }
  }, [id])

  const antes   = parsear(cambio?.antes)
  const despues = parsear(cambio?.despues)

  // En un INSERT no hay antes, y en un DELETE no hay después: en los dos casos
  // interesa la fila entera, así que la lista de campos cambiados no aplica.
  const esUpdate = cambio?.operacion === 'U'

  const columnas = !cambio
    ? []
    : esUpdate && !todo && cambio.camposCambiados?.length
      ? cambio.camposCambiados
      : Array.from(new Set([...Object.keys(antes), ...Object.keys(despues)])).sort()

  return (
    <Dialogo
      titulo={cambio ? `${nombreOperacion(cambio.operacion)} en ${cambio.tabla}` : 'Cambio'}
      abierto
      onCerrar={onCerrar}
      acciones={<Boton onClick={onCerrar}>Cerrar</Boton>}
    >
      {error && <Aviso>{error}</Aviso>}
      {!cambio && !error && <Cargando texto="Cargando el cambio…" />}

      {cambio && (
        <>
          <dl className="datos">
            <div className="fila"><dt>Cuándo</dt><dd>{fechaYHora(cambio.ocurridoEn)}</dd></div>
            <div className="fila">
              <dt>Quién</dt>
              <dd>{cambio.usuario ?? <span className="vacio">El sistema</span>}</dd>
            </div>
            <div className="fila"><dt>Desde</dt><dd className="mono">{cambio.ip ?? '—'}</dd></div>
            <div className="fila"><dt>Fila</dt><dd className="mono">{cambio.filaId}</dd></div>
          </dl>

          {esUpdate && cambio.camposCambiados && cambio.camposCambiados.length > 0 && (
            <p className="nota">
              Cambiaron {cambio.camposCambiados.length}{' '}
              {cambio.camposCambiados.length === 1 ? 'columna' : 'columnas'}.{' '}
              <button type="button" className="enlace" onClick={() => setTodo(!todo)}>
                {todo ? 'Ver solo lo que cambió' : 'Ver la fila entera'}
              </button>
            </p>
          )}

          <table className="tabla diferencias">
            <thead>
              <tr>
                <th>Columna</th>
                <th>Antes</th>
                <th>Después</th>
              </tr>
            </thead>
            <tbody>
              {columnas.map(c => {
                const a = valor(antes[c])
                const d = valor(despues[c])

                return (
                  <tr key={c} className={a !== d ? 'cambiada' : undefined}>
                    <td className="mono">{c}</td>
                    <td className="mono">{a}</td>
                    <td className="mono">{d}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </Dialogo>
  )
}


function parsear(json: string | null | undefined): Record<string, unknown> {
  if (!json) return {}
  try {
    const v = JSON.parse(json)
    return v && typeof v === 'object' ? v as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

/** Un valor de JSON, en algo que se pueda leer en una celda. */
function valor(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'sí' : 'no'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function nombreOperacion(op: string): string {
  if (op === 'I') return 'Alta'
  if (op === 'U') return 'Cambio'
  if (op === 'D') return 'Borrado'
  return op
}
