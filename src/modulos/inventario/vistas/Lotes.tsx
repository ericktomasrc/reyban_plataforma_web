import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { InventarioApagado } from '../componentes/InventarioApagado'
import { useEstadoInventario } from '../componentes/usoInventario'
import { cantidad, inventarioServicio, type PaginaLotes } from '../servicios/inventarioServicio'
import '../inventario.css'

const fecha = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * 064 — LOTES Y VENCIMIENTOS (inventario ampliado D4). Solo los productos con
 * «Maneja lotes». Entra al lote de la compra; sale primero lo que vence antes
 * (la base lo hace sola). Aquí se ve qué hay de cada lote y qué vence pronto.
 */
export function Lotes() {
  const { estado, error: errorEstado } = useEstadoInventario()
  const [dias, setDias] = useState<number | null>(30)
  const [q, setQ] = useState('')
  const [datos, setDatos] = useState<PaginaLotes>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!estado?.encendido) return
    let vivo = true
    const t = setTimeout(() => {
      inventarioServicio.lotes({ dias, q })
        .then(r => { if (vivo) { setDatos(r); setError(undefined) } })
        .catch(e => { if (vivo) setError(e instanceof ErrorApi ? e.message : 'No se pudieron cargar los lotes.') })
    }, 200)
    return () => { vivo = false; clearTimeout(t) }
  }, [estado, dias, q])

  if (errorEstado) return <Aviso>{errorEstado}</Aviso>
  if (!estado) return <Cargando />
  if (!estado.encendido) return <InventarioApagado titulo="Lotes y vencimientos" />

  const chip = (d: number | null, texto: string) => (
    <button type="button" className={`chip${dias === d ? ' elegido' : ''}`} onClick={() => setDias(d)}>{texto}</button>
  )

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">Lotes y vencimientos</h1>
          <p className="secundario">
            De los productos que «Manejan lotes» (se marca en el producto). La compra entra a su lote; al vender, sale
            primero lo que vence antes, sin que tengas que elegir.
          </p>
        </div>
      </div>

      {datos && datos.vencidos > 0 && (
        <Aviso>{datos.vencidos === 1 ? 'Hay 1 lote vencido con stock.' : `Hay ${datos.vencidos} lotes vencidos con stock.`} Sácalos con un ajuste «Vencido» en <Link to="/inventario/ajustes">Ajustes y conteos</Link>.</Aviso>
      )}
      {error && <Aviso>{error}</Aviso>}

      <div className="filtros-guias">
        <div className="chips">
          {chip(0, 'Vencidos')}
          {chip(30, 'Vencen en 30 días')}
          {chip(90, 'En 90 días')}
          {chip(null, 'Todos con stock')}
        </div>
      </div>
      <div className="filtros-lista">
        <label className="campo">
          <span className="solo-lector">Buscar</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Producto, código o lote…" />
        </label>
      </div>

      <div className="bloque sin-relleno">
        {!datos ? (
          <div className="relleno"><Cargando /></div>
        ) : datos.filas.length === 0 ? (
          <div className="relleno"><Vacio>{dias === null ? 'Ningún lote con stock.' : 'Nada vence en ese plazo.'}</Vacio></div>
        ) : (
          <table className="tabla">
            <thead><tr><th>Producto</th><th>Lote</th><th>Vence</th><th>Sucursal</th><th className="num">Cantidad</th></tr></thead>
            <tbody>
              {datos.filas.map(f => (
                <tr key={`${f.productoId}-${f.sucursalId}-${f.lote}`}>
                  <td>
                    <Link to={`/inventario/kardex/${f.productoId}`} className="principal">{f.descripcion}</Link>
                    <div className="secundario mono">{f.codigo}</div>
                  </td>
                  <td className="mono">{f.lote || <span className="secundario">sin lote</span>}</td>
                  <td className={f.dias == null ? '' : f.dias < 0 ? 'inv-mal' : f.dias <= 30 ? 'inv-bajo' : ''}>
                    {f.vence ? fecha(f.vence) : '—'}
                    {f.dias != null && <div className="secundario">{f.dias < 0 ? `venció hace ${-f.dias} día${f.dias === -1 ? '' : 's'}` : f.dias === 0 ? 'vence hoy' : `en ${f.dias} día${f.dias === 1 ? '' : 's'}`}</div>}
                  </td>
                  <td>{f.sucursal}</td>
                  <td className={`num mono${f.fisico < 0 ? ' inv-mal' : ''}`}>{cantidad(f.fisico)} {f.unidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}