import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { Paginacion } from '../../../componentes/Paginacion'
import { ErrorApi } from '../../../nucleo/api/errores'
import { Si } from '../../../nucleo/autorizacion/Protegido'
import { Permisos } from '../../../nucleo/autorizacion/permisos'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { useSesion } from '../../../nucleo/sesion/SesionContexto'
import { InventarioApagado } from '../componentes/InventarioApagado'
import {
  cantidad, inventarioServicio,
  type AlertaInventario, type Categoria, type EstadoInventario, type PaginaStock,
} from '../servicios/inventarioServicio'
import '../inventario.css'

/**
 * 052 — STOCK POR SUCURSAL (diseño aprobado el 24 oct).
 *
 * Cuánto hay en cada sucursal: disponible (lo que se puede vender) y físico,
 * lo reservado y lo que viene en camino. Solo los productos con «Controla
 * stock»; los servicios no se cuentan.
 */
export function Stock() {
  const navegar = useNavigate()
  const mensaje = useMensaje()
  const { puede } = useSesion()
  const [estado, setEstado] = useState<EstadoInventario>()
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [alertas, setAlertas] = useState<AlertaInventario[]>([])
  const [q, setQ] = useState('')
  const [sucursal, setSucursal] = useState('')
  const [categoria, setCategoria] = useState('')
  const [mostrar, setMostrar] = useState('')
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(20)
  const [datos, setDatos] = useState<PaginaStock>()
  const [error, setError] = useState<string>()
  const [cargando, setCargando] = useState(true)
  const [bajando, setBajando] = useState(false)
  const primera = useRef(true)

  useEffect(() => {
    let vivo = true
    void (async () => {
      try {
        const e = await inventarioServicio.estado()
        if (!vivo) return
        setEstado(e)
        if (e.encendido) {
          const [c, a] = await Promise.all([inventarioServicio.categorias(), inventarioServicio.alertas()])
          if (vivo) { setCategorias(c); setAlertas(a) }
        }
      } catch (err) {
        if (vivo) setError(err instanceof ErrorApi ? err.message : 'No se pudo leer el inventario.')
      }
    })()
    return () => { vivo = false }
  }, [])

  async function cargar() {
    setCargando(true)
    try {
      setDatos(await inventarioServicio.stock({ q, sucursalId: sucursal, categoriaId: categoria, mostrar, pagina, porPagina }))
      setError(undefined)
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar el stock.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    if (!estado?.encendido) return
    if (primera.current) { primera.current = false; void cargar(); return }
    const t = setTimeout(() => { void cargar() }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, q, sucursal, categoria, mostrar, pagina, porPagina])

  async function excel() {
    setBajando(true)
    try { await inventarioServicio.stockExcel({ q, sucursalId: sucursal, categoriaId: categoria, mostrar }) }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo bajar el Excel.') }
    finally { setBajando(false) }
  }

  if (estado && !estado.encendido) return <InventarioApagado titulo="Stock" />

  const columnas = datos?.sucursales ?? []
  const bajos = alertas.reduce((n, a) => n + a.bajoMinimo, 0)
  const negativos = alertas.reduce((n, a) => n + a.negativos, 0)

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">Stock</h1>
          <p className="secundario">Cuánto hay en cada sucursal. Solo los productos que tienen marcado «Controla stock»; los servicios no se cuentan.</p>
        </div>
        <div className="acciones-guia">
          {puede(Permisos.Inventario.Ajustar) && <Boton estilo="secundario" onClick={() => navegar('/inventario/ajustes')}>Ajuste</Boton>}
          {puede(Permisos.Guias.Emitir) && <Boton estilo="secundario" onClick={() => navegar('/guias/nueva?motivo=04')}>Trasladar</Boton>}
          <Si puede={Permisos.Inventario.Ingresar}>
            <Boton onClick={() => navegar('/inventario/ingresos/nuevo')}>Ingreso por compra</Boton>
          </Si>
        </div>
      </div>

      <div className="inv-leyenda">
        <div><small>Físico</small>Lo que hay en el almacén ahora</div>
        <div><small>Reservado</small>Facturado, espera su guía</div>
        <div className="clave"><small>Disponible = físico − reservado</small>Lo que se puede vender</div>
        <div><small>En tránsito</small>Salió de otra sucursal, aún no llega</div>
      </div>

      {estado && estado.sucursales.some(s => !s.controlaDesde) && (
        <Aviso tono="ojo">
          {estado.sucursales.every(s => !s.controlaDesde)
            ? <>Todavía <strong>no se controla</strong>: se anota todo, pero no se bloquea lo que no hay. </>
            : <>Algunas sucursales todavía <strong>no controlan</strong> (solo avisan). </>}
          <Link to="/inventario/configuracion">Ver cómo empezar a controlar</Link>
        </Aviso>
      )}

      {(bajos > 0 || negativos > 0) && (
        <Aviso tono="ojo">
          {bajos > 0 && <><strong>{bajos} producto(s) bajo el mínimo</strong> ({alertas.filter(a => a.bajoMinimo > 0).map(a => `${a.codigo} ${a.nombre}`).join(', ')}). </>}
          {negativos > 0 && <><strong>{negativos} en negativo</strong>: revísalos. </>}
          <button type="button" className="enlace" onClick={() => { setMostrar(bajos > 0 ? 'bajo_minimo' : 'negativo'); setPagina(1) }}>Ver solo esos</button>
        </Aviso>
      )}

      {error && <Aviso>{error}</Aviso>}

      <div className="filtros-lista">
        <label>
          <span>Buscar</span>
          <input value={q} placeholder="Código o nombre del producto" onChange={e => { setQ(e.target.value); setPagina(1) }} />
        </label>
        {(estado?.sucursales.length ?? 0) > 1 && (
          <label>
            <span>Sucursal</span>
            <select value={sucursal} onChange={e => { setSucursal(e.target.value); setPagina(1) }}>
              <option value="">Todas (en columnas)</option>
              {(datos?.sucursales ?? estado?.sucursales ?? []).map(s => <option key={s.id} value={s.id}>{s.codigo} {s.nombre}</option>)}
            </select>
          </label>
        )}
        {categorias.length > 0 && (
          <label>
            <span>Categoría</span>
            <select value={categoria} onChange={e => { setCategoria(e.target.value); setPagina(1) }}>
              <option value="">Todas</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
        )}
        <label>
          <span>Mostrar</span>
          <select value={mostrar} onChange={e => { setMostrar(e.target.value); setPagina(1) }}>
            <option value="">Todos</option>
            <option value="bajo_minimo">Bajo el mínimo</option>
            <option value="sin_stock">Sin stock</option>
            <option value="negativo">En negativo</option>
          </select>
        </label>
        <Boton estilo="secundario" onClick={() => void excel()} ocupado={bajando} textoOcupado="Bajando…">Descargar Excel</Boton>
      </div>

      <div className="bloque sin-relleno">
        {cargando && !datos ? (
          <div className="relleno"><Cargando /></div>
        ) : datos && datos.filas.length > 0 ? (
          <table className="tabla">
            <thead>
              <tr>
                <th>Producto</th>
                {columnas.map(s => (
                  <th key={s.id} className="num">{s.codigo} {s.nombre}<div className="secundario">disp. · físico</div></th>
                ))}
                <th className="num">En tránsito</th>
                {columnas.length > 1 && <th className="num">Total disp.</th>}
                <th />
              </tr>
            </thead>
            <tbody>
              {datos.filas.map(f => (
                <tr key={f.productoId}>
                  <td>
                    <div className="principal">{f.descripcion}</div>
                    <div className="secundario"><span className="mono">{f.codigo}</span> · {f.unidad}{f.categoria && <> · {f.categoria}</>}</div>
                  </td>
                  {f.sucursales.map(s => (
                    <td key={s.sucursalId} className={`num${s.fisico < 0 ? ' inv-mal' : s.disponible <= 0 ? ' inv-mal' : s.bajoMinimo ? ' inv-bajo' : ''}`}>
                      <span className="mono"><strong>{cantidad(s.disponible)}</strong> · {cantidad(s.fisico)}</span>
                      {s.reservado > 0 && <div className="secundario inv-reservado">{cantidad(s.reservado)} reservadas</div>}
                      {s.fisico < 0 ? <div className="secundario">En negativo: revisar</div>
                        : s.disponible <= 0 ? <div className="secundario">Sin stock</div>
                        : s.bajoMinimo ? <div className="secundario">▼ mínimo {cantidad(s.minimo)}</div> : null}
                    </td>
                  ))}
                  <td className="num mono">{f.transito > 0 ? cantidad(f.transito) : <span className="vacio">—</span>}</td>
                  {columnas.length > 1 && <td className="num mono"><strong>{cantidad(f.totalDisponible)}</strong></td>}
                  <td><Link to={`/inventario/kardex/${f.productoId}`}>Kardex</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="relleno">
            <Vacio>
              {q || categoria || mostrar ? 'Ningún producto cuadra con eso.'
                : 'Todavía no hay productos con «Controla stock». Márcalo en cada producto o en Inventario › Configuración.'}
            </Vacio>
          </div>
        )}
      </div>

      {datos && (
        <Paginacion total={datos.total} pagina={datos.pagina} porPagina={datos.porPagina}
                    onCambiar={setPagina} onPorPagina={n => { setPorPagina(n); setPagina(1) }} />
      )}

      <p className="nota se-aplica">
        Se aplica: el negativo solo aparece si la empresa activó «Permitir vender sin stock». Las cantidades admiten decimales
        para lo que se vende por peso o medida.
      </p>
    </>
  )
}