import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
import { TablaDatos } from '../../../componentes/TablaDatos'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { useYo } from '../../../nucleo/sesion/SesionContexto'
import { BuscadorCliente } from '../../facturacion/componentes/BuscadorCliente'
import { imprimirPdf } from '../../facturacion/componentes/ArchivosComprobante'
import { clientesServicio, documentosServicio, productosServicio } from '../../facturacion/servicios/facturacionServicio'
import type { SerieEmpresa } from '../../facturacion/servicios/facturacionServicio'
import type { ClienteEnLista, ProductoEnLista } from '../../facturacion/tipos'
import { cantidad as fmtCantidad, inventarioServicio, type Disponible } from '../../inventario/servicios/inventarioServicio'
import {
  MEDIOS, nombreMedio, posServicio,
  type Cobrado, type DetalleCaja, type EstadoPos, type MedioPago, type SesionCaja,
} from '../servicios/posServicio'
import '../pos.css'

/**
 * e173 (055) — EL PUNTO DE VENTA.
 *
 * A pantalla completa, sin el menú de la plataforma: es la pantalla de quien
 * atiende el mostrador todo el día. Tres momentos:
 *
 *   sin caja abierta   ABRIR CAJA (el fondo inicial)
 *   con caja           VENDER: buscar o escanear, la cuenta, cobrar
 *   al final           CERRAR CAJA: contar el efectivo, la diferencia
 *
 * Cada venta es una boleta o factura normal (la API usa lo mismo que «Nuevo
 * comprobante»): va a SUNAT, descuenta stock y sale en Comprobantes.
 */

