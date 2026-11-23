import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { ListaConfirmar } from '../../../componentes/ListaConfirmar'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { sucursalesServicio, type SucursalMia } from '../../facturacion/servicios/facturacionServicio'
import { NOMBRE_TIPO, type TipoOferta } from '../ofertas'
import { posServicio, type FilaOferta, type PeticionOferta, type ProductoParaOferta } from '../servicios/posServicio'
import '../../facturacion/comprobantes-lista.css'
import '../pos.css'

/**
 * e279 (094) — NUEVA OFERTA (o cambiar una). Se elige el tipo, los productos y
 * el precio con IGV; abajo se ve cuánto se cobra por cada producto (el
 * descuento se reparte según su precio) y cuánto se gana con cada uno.
 */

const dinero = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const cant = (n: number) => n.toLocaleString('es-PE', { maximumFractionDigits: 2 })
const num = (s: string) => { const n = Number((s ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
const hoyLima = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())

const TIPOS: { tipo: TipoOferta; que: string; ej: string }[] = [
  { tipo: 'cantidad', que: 'Del mismo producto.', ej: 'Ej.: 2 gaseosas por S/ 16 · 3x2' },
  { tipo: 'pack', que: 'Varios productos distintos por un precio.', ej: 'Ej.: pan + leche + mantequilla por S/ 20' },
  { tipo: 'minimo', que: 'Desde cierta cantidad, cada uno cuesta menos.', ej: 'Ej.: desde 3 sacos, S/ 22 c/u' },
  { tipo: 'lote', que: 'Solo el lote que está por vencer.', ej: 'Ej.: el yogurt que vence el 28 nov.' },
]

interface Item { productoId: string; cantidad: number }
interface FilaReparto { p: ProductoParaOferta; cant: number; normal: number; cobra: number; ganas: number | null; debajo: number }

/** Cuánto se cobra por cada producto: el descuento, según lo que vale cada uno (como el punto de venta). */
function repartir(tipo: TipoOferta, items: { p: ProductoParaOferta; cantidad: number }[], precio: number): FilaReparto[] {
  const conGanancia = (p: ProductoParaOferta, n: number, normal: number, cobra: number): FilaReparto => {
    const sinIgv = p.tipoAfectacion === '10' ? cobra / 1.18 : cobra
    const ganas = p.costo != null ? Math.round((sinIgv - p.costo * n) * 100) / 100 : null
    return { p, cant: n, normal, cobra, ganas, debajo: ganas != null && ganas < 0 ? -ganas : 0 }
  }
  if (tipo === 'minimo' || tipo === 'lote') {
    const it = items[0]
    return it ? [conGanancia(it.p, 1, it.p.precio, precio)] : []
  }
  const normales = items.map(it => Math.round(it.p.precio * it.cantidad * 100))
  const total = normales.reduce((s, n) => s + n, 0)
  const dsc = total - Math.round(precio * 100)
  let repartido = 0
  const partes = normales.map(n => { const d = total > 0 && dsc > 0 ? Math.floor(dsc * n / total) : 0; repartido += d; return d })
  if (partes.length && dsc > 0) partes[0] += dsc - repartido
  return items.map((it, i) => conGanancia(it.p, it.cantidad, normales[i] / 100, (normales[i] - partes[i]) / 100))
}

export function EditarOferta() {
  const { id } = useParams()
  const navegar = useNavigate()
  const mensaje = useMensaje()
  const { pedir, dialogo } = useConfirmar()
  const [productos, setProductos] = useState<ProductoParaOferta[]>()
  const [sucursales, setSucursales] = useState<SucursalMia[]>([])
  const [original, setOriginal] = useState<FilaOferta | null>()
  const [fallo, setFallo] = useState<string>()
  const [guardando, setGuardando] = useState(false)

  const [tipo, setTipo] = useState<TipoOferta>('pack')
  const [nombre, setNombre] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [precio, setPrecio] = useState('')
  const [lote, setLote] = useState('')
  const [lotesDe, setLotesDe] = useState<{ productoId: string; lotes: { lote: string; vence: string | null; quedan: number }[] }>()
  const [desde, setDesde] = useState(hoyLima())
  const [hasta, setHasta] = useState('')
  const [todas, setTodas] = useState(true)
  const [elegidas, setElegidas] = useState<string[]>([])
  const [limite, setLimite] = useState('')

  useEffect(() => {
    let vivo = true
    Promise.all([posServicio.productosParaOferta(), sucursalesServicio.mias(), id ? posServicio.ofertas() : Promise.resolve(null)])
      .then(([ps, ss, lista]) => {
        if (!vivo) return
        setProductos(ps); setSucursales(ss.sucursales)
        if (!id) { setOriginal(null); return }
        const o = lista?.filas.find(f => f.id === id)
        if (!o) { setFallo('Esa oferta no existe.'); return }
        setOriginal(o); setTipo(o.tipo); setNombre(o.nombre); setPrecio(String(o.precio)); setLote(o.lote ?? '')
        setItems(o.productos.map(p => ({ productoId: p.productoId, cantidad: p.cantidad })))
        setDesde(o.desde); setHasta(o.hasta ?? ''); setTodas(o.todasSucursales); setElegidas(o.sucursales)
        setLimite(o.limite != null ? String(o.limite) : '')
      })
      .catch(e => { if (vivo) setFallo(e instanceof ErrorApi ? e.message : 'No se pudo abrir la oferta.') })
    return () => { vivo = false }
  }, [id])

  // Los lotes del producto, para «liquidar lote».
  const productoLote = tipo === 'lote' ? items[0]?.productoId : undefined
  useEffect(() => {
    if (!productoLote) return
    let vivo = true
    posServicio.lotesParaOferta(productoLote)
      .then(l => { if (vivo) setLotesDe({ productoId: productoLote, lotes: l }) })
      .catch(() => { if (vivo) setLotesDe({ productoId: productoLote, lotes: [] }) })
    return () => { vivo = false }
  }, [productoLote])
  const lotes = productoLote && lotesDe?.productoId === productoLote ? lotesDe.lotes : undefined

  const porId = useMemo(() => new Map((productos ?? []).map(p => [p.id, p])), [productos])
  const elegidos = items.map(it => ({ p: porId.get(it.productoId), cantidad: it.cantidad }))
    .filter((x): x is { p: ProductoParaOferta; cantidad: number } => !!x.p)
  const vPrecio = num(precio)
  const filas = repartir(tipo, elegidos, vPrecio)
  const normal = tipo === 'minimo' || tipo === 'lote' ? (elegidos[0]?.p.precio ?? 0) : elegidos.reduce((s, x) => s + x.p.precio * x.cantidad, 0)
  const ahorro = normal - vPrecio
  const pct = normal > 0 ? Math.round(ahorro / normal * 100) : 0
  const ganancia = filas.every(f => f.ganas != null) ? filas.reduce((s, f) => s + (f.ganas ?? 0), 0) : null
  const debajo = filas.filter(f => f.debajo > 0)
  const vendida = (original?.vendidas ?? 0) > 0
  const porUnidad = tipo === 'minimo' || tipo === 'lote'

  function cambiarTipo(t: TipoOferta) {
    setTipo(t)
    setItems(its => {
      const primero = its[0]
      if (t === 'pack') return its.map(x => ({ ...x, cantidad: Math.max(1, Math.round(x.cantidad)) }))
      if (!primero) return []
      // Liquidar lote: solo un producto que maneja lotes.
      if (t === 'lote' && !productos?.find(p => p.id === primero.productoId)?.manejaLotes) return []
      return [{ productoId: primero.productoId, cantidad: t === 'cantidad' ? 2 : t === 'minimo' ? 3 : 1 }]
    })
    if (t !== 'lote') setLote('')
  }

  function agregar(p: ProductoParaOferta) {
    if (tipo === 'pack') setItems(its => its.some(x => x.productoId === p.id) ? its : [...its, { productoId: p.id, cantidad: 1 }])
    else setItems([{ productoId: p.id, cantidad: tipo === 'cantidad' ? (items[0]?.cantidad ?? 2) : tipo === 'minimo' ? (items[0]?.cantidad ?? 3) : 1 }])
    if (tipo === 'lote') setLote('')
  }

  const falta = nombre.trim().length < 2 ? 'Escribe el nombre de la oferta.'
    : elegidos.length === 0 ? 'Elige el producto.'
    : tipo === 'pack' && elegidos.length < 2 ? 'Un pack lleva al menos dos productos.'
    : tipo === 'cantidad' && (items[0]?.cantidad ?? 0) < 2 ? '«Lleva varios» es desde 2 unidades.'
    : (tipo === 'pack' || tipo === 'cantidad') && items.some(x => !Number.isInteger(x.cantidad)) ? 'Las cantidades son enteras (2, 3…).'
    : tipo === 'lote' && !lote ? 'Elige el lote.'
    : !(vPrecio > 0) ? 'Escribe el precio de la oferta.'
    : vPrecio >= normal ? `El precio de la oferta tiene que ser menor que el normal (S/ ${dinero(normal)}).`
    : !desde ? 'Elige desde qué día vale.'
    : hasta && hasta < desde ? 'La fecha «hasta» es antes de «desde».'
    : !todas && elegidas.length === 0 ? 'Elige al menos una sucursal.'
    : limite && !(num(limite) > 0) ? 'El límite tiene que ser mayor que cero (o déjalo vacío).'
    : undefined

  async function guardar() {
    if (falta) return
    const peticion: PeticionOferta = {
      nombre: nombre.trim(), tipo, precio: vPrecio, lote: tipo === 'lote' ? lote : null, desde, hasta: hasta || null,
      todasSucursales: todas, sucursales: todas ? [] : elegidas, limite: limite ? num(limite) : null,
      productos: items.map(x => ({ productoId: x.productoId, cantidad: x.cantidad })),
    }
    const que = tipo === 'pack' ? elegidos.map(x => `${x.cantidad !== 1 ? cant(x.cantidad) + ' ' : ''}${x.p.descripcion}`).join(' + ')
      : tipo === 'cantidad' ? `${cant(items[0].cantidad)} × ${elegidos[0].p.descripcion}`
      : tipo === 'minimo' ? `${elegidos[0].p.descripcion}, desde ${cant(items[0].cantidad)}`
      : `${elegidos[0].p.descripcion}, lote ${lote}`
    if (!await pedir({
      titulo: id ? '¿Guardar los cambios de la oferta?' : '¿Guardar esta oferta?',
      confirmar: id ? 'Sí, guardar cambios' : 'Sí, guardar la oferta',
      mensaje: <>
        <p>Desde ese día, al vender en el punto de venta, la oferta <strong>se aplica sola</strong>. El precio de tus productos y el stock no cambian.</p>
        <ListaConfirmar filas={[
          { nombre: 'Oferta', valor: nombre.trim(), fuerte: true },
          { nombre: 'Tipo', valor: NOMBRE_TIPO[tipo] },
          { nombre: 'Productos', valor: que },
          { nombre: 'Precio normal', valor: `S/ ${dinero(normal)}${porUnidad ? ' c/u' : ''}` },
          { nombre: 'Precio de la oferta', valor: `S/ ${dinero(vPrecio)}${porUnidad ? ' c/u' : ''} (−${pct}%)`, fuerte: true },
          { nombre: 'Vale', valor: hasta ? `del ${fecha(desde)} al ${fecha(hasta)}` : `desde el ${fecha(desde)}, sin fecha de fin` },
          { nombre: 'Sucursales', valor: todas ? 'Todas' : sucursales.filter(s => elegidas.includes(s.id)).map(s => s.nombre).join(', ') },
          ...(limite ? [{ nombre: 'Límite', valor: `hasta ${cant(num(limite))} ${porUnidad ? 'unidades' : tipo === 'pack' ? 'packs' : 'grupos'}` }] : []),
        ]} />
        {debajo.length > 0 && <p className="conf-ojo">{debajo.map(f => f.p.descripcion).join(', ')} {debajo.length === 1 ? 'queda' : 'quedan'} por debajo de su costo.</p>}
      </>,
    })) return
    setGuardando(true)
    try {
      const r = id ? await posServicio.cambiarOferta(id, peticion) : await posServicio.crearOferta(peticion)
      mensaje.bien(r.mensaje)
      navegar('/pos/ofertas')
    } catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo guardar la oferta.') }
    finally { setGuardando(false) }
  }

  if (fallo) return <div className="pos-ofertas"><Link to="/pos/ofertas" className="enlace-volver">← Ofertas</Link><Aviso>{fallo}</Aviso></div>
  if (!productos || original === undefined) return <Cargando />
  if (original?.estado === 'terminada') return (
    <div className="pos-ofertas"><Link to="/pos/ofertas" className="enlace-volver">← Ofertas</Link>
      <Aviso tono="info">«{original.nombre}» está terminada: ya no se cambia. Si la quieres de nuevo, crea una nueva oferta.</Aviso></div>
  )

  return (
    <div className="pos-ofertas">
      {dialogo}
      <Link to="/pos/ofertas" className="enlace-volver">← Ofertas</Link>
      <div className="encabezado-pagina cmp-encab">
        <div>
          <h1 className="titulo-pagina">{id ? 'Cambiar oferta' : 'Nueva oferta'}</h1>
          <p className="bajada-pagina">Elige qué tipo de oferta quieres. Abajo ves cuánto se cobra por cada producto.</p>
        </div>
      </div>
      {vendida && <Aviso tono="info">Ya se vendió con esta oferta ({cant(original!.vendidas)}): el tipo, los productos y el precio quedan como se vendieron. Puedes cambiar el nombre, las fechas, las sucursales y el límite.</Aviso>}

      <div className="pos-of-tipos" role="radiogroup" aria-label="Tipo de oferta">
        {TIPOS.map(t => (
          <button key={t.tipo} type="button" role="radio" aria-checked={tipo === t.tipo} disabled={vendida}
                  className={`pos-of-tipo${tipo === t.tipo ? ' elegido' : ''}`} onClick={() => cambiarTipo(t.tipo)}>
            <b>{NOMBRE_TIPO[t.tipo]}</b><span>{t.que}</span><i>{t.ej}</i>
          </button>
        ))}
      </div>

      <div className="pos-of-form">
        <section className="lst-caja pos-of-izq">
          <label className="pos-of-campo">
            <span>Nombre de la oferta (sale en el ticket)</span>
            <input value={nombre} maxLength={60} placeholder={tipo === 'pack' ? 'Ej.: Combo desayuno' : tipo === 'lote' ? 'Ej.: Yogurt fresa: liquidación' : 'Ej.: Gaseosa 3L: 2 por S/ 16'}
                   onChange={e => setNombre(e.target.value)} />
          </label>

          {!vendida && (tipo === 'pack' || elegidos.length === 0) && (
            <BuscarProducto productos={productos.filter(p => (tipo !== 'lote' || p.manejaLotes) && !items.some(x => x.productoId === p.id))}
                            texto={tipo === 'pack' ? 'Agregar producto al pack' : tipo === 'lote' ? 'Elegir el producto (solo los que manejan lotes)' : 'Elegir el producto'}
                            onElegir={agregar} />
          )}

          {elegidos.length > 0 && (
            <table className="tabla lst pos-of-reparto">
              <thead><tr>
                <th>{tipo === 'pack' ? 'Producto del pack' : 'Producto'}</th>
                <th className="derecha">{tipo === 'minimo' ? 'Desde' : porUnidad ? '' : 'Cant.'}</th>
                <th className="derecha">Precio normal</th><th className="derecha">Con la oferta</th><th className="derecha">Ganas</th>
                {!vendida && <th />}
              </tr></thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={f.p.id}>
                    <td><div className="principal">{f.p.descripcion}</div><div className="secundario">{f.p.codigo}</div></td>
                    <td className="derecha">
                      {tipo === 'lote' ? '' : (
                        <input className="pos-of-cant" inputMode="decimal" disabled={vendida} value={items[i]?.cantidad ?? ''}
                               aria-label={`Cantidad de ${f.p.descripcion}`}
                               onChange={e => { const v = Math.max(0, num(e.target.value)); setItems(its => its.map((x, j) => j === i ? { ...x, cantidad: v } : x)) }} />
                      )}
                    </td>
                    <td className="derecha">S/ {dinero(f.normal)}{porUnidad && ' c/u'}</td>
                    <td className="derecha"><strong>{vPrecio > 0 ? `S/ ${dinero(f.cobra)}` : '—'}</strong>{porUnidad && vPrecio > 0 && ' c/u'}</td>
                    <td className={`derecha${f.debajo > 0 ? ' pos-of-mal' : ''}`}>{f.ganas == null || !(vPrecio > 0) ? <span className="secundario" title="Sin costo: anota el costo del producto o registra una compra">—</span> : `${f.ganas < 0 ? '−' : ''}S/ ${dinero(Math.abs(f.ganas))}`}</td>
                    {!vendida && <td className="acciones"><button type="button" className="pos-quitar" aria-label={`Quitar ${f.p.descripcion}`}
                                                    onClick={() => setItems(its => its.filter((_, j) => j !== i))}>×</button></td>}
                  </tr>
                ))}
                {tipo === 'pack' && filas.length > 1 && (
                  <tr className="pos-of-total"><td><strong>Total</strong></td><td /><td className="derecha"><s>S/ {dinero(normal)}</s></td>
                    <td className="derecha"><strong>{vPrecio > 0 ? `S/ ${dinero(vPrecio)}` : '—'}</strong></td>
                    <td className="derecha"><strong>{ganancia != null && vPrecio > 0 ? `${ganancia < 0 ? '−' : ''}S/ ${dinero(Math.abs(ganancia))}` : '—'}</strong></td>{!vendida && <td />}</tr>
                )}
              </tbody>
            </table>
          )}

          {tipo === 'lote' && elegidos.length > 0 && (
            <label className="pos-of-campo">
              <span>¿Qué lote liquidas?</span>
              <select value={lote} disabled={vendida} onChange={e => setLote(e.target.value)}>
                <option value="">Elige el lote…</option>
                {lote && lotes && !lotes.some(l => l.lote === lote) && <option value={lote}>Lote {lote}</option>}
                {(lotes ?? []).map(l => <option key={l.lote} value={l.lote}>Lote {l.lote}{l.vence ? ` · vence ${fecha(l.vence)}` : ''} · quedan {cant(l.quedan)}</option>)}
              </select>
              {lotes && lotes.length === 0 && <small className="secundario">Este producto no tiene lotes con stock.</small>}
            </label>
          )}

          {debajo.length > 0 && vPrecio > 0 && (
            <div className="aviso ojo pos-of-aviso">
              {debajo.map(f => <span key={f.p.id}><strong>{f.p.descripcion}</strong> queda <strong>S/ {dinero(f.debajo)} por debajo de su costo</strong>. </span>)}
              {ganancia != null && (ganancia > 0 ? <>La oferta igual te deja S/ {dinero(ganancia)} de ganancia. </> : <>Con esta oferta pierdes S/ {dinero(-ganancia)}. </>)}
              Puedes guardarla así.
            </div>
          )}
          <p className="nota">
            {tipo === 'pack' ? <>«Con la oferta» reparte el descuento según el precio de cada producto (todos bajan lo mismo en %). Así cada producto sigue con su venta y su ganancia en los reportes.</>
              : tipo === 'cantidad' ? <>Para un 3x2: pon 3 en la cantidad y como precio lo que cuestan 2. Si el cliente lleva más, cada grupo completo va con la oferta y el resto a precio normal.</>
              : tipo === 'minimo' ? <>Si el cliente lleva esa cantidad o más, <strong>todas</strong> sus unidades van al precio de la oferta.</>
              : <>Solo las unidades de ese lote van con la oferta. Al vender, el punto de venta elige ese lote solo.</>}
          </p>
        </section>

        <section className="lst-caja pos-of-der">
          <label className="pos-of-campo">
            <span>{tipo === 'pack' ? 'Precio del pack' : tipo === 'cantidad' ? `Precio por las ${cant(items[0]?.cantidad ?? 2)}` : 'Precio por unidad'} (con IGV)</span>
            <input className="pos-of-precio" inputMode="decimal" disabled={vendida} value={precio} placeholder="S/ 0.00" onChange={e => setPrecio(e.target.value)} />
            {normal > 0 && <small className="secundario">{vPrecio > 0 && vPrecio < normal ? `El cliente ahorra S/ ${dinero(ahorro)} (${pct}%) · normal S/ ${dinero(normal)}` : `Normal: S/ ${dinero(normal)}${porUnidad ? ' c/u' : ''}`}</small>}
          </label>
          <div className="pos-of-dos">
            <label className="pos-of-campo"><span>Desde</span><input type="date" value={desde} onChange={e => setDesde(e.target.value)} /></label>
            <label className="pos-of-campo"><span>Hasta (opcional)</span><input type="date" value={hasta} min={desde} onChange={e => setHasta(e.target.value)} /></label>
          </div>
          <div className="pos-of-campo">
            <span>¿En qué sucursales?</span>
            <div className="pos-tipo pos-of-seg" role="tablist" aria-label="Sucursales">
              <button type="button" className={todas ? 'on' : ''} onClick={() => setTodas(true)}>Todas</button>
              <button type="button" className={!todas ? 'on' : ''} onClick={() => setTodas(false)}>Elegir</button>
            </div>
            {!todas && (
              <div className="pos-of-sucs">
                {sucursales.map(s => (
                  <label key={s.id} className="pos-of-check">
                    <input type="checkbox" checked={elegidas.includes(s.id)}
                           onChange={e => setElegidas(es => e.target.checked ? [...es, s.id] : es.filter(x => x !== s.id))} />
                    {s.codigo} {s.nombre}
                  </label>
                ))}
              </div>
            )}
          </div>
          <label className="pos-of-campo">
            <span>Límite (opcional)</span>
            <input inputMode="decimal" value={limite} placeholder={porUnidad ? 'Ej.: hasta 100 unidades' : tipo === 'pack' ? 'Ej.: hasta 100 packs' : 'Ej.: hasta 50 grupos'} onChange={e => setLimite(e.target.value)} />
            <small className="secundario">Cuando se vende esa cantidad, la oferta termina sola.</small>
          </label>
          <div className="aviso bien pos-of-aviso">
            Al vender, del stock sale cada producto, como siempre{tipo === 'lote' ? ' (de ese lote)' : ''}. En la boleta cada producto sale con su descuento.
          </div>
          {falta && <p className="pos-falta">{falta}</p>}
          <div className="pos-of-botones">
            <Link className="boton secundario" to="/pos/ofertas">Cancelar</Link>
            <Boton disabled={!!falta} ocupado={guardando} textoOcupado="Guardando…" onClick={() => void guardar()}>{id ? 'Guardar cambios' : 'Guardar oferta'}</Boton>
          </div>
        </section>
      </div>
    </div>
  )
}

