import { useEffect, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { Permisos } from '../../../nucleo/autorizacion/permisos'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { useSesion } from '../../../nucleo/sesion/SesionContexto'
import { InventarioApagado } from '../componentes/InventarioApagado'
import { useEstadoInventario, useSucursalesDeTrabajo } from '../componentes/usoInventario'
import { cantidad, inventarioServicio, type Almacen, type StockPorAlmacen } from '../servicios/inventarioServicio'
import '../inventario.css'

/**
 * 066 — ALMACENES DENTRO DE UNA SUCURSAL (tienda y depósito). El stock de la
 * sucursal es el mismo; aquí se ve dónde está y se mueve de uno a otro. Se
 * vende del principal; si no alcanza, sale de los demás en su orden.
 */
export function Almacenes() {
  const mensaje = useMensaje()
  const { puede } = useSesion()
  const { estado, error: errorEstado } = useEstadoInventario()
  const { sucursales, defecto } = useSucursalesDeTrabajo(estado)
  const [sucursal, setSucursal] = useState('')
  const elegida = sucursal || defecto
  const [almacenes, setAlmacenes] = useState<Almacen[]>()
  const [stock, setStock] = useState<StockPorAlmacen[]>()
  const [q, setQ] = useState('')
  const [recargar, setRecargar] = useState(0)
  const [creando, setCreando] = useState(false)
  const [moviendo, setMoviendo] = useState<StockPorAlmacen>()

  useEffect(() => {
    if (!elegida) return
    let vivo = true
    inventarioServicio.almacenes(elegida).then(a => { if (vivo) setAlmacenes(a) }).catch(() => { if (vivo) setAlmacenes([]) })
    return () => { vivo = false }
  }, [elegida, recargar])

  useEffect(() => {
    if (!elegida || !almacenes?.length) { setStock(undefined); return }
    let vivo = true
    const t = setTimeout(() => {
      inventarioServicio.stockPorAlmacen(elegida, q.trim() || undefined)
        .then(s => { if (vivo) setStock(s) })
        .catch(e => mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo leer el stock por almacén.'))
    }, 200)
    return () => { vivo = false; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elegida, almacenes, q, recargar])

  if (errorEstado) return <Aviso>{errorEstado}</Aviso>
  if (!estado) return <Cargando />
  if (!estado.encendido) return <InventarioApagado titulo="Almacenes" />

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">Almacenes</h1>
          <p className="secundario">
            Si una sucursal guarda mercadería en más de un lugar (la tienda y un depósito). El stock de la sucursal no
            cambia: aquí ves dónde está. Se vende del principal; si no alcanza, sale de los demás.
          </p>
        </div>
        {puede(Permisos.Inventario.Configurar) && <Boton onClick={() => setCreando(true)}>Nuevo almacén</Boton>}
      </div>

      <div className="filtros-lista">
        <label className="campo">
          <span className="etiqueta">Sucursal</span>
          <select value={elegida} onChange={e => setSucursal(e.target.value)} disabled={sucursales.length <= 1}>
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.codigo} {s.nombre}</option>)}
          </select>
        </label>
        {almacenes && almacenes.length > 0 && (
          <label className="campo">
            <span className="etiqueta">Buscar</span>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Producto o código…" />
          </label>
        )}
      </div>

      {!almacenes ? <Cargando /> : almacenes.length === 0 ? (
        <div className="bloque">
          <Vacio>Esta sucursal tiene un solo almacén (toda la sucursal). Crea uno, por ejemplo «Depósito», y lo que hay hoy queda en el principal (la tienda).</Vacio>
        </div>
      ) : (
        <div className="bloque sin-relleno">
          {!stock ? <div className="relleno"><Cargando /></div> : stock.length === 0 ? (
            <div className="relleno"><Vacio>{q.trim() ? 'Ningún producto con eso.' : 'No hay stock en estos almacenes.'}</Vacio></div>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  {almacenes.map(a => <th key={a.id} className="num">{a.nombre}{a.principal && <div className="secundario">principal</div>}</th>)}
                  <th className="num">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {stock.map(p => (
                  <tr key={p.productoId}>
                    <td>{p.descripcion}<div className="secundario mono">{p.codigo}</div></td>
                    {almacenes.map(a => {
                      const v = p.almacenes[a.id] ?? 0
                      return <td key={a.id} className={`num mono${v < 0 ? ' inv-mal' : ''}`}>{v ? cantidad(v) : '—'}</td>
                    })}
                    <td className="num mono"><strong>{cantidad(Object.values(p.almacenes).reduce((s, x) => s + x, 0))}</strong> {p.unidad}</td>
                    <td>{puede(Permisos.Inventario.Ajustar) && almacenes.length > 1 && <Boton estilo="plano" onClick={() => setMoviendo(p)}>Mover</Boton>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {creando && (
        <DialogoCrear sucursalId={elegida} primero={!almacenes?.length} onCerrar={() => setCreando(false)}
                      onHecho={m => { setCreando(false); mensaje.bien(m); setRecargar(x => x + 1) }} />
      )}
      {moviendo && almacenes && (
        <DialogoMover producto={moviendo} almacenes={almacenes} onCerrar={() => setMoviendo(undefined)}
                      onHecho={m => { setMoviendo(undefined); mensaje.bien(m); setRecargar(x => x + 1) }} />
      )}
    </>
  )
}

function DialogoCrear({ sucursalId, primero, onCerrar, onHecho }: {
  sucursalId: string; primero: boolean; onCerrar: () => void; onHecho: (m: string) => void
}) {
  const mensaje = useMensaje()
  const [nombre, setNombre] = useState('')
  const [principal, setPrincipal] = useState('Tienda')
  const [guardando, setGuardando] = useState(false)
  async function crear() {
    setGuardando(true)
    try {
      const r = await inventarioServicio.crearAlmacen({ sucursalId, nombre: nombre.trim(), principalNombre: principal.trim() || undefined })
      onHecho(r.mensaje)
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo crear el almacén.')
    } finally {
      setGuardando(false)
    }
  }
  return (
    <Dialogo titulo="Nuevo almacén" abierto onCerrar={onCerrar}
             acciones={<><Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
               <Boton ocupado={guardando} disabled={!nombre.trim()} onClick={() => void crear()}>Crear</Boton></>}>
      <label className="campo">
        <span className="etiqueta">Nombre</span>
        <input value={nombre} maxLength={60} autoFocus placeholder="Depósito" onChange={e => setNombre(e.target.value)} />
      </label>
      {primero && (
        <label className="campo">
          <span className="etiqueta">Y el principal (de donde se vende) se llamará</span>
          <input value={principal} maxLength={60} onChange={e => setPrincipal(e.target.value)} />
          <span className="pista">Es el primer almacén extra: todo lo que hay hoy en la sucursal queda en el principal.</span>
        </label>
      )}
    </Dialogo>
  )
}

function DialogoMover({ producto, almacenes, onCerrar, onHecho }: {
  producto: StockPorAlmacen; almacenes: Almacen[]; onCerrar: () => void; onHecho: (m: string) => void
}) {
  const mensaje = useMensaje()
  const conStock = almacenes.filter(a => (producto.almacenes[a.id] ?? 0) > 0)
  const [origen, setOrigen] = useState(conStock.find(a => !a.principal)?.id ?? conStock[0]?.id ?? '')
  const [destino, setDestino] = useState(almacenes.find(a => a.id !== origen)?.id ?? '')
  const [cant, setCant] = useState('')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const hay = producto.almacenes[origen] ?? 0
  const n = Number(cant.replace(',', '.'))
  const valido = origen && destino && origen !== destino && n > 0 && n <= hay
  async function mover() {
    setGuardando(true)
    try {
      const r = await inventarioServicio.moverEntreAlmacenes({ productoId: producto.productoId, origenId: origen, destinoId: destino, cantidad: n, nota: nota.trim() || null })
      onHecho(r.mensaje)
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo mover.')
    } finally {
      setGuardando(false)
    }
  }
  return (
    <Dialogo titulo={`Mover · ${producto.descripcion}`} abierto onCerrar={onCerrar}
             acciones={<><Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
               <Boton ocupado={guardando} disabled={!valido} onClick={() => void mover()}>Mover</Boton></>}>
      <div className="pareja">
        <label className="campo">
          <span className="etiqueta">De</span>
          <select value={origen} onChange={e => setOrigen(e.target.value)}>
            {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre} ({cantidad(producto.almacenes[a.id] ?? 0)})</option>)}
          </select>
        </label>
        <label className="campo">
          <span className="etiqueta">A</span>
          <select value={destino} onChange={e => setDestino(e.target.value)}>
            {almacenes.filter(a => a.id !== origen).map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </label>
      </div>
      <label className="campo">
        <span className="etiqueta">Cantidad ({producto.unidad})</span>
        <input className="mono" inputMode="decimal" value={cant} autoFocus aria-invalid={cant !== '' && !(n > 0 && n <= hay)} onChange={e => setCant(e.target.value)} />
        <span className="pista">Hay {cantidad(hay)} en el almacén de origen.</span>
      </label>
      <label className="campo">
        <span className="etiqueta">Nota (opcional)</span>
        <input value={nota} maxLength={200} onChange={e => setNota(e.target.value)} />
      </label>
    </Dialogo>
  )
}