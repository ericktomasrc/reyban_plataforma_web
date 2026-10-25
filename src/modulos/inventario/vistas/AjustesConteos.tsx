import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { Permisos } from '../../../nucleo/autorizacion/permisos'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { useSesion } from '../../../nucleo/sesion/SesionContexto'
import type { ProductoEnLista } from '../../facturacion/tipos'
import { BuscadorProductoStock } from '../componentes/BuscadorProductoStock'
import { InventarioApagado } from '../componentes/InventarioApagado'
import { ListaOperaciones } from '../componentes/ListaOperaciones'
import { useEstadoInventario, useSucursalesDeTrabajo } from '../componentes/usoInventario'
import {
  cantidad, inventarioServicio,
  type Categoria, type EstadoInventario, type MinimoEnSucursal, type RevisionStockInicial,
} from '../servicios/inventarioServicio'
import '../inventario.css'

type Pestana = 'ajuste' | 'inicial' | 'conteo' | 'historial'
const numero = (s: string) => { const n = Number(s.replace(',', '.')); return Number.isFinite(n) ? n : NaN }

/**
 * 052 — AJUSTES Y CONTEOS: el ajuste con motivo, la carga del stock inicial
 * (a mano o con Excel) y el conteo físico. Y el historial de todos.
 */
export function AjustesConteos() {
  const { puede } = useSesion()
  const [recargar, setRecargar] = useState(0)
  const { estado, error } = useEstadoInventario(recargar)
  const puedeAjustar = puede(Permisos.Inventario.Ajustar)
  const puedeContar = puede(Permisos.Inventario.Contar)
  // e161: la pestaña va en la dirección (?ver=inicial), para enlazarla desde
  // Configuración («Cargar ahora») y para que «Atrás» vuelva a la misma.
  const [params, setParams] = useSearchParams()
  const permitidas: Pestana[] = [...(puedeAjustar ? ['ajuste', 'inicial'] as const : []), ...(puedeContar ? ['conteo'] as const : []), 'historial']
  const pedida = params.get('ver') as Pestana | null
  const pestana: Pestana = pedida && permitidas.includes(pedida) ? pedida : permitidas[0]
  const setPestana = (p: Pestana) => setParams(p === permitidas[0] ? {} : { ver: p }, { replace: true })

  if (error) return <Aviso>{error}</Aviso>
  if (!estado) return <Cargando />
  if (!estado.encendido) return <InventarioApagado titulo="Ajustes y conteos" />

  const boton = (p: Pestana, texto: string) => (
    <button type="button" role="tab" aria-selected={pestana === p} className={pestana === p ? 'elegido' : undefined} onClick={() => setPestana(p)}>{texto}</button>
  )

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">Ajustes y conteos</h1>
          <p className="secundario">Lo que se rompió o se encontró, el stock con el que empiezas y el conteo físico.</p>
        </div>
      </div>
      <div className="segmentado" role="tablist" aria-label="Ajustes y conteos">
        {puedeAjustar && boton('ajuste', 'Ajuste')}
        {puedeAjustar && boton('inicial', 'Stock inicial')}
        {puedeContar && boton('conteo', 'Conteo físico')}
        {boton('historial', 'Historial')}
      </div>

      {pestana === 'ajuste' && <FormularioAjuste estado={estado} onHecho={() => setRecargar(n => n + 1)} />}
      {pestana === 'inicial' && <StockInicial estado={estado} onHecho={() => setRecargar(n => n + 1)} />}
      {pestana === 'conteo' && <NuevoConteo estado={estado} />}
      {pestana === 'historial' && <ListaOperaciones tipo="ajuste" recargar={recargar} />}
    </>
  )
}


// =============================================================================
// AJUSTE
// =============================================================================
interface LineaAjuste { producto: ProductoEnLista; cantidad: string; hay?: number }

