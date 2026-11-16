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
import '../../facturacion/comprobantes-lista.css'

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
  // Diseño 16 nov: cuántos hay en «Todos» (se recuerda al filtrar por la franja).
  const [totalTodos, setTotalTodos] = useState<number>()
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
      const r = await inventarioServicio.stock({ q, sucursalId: sucursal, categoriaId: categoria, mostrar, pagina, porPagina })
      setDatos(r)
      if (!mostrar) setTotalTodos(r.total)
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
    <div className="inv-pagina">
      <div className="encabezado-pagina cmp-encab">
        <div>
          <h1 className="titulo-pagina">Stock{totalTodos !== undefined && !q && !categoria && <span className="lst-cuenta">{totalTodos} {totalTodos === 1 ? 'producto' : 'productos'}</span>}</h1>
          <p className="bajada-pagina">Cuánto hay para vender en cada sucursal. Solo los productos con «Controla stock».</p>
        </div>
        <div className="acciones-guia">
          {puede(Permisos.Inventario.Ajustar) && <Boton estilo="secundario" onClick={() => navegar('/inventario/ajustes')}>Ajuste</Boton>}
          {puede(Permisos.Guias.Emitir) && <Boton estilo="secundario" onClick={() => navegar('/guias/nueva?motivo=04')}>Trasladar</Boton>}
          <Si puede={Permisos.Inventario.Ingresar}>
            <Boton onClick={() => navegar('/inventario/ingresos/nuevo')}>Ingreso por compra</Boton>
          </Si>
        </div>
      </div>

      {/* Diseño 16 nov: en lugar de las 4 tarjetas de definiciones, una franja que filtra
          (el mismo filtro «Mostrar» de antes). Las definiciones van en una línea al pie. */}
      <div className="cmp-mes inv-franja" role="group" aria-label="Mostrar">
        <button type="button" className={`cmp-mes-dato${mostrar === '' ? ' elegido' : ''}`} onClick={() => { setMostrar(''); setPagina(1) }}>
          <span>Todos</span><strong>{totalTodos ?? '—'}</strong><small>con «Controla stock»</small>
        </button>
        <button type="button" className={`cmp-mes-dato ojo${mostrar === 'bajo_minimo' ? ' elegido' : ''}`} onClick={() => { setMostrar('bajo_minimo'); setPagina(1) }}>
          <span>Bajo el mínimo</span><strong>{bajos}</strong>
          <small title={alertas.filter(a => a.bajoMinimo > 0).map(a => `${a.codigo} ${a.nombre}`).join(', ')}>
            {bajos > 0 ? alertas.filter(a => a.bajoMinimo > 0).map(a => a.nombre).join(', ') : 'ninguno'}
          </small>
        </button>
        <button type="button" className={`cmp-mes-dato mal${mostrar === 'sin_stock' ? ' elegido' : ''}`} onClick={() => { setMostrar('sin_stock'); setPagina(1) }}>
          <span>Sin stock</span><strong>{mostrar === 'sin_stock' && datos ? datos.total : 'Ver'}</strong><small>no se pueden vender</small>
        </button>
        <button type="button" className={`cmp-mes-dato mal${mostrar === 'negativo' ? ' elegido' : ''}`} onClick={() => { setMostrar('negativo'); setPagina(1) }}>
          <span>En negativo</span><strong>{negativos}</strong><small>{negativos > 0 ? 'revisar' : 'ninguno'}</small>
        </button>
      </div>

      {estado && estado.sucursales.some(s => !s.controlaDesde) && (
        <Aviso tono="ojo">
          {estado.sucursales.every(s => !s.controlaDesde)
            ? <>Todavía <strong>no se controla</strong>: se anota todo, pero no se bloquea lo que no hay. </>
            : <>Algunas sucursales todavía <strong>no controlan</strong> (solo avisan). </>}
          <Link to="/inventario/configuracion">Ver cómo empezar a controlar</Link>
        </Aviso>
      )}


      {error && <Aviso>{error}</Aviso>}

      <div className="filtros-lista">
        <label className="inv-buscar">
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
                  <th key={s.id} className="num">{s.codigo} {s.nombre}</th>
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
                    <div className="secundario">{f.codigo} · {f.unidad}{f.categoria && <> · <span className="inv-cat">{f.categoria}</span></>}</div>
                  </td>
                  {f.sucursales.map(s => (
                    <td key={s.sucursalId} className={`num${s.fisico < 0 ? ' inv-mal' : s.disponible <= 0 ? ' inv-mal' : s.bajoMinimo ? ' inv-bajo' : ''}`}>
                      {/* Diseño 16 nov: lo disponible grande; el físico y lo reservado, chico debajo. */}
                      <strong className="inv-disp">{cantidad(s.disponible)}</strong>
                      {(s.reservado > 0 || s.fisico !== s.disponible) && (
                        <div className="secundario">{cantidad(s.fisico)} físico{s.reservado > 0 && <> · <span className="inv-reservado">{cantidad(s.reservado)} reservadas</span></>}</div>
                      )}
                      {s.fisico < 0 ? <div className="secundario">En negativo: revisar</div>
                        : s.disponible <= 0 ? <div className="secundario">Sin stock</div>
                        : s.bajoMinimo ? <div className="secundario">▼ mínimo {cantidad(s.minimo)}</div> : null}
                    </td>
                  ))}
                  <td className="num">{f.transito > 0 ? cantidad(f.transito) : <span className="vacio">—</span>}</td>
                  {columnas.length > 1 && <td className="num"><strong className="inv-disp">{cantidad(f.totalDisponible)}</strong></td>}
                  <td className="lst-acciones"><Link className="inv-enlace" to={`/inventario/kardex/${f.productoId}`}>Kardex</Link></td>
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

      <p className="inv-leyenda-linea">
        <span><b>Disponible</b> = físico − reservado: lo que se puede vender</span>
        <span><b>Reservado</b>: facturado, espera su guía</span>
        <span><b>En tránsito</b>: salió de otra sucursal, aún no llega</span>
      </p>

      {datos && (
        <Paginacion total={datos.total} pagina={datos.pagina} porPagina={datos.porPagina}
                    onCambiar={setPagina} onPorPagina={n => { setPorPagina(n); setPagina(1) }} />
      )}

      <p className="nota se-aplica">
        Se aplica: el negativo solo aparece si la empresa activó «Permitir vender sin stock». Las cantidades admiten decimales
        para lo que se vende por peso o medida.
      </p>
    </div>
  )
}