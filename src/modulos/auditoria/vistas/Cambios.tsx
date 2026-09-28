import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fechaYHora } from '../../../nucleo/formato/fechas'
import { useYo } from '../../../nucleo/sesion/SesionContexto'
import { DialogoCambio } from '../componentes/DialogoCambio'
import { Paginacion } from '../componentes/Paginacion'
import { auditoriaServicio } from '../servicios/auditoriaServicio'
import type { Cambio, FiltroCambios, Pagina } from '../tipos'

/**
 * Qué cambió, quién y cuándo.
 *
 * LA MISMA PANTALLA SIRVE A LOS DOS NIVELES, y no hay ni un `if` que lo
 * decida: el administrador de una empresa ve lo suyo y el super administrador
 * ve todo, porque lo recorta la política de la base según quién pregunta.
 *
 * Esa es la diferencia entre este diseño y filtrar por empresa en la consulta:
 * aquí no hay forma de equivocarse.
 */
export function Cambios() {
  const { usuario } = useYo()

  const [filtro, setFiltro]   = useState<FiltroCambios>({ pagina: 1 })
  const [datos, setDatos]     = useState<Pagina<Cambio>>()
  const [tablas, setTablas]   = useState<string[]>([])
  const [error, setError]     = useState<string>()
  const [cargando, setCargando] = useState(true)
  const [viendo, setViendo]   = useState<number>()

  // Las tablas para el desplegable: una sola vez.
  useEffect(() => {
    let vivo = true
    void (async () => {
      try {
        const t = await auditoriaServicio.tablas()
        if (vivo) setTablas(t)
      } catch { /* el filtro se queda sin desplegable, no es grave */ }
    })()
    return () => { vivo = false }
  }, [])

  // Y los datos, cada vez que cambia un filtro.
  useEffect(() => {
    let vivo = true
    setCargando(true)

    void (async () => {
      try {
        const d = await auditoriaServicio.cambios(filtro)
        if (vivo) { setDatos(d); setError(undefined) }
      } catch (e) {
        if (vivo) setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar la bitácora.')
      } finally {
        if (vivo) setCargando(false)
      }
    })()

    return () => { vivo = false }
  }, [filtro])

  /** Cambiar un filtro vuelve siempre a la página 1. */
  const poner = (cambio: Partial<FiltroCambios>) =>
    setFiltro(f => ({ ...f, ...cambio, pagina: 1 }))

  return (
    <>
      <div className="encabezado-pagina">
        <h1 className="titulo-pagina">Auditoría</h1>
        <nav className="pestanas">
          <NavLink to="/auditoria" end className={({ isActive }) => isActive ? 'activa' : undefined}>
            Cambios
          </NavLink>
          <NavLink to="/auditoria/eventos" className={({ isActive }) => isActive ? 'activa' : undefined}>
            Seguridad
          </NavLink>
        </nav>
      </div>

      <p className="bajada-pagina">
        {usuario.esSuperAdmin
          ? 'Todo cambio de toda tabla, en todas las empresas. Los cambios sin empresa —migraciones, arranque, lo que haces tú— solo los ves aquí.'
          : 'Todo cambio de toda tabla de tu empresa. Lo escribe la base de datos sola, y no se puede modificar ni borrar.'}
      </p>

      {error && <Aviso>{error}</Aviso>}

      <div className="filtros">
        <label>
          <span>Tabla</span>
          <select value={filtro.tabla ?? ''} onChange={e => poner({ tabla: e.target.value || undefined })}>
            <option value="">Todas</option>
            {tablas.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>

        <label>
          <span>Operación</span>
          <select value={filtro.operacion ?? ''} onChange={e => poner({ operacion: e.target.value || undefined })}>
            <option value="">Todas</option>
            <option value="I">Altas</option>
            <option value="U">Cambios</option>
            <option value="D">Borrados</option>
          </select>
        </label>

        <label>
          <span>Desde</span>
          <input type="date" value={filtro.desde ?? ''} onChange={e => poner({ desde: e.target.value || undefined })} />
        </label>

        <label>
          <span>Hasta</span>
          <input type="date" value={filtro.hasta ?? ''} onChange={e => poner({ hasta: e.target.value || undefined })} />
        </label>

        {(filtro.tabla || filtro.operacion || filtro.desde || filtro.hasta) && (
          <button type="button" className="enlace" onClick={() => setFiltro({ pagina: 1 })}>
            Quitar filtros
          </button>
        )}
      </div>

      <div className="bloque sin-relleno">
        {cargando && !datos ? (
          <div className="relleno"><Cargando /></div>
        ) : datos && datos.filas.length > 0 ? (
          <table className="tabla">
            <thead>
              <tr>
                <th>Cuándo</th>
                <th>Qué</th>
                <th>Quién</th>
                <th>Columnas</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>

            <tbody>
              {datos.filas.map(c => (
                <tr key={c.id}>
                  <td className="secundario">{fechaYHora(c.ocurridoEn)}</td>

                  <td>
                    <div className="principal">
                      <span className={`operacion ${c.operacion}`}>{etiqueta(c.operacion)}</span>
                      {' '}{c.tabla}
                    </div>
                    <div className="secundario mono">{c.filaId}</div>
                  </td>

                  <td>
                    {c.usuario ?? <span className="vacio">El sistema</span>}
                    {c.ip && <div className="secundario mono">{c.ip}</div>}
                  </td>

                  <td>
                    {c.camposCambiados && c.camposCambiados.length > 0 ? (
                      <div className="etiquetas">
                        {c.camposCambiados.slice(0, 4).map(x => (
                          <span key={x} className="etiqueta">{x}</span>
                        ))}
                        {c.camposCambiados.length > 4 && (
                          <span className="etiqueta">+{c.camposCambiados.length - 4}</span>
                        )}
                      </div>
                    ) : (
                      <span className="vacio">—</span>
                    )}
                  </td>

                  <td className="acciones">
                    <button type="button" className="enlace" onClick={() => setViendo(c.id)}>
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="relleno">
            <Vacio>
              No hay cambios que cuadren con eso. Prueba a quitar filtros.
            </Vacio>
          </div>
        )}
      </div>

      {datos && (
        <Paginacion
          total={datos.total}
          pagina={datos.pagina}
          porPagina={datos.porPagina}
          onCambiar={p => setFiltro(f => ({ ...f, pagina: p }))}
        />
      )}

      {viendo !== undefined && (
        <DialogoCambio id={viendo} onCerrar={() => setViendo(undefined)} />
      )}
    </>
  )
}

function etiqueta(op: string): string {
  if (op === 'I') return 'Alta'
  if (op === 'U') return 'Cambio'
  if (op === 'D') return 'Borrado'
  return op
}