function FormularioAjuste({ estado, onHecho }: { estado: EstadoInventario; onHecho: () => void }) {
  const navegar = useNavigate()
  const mensaje = useMensaje()
  const { sucursales, defecto } = useSucursalesDeTrabajo(estado)
  const [sucursal, setSucursal] = useState('')
  const [motivo, setMotivo] = useState('merma')
  const [sentido, setSentido] = useState<'sale' | 'entra'>('sale')
  const [nota, setNota] = useState('')
  const [lineas, setLineas] = useState<LineaAjuste[]>([])
  const [guardando, setGuardando] = useState(false)
  const suc = sucursal || defecto
  const m = estado.motivosAjuste.find(x => x.codigo === motivo)
  const sale = m?.signo === -1 || (m?.signo === 0 && sentido === 'sale')

  const ids = lineas.map(l => l.producto.id).join(',')
  useEffect(() => {
    if (!ids || !suc) return
    let vivo = true
    void Promise.all(ids.split(',').map(id => inventarioServicio.minimos(id).then(r => [id, r] as [string, MinimoEnSucursal[]])))
      .then(r => {
        if (!vivo) return
        const hay = new Map(r.map(([id, x]) => [id, x.find(s => s.sucursalId === suc)?.fisico ?? 0]))
        setLineas(ls => ls.map(l => ({ ...l, hay: hay.get(l.producto.id) })))
      })
      .catch(() => { /* sin «hay» */ })
    return () => { vivo = false }
  }, [ids, suc])

  const malas = lineas.some(l => !(numero(l.cantidad) > 0))

  async function registrar() {
    if (lineas.length === 0) { mensaje.error('Agrega al menos un producto.'); return }
    if (malas) { mensaje.error('Cada cantidad tiene que ser mayor que cero.'); return }
    if (nota.trim().length < 3) { mensaje.error('Explica qué pasó (es obligatorio en un ajuste).'); return }
    setGuardando(true)
    try {
      const r = await inventarioServicio.ajustar({
        sucursalId: suc, motivo, nota: nota.trim(),
        lineas: lineas.map(l => ({ productoId: l.producto.id, cantidad: (sale ? -1 : 1) * numero(l.cantidad) })),
      })
      mensaje.bien(r.mensaje)
      onHecho()
      navegar(`/inventario/operaciones/${r.id}`)
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo registrar el ajuste.')
    } finally { setGuardando(false) }
  }

  return (
    <div className="bloque">
      <h2 className="subtitulo">Ajuste de stock</h2>
      <p className="parrafo secundario">Para lo que se rompió, se venció, se perdió o se encontró.</p>
      <div className="rejilla-4">
        <label className="campo">
          <span className="etiqueta">Sucursal</span>
          <select value={suc} onChange={e => setSucursal(e.target.value)} disabled={sucursales.length <= 1}>
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.codigo} {s.nombre}</option>)}
          </select>
        </label>
        <label className="campo">
          <span className="etiqueta">Motivo</span>
          <select value={motivo} onChange={e => setMotivo(e.target.value)}>
            {estado.motivosAjuste.map(x => (
              <option key={x.codigo} value={x.codigo}>{x.nombre} ({x.signo < 0 ? 'sale' : x.signo > 0 ? 'entra' : 'entra o sale'})</option>
            ))}
          </select>
        </label>
        {m?.signo === 0 && (
          <label className="campo">
            <span className="etiqueta">¿Entra o sale?</span>
            <select value={sentido} onChange={e => setSentido(e.target.value as 'sale' | 'entra')}>
              <option value="sale">Sale</option>
              <option value="entra">Entra</option>
            </select>
          </label>
        )}
      </div>

      <table className="tabla inv-lineas">
        <thead><tr><th>Producto</th><th className="num">Hay</th><th className="num">{sale ? 'Sale' : 'Entra'}</th><th className="num">Queda</th><th /></tr></thead>
        <tbody>
          {lineas.map((l, i) => {
            const n = numero(l.cantidad)
            const queda = l.hay !== undefined && n > 0 ? l.hay + (sale ? -n : n) : undefined
            return (
              <tr key={l.producto.id}>
                <td><div className="principal">{l.producto.descripcion}</div><div className="secundario mono">{l.producto.codigo}</div></td>
                <td className="num mono">{cantidad(l.hay)}</td>
                <td className="num">
                  <input className="cantidad mono" inputMode="decimal" value={l.cantidad} aria-label={`Cantidad de ${l.producto.descripcion}`}
                         aria-invalid={l.cantidad !== '' && !(n > 0)} autoFocus={i === lineas.length - 1}
                         onChange={e => setLineas(ls => ls.map((x, j) => j === i ? { ...x, cantidad: e.target.value } : x))} />
                </td>
                <td className={`num mono${queda !== undefined && queda < 0 ? ' inv-mal' : ''}`}><strong>{cantidad(queda)}</strong></td>
                <td><Boton estilo="plano" onClick={() => setLineas(ls => ls.filter((_, j) => j !== i))}>Quitar</Boton></td>
              </tr>
            )
          })}
          <tr><td colSpan={5}>
            <BuscadorProductoStock excluir={lineas.map(l => l.producto.id)} onElegir={p => setLineas(ls => [...ls, { producto: p, cantidad: '' }])} />
          </td></tr>
        </tbody>
      </table>

      <label className="campo">
        <span className="etiqueta">Explica qué pasó (obligatorio)</span>
        <input value={nota} maxLength={250} placeholder="Ej.: 5 bolsas rotas al descargar" onChange={e => setNota(e.target.value)} />
      </label>
      <p className="nota se-aplica">
        Se aplica: queda en el kardex con quién lo hizo y cuándo, y en la bitácora. No se borra; si fue un error, se anula
        (el movimiento contrario) o se hace otro ajuste «Corrección».
      </p>
      <div className="inv-pie">
        <Boton onClick={() => void registrar()} ocupado={guardando} textoOcupado="Registrando…" disabled={lineas.length === 0}>Registrar ajuste</Boton>
      </div>
    </div>
  )
}


