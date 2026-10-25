import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
import { Paginacion } from '../../../componentes/Paginacion'
import { ErrorApi } from '../../../nucleo/api/errores'
import { Permisos } from '../../../nucleo/autorizacion/permisos'
import { fecha } from '../../../nucleo/formato/fechas'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { useSesion } from '../../../nucleo/sesion/SesionContexto'
import { consultasServicio } from '../../facturacion/servicios/facturacionServicio'
import { useEstadoInventario } from '../componentes/usoInventario'
import { inventarioServicio, type Categoria, type PaginaDe, type Proveedor } from '../servicios/inventarioServicio'
import '../inventario.css'

type Pestana = 'proveedores' | 'categorias' | 'motivos'
const PESTANAS: [Pestana, string][] = [['proveedores', 'Proveedores'], ['categorias', 'Categorías de producto'], ['motivos', 'Motivos de ajuste']]

/**
 * 052 — LAS MAESTRAS DEL INVENTARIO: proveedores (a quién le compras),
 * categorías de producto (para filtrar) y los motivos de ajuste (lista fija).
 * Nada se borra: se desactiva.
 *
 * e161: EN PESTAÑAS. Con 50 categorías en una columna al lado, los motivos de
 * ajuste quedaban al fondo de la página. Cada maestra tiene ahora su pestaña,
 * con su buscador y su paginación; la pestaña va en la dirección (?ver=…) para
 * poder enlazarla y volver con «Atrás».
 */