const IGV = 0.18
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const dinero = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = (s: string) => { const n = Number((s ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

interface LineaVenta {
  clave: string
  productoId: string
  codigo: string
  descripcion: string
  unidadMedida: string
  tipoAfectacion: string
  /** Precio con IGV (lo que se ve). */
  precio: number
  /** Valor unitario sin IGV (lo que viaja). */
  valorUnitario: number
  cantidad: number
  descuento: number
}

interface Espera { clave: string; en: string; lineas: LineaVenta[]; cliente?: ClienteEnLista; tipo: '01' | '03' }

const valorVenta = (l: LineaVenta) => r2(Math.max(0, l.cantidad * l.valorUnitario - l.descuento))
const igvDe = (l: LineaVenta) => l.tipoAfectacion === '10' ? r2(valorVenta(l) * IGV) : 0

function totalesDe(lineas: LineaVenta[]) {
  let gravado = 0, otros = 0, igv = 0
  for (const l of lineas) {
    const vv = valorVenta(l)
    if (l.tipoAfectacion === '10') { gravado += vv; igv += igvDe(l) } else otros += vv
  }
  return { gravado: r2(gravado), otros: r2(otros), igv: r2(igv), total: r2(gravado + otros + igv) }
}

const CLAVE_IMPRIMIR = 'reyban.pos.imprimir'
const leer = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const guardar = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* sin almacenamiento */ } }

export function PuntoDeVenta() {
  const [estado, setEstado] = useState<EstadoPos>()
  const [error, setError] = useState<string>()
  const [cerrando, setCerrando] = useState(false)
  const [cerrada, setCerrada] = useState<{ id: string; mensaje: string }>()

  const cargar = useCallback(async () => {
    try { setEstado(await posServicio.estado()); setError(undefined) }
    catch (e) { setError(e instanceof ErrorApi ? e.message : 'No se pudo abrir el punto de venta.') }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  if (error) return <MarcoPos><div className="pos-centro"><Aviso>{error}</Aviso><Link to="/">Volver al inicio</Link></div></MarcoPos>
  if (!estado) return <MarcoPos><Cargando texto="Abriendo el punto de venta…" /></MarcoPos>

  if (cerrada) return (
    <MarcoPos>
      <div className="pos-centro">
        <div className="pos-tarjeta pos-angosta">
          <h1 className="pos-titulo">Caja cerrada</h1>
          <p>{cerrada.mensaje}</p>
          <div className="pos-pie">
            <Link className="boton secundario" to={`/pos/cajas/${cerrada.id}`}>Ver e imprimir el arqueo</Link>
            <Boton onClick={() => { setCerrada(undefined); void cargar() }}>Abrir otra caja</Boton>
          </div>
        </div>
      </div>
    </MarcoPos>
  )

  if (!estado.sesion) return <MarcoPos><AbrirCaja estado={estado} onAbierta={() => void cargar()} /></MarcoPos>

  if (cerrando) return (
    <MarcoPos sesion={estado.sesion}>
      <CerrarCaja onVolver={() => setCerrando(false)}
                  onCerrada={c => { setCerrando(false); setCerrada(c) }} />
    </MarcoPos>
  )

  return <Vender estado={estado} sesion={estado.sesion} onCerrar={() => setCerrando(true)} />
}


// =============================================================================
// EL MARCO: la barra de arriba del POS
// =============================================================================

function MarcoPos({ sesion, acciones, children }: { sesion?: SesionCaja; acciones?: React.ReactNode; children: React.ReactNode }) {
  const { usuario } = useYo()
  return (
    <div className="pos">
      <header className="pos-barra">
        <strong className="pos-marca">Reyban · Punto de venta</strong>
        {sesion && <span className="pos-chip">{sesion.sucursal}</span>}
        {sesion && <span className="pos-chip ok">● {sesion.caja} abierta · {hora(sesion.abiertaEn)}</span>}
        <div className="pos-der">
          {acciones}
          <span className="pos-chip">{usuario.nombre}</span>
          <Link to="/" className="boton secundario">Salir del POS</Link>
        </div>
      </header>
      <main className="pos-cuerpo">{children}</main>
    </div>
  )
}


// =============================================================================
// ABRIR CAJA
// =============================================================================

function AbrirCaja({ estado, onAbierta }: { estado: EstadoPos; onAbierta: () => void }) {
  const { alcance } = useYo()
  const sucursales = estado.sucursales
  const inicial = sucursales.find(s => s.id === alcance?.defecto) ?? sucursales[0]
  const [sucursalId, setSucursalId] = useState(inicial?.id ?? '')
  const sucursal = sucursales.find(s => s.id === sucursalId)
  const libres = (sucursal?.cajas ?? []).filter(c => !c.abiertaPor)
  const [cajaId, setCajaId] = useState('')
  const caja = libres.find(c => c.id === cajaId) ?? libres[0]
  const [fondo, setFondo] = useState(() => caja?.ultimoCierre?.deja != null ? caja.ultimoCierre.deja.toFixed(2) : '')
  const [nota, setNota] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string>()

  if (sucursales.length === 0) return (
    <div className="pos-centro"><Aviso>No trabajas en ninguna sucursal activa: pide al administrador que te asigne una.</Aviso></div>
  )

  const abrir = async () => {
    setOcupado(true); setFallo(undefined)
    try {
      // Sin ventana de «listo»: se pasa directo a vender.
      await posServicio.abrir({ sucursalId, fondo: num(fondo), nota: nota.trim() || undefined, cajaId: caja?.id })
      onAbierta()
    } catch (e) {
      setFallo(e instanceof ErrorApi ? e.message : 'No se pudo abrir la caja.')
    } finally { setOcupado(false) }
  }

  return (
    <div className="pos-centro">
      <div className="pos-tarjeta pos-angosta">
        <div>
          <h1 className="pos-titulo">Abrir caja</h1>
          <p className="pos-sub">Antes de vender, cuenta el dinero con el que empiezas.</p>
        </div>
        <div className="pos-dos">
          {sucursales.length > 1 && (
            <label className="pos-campo">
              <span>Sucursal</span>
              <select value={sucursalId} onChange={e => { setSucursalId(e.target.value); setCajaId('') }}>
                {sucursales.map(s => <option key={s.id} value={s.id}>{s.codigo} {s.nombre}</option>)}
              </select>
            </label>
          )}
          <label className="pos-campo">
            <span>Caja</span>
            <select value={caja?.id ?? ''} onChange={e => setCajaId(e.target.value)}>
              {libres.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              {libres.length === 0 && <option value="">{(sucursal?.cajas.length ?? 0) === 0 ? 'Caja 01 (se crea ahora)' : 'Una caja nueva (se crea ahora)'}</option>}
            </select>
          </label>
          <label className="pos-campo">
            <span>Fondo inicial en efectivo (S/)</span>
            <input className="grande" inputMode="decimal" value={fondo} placeholder="0.00" autoFocus
                   onChange={e => setFondo(e.target.value.replace(/[^\d.,]/g, ''))}
                   onKeyDown={e => { if (e.key === 'Enter') void abrir() }} />
          </label>
        </div>
        {caja?.ultimoCierre && (
          <p className="pos-recuadro">
            La última vez la cerró <strong>{caja.ultimoCierre.por}</strong> el {new Date(caja.ultimoCierre.en).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}
            {caja.ultimoCierre.deja != null && <> y dejó en caja <strong className="mono">S/ {dinero(caja.ultimoCierre.deja)}</strong></>}.
          </p>
        )}
        {(sucursal?.cajas ?? []).filter(c => c.abiertaPor).map(c => (
          <p key={c.id} className="nota">{c.nombre}: la tiene abierta {c.abiertaPor}.</p>
        ))}
        <label className="pos-campo">
          <span>Nota (opcional)</span>
          <input value={nota} maxLength={250} onChange={e => setNota(e.target.value)} placeholder="Ej.: dos billetes de 50 y monedas" />
        </label>
        {fallo && <Aviso>{fallo}</Aviso>}
        <div className="pos-pie">
          <Boton onClick={() => void abrir()} ocupado={ocupado} textoOcupado="Abriendo…">Abrir caja y empezar a vender</Boton>
        </div>
        <p className="nota">Una caja abierta por persona. Las ventas, ingresos y retiros quedan a tu nombre hasta que la cierres.</p>
      </div>
    </div>
  )
}


// =============================================================================
// VENDER
// =============================================================================

function Vender({ estado, sesion, onCerrar }: { estado: EstadoPos; sesion: SesionCaja; onCerrar: () => void }) {
  const mensaje = useMensaje()
  const [productos, setProductos] = useState<ProductoEnLista[]>()
  const [series, setSeries] = useState<SerieEmpresa[]>([])
  const [disp, setDisp] = useState<Disponible>()
  const [q, setQ] = useState('')
  const [categoria, setCategoria] = useState('')
  const [lineas, setLineas] = useState<LineaVenta[]>([])
  const [tipo, setTipo] = useState<'01' | '03'>('03')
  const [cliente, setCliente] = useState<ClienteEnLista>()
  const [cobrando, setCobrando] = useState(false)
  const [hecho, setHecho] = useState<Cobrado>()
  const [movimiento, setMovimiento] = useState(false)
  const [verVentas, setVerVentas] = useState(false)
  const [esperas, setEsperas] = useState<Espera[]>([])
  const [verEsperas, setVerEsperas] = useState(false)
  // Los avisos del mostrador no abren ventana: salen un momento abajo.
  const [toast, setToast] = useState<{ texto: string; tono: 'bien' | 'ojo' }>()
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(undefined), 3500)
    return () => clearTimeout(t)
  }, [toast])
  // El descuento que se está escribiendo (permiso pos.descuentos).
  const [descDe, setDescDe] = useState<string>()
  const buscador = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let vivo = true
    Promise.all([productosServicio.listar(''), documentosServicio.series()])
      .then(([p, s]) => { if (vivo) { setProductos(p.filter(x => x.activo !== false)); setSeries(s) } })
      .catch(e => mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudieron leer los productos.'))
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const categorias = useMemo(() => [...new Set((productos ?? []).map(p => p.categoria).filter((c): c is string => !!c))].sort(), [productos])
  const texto = q.trim().toLocaleLowerCase('es')
  const visibles = useMemo(() => (productos ?? [])
    .filter(p => !categoria || p.categoria === categoria)
    .filter(p => !texto || p.descripcion.toLocaleLowerCase('es').includes(texto) || p.codigo.toLocaleLowerCase('es').includes(texto))
    .slice(0, 48), [productos, categoria, texto])

  // El stock de lo que se ve (en la sucursal de la caja).
  const idsVisibles = visibles.map(p => p.id).join(',')
  const [refrescarStock, setRefrescarStock] = useState(0)
  useEffect(() => {
    if (!idsVisibles) return
    let vivo = true
    const t = setTimeout(() => {
      inventarioServicio.disponible(idsVisibles.split(','), { sucursalId: sesion.sucursalId })
        .then(d => { if (vivo) setDisp(d) }).catch(() => { /* sin inventario: no se muestra */ })
    }, 200)
    return () => { vivo = false; clearTimeout(t) }
  }, [idsVisibles, sesion.sucursalId, refrescarStock])
  const stockDe = (id: string) => disp?.encendido ? disp.productos?.find(x => x.productoId === id) : undefined

  const serie = series.find(s => s.tipo === tipo && (s.sucursalId ?? null) === sesion.sucursalId)?.serie
    ?? series.find(s => s.tipo === tipo && !s.sucursalId)?.serie
  const t = totalesDe(lineas)

  function agregar(p: ProductoEnLista) {
    const st = stockDe(p.id)
    if (st?.controla && disp?.bloquea && st.disponible <= 0) {
      setToast({ texto: `«${p.descripcion}» no tiene stock en esta sucursal.`, tono: 'ojo' })
      return
    }
    setLineas(ls => {
      const i = ls.findIndex(l => l.productoId === p.id && l.descuento === 0)
      if (i >= 0) return ls.map((l, j) => j === i ? { ...l, cantidad: r2(l.cantidad + 1) } : l)
      const afectacion = p.tipoAfectacion
      const valorUnitario = p.incluyeIgv && afectacion === '10' ? p.precioUnitario / (1 + IGV) : p.precioUnitario
      const precio = afectacion === '10' ? (p.incluyeIgv ? p.precioUnitario : p.precioUnitario * (1 + IGV)) : p.precioUnitario
      return [...ls, {
        clave: crypto.randomUUID(), productoId: p.id, codigo: p.codigo, descripcion: p.descripcion,
        unidadMedida: p.unidadMedida, tipoAfectacion: afectacion, precio: r2(precio),
        valorUnitario: Number(valorUnitario.toFixed(6)), cantidad: 1, descuento: 0,
      }]
    })
  }

  // Lector de código de barras (escribe el código y Enter) o Enter con un solo resultado.
  function enter() {
    const exacto = (productos ?? []).find(p => p.codigo.toLocaleLowerCase('es') === texto)
    const uno = exacto ?? (visibles.length === 1 ? visibles[0] : undefined)
    if (uno) { agregar(uno); setQ('') }
    else if (texto) setToast({ texto: visibles.length === 0 ? `Ningún producto con «${q.trim()}».` : 'Hay varios: toca el que es.', tono: 'ojo' })
  }

  const cambiarLinea = (clave: string, cambio: Partial<LineaVenta>) =>
    setLineas(ls => ls.map(l => l.clave === clave ? { ...l, ...cambio } : l))

  function elegirCliente(c: ClienteEnLista) {
    setCliente(c)
    setTipo(c.tipoDocumento === '6' ? '01' : '03')
  }

  function nuevaVenta() {
    setLineas([]); setCliente(undefined); setTipo('03'); setQ('')
    setTimeout(() => buscador.current?.focus(), 50)
  }

  function ponerEnEspera() {
    if (lineas.length === 0) return
    setEsperas(es => [...es, { clave: crypto.randomUUID(), en: new Date().toISOString(), lineas, cliente, tipo }])
    nuevaVenta()
    setToast({ texto: 'Venta en espera. Atiende al siguiente y retómala con «Retomar».', tono: 'bien' })
  }

  // Lo que impide cobrar, en una frase.
  const falta = lineas.length === 0 ? 'Agrega productos.'
    : !serie ? `Tu sucursal no tiene serie de ${tipo === '01' ? 'factura' : 'boleta'}.`
    : tipo === '01' && cliente?.tipoDocumento !== '6' ? 'Una factura necesita un cliente con RUC.'
    : tipo === '03' && t.total > 700 && (!cliente || cliente.tipoDocumento === '0') ? 'Una boleta de más de S/ 700 necesita el DNI del cliente.'
    : lineas.some(l => valorVenta(l) <= 0) ? 'Hay una línea en cero.'
    : undefined

  // F2 = cobrar.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); if (!falta) setCobrando(true) }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [falta])

  return (
    <MarcoPos sesion={sesion} acciones={<>
      {estado.puede.movimientos && <button type="button" className="boton secundario" onClick={() => setMovimiento(true)}>Ingreso / retiro</button>}
      <button type="button" className="boton secundario" onClick={() => setVerVentas(true)}>Ventas de esta caja</button>
      <button type="button" className="boton secundario" onClick={onCerrar}>Cerrar caja</button>
    </>}>
      <div className="pos-venta">
        <section className="pos-izq">
          <input ref={buscador} className="pos-buscar" value={q} autoFocus
                 placeholder="Escanea el código de barras o escribe el nombre o el código…"
                 onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); enter() } }}
                 aria-label="Buscar producto" />
          {categorias.length > 0 && (
            <div className="pos-cats">
              <button type="button" className={!categoria ? 'on' : ''} onClick={() => setCategoria('')}>Todos</button>
              {categorias.map(c => (
                <button type="button" key={c} className={categoria === c ? 'on' : ''} onClick={() => setCategoria(c)}>{c}</button>
              ))}
            </div>
          )}
          {!productos && <Cargando texto="Leyendo tus productos…" />}
          {productos && productos.length === 0 && (
            <Aviso tono="ojo">No tienes productos todavía. Créalos en <Link to="/facturacion/productos">Productos</Link>.</Aviso>
          )}
          <div className="pos-grid">
            {visibles.map(p => {
              const st = stockDe(p.id)
              const sin = !!st?.controla && st.disponible <= 0
              const precio = p.tipoAfectacion === '10' && !p.incluyeIgv ? p.precioUnitario * (1 + IGV) : p.precioUnitario
              return (
                <button type="button" key={p.id} className={`pos-prod${sin ? ' sin' : ''}`} onClick={() => agregar(p)}>
                  <b>{p.descripcion}</b>
                  <small>{p.codigo} · {p.unidadMedida === 'ZZ' ? 'servicio' : p.unidadMedida}</small>
                  <span className="pr">S/ {dinero(precio)}</span>
                  {st?.controla
                    ? <span className={`stock${sin ? ' mal' : st.disponible <= 5 ? ' bajo' : ''}`}>{sin ? 'Sin stock' : `Hay ${fmtCantidad(st.disponible)}`}</span>
                    : <span className="stock gris">{p.unidadMedida === 'ZZ' ? 'Servicio' : ' '}</span>}
                </button>
              )
            })}
          </div>
          {productos && texto && visibles.length === 0 && <p className="nota">Ningún producto con «{q.trim()}».</p>}
          <p className="nota">Un toque (o el lector) agrega 1; el mismo producto otra vez suma a su línea. F2 cobra.</p>
        </section>

        <aside className="pos-ticket">
          <div className="pos-tcab">
            <div className="pos-tipo" role="tablist" aria-label="Comprobante">
              <button type="button" className={tipo === '03' ? 'on' : ''} onClick={() => setTipo('03')}>Boleta</button>
              <button type="button" className={tipo === '01' ? 'on' : ''} onClick={() => setTipo('01')}>Factura</button>
            </div>
            <BuscadorCliente elegido={cliente} onElegir={elegirCliente} />
            <span className="nota">
              {cliente
                ? <>Para <strong>{cliente.razonSocial}</strong>{' '}<button type="button" className="enlace" onClick={() => { setCliente(undefined); setTipo('03') }}>quitar</button></>
                : tipo === '03' ? <>Sin cliente: <strong>Público en general</strong> (hasta S/ 700).</> : 'Elige el cliente con RUC.'}
            </span>
          </div>

          <div className="pos-lineas">
            {lineas.length === 0 && <p className="pos-vacio">Toca un producto o escanéalo para empezar.</p>}
            {lineas.map(l => (
              <div className="pos-lin" key={l.clave}>
                <div className="d">
                  {l.descripcion}
                  <small>
                    S/ {dinero(l.precio)} c/u{l.descuento > 0 && <span className="desc"> · desc. {dinero(l.descuento)}</span>}
                    {estado.puede.descuentos && <>{' · '}
                      <button type="button" className="enlace" onClick={() => {
                        if (l.descuento > 0) cambiarLinea(l.clave, { descuento: 0 })
                        else setDescDe(l.clave)
                      }}>{l.descuento > 0 ? 'quitar descuento' : 'descuento'}</button>
                    </>}
                  </small>
                  {descDe === l.clave && (
                    <input className="pos-desc" autoFocus inputMode="decimal" placeholder="Descuento S/"
                           onKeyDown={e => {
                             if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() }
                             if (e.key === 'Escape') setDescDe(undefined)
                           }}
                           onBlur={e => {
                             // El descuento se escribe con IGV (lo que ve el cliente); viaja sin IGV.
                             const tope = r2(l.cantidad * l.precio) - 0.01
                             const v = Math.min(num(e.target.value), tope)
                             cambiarLinea(l.clave, { descuento: v > 0 ? r2(l.tipoAfectacion === '10' ? v / (1 + IGV) : v) : 0 })
                             setDescDe(undefined)
                           }} />
                  )}
                </div>
                <div className="pos-qty">
                  <button type="button" aria-label="Uno menos" onClick={() => l.cantidad <= 1
                    ? setLineas(ls => ls.filter(x => x.clave !== l.clave))
                    : cambiarLinea(l.clave, { cantidad: r2(l.cantidad - 1) })}>−</button>
                  <input inputMode="decimal" value={l.cantidad} aria-label={`Cantidad de ${l.descripcion}`}
                         onChange={e => cambiarLinea(l.clave, { cantidad: Math.max(0, num(e.target.value)) })} />
                  <button type="button" aria-label="Uno más" onClick={() => cambiarLinea(l.clave, { cantidad: r2(l.cantidad + 1) })}>+</button>
                </div>
                <b className="mono">{dinero(r2(valorVenta(l) + igvDe(l)))}</b>
                <button type="button" className="pos-quitar" aria-label={`Quitar ${l.descripcion}`}
                        onClick={() => setLineas(ls => ls.filter(x => x.clave !== l.clave))}>×</button>
              </div>
            ))}
          </div>

          <div className="pos-tot">
            {t.gravado > 0 && <div><span>Op. gravadas</span><span className="mono">{dinero(t.gravado)}</span></div>}
            {t.otros > 0 && <div><span>Exoneradas / inafectas</span><span className="mono">{dinero(t.otros)}</span></div>}
            <div><span>IGV</span><span className="mono">{dinero(t.igv)}</span></div>
            <div className="g"><span>Total</span><span className="mono">S/ {dinero(t.total)}</span></div>
            <div className="pos-dos-botones">
              <button type="button" className="boton secundario" disabled={lineas.length === 0} onClick={nuevaVenta}>Vaciar</button>
              <button type="button" className="boton secundario" disabled={lineas.length === 0} onClick={ponerEnEspera}>En espera</button>
              {esperas.length > 0 && (
                <button type="button" className="boton secundario" onClick={() => setVerEsperas(true)}>Retomar ({esperas.length})</button>
              )}
            </div>
            {falta && lineas.length > 0 && <p className="pos-falta">{falta}</p>}
            <button type="button" className="boton pos-cobrar" disabled={!!falta} onClick={() => setCobrando(true)}>
              Cobrar S/ {dinero(t.total)} <span>(F2)</span>
            </button>
          </div>
        </aside>
      </div>

      {cobrando && serie && (
        <Cobrar total={t.total} tipo={tipo} serie={serie} cliente={cliente} lineas={lineas}
                onCerrar={() => setCobrando(false)}
                onCobrado={c => {
                  setCobrando(false); setHecho(c); nuevaVenta(); setRefrescarStock(n => n + 1)
                }} />
      )}

      <Dialogo titulo={hecho ? hecho.mensaje : ''} abierto={!!hecho} onCerrar={() => { setHecho(undefined); buscador.current?.focus() }}
               acciones={<Boton onClick={() => { setHecho(undefined); buscador.current?.focus() }}>Siguiente venta (Enter)</Boton>}>
        {hecho && (
          <div className="pos-hecho">
            {hecho.vuelto > 0
              ? <div className="pos-vuelto"><span>Vuelto</span><b className="mono">S/ {dinero(hecho.vuelto)}</b></div>
              : <p>Cobrado <strong className="mono">S/ {dinero(hecho.total)}</strong>.</p>}
            <p className="nota">
              {hecho.tipo === '03' ? 'La boleta va a SUNAT en el resumen diario.' : 'La factura ya está en camino a SUNAT.'}{' '}
              <Link to={`/facturacion/comprobantes/${hecho.id}`} target="_blank">Ver el comprobante</Link>
            </p>
          </div>
        )}
      </Dialogo>

      {movimiento && <Movimiento onCerrar={m => { setMovimiento(false); if (m) setToast({ texto: m, tono: 'bien' }) }} />}
      {toast && <div className={`pos-toast ${toast.tono}`} role="status">{toast.texto}</div>}
      {verVentas && <VentasDeLaCaja onCerrar={() => setVerVentas(false)} />}

      <Dialogo titulo="Ventas en espera" abierto={verEsperas} onCerrar={() => setVerEsperas(false)}
               acciones={<Boton estilo="secundario" onClick={() => setVerEsperas(false)}>Cerrar</Boton>}>
        <ul className="pos-esperas">
          {esperas.map(e => (
            <li key={e.clave}>
              <span>{hora(e.en)} · {e.lineas.length} producto(s) · S/ {dinero(totalesDe(e.lineas).total)}{e.cliente && <> · {e.cliente.razonSocial}</>}</span>
              <Boton onClick={() => {
                if (lineas.length > 0) ponerEnEspera()
                setLineas(e.lineas); setCliente(e.cliente); setTipo(e.tipo)
                setEsperas(es => es.filter(x => x.clave !== e.clave)); setVerEsperas(false)
              }}>Retomar</Boton>
            </li>
          ))}
        </ul>
      </Dialogo>
    </MarcoPos>
  )
}