// =============================================================================
// STOCK INICIAL
// =============================================================================
function StockInicial({ estado, onHecho }: { estado: EstadoInventario; onHecho: () => void }) {
  const mensaje = useMensaje()
  const { sucursales, defecto } = useSucursalesDeTrabajo(estado)
  const [archivo, setArchivo] = useState<File>()
  const [revision, setRevision] = useState<RevisionStockInicial>()
  const [ocupado, setOcupado] = useState(false)
  const [sucursal, setSucursal] = useState('')
  const [lineas, setLineas] = useState<{ producto: ProductoEnLista; cantidad: string; costo: string }[]>([])
  const suc = sucursal || defecto

  async function plantilla() {
    try { await inventarioServicio.plantillaStockInicial() }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo bajar la plantilla.') }
  }

  async function revisar(f: File) {
    setArchivo(f); setOcupado(true); setRevision(undefined)
    try { setRevision(await inventarioServicio.importarStockInicial(f, true)) }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo leer el archivo.') }
    finally { setOcupado(false) }
  }

  async function cargarExcel() {
    if (!archivo) return
    setOcupado(true)
    try {
      const r = await inventarioServicio.importarStockInicial(archivo, false)
      mensaje.bien(r.mensaje ?? 'Stock inicial cargado.')
      setArchivo(undefined); setRevision(undefined); onHecho()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo cargar.')
    } finally { setOcupado(false) }
  }

  async function cargarAMano() {
    if (lineas.length === 0) return
    if (lineas.some(l => !(numero(l.cantidad) >= 0) || l.cantidad.trim() === '')) { mensaje.error('Cada cantidad tiene que ser 0 o más.'); return }
    setOcupado(true)
    try {
      const r = await inventarioServicio.stockInicial({
        sucursalId: suc,
        lineas: lineas.map(l => ({ productoId: l.producto.id, cantidad: numero(l.cantidad), costoUnitario: l.costo.trim() ? numero(l.costo) : null })),
      })
      mensaje.bien(r.mensaje); setLineas([]); onHecho()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo cargar.')
    } finally { setOcupado(false) }
  }

  return (
    <div className="inv-dos">
      <div className="bloque">
        <h2 className="subtitulo">Stock inicial con Excel</h2>
        <p className="parrafo secundario">Lo que ya tienes el día que empiezas. Una vez por producto y sucursal; después todo entra por compra, traslado o ajuste.</p>
        <ol className="pasos">
          <li><button type="button" className="enlace" onClick={() => void plantilla()}>Descarga la plantilla</button>: ya trae tus productos con «Controla stock» y una columna por sucursal.</li>
          <li>Escribe las cantidades (y el costo, si lo sabes).</li>
          <li>Súbela: antes de guardar ves qué filas tienen error.</li>
        </ol>
        <div className="inv-zona-excel">
          Elige el archivo de Excel (.xlsx)
          <input type="file" accept=".xlsx,.csv" aria-label="Archivo de Excel"
                 onChange={e => { const f = e.target.files?.[0]; if (f) void revisar(f) }} />
        </div>
        {ocupado && !revision && <Cargando texto="Revisando…" />}
        {revision && (
          <>
            <Aviso tono={revision.errores > 0 ? 'ojo' : 'bien'}>
              {revision.cargan} cantidad(es) para cargar{revision.errores > 0 && <>; <strong>{revision.errores} con error</strong> (no entran)</>}.
            </Aviso>
            {revision.errores > 0 && (
              <ul className="inv-motivos">
                {revision.filas.filter(f => f.resultado === 'error').slice(0, 20).map((f, i) => (
                  <li key={i}><span>Fila {f.fila} · <span className="mono">{f.codigo}</span>{f.sucursal && <> · {f.sucursal}</>}</span><span className="inv-mal">{f.mensaje}</span></li>
                ))}
              </ul>
            )}
            <div className="inv-pie">
              <Boton onClick={() => void cargarExcel()} ocupado={ocupado} disabled={revision.cargan === 0}>Cargar {revision.cargan}</Boton>
            </div>
          </>
        )}
      </div>

      <div className="bloque">
        <h2 className="subtitulo">O a mano</h2>
        <label className="campo">
          <span className="etiqueta">Sucursal</span>
          <select value={suc} onChange={e => setSucursal(e.target.value)} disabled={sucursales.length <= 1}>
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.codigo} {s.nombre}</option>)}
          </select>
        </label>
        <table className="tabla inv-lineas">
          <thead><tr><th>Producto</th><th className="num">Hay hoy</th><th className="num">Costo</th><th /></tr></thead>
          <tbody>
            {lineas.map((l, i) => (
              <tr key={l.producto.id}>
                <td>{l.producto.descripcion}<div className="secundario mono">{l.producto.codigo}</div></td>
                <td className="num"><input className="cantidad mono" inputMode="decimal" value={l.cantidad} aria-label="Cantidad"
                  onChange={e => setLineas(ls => ls.map((x, j) => j === i ? { ...x, cantidad: e.target.value } : x))} /></td>
                <td className="num"><input className="cantidad mono" inputMode="decimal" value={l.costo} placeholder="—" aria-label="Costo"
                  onChange={e => setLineas(ls => ls.map((x, j) => j === i ? { ...x, costo: e.target.value } : x))} /></td>
                <td><Boton estilo="plano" onClick={() => setLineas(ls => ls.filter((_, j) => j !== i))}>Quitar</Boton></td>
              </tr>
            ))}
            <tr><td colSpan={4}>
              <BuscadorProductoStock excluir={lineas.map(l => l.producto.id)} onElegir={p => setLineas(ls => [...ls, { producto: p, cantidad: '', costo: '' }])} />
            </td></tr>
          </tbody>
        </table>
        <p className="nota se-aplica">Se aplica: queda en el stock lo que escribas (si ya se vendió algo antes, se corrige solo).</p>
        <div className="inv-pie">
          <Boton onClick={() => void cargarAMano()} ocupado={ocupado} disabled={lineas.length === 0}>Cargar stock inicial</Boton>
        </div>
      </div>
    </div>
  )
}