export function Proveedores() {
  const [params, setParams] = useSearchParams()
  const ver: Pestana = (PESTANAS.find(([v]) => v === params.get('ver'))?.[0]) ?? 'proveedores'
  const { estado } = useEstadoInventario()

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">Proveedores y categorías</h1>
          <p className="secundario">Las listas que usa el inventario: a quién le compras, cómo agrupas tus productos y por qué se ajusta el stock.</p>
        </div>
      </div>

      <div className="segmentado" role="tablist" aria-label="Maestras del inventario">
        {PESTANAS.map(([v, t]) => (
          <button key={v} type="button" role="tab" aria-selected={ver === v} className={ver === v ? 'elegido' : undefined}
                  onClick={() => setParams(v === 'proveedores' ? {} : { ver: v }, { replace: true })}>
            {t}
          </button>
        ))}
      </div>

      {ver === 'proveedores' && <ListaProveedores />}
      {ver === 'categorias' && <Categorias />}
      {ver === 'motivos' && (
        <div className="bloque">
          <h2 className="subtitulo">Motivos de ajuste</h2>
          <p className="parrafo secundario">Lista fija, igual para todas las empresas, para que los reportes salgan ordenados. Se eligen en «Ajustes y conteos».</p>
          <table className="tabla">
            <thead><tr><th>Motivo</th><th>Qué hace con el stock</th></tr></thead>
            <tbody>
              {(estado?.motivosAjuste ?? []).map(m => (
                <tr key={m.codigo}>
                  <td>{m.nombre}</td>
                  <td className={m.signo < 0 ? 'inv-mal' : m.signo > 0 ? 'inv-bien' : 'secundario'}>
                    {m.signo < 0 ? '− Sale (baja el stock)' : m.signo > 0 ? '+ Entra (sube el stock)' : 'Entra o sale, según lo que escribas'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="nota se-aplica">Se aplica: el conteo físico y los faltantes de traslado usan sus propios motivos («Diferencia de conteo», «Faltante en traslado»).</p>
        </div>
      )}
    </>
  )
}

function ListaProveedores() {
  const { puede } = useSesion()
  const mensaje = useMensaje()
  const [q, setQ] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(20)
  const [datos, setDatos] = useState<PaginaDe<Proveedor>>()
  const [error, setError] = useState<string>()
  const [editando, setEditando] = useState<Proveedor | 'nuevo'>()
  const [recargar, setRecargar] = useState(0)
  const puedeEditar = puede(Permisos.Inventario.Ingresar)

  useEffect(() => {
    let vivo = true
    const t = setTimeout(() => {
      inventarioServicio.proveedores({ q, estado: filtroEstado, pagina, porPagina })
        .then(r => { if (vivo) { setDatos(r); setError(undefined) } })
        .catch(e => { if (vivo) setError(e instanceof ErrorApi ? e.message : 'No se pudieron cargar los proveedores.') })
    }, 250)
    return () => { vivo = false; clearTimeout(t) }
  }, [q, filtroEstado, pagina, porPagina, recargar])

  async function activar(p: Proveedor, activo: boolean) {
    try {
      const r = await inventarioServicio.activarProveedor(p.id, activo)
      mensaje.bien(r.mensaje); setRecargar(n => n + 1)
    } catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo cambiar.') }
  }

  return (
    <>
      {error && <Aviso>{error}</Aviso>}
      <div className="inv-barra">
        <div className="filtros-lista">
          <label><span>Buscar</span><input value={q} placeholder="RUC o razón social" onChange={e => { setQ(e.target.value); setPagina(1) }} /></label>
          <label>
            <span>Estado</span>
            <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPagina(1) }}>
              <option value="">Activos</option><option value="inactivos">Inactivos</option><option value="todos">Todos</option>
            </select>
          </label>
        </div>
        {puedeEditar && <Boton onClick={() => setEditando('nuevo')}>Nuevo proveedor</Boton>}
      </div>
      <div className="bloque sin-relleno">
        {!datos ? <div className="relleno"><Cargando /></div> : datos.filas.length === 0 ? (
          <div className="relleno"><Vacio>{q ? 'Ningún proveedor con eso.' : 'Todavía no hay proveedores. También se guardan solos al registrar un ingreso con un RUC nuevo.'}</Vacio></div>
        ) : (
          <table className="tabla">
            <thead><tr><th>Proveedor</th><th>Contacto</th><th>Última compra</th><th /></tr></thead>
            <tbody>
              {datos.filas.map(p => (
                <tr key={p.id} className={p.activo === false ? 'inactivo' : undefined}>
                  <td><div className="principal">{p.razonSocial}</div><div className="secundario mono">{p.numeroDocumento}</div></td>
                  <td>{p.correo ?? <span className="vacio">—</span>}{p.telefono && <div className="secundario">{p.telefono}</div>}</td>
                  <td>{p.ultimaCompra ? fecha(p.ultimaCompra) : <span className="vacio">—</span>}</td>
                  <td className="acciones">
                    {puedeEditar && <>
                      <Boton estilo="plano" onClick={() => setEditando(p)}>Editar</Boton>
                      <Boton estilo="plano" onClick={() => void activar(p, p.activo === false)}>{p.activo === false ? 'Reactivar' : 'Desactivar'}</Boton>
                    </>}
                  </td>
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

      {editando && (
        <DialogoProveedor proveedor={editando === 'nuevo' ? undefined : editando} onCerrar={() => setEditando(undefined)}
                          onHecho={m => { mensaje.bien(m); setEditando(undefined); setRecargar(n => n + 1) }} />
      )}
    </>
  )
}

function DialogoProveedor({ proveedor, onCerrar, onHecho }: { proveedor?: Proveedor; onCerrar: () => void; onHecho: (m: string) => void }) {
  const mensaje = useMensaje()
  const [tipo, setTipo] = useState(proveedor?.tipoDocumento ?? '6')
  const [numero, setNumero] = useState(proveedor?.numeroDocumento ?? '')
  const [razon, setRazon] = useState(proveedor?.razonSocial ?? '')
  const [direccion, setDireccion] = useState(proveedor?.direccion ?? '')
  const [correo, setCorreo] = useState(proveedor?.correo ?? '')
  const [telefono, setTelefono] = useState(proveedor?.telefono ?? '')
  const [ocupado, setOcupado] = useState(false)
  const [consultado, setConsultado] = useState<string>()

  useEffect(() => {
    if (proveedor || tipo !== '6' || !/^(10|15|17|20)\d{9}$/.test(numero)) return
    let vivo = true
    consultasServicio.ruc(numero)
      .then(f => {
        if (!vivo) return
        if (f.razonSocial) { setRazon(f.razonSocial); setConsultado('✓ Razón social y dirección traídas de SUNAT') }
        if (f.direccion) setDireccion(f.direccion)
      })
      .catch(() => { if (vivo) setConsultado('No se pudo consultar: escríbela a mano.') })
    return () => { vivo = false }
  }, [numero, tipo, proveedor])

  async function guardar() {
    setOcupado(true)
    const d = { tipoDocumento: tipo, numeroDocumento: numero.trim(), razonSocial: razon.trim(), direccion: direccion.trim() || null, correo: correo.trim() || null, telefono: telefono.trim() || null }
    try {
      const r = proveedor ? await inventarioServicio.editarProveedor(proveedor.id, d) : await inventarioServicio.crearProveedor(d)
      onHecho(r.mensaje)
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo guardar el proveedor.')
    } finally { setOcupado(false) }
  }

  return (
    <Dialogo titulo={proveedor ? 'Editar proveedor' : 'Nuevo proveedor'} abierto onCerrar={onCerrar}
      acciones={<>
        <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={() => void guardar()} ocupado={ocupado} disabled={!numero.trim() || !razon.trim()}>Guardar</Boton>
      </>}>
      <div className="pareja">
        <label className="campo">
          <span className="etiqueta">Documento</span>
          <select value={tipo} onChange={e => setTipo(e.target.value)} disabled={!!proveedor}>
            <option value="6">RUC</option><option value="1">DNI</option><option value="4">Carné de extranjería</option><option value="7">Pasaporte</option><option value="0">Otro</option>
          </select>
        </label>
        <label className="campo">
          <span className="etiqueta">Número</span>
          <input className="mono" value={numero} maxLength={15} disabled={!!proveedor} onChange={e => setNumero(e.target.value.toUpperCase().trim())} />
          {consultado && <span className="pista">{consultado}</span>}
        </label>
      </div>
      <label className="campo"><span className="etiqueta">Razón social</span><input value={razon} maxLength={200} onChange={e => setRazon(e.target.value)} /></label>
      <label className="campo"><span className="etiqueta">Dirección (opcional)</span><input value={direccion} maxLength={250} onChange={e => setDireccion(e.target.value)} /></label>
      <div className="pareja">
        <label className="campo"><span className="etiqueta">Correo (opcional)</span><input type="email" value={correo} maxLength={150} onChange={e => setCorreo(e.target.value)} /></label>
        <label className="campo"><span className="etiqueta">Teléfono (opcional)</span><input value={telefono} maxLength={30} onChange={e => setTelefono(e.target.value)} /></label>
      </div>
      <p className="nota se-aplica">Se aplica: también se crea solo al registrar un ingreso con un RUC nuevo. No se borra; se desactiva.</p>
    </Dialogo>
  )
}

/**
 * Las categorías de producto: crear, renombrar, desactivar y reactivar.
 *
 * e161: EN TABLA, CON BUSCADOR Y PÁGINAS. Llegan todas de una vez (son decenas,
 * no miles) y se filtran y paginan aquí.
 */
export function Categorias() {
  const { puede } = useSesion()
  const mensaje = useMensaje()
  const [lista, setLista] = useState<Categoria[]>()
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<'activas' | 'inactivas' | 'todas'>('activas')
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(20)
  const [nombre, setNombre] = useState('')
  const [renombrando, setRenombrando] = useState<{ id: string; nombre: string }>()
  const [recargar, setRecargar] = useState(0)
  const [ocupado, setOcupado] = useState(false)
  const puedeEditar = puede(Permisos.Facturacion.ProductosGestionar)

  useEffect(() => {
    let vivo = true
    inventarioServicio.categorias(true).then(c => { if (vivo) setLista(c) }).catch(() => { if (vivo) setLista([]) })
    return () => { vivo = false }
  }, [recargar])

  async function hacer(accion: () => Promise<{ mensaje: string }>, limpiar = false) {
    setOcupado(true)
    try {
      const r = await accion(); mensaje.bien(r.mensaje); setRecargar(n => n + 1)
      if (limpiar) setNombre('')
      setRenombrando(undefined)
    } catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo.') }
    finally { setOcupado(false) }
  }

  const texto = q.trim().toLocaleLowerCase('es')
  const filtradas = (lista ?? [])
    .filter(c => filtro === 'todas' || (filtro === 'activas' ? c.activo !== false : c.activo === false))
    .filter(c => !texto || c.nombre.toLocaleLowerCase('es').includes(texto))
  const paginas = Math.max(1, Math.ceil(filtradas.length / porPagina))
  const paginaReal = Math.min(pagina, paginas)
  const visibles = filtradas.slice((paginaReal - 1) * porPagina, paginaReal * porPagina)
  const activas = (lista ?? []).filter(c => c.activo !== false).length

  return (
    <>
      <div className="inv-barra">
        <div className="filtros-lista">
          <label><span>Buscar</span><input value={q} placeholder="Nombre de la categoría" onChange={e => { setQ(e.target.value); setPagina(1) }} /></label>
          <label>
            <span>Estado</span>
            <select value={filtro} onChange={e => { setFiltro(e.target.value as typeof filtro); setPagina(1) }}>
              <option value="activas">Activas</option><option value="inactivas">Desactivadas</option><option value="todas">Todas</option>
            </select>
          </label>
        </div>
        {puedeEditar && (
          <form className="inv-nueva" onSubmit={e => { e.preventDefault(); if (nombre.trim()) void hacer(() => inventarioServicio.crearCategoria(nombre.trim()), true) }}>
            <input value={nombre} maxLength={60} placeholder="Nueva categoría (ej.: Pinturas)" aria-label="Nueva categoría" onChange={e => setNombre(e.target.value)} />
            <Boton type="submit" disabled={!nombre.trim()} ocupado={ocupado && !!nombre.trim()}>Agregar</Boton>
          </form>
        )}
      </div>

      <div className="bloque sin-relleno">
        {!lista ? <div className="relleno"><Cargando /></div> : visibles.length === 0 ? (
          <div className="relleno"><Vacio>{texto ? `Ninguna categoría con «${q.trim()}».` : filtro === 'inactivas' ? 'No hay categorías desactivadas.' : 'Todavía no hay categorías. Agrega la primera arriba a la derecha.'}</Vacio></div>
        ) : (
          <table className="tabla">
            <thead><tr><th>Categoría</th><th className="num">Productos</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {visibles.map(c => (
                <tr key={c.id} className={c.activo === false ? 'inactivo' : undefined}>
                  <td>
                    {renombrando?.id === c.id ? (
                      <form className="inv-nueva" onSubmit={e => { e.preventDefault(); if (renombrando.nombre.trim()) void hacer(() => inventarioServicio.renombrarCategoria(c.id, renombrando.nombre.trim())) }}>
                        <input value={renombrando.nombre} maxLength={60} aria-label="Nuevo nombre" autoFocus
                               onChange={e => setRenombrando({ id: c.id, nombre: e.target.value })} />
                        <Boton type="submit" estilo="secundario" disabled={!renombrando.nombre.trim()}>Guardar</Boton>
                        <Boton estilo="plano" onClick={() => setRenombrando(undefined)}>Cancelar</Boton>
                      </form>
                    ) : <span className="principal">{c.nombre}</span>}
                  </td>
                  <td className="num mono">{c.productos}</td>
                  <td>{c.activo === false ? <span className="secundario">Desactivada</span> : <span className="inv-bien">● Activa</span>}</td>
                  <td className="acciones">
                    {puedeEditar && renombrando?.id !== c.id && <>
                      <Boton estilo="plano" onClick={() => setRenombrando({ id: c.id, nombre: c.nombre })}>Renombrar</Boton>
                      {c.activo === false
                        ? <Boton estilo="plano" onClick={() => void hacer(() => inventarioServicio.reactivarCategoria(c.id))}>Reactivar</Boton>
                        : <Boton estilo="plano" onClick={() => void hacer(() => inventarioServicio.desactivarCategoria(c.id))}>Desactivar</Boton>}
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Paginacion total={filtradas.length} pagina={paginaReal} porPagina={porPagina}
                  onCambiar={setPagina} onPorPagina={n => { setPorPagina(n); setPagina(1) }} />
      <p className="nota se-aplica">
        {activas} {activas === 1 ? 'categoría activa' : 'categorías activas'}. Se aplica: una sola categoría por producto; se elige al
        crear o editar el producto, y sirve para filtrar Stock, Productos y el conteo físico. Desactivar no la quita de los productos que ya la tienen.
      </p>
    </>
  )
}