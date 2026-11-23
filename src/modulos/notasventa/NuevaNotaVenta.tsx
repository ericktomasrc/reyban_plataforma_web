import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Aviso } from '../../componentes/Aviso'
import { Boton } from '../../componentes/Boton'
import { ErrorApi } from '../../nucleo/api/errores'
import { useConfirmar } from '../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../nucleo/mensajes/ProveedorMensajes'
import { MEDIOS, type MedioPago } from '../deudas/deudasServicio'
import { BuscadorCliente } from '../facturacion/componentes/BuscadorCliente'
import { BuscadorProducto } from '../facturacion/componentes/BuscadorProducto'
import { sucursalesServicio, type SucursalMia } from '../facturacion/servicios/facturacionServicio'
import type { ClienteEnLista, ProductoEnLista } from '../facturacion/tipos'
import { inventarioServicio, type Disponible } from '../inventario/servicios/inventarioServicio'
import '../facturacion/comprobante.css'
import './notas-venta.css'
import { dinero } from './formatoNotas'
import { notasVentaServicio, type FormaNota } from './notasVentaServicio'

/**
 * e282 (097) — NUEVA NOTA DE VENTA. Como una boleta, pero sin SUNAT. Contado
 * (con su medio), fiado (paga hasta) o pedido (se separa el stock y se entrega
 * después). Al guardar se abre la nota con su ticket para imprimir.
 */

interface Linea {
  clave: string
  productoId: string
  descripcion: string
  unidad: string
  presentacionId: string | null
  factor: number
  controla: boolean
  cantidad: string
  precio: string
}

