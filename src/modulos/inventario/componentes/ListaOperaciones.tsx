import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { FiltroFechas, FiltroSucursal } from '../../../componentes/FiltrosComunes'
import { Paginacion } from '../../../componentes/Paginacion'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { cantidad, inventarioServicio, PREFIJO_OPERACION, type FilaOperacion, type PaginaDe } from '../servicios/inventarioServicio'

const ESTADOS: Record<FilaOperacion['estado'], string> = {
  registrada: 'Registrado', anulada: 'Anulado', abierto: 'Abierto', cerrado: 'Cerrado',
}

/**
 * 052 — La lista de ingresos (o de ajustes, stocks iniciales y conteos), con
 * fechas, sucursal, buscador y páginas. Lo más nuevo arriba.
 */
export function ListaOperaciones({ tipo, recargar = 0 }: { tipo: 'ingreso' | 'ajuste'; recargar?: number }) {
  const navegar = useNavigate()
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [sucursal, setSucursal] = useState('')
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(20)
  const [datos, setDatos] = useState<PaginaDe<FilaOperacion>>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    let vivo = true
    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await inventarioServicio.operaciones({ tipo, q, estado, desde, hasta, sucursalId: sucursal, pagina, porPagina })
          if (vivo) { setDatos(r); setError(undefined) }
        } catch (e) {
          if (vivo) setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar la lista.')
        }
      })()
    }, 250)
    return () => { vivo = false; clearTimeout(t) }
  }, [tipo, q, estado, desde, hasta, sucursal, pagina, porPagina, recargar])

  return (
    <>
      {error && <Aviso>{error}</Aviso>}
      <div className="filtros-lista">
        <label>
          <span>Buscar</span>
          <input value={q} placeholder={tipo === 'ingreso' ? 'Proveedor, RUC o su factura' : 'Lo que explica el ajuste'}
                 onChange={e => { setQ(e.target.value); setPagina(1) }} />
        </label>
        <FiltroFechas desde={desde} hasta={hasta} onDesde={v => { setDesde(v); setPagina(1) }} onHasta={v => { setHasta(v); setPagina(1) }} />
        <FiltroSucursal valor={sucursal} onCambio={v => { setSucursal(v); setPagina(1) }} />
        <label>
          <span>Estado</span>
          <select value={estado} onChange={e => { setEstado(e.target.value); setPagina(1) }}>
            <option value="">Todos</option>
            <option value="registrada">Registrados</option>
            <option value="anulada">Anulados</option>
            {tipo === 'ajuste' && <option value="abierto">Conteos abiertos</option>}
          </select>
        </label>
      </div>

      <div className="bloque sin-relleno">
        {!datos ? (
          <div className="relleno"><Cargando /></div>
        ) : datos.filas.length === 0 ? (
          <div className="relleno"><Vacio>{tipo === 'ingreso' ? 'Todavía no hay ingresos con esos filtros.' : 'Todavía no hay ajustes con esos filtros.'}</Vacio></div>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Número</th><th>Fecha</th><th>Sucursal</th>
                <th>{tipo === 'ingreso' ? 'Proveedor · su factura' : 'Motivo'}</th>
                <th className="num">Productos</th>
                {tipo === 'ingreso' && <th className="num">Costo anotado</th>}
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {datos.filas.map(o => (
                <tr key={o.id} className="fila-clic" onClick={() => navegar(`/inventario/operaciones/${o.id}`)}>
                  <td>
                    <div className={`principal mono${o.estado === 'anulada' ? ' tachado' : ''}`}>{o.codigo}</div>
                    {tipo === 'ajuste' && <div className="secundario">{PREFIJO_OPERACION[o.tipo]}</div>}
                  </td>
                  <td>{fecha(o.fecha)}<div className="secundario">{o.usuario ?? ''}</div></td>
                  <td>{o.sucursal}</td>
                  <td>
                    {tipo === 'ingreso'
                      ? <>{o.proveedor ?? <span className="vacio">Sin proveedor</span>}{o.documentoProveedor && <div className="secundario mono">{o.documentoProveedor}</div>}</>
                      : <>{o.motivoNombre ?? (o.tipo === 'conteo' ? 'Conteo físico' : o.tipo === 'stock_inicial' ? 'Stock inicial' : '—')}
                          {o.nota && <div className="secundario">{o.nota}</div>}</>}
                  </td>
                  <td className="num">{o.lineas}<div className="secundario">{cantidad(o.unidades)} u.</div></td>
                  {tipo === 'ingreso' && <td className="num mono">{o.costo !== null ? `${o.moneda === 'USD' ? 'US$' : 'S/'} ${o.costo.toFixed(2)}` : '—'}</td>}
                  <td className={o.estado === 'anulada' ? 'inv-mal' : o.estado === 'abierto' ? 'inv-bajo' : 'inv-bien'}>{ESTADOS[o.estado]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {datos && (
        <Paginacion total={datos.total} pagina={datos.pagina} porPagina={datos.porPagina}
                    onCambiar={setPagina} onPorPagina={n => { setPorPagina(n); setPagina(1) }} />
      )}
    </>
  )
}