// =============================================================================
// COBRAR
// =============================================================================

function Cobrar({ total, tipo, serie, cliente, lineas, onCerrar, onCobrado }: {
  total: number; tipo: '01' | '03'; serie: string; cliente?: ClienteEnLista; lineas: LineaVenta[]
  onCerrar: () => void; onCobrado: (c: Cobrado) => void
}) {
  const mensaje = useMensaje()
  const [medio, setMedio] = useState<MedioPago | 'mixto'>('efectivo')
  const [recibido, setRecibido] = useState('')
  const [referencia, setReferencia] = useState('')
  const [mixto, setMixto] = useState<Record<MedioPago, string>>({ efectivo: '', yape: '', tarjeta: '', transferencia: '' })
  const [refs, setRefs] = useState<Record<MedioPago, string>>({ efectivo: '', yape: '', tarjeta: '', transferencia: '' })
  const [imprimir, setImprimir] = useState(() => leer(CLAVE_IMPRIMIR) !== '0')
  const [whatsapp, setWhatsapp] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string>()
  const [reintentar, setReintentar] = useState<string>()

  const efectivoMixto = num(mixto.efectivo)
  const sumaMixto = r2(MEDIOS.reduce((s, m) => s + num(mixto[m.codigo]), 0))
  const efectivo = medio === 'efectivo' ? total : medio === 'mixto' ? efectivoMixto : 0
  const recibidoN = recibido.trim() ? num(recibido) : efectivo
  const vuelto = efectivo > 0 ? r2(recibidoN - efectivo) : 0
  const sugeridos = [...new Set([Math.ceil(total), Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100])]
    .filter(v => v > total).slice(0, 3)

  const problema = medio === 'mixto' && Math.abs(sumaMixto - total) > 0.009 ? `Los pagos suman S/ ${dinero(sumaMixto)}; faltan S/ ${dinero(r2(total - sumaMixto))}.`
    : efectivo > 0 && recibidoN < efectivo ? `Falta: recibiste S/ ${dinero(recibidoN)} y son S/ ${dinero(efectivo)} en efectivo.`
    : undefined

  const cobrar = async () => {
    if (problema || ocupado) return
    setOcupado(true); setFallo(undefined)
    guardar(CLAVE_IMPRIMIR, imprimir ? '1' : '0')
    try {
      const pagos = medio === 'mixto'
        ? MEDIOS.filter(m => num(mixto[m.codigo]) > 0).map(m => ({ medio: m.codigo, monto: r2(num(mixto[m.codigo])), referencia: refs[m.codigo].trim() || undefined }))
        : [{ medio, monto: total, referencia: referencia.trim() || undefined }]
      const clienteId = cliente?.id ?? (await clientesServicio.publicoGeneral()).id
      const r = await posServicio.cobrar({
        tipo, serie, clienteId, pagos,
        recibido: efectivo > 0 ? r2(recibidoN) : undefined,
        whatsapp: whatsapp || undefined,
        documentoId: reintentar,
        lineas: lineas.map(l => ({
          productoId: l.productoId, codigo: l.codigo, descripcion: l.descripcion, unidadMedida: l.unidadMedida,
          cantidad: l.cantidad, valorUnitario: l.valorUnitario, descuento: l.descuento, tipoAfectacion: l.tipoAfectacion,
        })),
      })
      onCobrado(r)
      if (imprimir) {
        documentosServicio.pdf(r.id, 'ticket80').then(imprimirPdf)
          .catch(() => mensaje.ojo('La venta salió, pero el ticket no se pudo imprimir. Imprímelo desde el comprobante.'))
      }
    } catch (e) {
      if (e instanceof ErrorApi && e.codigo?.startsWith('reintentar:')) setReintentar(e.codigo.slice('reintentar:'.length))
      setFallo(e instanceof ErrorApi ? e.message : 'No se pudo cobrar.')
    } finally { setOcupado(false) }
  }

  return (
    <Dialogo titulo={`Cobrar ${tipo === '01' ? 'factura' : 'boleta'} · ${cliente?.razonSocial ?? 'Público en general'}`}
             abierto onCerrar={() => { if (!ocupado && !reintentar) onCerrar() }} ancho="grande"
             acciones={<>
               {!reintentar && <Boton estilo="secundario" onClick={onCerrar} disabled={ocupado}>Volver</Boton>}
               <Boton onClick={() => void cobrar()} disabled={!!problema} ocupado={ocupado} textoOcupado="Emitiendo…">
                 {reintentar ? 'Reintentar el envío' : `Cobrar y emitir S/ ${dinero(total)}`}
               </Boton>
             </>}>
      <form className="pos-cobro" onSubmit={e => { e.preventDefault(); void cobrar() }}>
        <div className="pos-total-cobro"><span>Total</span><b className="mono">S/ {dinero(total)}</b></div>
        <div className="pos-medios" role="radiogroup" aria-label="Medio de pago">
          {[...MEDIOS, { codigo: 'mixto' as const, nombre: 'Mixto' }].map(m => (
            <button type="button" key={m.codigo} role="radio" aria-checked={medio === m.codigo} disabled={!!reintentar}
                    className={medio === m.codigo ? 'on' : ''} onClick={() => setMedio(m.codigo)}>{m.nombre}</button>
          ))}
        </div>

        {medio === 'efectivo' && (
          <div className="pos-dos">
            <label className="pos-campo">
              <span>Recibido en efectivo (S/)</span>
              <input className="grande" inputMode="decimal" autoFocus value={recibido} placeholder={dinero(total)} disabled={!!reintentar}
                     onChange={e => setRecibido(e.target.value.replace(/[^\d.,]/g, ''))} />
            </label>
            <div className="pos-billetes">
              <button type="button" onClick={() => setRecibido('')}>Exacto</button>
              {sugeridos.map(v => <button type="button" key={v} onClick={() => setRecibido(String(v))}>S/ {v}</button>)}
            </div>
          </div>
        )}
        {(medio === 'yape' || medio === 'tarjeta' || medio === 'transferencia') && (
          <label className="pos-campo">
            <span>{medio === 'yape' ? 'N.° de operación de Yape / Plin' : medio === 'tarjeta' ? 'N.° de operación (voucher)' : 'N.° de operación'} (opcional)</span>
            <input value={referencia} maxLength={60} onChange={e => setReferencia(e.target.value)} autoFocus disabled={!!reintentar} />
          </label>
        )}
        {medio === 'mixto' && (
          <div className="pos-mixto">
            {MEDIOS.map(m => (
              <div key={m.codigo} className="pos-mixto-fila">
                <span>{m.nombre}</span>
                <input inputMode="decimal" placeholder="0.00" value={mixto[m.codigo]} disabled={!!reintentar}
                       onChange={e => setMixto(x => ({ ...x, [m.codigo]: e.target.value.replace(/[^\d.,]/g, '') }))} />
                {m.codigo !== 'efectivo'
                  ? <input placeholder="N.° de operación" value={refs[m.codigo]} maxLength={60} disabled={!!reintentar}
                           onChange={e => setRefs(x => ({ ...x, [m.codigo]: e.target.value }))} />
                  : <input placeholder="Recibido (para el vuelto)" inputMode="decimal" value={recibido} disabled={!!reintentar}
                           onChange={e => setRecibido(e.target.value.replace(/[^\d.,]/g, ''))} />}
              </div>
            ))}
            <p className="nota">Suma: S/ {dinero(sumaMixto)} de S/ {dinero(total)}.</p>
          </div>
        )}

        {efectivo > 0 && vuelto > 0 && (
          <div className="pos-vuelto"><span>Vuelto</span><b className="mono">S/ {dinero(vuelto)}</b></div>
        )}
        {problema && <p className="pos-falta">{problema}</p>}

        <div className="pos-opciones">
          <label><input type="checkbox" checked={imprimir} onChange={e => setImprimir(e.target.checked)} /> Imprimir ticket (80 mm)</label>
          <label><input type="checkbox" checked={whatsapp} onChange={e => setWhatsapp(e.target.checked)} disabled={!cliente} /> Enviar por WhatsApp</label>
          <span className="nota">Sale con la serie {serie}.</span>
        </div>
        {fallo && <Aviso>{fallo}</Aviso>}
        <button type="submit" hidden />
      </form>
    </Dialogo>
  )
}