const num = (s: string) => { const n = Number((s ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
// En enteros (céntimos y diezmilésimas), como el servidor: 3 × 15.10 = 45.30 exacto.
const importe = (l: Linea) => Math.floor((Math.round(num(l.cantidad) * 10_000) * Math.round(num(l.precio) * 100) + 5_000) / 10_000) / 100
const hoyLima = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
const masDias = (d: number) => { const x = new Date(`${hoyLima()}T12:00:00`); x.setDate(x.getDate() + d); return x.toLocaleDateString('en-CA') }

/** El precio que se cobra por unidad (con IGV si es gravado). */
function precioDe(p: ProductoEnLista) {
  const v = p.tipoAfectacion === '10' && !p.incluyeIgv ? p.precioUnitario * 1.18 : p.precioUnitario
  return (Math.round((v + Number.EPSILON) * 100) / 100).toFixed(2)
}

export function NuevaNotaVenta() {
  const navegar = useNavigate()
  const mensaje = useMensaje()
  const { pedir, dialogo } = useConfirmar()
  const [cliente, setCliente] = useState<ClienteEnLista>()
  const [lineas, setLineas] = useState<Linea[]>([])
  const [forma, setForma] = useState<FormaNota>('contado')
  const [medio, setMedio] = useState<MedioPago>('efectivo')
  const [vence, setVence] = useState(masDias(7))
  const [entrega, setEntrega] = useState('')
  const [seLoLleva, setSeLoLleva] = useState(true)
  const [nota, setNota] = useState('')
  const [sucursales, setSucursales] = useState<SucursalMia[]>([])
  const [sucursalId, setSucursalId] = useState('')
  const [disp, setDisp] = useState<Disponible>()
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string>()

  useEffect(() => {
    let vivo = true
    sucursalesServicio.mias().then(r => {
      if (!vivo) return
      setSucursales(r.sucursales)
      const d = r.defectoId && r.sucursales.some(s => s.id === r.defectoId) ? r.defectoId : r.sucursales[0]?.id
      if (d) setSucursalId(d)
    }).catch(() => { /* la API elige la sucursal */ })
    return () => { vivo = false }
  }, [])

  // Lo disponible de lo elegido, en la sucursal de la nota.
  const ids = [...new Set(lineas.map(l => l.productoId))].sort().join(',')
  useEffect(() => {
    if (!ids || !sucursalId) return
    let vivo = true
    const t = setTimeout(() => {
      inventarioServicio.disponible(ids.split(','), { sucursalId })
        .then(r => { if (vivo) setDisp(r) })
        .catch(() => { /* sin inventario: la base revisa igual */ })
    }, 300)
    return () => { vivo = false; clearTimeout(t) }
  }, [ids, sucursalId])

  const faltan = useMemo(() => {
    if (!disp?.encendido || !disp.productos) return []
    const pide = new Map<string, number>()
    for (const l of lineas) pide.set(l.productoId, (pide.get(l.productoId) ?? 0) + num(l.cantidad) * l.factor)
    return disp.productos.filter(p => p.controla && (pide.get(p.productoId) ?? 0) > p.disponible)
      .map(p => ({ ...p, pide: pide.get(p.productoId) ?? 0, descripcion: lineas.find(l => l.productoId === p.productoId)?.descripcion ?? '' }))
  }, [disp, lineas])

  const total = Math.round(lineas.reduce((s, l) => s + importe(l), 0) * 100) / 100

  function agregar(p: ProductoEnLista) {
    if (p.esModelo) { mensaje.ojo(`«${p.descripcion}» es un modelo: elige una de sus variantes.`); return }
    if (p.manejaSeries) { mensaje.ojo(`«${p.descripcion}» lleva número de serie: véndelo con boleta o factura.`); return }
    const presentacionId = p.presentacion?.id ?? null
    setLineas(ls => {
      const i = ls.findIndex(l => l.productoId === p.id && l.presentacionId === presentacionId)
      if (i >= 0) return ls.map((l, j) => j === i ? { ...l, cantidad: String(num(l.cantidad) + 1) } : l)
      return [...ls, {
        clave: crypto.randomUUID(), productoId: p.id, descripcion: p.descripcion, unidad: p.unidadMedida,
        presentacionId, factor: p.presentacion?.factor ?? 1, controla: !!p.controlaStock,
        cantidad: '1', precio: precioDe(p),
      }]
    })
  }
  const cambiar = (clave: string, c: Partial<Linea>) => setLineas(ls => ls.map(l => l.clave === clave ? { ...l, ...c } : l))

  function cambiarForma(f: FormaNota) {
    setForma(f)
    if (f === 'pedido') setSeLoLleva(false)
    else if (forma === 'pedido') setSeLoLleva(true)
  }

  const falta = lineas.length === 0 ? 'Agrega al menos un producto.'
    : lineas.some(l => num(l.cantidad) <= 0) ? 'Cada cantidad tiene que ser mayor que cero.'
    : lineas.some(l => num(l.precio) < 0) ? 'Revisa los precios.'
    : total <= 0 ? 'El total tiene que ser mayor que cero.'
    : forma === 'fiado' && !cliente ? 'Para fiar, elige al cliente: así sabes quién te debe.'
    : forma === 'pedido' && !cliente ? 'Para un pedido, elige al cliente.'
    : forma === 'fiado' && (!vence || vence < hoyLima()) ? 'Elige hasta qué fecha paga (hoy o después).'
    : null

  async function guardar() {
    if (falta) { setFallo(falta); return }
    const quien = cliente?.razonSocial ?? 'cliente varios'
    if (!await pedir({
      titulo: '¿Guardar la nota de venta?',
      confirmar: 'Sí, guardar e imprimir',
      mensaje: (
        <>
          <p><strong>S/ {dinero(total)}</strong> a {quien}.{' '}
            {forma === 'contado' && <>Al contado ({MEDIOS.find(m => m[0] === medio)?.[1].toLowerCase()}).</>}
            {forma === 'fiado' && <>Al fiado: queda <strong>por cobrar</strong> hasta el {new Date(`${vence}T12:00:00`).toLocaleDateString('es-PE')}.</>}
            {forma === 'pedido' && <>Pedido: se paga al entregarlo.</>}
          </p>
          <p>{seLoLleva ? 'Los productos salen del stock ahora.' : 'El stock queda separado hasta que lo entregues.'} No se envía a SUNAT.</p>
        </>
      ),
    })) return
    setOcupado(true); setFallo(undefined)
    try {
      const r = await notasVentaServicio.crear({
        sucursalId: sucursalId || null, clienteId: cliente?.id ?? null, forma,
        medio: forma === 'contado' ? medio : null,
        vence: forma === 'fiado' ? vence : null,
        entregaFecha: forma === 'pedido' && entrega ? entrega : null,
        seLoLleva: forma === 'pedido' ? false : seLoLleva,
        lineas: lineas.map(l => ({ productoId: l.productoId, cantidad: num(l.cantidad), precio: num(l.precio), presentacionId: l.presentacionId })),
        nota: nota.trim() || null,
      })
      mensaje.bien(r.mensaje)
      navegar(`/facturacion/notas-venta/${r.id}?imprimir=1`, { replace: true })
    } catch (e) {
      setFallo(e instanceof ErrorApi ? e.message : 'No se pudo guardar la nota.')
    } finally { setOcupado(false) }
  }

  return (
    <div className="nv-pagina nv-nueva">
      {dialogo}
      <div className="encabezado-pagina">
        <div>
          <p className="nv-migas"><Link to="/facturacion/notas-venta">Notas de venta</Link> › Nueva</p>
          <h1 className="titulo-pagina">Nueva nota de venta</h1>
          <p className="bajada-pagina">Igual que una boleta, pero sin SUNAT. Al guardar se abre el ticket para imprimir.</p>
        </div>
      </div>

      <div className="nv-dos">
        <section className="bloque nv-izq">
          <div className="nv-fila-cliente">
            <div className="nv-cliente">
              <BuscadorCliente elegido={cliente} onElegir={setCliente} />
              {cliente
                ? forma === 'contado' && <button type="button" className="enlace nv-quitar" onClick={() => setCliente(undefined)}>Quitar cliente (queda «cliente varios»)</button>
                : forma === 'contado' && <p className="nota nv-quitar">Opcional al contado: sin cliente es «cliente varios».</p>}
            </div>
            {sucursales.length > 1 && (
              <label className="campo nv-sucursal"><span className="nv-rotulo">Sucursal</span>
                <select value={sucursalId} onChange={e => setSucursalId(e.target.value)}>
                  {sucursales.map(s => <option key={s.id} value={s.id}>{s.codigo} · {s.nombre}</option>)}
                </select>
              </label>
            )}
          </div>

          <div className="tabla-envoltura">
            <table className="tabla nv-lineas">
              <thead><tr><th>Producto</th><th className="derecha">Cant.</th><th className="derecha">Precio</th><th className="derecha">Importe</th><th aria-label="Quitar" /></tr></thead>
              <tbody>
                {lineas.map(l => (
                  <tr key={l.clave}>
                    <td>{l.descripcion}<div className="secundario">{l.unidad}</div></td>
                    <td className="derecha"><input className="mono nv-num" inputMode="decimal" value={l.cantidad} aria-label={`Cantidad de ${l.descripcion}`}
                      onChange={e => cambiar(l.clave, { cantidad: e.target.value })} onFocus={e => e.target.select()} /></td>
                    <td className="derecha"><input className="mono nv-num" inputMode="decimal" value={l.precio} aria-label={`Precio de ${l.descripcion}`}
                      onChange={e => cambiar(l.clave, { precio: e.target.value })} onFocus={e => e.target.select()} /></td>
                    <td className="derecha mono">{dinero(importe(l))}</td>
                    <td className="derecha"><button type="button" className="nv-x" aria-label={`Quitar ${l.descripcion}`}
                      onClick={() => setLineas(ls => ls.filter(x => x.clave !== l.clave))}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="nv-buscar">
            <BuscadorProducto presentaciones="venta" placeholder="+ Agregar producto (código, nombre o lector)" onElegir={agregar} />
          </div>
          {faltan.length > 0 && (
            <Aviso tono={disp?.bloquea ? 'error' : 'info'}>
              {faltan.map(f => <div key={f.productoId}>«{f.descripcion}»: pides {f.pide} y hay {f.disponible} disponibles.</div>)}
              {disp?.bloquea ? 'Esta sucursal no deja vender sin stock.' : 'Se puede guardar igual: el stock quedará en negativo.'}
            </Aviso>
          )}
          <label className="campo nv-nota"><span className="nv-rotulo">Nota (opcional)</span>
            <input value={nota} maxLength={300} placeholder="Ej.: recoge su hija, entregar en la tienda" onChange={e => setNota(e.target.value)} /></label>
        </section>

        <aside className="bloque nv-der">
          <span className="nv-rotulo">¿Cómo paga?</span>
          <div className="segmentado nv-seg" role="radiogroup" aria-label="Cómo paga">
            {(['contado', 'fiado', 'pedido'] as const).map(f => (
              <button key={f} type="button" role="radio" aria-checked={forma === f} className={forma === f ? 'elegido' : undefined}
                onClick={() => cambiarForma(f)}>{f === 'contado' ? 'Contado' : f === 'fiado' ? 'Fiado' : 'Pedido'}</button>
            ))}
          </div>

          {forma === 'contado' && (
            <div className="campo"><span className="nv-rotulo">Medio de pago</span>
              <div className="cmp-chips nv-medios" role="group" aria-label="Medio de pago">
                {MEDIOS.map(([v, t]) => (
                  <button key={v} type="button" className={medio === v ? 'cmp-chip elegido' : 'cmp-chip'} aria-pressed={medio === v} onClick={() => setMedio(v)}>{t}</button>
                ))}
              </div>
            </div>
          )}
          {forma === 'fiado' && (
            <label className="campo"><span className="nv-rotulo">Paga hasta</span>
              <input type="date" value={vence} min={hoyLima()} onChange={e => setVence(e.target.value)} /></label>
          )}
          {forma === 'pedido' && (
            <label className="campo"><span className="nv-rotulo">Fecha de entrega (opcional)</span>
              <input type="date" value={entrega} min={hoyLima()} onChange={e => setEntrega(e.target.value)} /></label>
          )}

          {forma !== 'pedido' ? (
            <>
              <span className="nv-rotulo">¿Sale ahora del stock?</span>
              <div className="segmentado nv-seg" role="radiogroup" aria-label="Sale ahora del stock">
                <button type="button" role="radio" aria-checked={seLoLleva} className={seLoLleva ? 'elegido' : undefined} onClick={() => setSeLoLleva(true)}>Sí, se lo lleva</button>
                <button type="button" role="radio" aria-checked={!seLoLleva} className={!seLoLleva ? 'elegido' : undefined} onClick={() => setSeLoLleva(false)}>No, lo recoge después</button>
              </div>
            </>
          ) : <p className="secundario nv-texto">El stock queda <strong>separado</strong> hasta que lo entregues. Al entregar eliges si paga al contado o al fiado.</p>}

          <div className="nv-totales">
            <div><span>Productos</span><span>{lineas.length}</span></div>
            <div className="nv-total"><span>Total</span><strong>S/ {dinero(total)}</strong></div>
          </div>

          {forma === 'fiado' && (
            <div className="aviso ojo nv-aviso">
              Fiado: queda en <strong>Cobros y pagos › Por cobrar</strong>{cliente ? <> a nombre de {cliente.razonSocial}</> : null} hasta que pague. Cada pago se anota ahí
              o en la misma nota.
            </div>
          )}
          {fallo && <Aviso>{fallo}</Aviso>}
          <div className="nv-botones">
            <Link className="boton secundario" to="/facturacion/notas-venta">Cancelar</Link>
            <Boton onClick={() => void guardar()} ocupado={ocupado} textoOcupado="Guardando…" disabled={lineas.length === 0}>Guardar e imprimir</Boton>
          </div>
        </aside>
      </div>
    </div>
  )
}