// =============================================================================
// CONTEO FÍSICO
// =============================================================================
function NuevoConteo({ estado }: { estado: EstadoInventario }) {
  const navegar = useNavigate()
  const mensaje = useMensaje()
  const { sucursales, defecto } = useSucursalesDeTrabajo(estado)
  const [sucursal, setSucursal] = useState('')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoria, setCategoria] = useState('')
  const [nota, setNota] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const suc = sucursal || defecto

  useEffect(() => {
    let vivo = true
    inventarioServicio.categorias().then(c => { if (vivo) setCategorias(c) }).catch(() => { /* sin categorías */ })
    return () => { vivo = false }
  }, [])

  async function abrir() {
    setOcupado(true)
    try {
      const r = await inventarioServicio.abrirConteo({ sucursalId: suc, categoriaId: categoria || null, nota: nota.trim() || null })
      mensaje.bien(r.mensaje)
      navegar(`/inventario/operaciones/${r.id}`)
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo abrir el conteo.')
    } finally { setOcupado(false) }
  }

  return (
    <div className="bloque">
      <h2 className="subtitulo">Conteo físico (toma de inventario)</h2>
      <p className="parrafo secundario">Cuentas lo que hay de verdad y el sistema hace los ajustes por la diferencia, todos de una vez.</p>
      <div className="rejilla-4">
        <label className="campo">
          <span className="etiqueta">Sucursal</span>
          <select value={suc} onChange={e => setSucursal(e.target.value)} disabled={sucursales.length <= 1}>
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.codigo} {s.nombre}</option>)}
          </select>
        </label>
        <label className="campo">
          <span className="etiqueta">Qué se cuenta</span>
          <select value={categoria} onChange={e => setCategoria(e.target.value)}>
            <option value="">Todos los productos que controlan stock</option>
            {categorias.map(c => <option key={c.id} value={c.id}>Solo {c.nombre}</option>)}
          </select>
        </label>
        <label className="campo ancho-2">
          <span className="etiqueta">Nota (opcional)</span>
          <input value={nota} maxLength={250} placeholder="Ej.: conteo de fin de mes" onChange={e => setNota(e.target.value)} />
        </label>
      </div>
      <p className="nota se-aplica">
        Se aplica: se abre una hoja con los productos; la llenas (puedes guardar y seguir después) y al cerrarla se ajusta
        cada diferencia con el stock de ese momento. Lo que no cuentes queda como está.
      </p>
      <div className="inv-pie">
        <Boton onClick={() => void abrir()} ocupado={ocupado}>Abrir conteo</Boton>
      </div>
    </div>
  )
}