// =============================================================================
// INGRESO O RETIRO
// =============================================================================

const MOTIVOS_RETIRO = ['Depósito al banco', 'Gasto: movilidad', 'Gasto: compra menor', 'Devolución a un cliente', 'Adelanto', 'Otro']
const MOTIVOS_INGRESO = ['Sencillo / cambio', 'Aporte del dueño', 'Otro']

function Movimiento({ onCerrar }: { onCerrar: (mensaje?: string) => void }) {
  const [tipo, setTipo] = useState<'ingreso' | 'retiro'>('retiro')
  const [monto, setMonto] = useState('')
  const [motivo, setMotivo] = useState(MOTIVOS_RETIRO[0])
  const [otro, setOtro] = useState('')
  const [detalle, setDetalle] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string>()
  const motivos = tipo === 'retiro' ? MOTIVOS_RETIRO : MOTIVOS_INGRESO
  const motivoFinal = motivo === 'Otro' ? otro.trim() : motivo

  const registrar = async () => {
    setOcupado(true); setFallo(undefined)
    try {
      const r = await posServicio.movimiento({ tipo, monto: num(monto), motivo: motivoFinal, detalle: detalle.trim() || undefined })
      onCerrar(r.mensaje)
    } catch (e) { setFallo(e instanceof ErrorApi ? e.message : 'No se pudo registrar.') }
    finally { setOcupado(false) }
  }

  return (
    <Dialogo titulo="Movimiento de caja" abierto onCerrar={() => onCerrar()}
             acciones={<>
               <Boton estilo="secundario" onClick={() => onCerrar()}>Cancelar</Boton>
               <Boton onClick={() => void registrar()} ocupado={ocupado} disabled={!(num(monto) > 0) || motivoFinal.length < 3}>
                 Registrar {tipo}
               </Boton>
             </>}>
      <div className="pos-cobro">
        <div className="pos-tipo angosto">
          <button type="button" className={tipo === 'ingreso' ? 'on' : ''} onClick={() => { setTipo('ingreso'); setMotivo(MOTIVOS_INGRESO[0]) }}>Ingreso</button>
          <button type="button" className={tipo === 'retiro' ? 'on' : ''} onClick={() => { setTipo('retiro'); setMotivo(MOTIVOS_RETIRO[0]) }}>Retiro / gasto</button>
        </div>
        <div className="pos-dos">
          <label className="pos-campo"><span>Monto (S/)</span>
            <input className="grande" inputMode="decimal" autoFocus value={monto} onChange={e => setMonto(e.target.value.replace(/[^\d.,]/g, ''))} /></label>
          <label className="pos-campo"><span>Motivo</span>
            <select value={motivo} onChange={e => setMotivo(e.target.value)}>{motivos.map(m => <option key={m}>{m}</option>)}</select></label>
        </div>
        {motivo === 'Otro' && <label className="pos-campo"><span>¿Cuál?</span><input value={otro} maxLength={80} onChange={e => setOtro(e.target.value)} /></label>}
        <label className="pos-campo"><span>Detalle (opcional)</span>
          <input value={detalle} maxLength={250} onChange={e => setDetalle(e.target.value)} placeholder="Ej.: taxi para entregar un pedido" /></label>
        <p className="nota">Solo efectivo. Queda en el arqueo con tu nombre y la hora.</p>
        {fallo && <Aviso>{fallo}</Aviso>}
      </div>
    </Dialogo>
  )
}


