import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { comprasServicio, type Compra } from '../../compras/comprasServicio'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import type { ProductoEnLista } from '../../facturacion/tipos'
import { BuscadorProductoStock } from '../componentes/BuscadorProductoStock'
import { ElegirProveedor, type ProveedorElegido } from '../componentes/ElegirProveedor'
import { InventarioApagado } from '../componentes/InventarioApagado'
import { useEstadoInventario, useSucursalesDeTrabajo } from '../componentes/usoInventario'
import { cantidad, inventarioServicio, type Almacen, type MinimoEnSucursal } from '../servicios/inventarioServicio'
import '../inventario.css'

interface Linea { producto: ProductoEnLista; cantidad: string; costo: string; antes?: number
  /** 061: comprado en una presentación (CAJA X 12): cantidad y costo son por caja. */
  pres?: string
  /** 064: producto con lotes: el lote y su vencimiento. */
  lote?: string; vence?: string
  /** 065: producto con series: los números, uno por línea. */
  series?: string }

/** 065: los números escritos (uno por línea, o separados por coma). */
const seriesDe = (l: Linea) => (l.series ?? '').split(/[\n,;]+/).map(x => x.trim().toUpperCase()).filter(Boolean)

/** 061: la presentación elegida de una línea (si la hay) y cuántas unidades entran. */
const presDe = (l: Linea) => l.pres ? l.producto.presentaciones?.find(x => x.id === l.pres) : undefined
const unidadesDe = (l: Linea) => numero(l.cantidad) * (presDe(l)?.factor ?? 1)

const hoyLima = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10)
const numero = (s: string) => { const n = Number(s.replace(',', '.')); return Number.isFinite(n) ? n : NaN }

/**
 * 052 — INGRESO POR COMPRA: la mercadería que llegó de un proveedor. Suma al
 * físico de la sucursal elegida. El costo es opcional (servirá para el
 * inventario valorizado).
 */
