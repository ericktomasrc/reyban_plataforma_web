import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { Paginacion } from '../../../componentes/Paginacion'
import { ErrorApi } from '../../../nucleo/api/errores'
import { Si } from '../../../nucleo/autorizacion/Protegido'
import { Permisos } from '../../../nucleo/autorizacion/permisos'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { DialogoProducto } from '../componentes/DialogoProducto'
import { productosServicio } from '../servicios/facturacionServicio'
import type { CatalogosSunat, ProductoEnLista } from '../tipos'
import { inventarioServicio, type Categoria } from '../../inventario/servicios/inventarioServicio'

/**
 * Lo que vende esta empresa.
 *
 * El stock no está aquí: es el módulo de inventario (052). De aquí sale si el
 * producto se cuenta («Controla stock») y su categoría.
 */
export function Productos() {
  const navegar = useNavigate()
  const { pedir, dialogo: confirmacion } = useConfirmar()
  const mensaje = useMensaje()

  const [q, setQ] = useState('')
  // 24 oct: filtros, orden y páginas.
  const [estado, setEstado] = useState('activos')
  const [unidad, setUnidad] = useState('')
  const [afectacion, setAfectacion] = useState('')
  const [orden, setOrden] = useState('recientes')
  // 052: categoría y «controla stock».
  const [categoria, setCategoria] = useState('')
  const [stock, setStock] = useState('')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [inventario, setInventario] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(20)
  const [total, setTotal] = useState(0)

  const [productos, setProductos] = useState<ProductoEnLista[]>()
  const [catalogos, setCatalogos] = useState<CatalogosSunat>()

  // ═══════════════════════════════════════════════════════════════════════════
  // UN ESTADO PROPIO PARA EL FALLO DE LOS CATÁLOGOS, y no «no hay catálogos».
  //
  // Antes el aviso salía con `!catalogos && !cargando`, usando el `cargando` de
  // la LISTA como si dijera algo de los catálogos. Son dos llamadas distintas y
  // llegan cuando les toca: en cuanto la lista contestaba, `cargando` se
  // apagaba, los catálogos seguían en camino, y el aviso de «no se pudieron
  // cargar» parpadeaba un instante antes de desaparecer solo.
  //
  // Un aviso que aparece y se va sin que nadie haya hecho nada es peor que no
  // tenerlo: enseña a no leerlos.
  // ═══════════════════════════════════════════════════════════════════════════
  const [catalogosFallaron, setCatalogosFallaron] = useState(false)
  const [cargando, setCargando] = useState(true)

  // EL FALLO DE CARGA SE QUEDA EN BANDA y no en ventana: si la lista no baja,
  // detrás de la ventana no hay nada que mirar, y hacer cerrar un aviso para
  // ver una pantalla vacía es trabajo por gusto. En ventana solo va lo que es
  // consecuencia de algo que se acaba de pulsar.
  const [errorCarga, setErrorCarga] = useState<string>()

  const [editando, setEditando] = useState<ProductoEnLista>()
  const [creando, setCreando] = useState(false)

  // Los catálogos de SUNAT, una sola vez. Vienen del back porque son los mismos
  // códigos que usa la línea de una factura: escritos dos veces, el día que
  // cambie uno el otro se queda atrás.
  useEffect(() => {
    let vivo = true
    void (async () => {
      try {
        const c = await productosServicio.catalogos()
        if (vivo) setCatalogos(c)
      } catch { if (vivo) setCatalogosFallaron(true) }
    })()
    inventarioServicio.categorias().then(c => { if (vivo) setCategorias(c) }).catch(() => { /* sin categorías */ })
    inventarioServicio.estado().then(e => { if (vivo) setInventario(e.encendido) }).catch(() => { /* sin inventario */ })
    return () => { vivo = false }
  }, [])

  async function cargar() {
    setCargando(true)
    try {
      const r = await productosServicio.pagina({ q, unidad, afectacion, estado, orden, pagina, porPagina, categoriaId: categoria, stock })
      setProductos(r.filas)
      setTotal(r.total)
      setErrorCarga(undefined)
    } catch (e) {
      setErrorCarga(e instanceof ErrorApi ? e.message : 'No se pudieron cargar los productos.')
    } finally {
      setCargando(false)
    }
  }

  const primeraCarga = useRef(true)

  // LA PRIMERA CARGA NO ESPERA. Los 300 ms son para no preguntarle al servidor
  // en cada tecla mientras se escribe; al entrar en la pantalla no hay nada que
  // esperar, y ese retraso era medio segundo de «Cargando…» en blanco cada vez
  // que alguien abría la pestaña. Se paga sin ganar nada.
  useEffect(() => {
    if (primeraCarga.current) {
      primeraCarga.current = false
      void cargar()
      return
    }

    const t = setTimeout(() => { void cargar() }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, estado, unidad, afectacion, orden, pagina, porPagina, categoria, stock])

  const nombreAfectacion = (codigo: string) =>
    catalogos?.afectaciones.find(a => a.codigo === codigo)?.nombre ?? codigo

  async function desactivar(p: ProductoEnLista) {
    const seguro = await pedir({
      titulo: `Desactivar ${p.codigo}`,
      confirmar: 'Desactivar',
      tono: 'peligro',
      mensaje: (
        <>
          <p>Dejará de salir al armar un comprobante.</p>
          <p>
            <strong>No se borra nada.</strong> Los comprobantes que ya lo
            incluyen siguen igual.
          </p>
        </>
      ),
    })
    if (!seguro) return

    try {
      const r = await productosServicio.desactivar(p.id)
      mensaje.bien(r.mensaje)
      await cargar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo desactivar.')
    }
  }

  async function reactivar(p: ProductoEnLista) {
    try {
      const r = await productosServicio.reactivar(p.id)
      mensaje.bien(r.mensaje)
      await cargar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo reactivar.')
    }
  }

  return (
    <>
      <div className="encabezado-pagina">
        {/* Sin pestañas desde el 12 de octubre: Comprobantes, Clientes y
            Productos están en el menú de la izquierda. */}
        <h1 className="titulo-pagina">Productos</h1>

        <Si puede={Permisos.Facturacion.ProductosGestionar}>
          <div className="botonera">
            {/* 22 oct: importar (o cambiar precios de golpe) desde Excel. */}
            <Boton estilo="secundario" onClick={() => navegar('/facturacion/productos/importar')}>
              Importar desde Excel
            </Boton>
            <Boton onClick={() => setCreando(true)} disabled={!catalogos}>
              Nuevo producto
            </Boton>
          </div>
        </Si>
      </div>

      <p className="bajada-pagina">
        Lo que vendes, con su precio y su afectación del IGV.
        {inventario ? ' Su stock está en Inventario › Stock.' : ''}
      </p>

      {errorCarga && <Aviso>{errorCarga}</Aviso>}

      {catalogosFallaron && (
        <Aviso tono="ojo">
          No se pudieron cargar los catálogos de SUNAT, así que no se puede dar
          de alta nada. Recarga la página.
        </Aviso>
      )}

      <div className="filtros">
        <label className="ancho">
          <span>Buscar</span>
          <input
            value={q}
            onChange={e => { setQ(e.target.value); setPagina(1) }}
            placeholder="Código o descripción"
            autoFocus
          />
        </label>

        {/* 24 oct: filtros y orden */}
        <label>
          <span>Unidad</span>
          <select value={unidad} onChange={e => { setUnidad(e.target.value); setPagina(1) }}>
            <option value="">Todas</option>
            {(catalogos?.unidades ?? []).map(u => <option key={u.codigo} value={u.codigo}>{u.nombre}</option>)}
          </select>
        </label>
        <label>
          <span>IGV</span>
          <select value={afectacion} onChange={e => { setAfectacion(e.target.value); setPagina(1) }}>
            <option value="">Todos</option>
            {(catalogos?.afectaciones ?? []).map(a => <option key={a.codigo} value={a.codigo}>{a.nombre}</option>)}
          </select>
        </label>
        <label>
          <span>Estado</span>
          <select value={estado} onChange={e => { setEstado(e.target.value); setPagina(1) }}>
            <option value="activos">Activos</option>
            <option value="inactivos">Desactivados</option>
            <option value="todos">Todos</option>
          </select>
        </label>
        {categorias.length > 0 && (
          <label>
            <span>Categoría</span>
            <select value={categoria} onChange={e => { setCategoria(e.target.value); setPagina(1) }}>
              <option value="">Todas</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
        )}
        {inventario && (
          <label>
            <span>Stock</span>
            <select value={stock} onChange={e => { setStock(e.target.value); setPagina(1) }}>
              <option value="">Todos</option>
              <option value="controla">Controlan stock</option>
              <option value="no_controla">No controlan</option>
            </select>
          </label>
        )}
        <label>
          <span>Orden</span>
          <select value={orden} onChange={e => { setOrden(e.target.value); setPagina(1) }}>
            <option value="recientes">Más recientes</option>
            <option value="az">A–Z</option>
          </select>
        </label>
      </div>

      <div className="bloque sin-relleno">
        {cargando && !productos ? (
          <div className="relleno"><Cargando /></div>
        ) : productos && productos.length > 0 ? (
          <table className="tabla">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Unidad</th>
                <th>Afectación</th>
                <th>Código SUNAT</th>
                <th className="derecha">Precio</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>

            <tbody>
              {productos.map(p => (
                <tr key={p.id} className={p.activo ? undefined : 'apagada'}>
                  <td>
                    <div className="principal">{p.descripcion}</div>
                    <div className="secundario mono">{p.codigo}</div>
                    {(p.categoria || (inventario && p.controlaStock === false && p.unidadMedida !== 'ZZ')) && (
                      <div className="secundario">
                        {p.categoria}
                        {inventario && p.controlaStock === false && p.unidadMedida !== 'ZZ' && <>{p.categoria ? ' · ' : ''}no controla stock</>}
                      </div>
                    )}
                  </td>

                  <td className="secundario">{p.unidadMedida}</td>

                  <td>
                    <span className={p.tipoAfectacion === '10' ? 'etiqueta' : 'etiqueta acento'}>
                      {nombreAfectacion(p.tipoAfectacion)}
                    </span>
                  </td>

                  {/* El código SUNAT con su nombre debajo: así se ve de un
                      vistazo si «50161509» de verdad es azúcar. */}
                  <td>
                    {p.codigoSunat ? (
                      <>
                        <div className="mono">{p.codigoSunat}</div>
                        <div className="secundario">
                          {p.codigoSunatNombre ?? 'No está en la lista de SUNAT'}
                        </div>
                      </>
                    ) : (
                      <span className="sin-codigo">—</span>
                    )}
                  </td>

                  <td className="derecha">
                    {/* Cuatro decimales, que es lo que se guarda y lo que viaja
                        al comprobante. Redondear a dos aquí haría que la
                        pantalla y la factura dijeran cosas distintas. */}
                    <div className="principal mono">{p.precioUnitario.toFixed(4)}</div>
                    <div className="secundario">{p.incluyeIgv ? 'con IGV' : 'sin IGV'}</div>
                  </td>

                  <td className="acciones">
                    <Si puede={Permisos.Facturacion.ProductosGestionar}>
                      {p.activo ? (
                        <>
                          <Boton
                            estilo="plano"
                            onClick={() => setEditando(p)}
                            disabled={!catalogos}
                          >
                            Editar
                          </Boton>
                          <Boton estilo="plano" onClick={() => void desactivar(p)}>
                            Desactivar
                          </Boton>
                        </>
                      ) : (
                        <Boton estilo="plano" onClick={() => void reactivar(p)}>
                          Reactivar
                        </Boton>
                      )}
                    </Si>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="relleno">
            <Vacio>
              {q || unidad || afectacion || categoria || stock || estado !== 'activos'
                ? 'Ningún producto cuadra con esos filtros.'
                : 'Todavía no tienes productos. Crea el primero para poder facturar.'}
            </Vacio>
          </div>
        )}
      </div>

      <Paginacion total={total} pagina={pagina} porPagina={porPagina}
                  onCambiar={setPagina} onPorPagina={n => { setPorPagina(n); setPagina(1) }} />

      {confirmacion}

      {creando && catalogos && (
        <DialogoProducto
          catalogos={catalogos}
          onCerrar={() => setCreando(false)}
          onGuardado={m => { setCreando(false); mensaje.bien(m); void cargar() }}
        />
      )}

      {editando && catalogos && (
        <DialogoProducto
          producto={editando}
          catalogos={catalogos}
          onCerrar={() => setEditando(undefined)}
          onGuardado={m => { setEditando(undefined); mensaje.bien(m); void cargar() }}
        />
      )}
    </>
  )
}