// =============================================================================
// LAS VENTAS DE ESTA CAJA
// =============================================================================

function VentasDeLaCaja({ onCerrar }: { onCerrar: () => void }) {
  const [d, setD] = useState<DetalleCaja>()
  const [fallo, setFallo] = useState<string>()
  useEffect(() => {
    posServicio.resumen().then(setD).catch(e => setFallo(e instanceof ErrorApi ? e.message : 'No se pudo leer.'))
  }, [])
  return (
    <Dialogo titulo="Ventas de esta caja" abierto onCerrar={onCerrar} ancho="grande"
             acciones={<Boton onClick={onCerrar}>Cerrar</Boton>}>
      {fallo && <Aviso>{fallo}</Aviso>}
      {!d && !fallo && <Cargando />}
      {d && <TablaVentas d={d} />}
    </Dialogo>
  )
}

/** e175: de 20 en 20, con búsqueda (número o cliente) y orden. */
export function TablaVentas({ d }: { d: DetalleCaja }) {
  if (d.ventas.length === 0) return <p className="nota">Todavía no hay ventas.</p>
  const cuenta = (e: string) => ['encolado', 'aceptado', 'observado'].includes(e)
  return (
    <TablaDatos filas={d.ventas} clave={v => v.id} buscar={v => [v.numero, v.cliente]} textoBuscar="Número o cliente"
      ordenInicial={{ clave: 'hora', desc: true }}
      columnas={[
        { clave: 'hora', titulo: 'Hora', clase: 'secundario', celda: v => hora(v.en), orden: v => v.en },
        { clave: 'numero', titulo: 'Comprobante', orden: v => v.numero,
          celda: v => <Link className="mono" to={`/facturacion/comprobantes/${v.id}`} target="_blank">{v.numero}</Link> },
        { clave: 'cliente', titulo: 'Cliente', celda: v => v.cliente, orden: v => v.cliente },
        { clave: 'pago', titulo: 'Pago', clase: 'secundario',
          celda: v => <>{(v.pagos ?? []).map(p => `${nombreMedio(p.medio)} ${dinero(p.monto)}`).join(' + ')}{v.vuelto > 0 && ` · vuelto ${dinero(v.vuelto)}`}</> },
        { clave: 'total', titulo: 'Total', clase: 'derecha mono', celda: v => dinero(v.total), orden: v => v.total },
        { clave: 'estado', titulo: 'Estado', orden: v => (cuenta(v.estado) ? 0 : 1),
          celda: v => cuenta(v.estado)
            ? <span className="texto-bien">{v.estado === 'encolado' ? 'En camino' : 'Aceptado'}</span>
            : <span className="texto-mal">{v.estado === 'error' ? 'No se envió (no cuenta)' : v.estado === 'rechazado' ? 'Rechazado (no cuenta)' : v.estado}</span> },
      ]} />
  )
}