function BuscarProducto({ productos, texto, onElegir }: { productos: ProductoParaOferta[]; texto: string; onElegir: (p: ProductoParaOferta) => void }) {
  const [q, setQ] = useState('')
  const t = q.trim().toLocaleLowerCase('es')
  const encontrados = t ? productos.filter(p => p.descripcion.toLocaleLowerCase('es').includes(t) || p.codigo.toLocaleLowerCase('es').includes(t)).slice(0, 8) : []
  return (
    <div className="pos-of-buscar">
      <input value={q} placeholder={`+ ${texto} (código o nombre)`} aria-label={texto} onChange={e => setQ(e.target.value)}
             onKeyDown={e => { if (e.key === 'Enter' && encontrados.length === 1) { e.preventDefault(); onElegir(encontrados[0]); setQ('') } }} />
      {t && (
        <ul className="pos-of-opciones">
          {encontrados.length === 0 && <li className="secundario">Ningún producto con «{q.trim()}».</li>}
          {encontrados.map(p => (
            <li key={p.id}><button type="button" onClick={() => { onElegir(p); setQ('') }}>
              <span>{p.descripcion}<small className="secundario"> · {p.codigo}</small></span><span className="mono">S/ {dinero(p.precio)}</span>
            </button></li>
          ))}
        </ul>
      )}
    </div>
  )
}