export function NuevoIngreso() {
  const navegar = useNavigate()
  const mensaje = useMensaje()
  const { estado, error } = useEstadoInventario()
  const { sucursales, defecto } = useSucursalesDeTrabajo(estado)
  const [sucursal, setSucursal] = useState('')
  const [proveedor, setProveedor] = useState<ProveedorElegido>(null)
  const [documento, setDocumento] = useState('')
  const [fecha, setFecha] = useState(hoyLima())
  const [moneda, setMoneda] = useState('PEN')
  const [nota, setNota] = useState('')
  const [lineas, setLineas] = useState<Linea[]>([])
  const [guardando, setGuardando] = useState(false)
  // 066: los almacenes de la sucursal (si tiene) y a cuál entra.
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [almacen, setAlmacen] = useState('')

  // e182: desde «Compras y gastos»: el proveedor y el comprobante ya puestos,
  // y al guardar la compra queda enlazada a este ingreso.
  const [params] = useSearchParams()
  const compraId = params.get('compra')
  const [compra, setCompra] = useState<Compra>()
  useEffect(() => {
    if (!compraId) return
    let vivo = true
    comprasServicio.ver(compraId).then(c => {
      if (!vivo) return
      setCompra(c)
      if (c.serie && c.numero) setDocumento(`${c.serie}-${c.numero}`)
      setFecha(c.fecha)
      setMoneda(c.moneda)
      if (c.descripcion) setNota(c.descripcion)
      if (c.proveedorId && c.proveedorDoc && c.proveedorNombre)
        setProveedor({ guardado: { id: c.proveedorId, tipoDocumento: c.proveedorTipoDoc ?? '6', numeroDocumento: c.proveedorDoc, razonSocial: c.proveedorNombre } })
    }).catch(() => { /* se llena a mano */ })
    return () => { vivo = false }
  }, [compraId])

  const sucursalElegida = sucursal || defecto

  // 066: los almacenes de la sucursal elegida.
  useEffect(() => {
    if (!sucursalElegida) return
    let vivo = true
    inventarioServicio.almacenes(sucursalElegida)
      .then(a => { if (vivo) { setAlmacenes(a); setAlmacen('') } })
      .catch(() => { if (vivo) setAlmacenes([]) })
    return () => { vivo = false }
  }, [sucursalElegida])

  // Lo que hay ahora de cada producto en la sucursal (para «pasa de X a Y»).
  const ids = lineas.map(l => l.producto.id).join(',')
  useEffect(() => {
    if (!ids || !sucursalElegida) return
    let vivo = true
    void Promise.all(ids.split(',').map(id => inventarioServicio.minimos(id).then(m => [id, m] as [string, MinimoEnSucursal[]])))
      .then(r => {
        if (!vivo) return
        const antes = new Map(r.map(([id, m]) => [id, m.find(x => x.sucursalId === sucursalElegida)?.fisico ?? 0]))
        setLineas(ls => ls.map(l => ({ ...l, antes: antes.get(l.producto.id) })))
      })
      .catch(() => { /* sin «antes»: no pasa nada */ })
    return () => { vivo = false }
  }, [ids, sucursalElegida])

  if (error) return <Aviso>{error}</Aviso>
  if (!estado) return <Cargando />
  if (!estado.encendido) return <InventarioApagado titulo="Ingreso por compra" />

  const malas = lineas.filter(l => !(numero(l.cantidad) > 0) || (l.costo.trim() !== '' && !(numero(l.costo) >= 0))
    || (!!l.producto.manejaLotes && !l.lote?.trim())   // 064: con lotes, el lote es obligatorio
    || (!!l.producto.manejaSeries && seriesDe(l).length !== unidadesDe(l)))   // 065: un número por unidad
  const total = lineas.reduce((s, l) => s + (l.costo.trim() && numero(l.cantidad) > 0 ? numero(l.cantidad) * numero(l.costo) : 0), 0)
  const simbolo = moneda === 'USD' ? 'US$' : 'S/'

  async function registrar() {
    if (lineas.length === 0) { mensaje.error('Agrega al menos un producto.'); return }
    if (malas.length > 0) { mensaje.error('Revisa las cantidades, los costos y los lotes marcados.'); return }
    setGuardando(true)
    try {
      const r = await inventarioServicio.ingresar({
        sucursalId: sucursalElegida,
        almacenId: almacenes.length > 0 && almacen ? almacen : null,   // 066
        proveedorId: proveedor && 'guardado' in proveedor ? proveedor.guardado.id : null,
        proveedor: proveedor && 'nuevo' in proveedor ? proveedor.nuevo : null,
        documentoProveedor: documento.trim() || null,
        fecha, moneda, nota: nota.trim() || null,
        lineas: lineas.map(l => ({ productoId: l.producto.id, cantidad: numero(l.cantidad), costoUnitario: l.costo.trim() ? numero(l.costo) : null,
                                   presentacionId: presDe(l)?.id ?? null,
                                   lote: l.lote?.trim() || null, vence: l.vence || null,
                                   series: l.producto.manejaSeries ? seriesDe(l) : null })),
      })
      if (compra) {
        try { await comprasServicio.enlazarIngreso(compra.id, r.id) } catch { /* el ingreso ya está; el enlace se puede rehacer */ }
      }
      mensaje.bien(r.mensaje)
      navegar(`/inventario/operaciones/${r.id}`)
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo registrar el ingreso.')
    } finally {
      setGuardando(false)
    }
  }

  const nombreSucursal = sucursales.find(s => s.id === sucursalElegida)

  return (
    <>
      <Link to="/inventario/ingresos" className="enlace-volver">← Ingresos por compra</Link>
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">Ingreso por compra</h1>
          <p className="secundario">La mercadería que llegó de un proveedor. Suma al físico de la sucursal que elijas. No es un comprobante electrónico: solo se anota la factura del proveedor.</p>
        </div>
      </div>

      <div className="bloque">
        <h2 className="subtitulo">De quién y a dónde</h2>
        <div className="rejilla-4">
          <div className="ancho-2"><ElegirProveedor valor={proveedor} onCambio={setProveedor} /></div>
          <label className="campo">
            <span className="etiqueta">Su factura</span>
            <input className="mono" value={documento} maxLength={40} placeholder="E001-552" onChange={e => setDocumento(e.target.value.toUpperCase())} />
            <span className="pista">Serie-número de la factura o guía del proveedor</span>
          </label>
          <label className="campo">
            <span className="etiqueta">Fecha de llegada</span>
            <input type="date" value={fecha} max={hoyLima()} onChange={e => setFecha(e.target.value)} />
          </label>
          <label className="campo">
            <span className="etiqueta">Entra a la sucursal</span>
            <select value={sucursalElegida} onChange={e => setSucursal(e.target.value)} disabled={sucursales.length <= 1}>
              {sucursales.map(s => <option key={s.id} value={s.id}>{s.codigo} {s.nombre}</option>)}
            </select>
            <span className="pista">Solo las sucursales en las que trabajas</span>
          </label>
          {/* 066: con varios almacenes, a cuál entra. */}
          {almacenes.length > 0 && (
            <label className="campo">
              <span className="etiqueta">Entra al almacén</span>
              <select value={almacen || almacenes.find(a => a.principal)?.id || ''} onChange={e => setAlmacen(e.target.value)}>
                {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre}{a.principal ? ' (principal)' : ''}</option>)}
              </select>
            </label>
          )}
          <label className="campo">
            <span className="etiqueta">Moneda del costo</span>
            <select value={moneda} onChange={e => setMoneda(e.target.value)}>
              <option value="PEN">Soles (PEN)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </label>
          <label className="campo ancho-2">
            <span className="etiqueta">Observación (opcional)</span>
            <input value={nota} maxLength={250} placeholder="Ej.: llegó con 2 bolsas rotas" onChange={e => setNota(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="bloque">
        <h2 className="subtitulo">Qué llegó</h2>
        <table className="tabla inv-lineas">
          <thead>
            <tr>
              <th>Producto</th><th className="num">Cantidad</th><th>Unidad</th>
              <th className="num">Costo unit. sin IGV <span className="secundario">(opcional, por unidad de compra)</span></th>
              <th className="num">Subtotal</th><th />
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => {
              const malaCantidad = l.cantidad !== '' && !(numero(l.cantidad) > 0)
              const malCosto = l.costo.trim() !== '' && !(numero(l.costo) >= 0)
              return (
                <tr key={l.producto.id}>
                  <td>
                    <div className="principal">{l.producto.descripcion}</div>
                    <div className="secundario mono">{l.producto.codigo}</div>
                    {/* 065: con series, un número por unidad. */}
                    {l.producto.manejaSeries && (
                      <div className="inv-series">
                        <textarea className="mono" rows={Math.min(6, Math.max(2, seriesDe(l).length + 1))} value={l.series ?? ''}
                                  placeholder="Números de serie, uno por línea" aria-label={`Números de serie de ${l.producto.descripcion}`}
                                  aria-invalid={l.cantidad !== '' && seriesDe(l).length !== unidadesDe(l)}
                                  onChange={e => setLineas(ls => ls.map((x, j) => j === i ? { ...x, series: e.target.value } : x))} />
                        <span className="secundario">{seriesDe(l).length} de {cantidad(unidadesDe(l))}</span>
                      </div>
                    )}
                    {/* 064: con lotes, el lote (obligatorio) y su vencimiento. */}
                    {l.producto.manejaLotes && (
                      <div className="inv-lote">
                        <input className="mono" value={l.lote ?? ''} placeholder="Lote" maxLength={40} aria-label={`Lote de ${l.producto.descripcion}`}
                               aria-invalid={!l.lote?.trim() && l.cantidad !== ''}
                               onChange={e => setLineas(ls => ls.map((x, j) => j === i ? { ...x, lote: e.target.value.toUpperCase() } : x))} />
                        <input type="date" value={l.vence ?? ''} aria-label={`Vencimiento de ${l.producto.descripcion}`}
                               onChange={e => setLineas(ls => ls.map((x, j) => j === i ? { ...x, vence: e.target.value } : x))} />
                      </div>
                    )}
                  </td>
                  <td className="num">
                    <input className="cantidad mono" inputMode="decimal" value={l.cantidad} aria-invalid={malaCantidad} autoFocus={i === lineas.length - 1}
                           aria-label={`Cantidad de ${l.producto.descripcion}`}
                           onChange={e => setLineas(ls => ls.map((x, j) => j === i ? { ...x, cantidad: e.target.value } : x))} />
                  </td>
                  <td>
                    {/* 061: en qué se compró: la unidad del producto o una presentación (caja, saco…). */}
                    {(l.producto.presentaciones ?? []).some(x => x.paraCompra) ? (
                      <select value={l.pres ?? ''} aria-label={`Unidad de compra de ${l.producto.descripcion}`}
                              onChange={e => setLineas(ls => ls.map((x, j) => j === i ? { ...x, pres: e.target.value || undefined } : x))}>
                        <option value="">{l.producto.unidadMedida}</option>
                        {(l.producto.presentaciones ?? []).filter(x => x.paraCompra).map(x => (
                          <option key={x.id} value={x.id}>{x.nombre} ({cantidad(x.factor)} {l.producto.unidadMedida})</option>
                        ))}
                      </select>
                    ) : l.producto.unidadMedida}
                    {presDe(l) && numero(l.cantidad) > 0 && (
                      <div className="secundario">entran {cantidad(unidadesDe(l))} {l.producto.unidadMedida}</div>
                    )}
                  </td>
                  <td className="num">
                    <input className="cantidad mono" inputMode="decimal" value={l.costo} placeholder="—" aria-invalid={malCosto}
                           aria-label={`Costo de ${l.producto.descripcion}`}
                           onChange={e => setLineas(ls => ls.map((x, j) => j === i ? { ...x, costo: e.target.value } : x))} />
                  </td>
                  <td className="num mono">
                    {l.costo.trim() && numero(l.cantidad) > 0 && numero(l.costo) >= 0 ? (numero(l.cantidad) * numero(l.costo)).toFixed(2) : '—'}
                  </td>
                  <td><Boton estilo="plano" onClick={() => setLineas(ls => ls.filter((_, j) => j !== i))}>Quitar</Boton></td>
                </tr>
              )
            })}
            <tr>
              <td colSpan={6}>
                <BuscadorProductoStock excluir={lineas.map(l => l.producto.id)}
                  onElegir={p => setLineas(ls => [...ls, { producto: p, cantidad: '', costo: '' }])} />
                <span className="secundario"> · solo aparecen los que controlan stock</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div className="inv-pie">
          <span>{lineas.length} producto(s)</span>
          {total > 0 && <span>Costo anotado <strong className="mono">{simbolo} {total.toFixed(2)}</strong></span>}
        </div>
        <p className="nota se-aplica">
          Se aplica: el costo es opcional hoy. Si lo anotas, servirá para el inventario valorizado (costo promedio) cuando
          se active; si no, ese producto entrará sin costo y se podrá completar después.
        </p>
      </div>

      {lineas.length > 0 && malas.length === 0 && nombreSucursal && (
        <Aviso tono="bien">
          Al registrar: <strong>{nombreSucursal.codigo} {nombreSucursal.nombre}</strong> ·{' '}
          {lineas.map(l => l.antes !== undefined
            ? `${l.producto.descripcion} pasa de ${cantidad(l.antes)} a ${cantidad(l.antes + unidadesDe(l))}`
            : `${l.producto.descripcion} +${cantidad(unidadesDe(l))}`).join(' · ')}.
        </Aviso>
      )}

      <div className="inv-pie">
        <Boton estilo="secundario" onClick={() => navegar('/inventario/ingresos')}>Cancelar</Boton>
        <Boton onClick={() => void registrar()} ocupado={guardando} textoOcupado="Registrando…" disabled={lineas.length === 0}>Registrar ingreso</Boton>
      </div>

      <div className="bloque">
        <strong>¿Se equivocaron en un ingreso?</strong>
        <p className="nota">No se edita ni se borra: en el ingreso aparece «Anular ingreso», que crea el movimiento contrario con el motivo, y queda en la bitácora. Si ya se vendió parte, antes te dice cuánto quedaría.</p>
      </div>
    </>
  )
}