// =============================================================================
// CERRAR CAJA
// =============================================================================

function CerrarCaja({ onVolver, onCerrada }: { onVolver: () => void; onCerrada: (c: { id: string; mensaje: string }) => void }) {
  const [d, setD] = useState<DetalleCaja>()
  const [fallo, setFallo] = useState<string>()
  const [contado, setContado] = useState('')
  const [observacion, setObservacion] = useState('')
  const [deja, setDeja] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [contando, setContando] = useState(false)

  useEffect(() => {
    posServicio.resumen().then(r => { setD(r); setDeja(r.sesion.fondo.toFixed(2)) })
      .catch(e => setFallo(e instanceof ErrorApi ? e.message : 'No se pudo leer la caja.'))
  }, [])

  if (fallo) return <div className="pos-centro"><Aviso>{fallo}</Aviso><Boton estilo="secundario" onClick={onVolver}>Volver</Boton></div>
  if (!d) return <Cargando texto="Sumando la caja…" />

  const contadoN = num(contado)
  const diferencia = contado.trim() ? r2(contadoN - d.esperado) : null
  const dejaN = Math.min(num(deja), contadoN)
  const entrega = r2(contadoN - dejaN)
  const listo = contado.trim() !== '' && (diferencia === 0 || observacion.trim().length >= 3)

  const cerrar = async () => {
    setOcupado(true); setFallo(undefined)
    try {
      const r = await posServicio.cerrar({ contado: contadoN, observacion: observacion.trim() || undefined, dejaEnCaja: dejaN, entrega })
      onCerrada(r)
    } catch (e) { setFallo(e instanceof ErrorApi ? e.message : 'No se pudo cerrar la caja.') }
    finally { setOcupado(false) }
  }

  return (
    <div className="pos-cierre">
      <div className="pos-cierre-cab">
        <div><h1 className="pos-titulo">Cerrar {d.sesion.caja}</h1><p className="pos-sub">Cuenta el efectivo. El sistema compara con lo que debería haber.</p></div>
        <Boton estilo="secundario" onClick={onVolver}>Volver a vender</Boton>
      </div>
      <div className="pos-cierre-cuerpo">
        <ArqueoSistemaTabla a={d.arqueo} esperado={d.esperado} />
        <section className="pos-tarjeta">
          <h2 className="pos-h2">Lo que contaste</h2>
          <div className="pos-dos">
            <label className="pos-campo"><span>Efectivo contado (S/)</span>
              <input className="grande" inputMode="decimal" autoFocus value={contado} onChange={e => setContado(e.target.value.replace(/[^\d.,]/g, ''))} /></label>
            <div className="pos-campo"><span>&nbsp;</span>
              <button type="button" className="boton secundario" onClick={() => setContando(true)}>Contar por billetes y monedas</button></div>
          </div>
          {diferencia !== null && (
            <div className={`pos-diferencia${diferencia === 0 ? ' ok' : ''}`}>
              <span>Diferencia</span>
              <b className="mono">{diferencia === 0 ? 'S/ 0.00 · cuadra' : `${diferencia > 0 ? '+' : '−'} S/ ${dinero(Math.abs(diferencia))} (${diferencia > 0 ? 'sobra' : 'falta'})`}</b>
            </div>
          )}
          {diferencia !== null && diferencia !== 0 && (
            <label className="pos-campo"><span>¿Qué pasó? (obligatorio si hay diferencia)</span>
              <input value={observacion} maxLength={250} onChange={e => setObservacion(e.target.value)} placeholder="Ej.: se dio vuelto de más a un cliente" /></label>
          )}
          <div className="pos-dos">
            <label className="pos-campo"><span>Dejas en caja para mañana (S/)</span>
              <input inputMode="decimal" value={deja} onChange={e => setDeja(e.target.value.replace(/[^\d.,]/g, ''))} /></label>
            <div className="pos-campo"><span>Entregas o depositas (S/)</span><input value={dinero(entrega)} readOnly /></div>
          </div>
          {fallo && <Aviso>{fallo}</Aviso>}
          <div className="pos-pie">
            <Boton onClick={() => void cerrar()} disabled={!listo} ocupado={ocupado} textoOcupado="Cerrando…">Cerrar caja</Boton>
          </div>
          <p className="nota">Cerrada, no se puede vender en ella hasta abrir otra. El arqueo queda en «Cajas» y no se borra.</p>
        </section>
      </div>
      {contando && <ContarBilletes onCerrar={() => setContando(false)} onListo={v => { setContado(v.toFixed(2)); setContando(false) }} />}
    </div>
  )
}

