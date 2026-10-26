import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { InventarioApagado } from '../componentes/InventarioApagado'
import { useEstadoInventario } from '../componentes/usoInventario'
import { inventarioServicio, type FilaSerie } from '../servicios/inventarioServicio'
import '../inventario.css'

const ESTADO: Record<string, { texto: string; clase: string }> = {
  en_stock: { texto: 'En stock', clase: 'inv-bien' },
  vendida: { texto: 'Vendida', clase: '' },
  anulada: { texto: 'Anulada', clase: 'secundario' },
  en_transito: { texto: 'En camino (traslado)', clase: 'inv-bajo' },   // 068
  baja: { texto: 'De baja (no llegó)', clase: 'inv-mal' },          // 068
}
const dia = (iso: string) => new Date(iso).toLocaleDateString('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'short', year: 'numeric' })

/**
 * 065 — NÚMEROS DE SERIE: buscar uno (garantías): qué producto es, dónde está
 * y, si se vendió, en qué comprobante y a quién.
 */
export function Series() {
  const { estado, error: errorEstado } = useEstadoInventario()
  const [q, setQ] = useState('')
  const [filas, setFilas] = useState<FilaSerie[]>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!estado?.encendido) return
    let vivo = true
    const t = setTimeout(() => {
      inventarioServicio.series({ q })
        .then(r => { if (vivo) { setFilas(r); setError(undefined) } })
        .catch(e => { if (vivo) setError(e instanceof ErrorApi ? e.message : 'No se pudieron cargar los números de serie.') })
    }, 250)
    return () => { vivo = false; clearTimeout(t) }
  }, [estado, q])

  if (errorEstado) return <Aviso>{errorEstado}</Aviso>
  if (!estado) return <Cargando />
  if (!estado.encendido) return <InventarioApagado titulo="Números de serie" />

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">Números de serie</h1>
          <p className="secundario">
            De los productos que «Manejan números de serie». Entran con la compra y se eligen al vender. Busca uno para
            saber dónde está o a quién se vendió (garantías).
          </p>
        </div>
      </div>
      {error && <Aviso>{error}</Aviso>}
      <div className="filtros-lista">
        <label className="campo">
          <span className="solo-lector">Buscar</span>
          <input className="mono" value={q} onChange={e => setQ(e.target.value)} placeholder="Número de serie o producto…" autoFocus />
        </label>
      </div>
      <div className="bloque sin-relleno">
        {!filas ? <div className="relleno"><Cargando /></div> : filas.length === 0 ? (
          <div className="relleno"><Vacio>{q.trim() ? 'Ningún número de serie con eso.' : 'Todavía no hay números de serie.'}</Vacio></div>
        ) : (
          <table className="tabla">
            <thead><tr><th>Número</th><th>Producto</th><th>Estado</th><th>Dónde / a quién</th><th>Entró</th></tr></thead>
            <tbody>
              {filas.map(s => (
                <tr key={s.id}>
                  <td className="mono principal">{s.serie}</td>
                  <td>{s.descripcion}<div className="secundario mono">{s.codigo}</div></td>
                  <td className={ESTADO[s.estado]?.clase}><strong>{ESTADO[s.estado]?.texto ?? s.estado}</strong></td>
                  <td>
                    {s.estado === 'vendida' && s.documentoId
                      ? <><Link to={`/facturacion/comprobantes/${s.documentoId}`} className="mono">{s.documento}</Link><div className="secundario">{s.cliente}{s.vendidaEn ? ` · ${dia(s.vendidaEn)}` : ''}</div></>
                      : s.sucursal}
                  </td>
                  <td className="secundario">{dia(s.creadoEn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}