export function ArqueoSistemaTabla({ a, esperado }: { a: DetalleCaja['arqueo']; esperado: number }) {
  return (
    <section className="pos-tarjeta">
      <h2 className="pos-h2">Lo que dice el sistema</h2>
      <table className="tabla">
        <thead><tr><th>Medio</th><th className="derecha">Ventas</th><th className="derecha">Monto</th></tr></thead>
        <tbody>
          {a.medios.map(m => (
            <tr key={m.medio}><td>{nombreMedio(m.medio)}</td><td className="derecha">{m.ventas}</td><td className="derecha mono">{dinero(m.monto)}</td></tr>
          ))}
          <tr className="fila-total"><td><strong>Total vendido</strong></td><td className="derecha"><strong>{a.ventas}</strong></td><td className="derecha mono"><strong>{dinero(a.vendido)}</strong></td></tr>
        </tbody>
      </table>
      <table className="tabla pos-calculo">
        <tbody>
          <tr><td>Fondo inicial</td><td className="derecha mono">{dinero(a.fondo)}</td></tr>
          <tr><td>+ Ventas en efectivo</td><td className="derecha mono">{dinero(a.efectivo)}</td></tr>
          <tr><td>+ Ingresos{a.ingresosCuantos > 0 && ` (${a.ingresosCuantos})`}</td><td className="derecha mono">{dinero(a.ingresos)}</td></tr>
          <tr><td>− Retiros y gastos{a.retirosCuantos > 0 && ` (${a.retirosCuantos})`}</td><td className="derecha mono">−{dinero(a.retiros)}</td></tr>
          <tr className="fila-total"><td><strong>Efectivo esperado</strong></td><td className="derecha mono"><strong>{dinero(esperado)}</strong></td></tr>
        </tbody>
      </table>
      {a.noCuentan > 0 && (
        <p className="nota">{a.noCuentan} venta(s) no cuentan: su comprobante no llegó a SUNAT o fue rechazado. Revísalas en «Ventas de esta caja».</p>
      )}
    </section>
  )
}

const DENOMINACIONES = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1]

function ContarBilletes({ onCerrar, onListo }: { onCerrar: () => void; onListo: (v: number) => void }) {
  const [c, setC] = useState<Record<string, string>>({})
  const total = r2(DENOMINACIONES.reduce((s, d) => s + d * num(c[d] ?? ''), 0))
  return (
    <Dialogo titulo="Contar el efectivo" abierto onCerrar={onCerrar}
             acciones={<><Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton><Boton onClick={() => onListo(total)}>Usar S/ {dinero(total)}</Boton></>}>
      <div className="pos-billetes-grid">
        {DENOMINACIONES.map(d => (
          <label key={d}>
            <span>{d >= 10 ? `Billete S/ ${d}` : `Moneda S/ ${d.toFixed(d < 1 ? 2 : 0)}`}</span>
            <input inputMode="numeric" value={c[d] ?? ''} placeholder="0" onChange={e => setC(x => ({ ...x, [d]: e.target.value.replace(/\D/g, '') }))} />
            <span className="mono">{dinero(d * num(c[d] ?? ''))}</span>
          </label>
        ))}
      </div>
      <p className="pos-total-cobro"><span>Total</span><b className="mono">S/ {dinero(total)}</b></p>
    </Dialogo>
  )
}