import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Asterisco } from '../../../componentes/Campo'
import { Paginacion } from '../../../componentes/Paginacion'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { notaCreditoServicio } from '../servicios/facturacionServicio'
import type { CalculoNotaCredito, PreviaNotaCredito } from '../tipos'
import { inventarioServicio, type EstadoInventario } from '../../inventario/servicios/inventarioServicio'
import { BarraLineas, usePaginaLineas, type FilaDetalle } from '../componentes/DetalleLineas'
import '../comprobante.css'

/** 052: las notas que devuelven productos preguntan si la mercadería volvió. */
const DEVUELVEN = ['01', '02', '06', '07']

/**
 * 031 — NOTA DE CRÉDITO (maqueta aprobada el 18 oct 2026).
 *
 * Nace siempre del comprobante original: el cliente, la moneda y los precios
 * vienen de él y no se tocan. Aquí solo se elige QUÉ pasó y CUÁNTO.
 *
 * EL TOTAL LO CALCULA EL BACK («Simular»), con los mismos redondeos con los
 * que se va a emitir: la pantalla nunca enseña una cifra distinta de la que
 * sale. Un doble clic manda la misma clave y no hace dos notas.
 *
 * 24 oct: los 13 motivos del catálogo 09 (los manuales de SOL del contador).
 * 03 corrige la descripción y 13 las cuotas: esas dos van en cero.
 *
 * e167: EL MISMO DISEÑO QUE «NUEVO COMPROBANTE» (tarjetas numeradas, líneas
 * de 10 con búsqueda y «Ver todo», barra fija con Emitir). Solo cambia cómo
 * se ve: los motivos, las reglas, el cálculo y lo que va a SUNAT, igual.
 */

type Motivo = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12' | '13'

const MOTIVOS: { codigo: Motivo; titulo: string; texto: string }[] = [
  { codigo: '01', titulo: 'Anular toda la venta', texto: 'La venta no se hizo o se emitió por error. Devuelve el total.' },
  { codigo: '07', titulo: 'Me devolvieron algunos productos', texto: 'Eliges qué productos y cuántos.' },
  { codigo: '06', titulo: 'Me devolvieron todo', texto: 'Devolución de toda la mercadería.' },
  { codigo: '04', titulo: 'Hice un descuento después (a todo)', texto: 'Un monto sobre toda la venta.' },
  { codigo: '05', titulo: 'Hice un descuento después (a un producto)', texto: 'Un monto sobre un solo producto.' },
  { codigo: '02', titulo: 'Me equivoqué de RUC', texto: 'Anula todo. Luego emites una factura nueva al RUC correcto.' },
  { codigo: '09', titulo: 'Bajó el valor de un producto', texto: 'Disminución en el valor, con un monto.' },
  { codigo: '03', titulo: 'Corregir la descripción', texto: 'Un producto salió mal escrito. No devuelve nada (va en cero).' },
  { codigo: '08', titulo: 'Bonificación', texto: 'Un monto bonificado sobre un producto.' },
  { codigo: '10', titulo: 'Otros conceptos', texto: 'Un monto por otro motivo; eliges si lleva IGV.' },
  { codigo: '11', titulo: 'Ajuste de exportación', texto: 'Un monto sobre lo exportado.' },
  { codigo: '12', titulo: 'Ajuste del IVAP', texto: 'Un monto sobre lo afecto al IVAP (arroz pilado).' },
  { codigo: '13', titulo: 'Corregir las cuotas', texto: 'Cambia el monto pendiente o las fechas de pago. Va en cero.' },
]

/** Diseño 15 nov: los motivos en grupos, con un ícono. Mismos motivos y reglas. */
const GRUPOS: { titulo: string; codigos: Motivo[] }[] = [
  { titulo: 'Devoluciones', codigos: ['07', '06', '01'] },
  { titulo: 'Descuentos y valor', codigos: ['04', '05', '09', '08', '10', '11', '12'] },
  { titulo: 'Errores y cuotas', codigos: ['03', '02', '13'] },
]
const ICONO: Record<Motivo, string> = {
  '01': '✕', '02': '#', '03': '✎', '04': '%', '05': '%', '06': '⟲', '07': '↩',
  '08': '+', '09': '↓', '10': '…', '11': '⇄', '12': '◇', '13': '◷',
}
const miles = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const TODO: Motivo[] = ['01', '02', '06']
const CON_MONTO: Motivo[] = ['04', '05', '08', '09', '10', '11', '12']
const CON_PRODUCTO: Motivo[] = ['05', '08', '09']

type CuotaEditable = { monto: string; vence: string }
function nuevaClave() {
  try { return crypto.randomUUID().replace(/-/g, '') }
  catch { return `${Date.now()}${Math.random().toString(16).slice(2)}` }
}

export function NotaCredito() {
  const { id } = useParams()
  const navegar = useNavigate()
  // 15 nov: «Volver» y «Cancelar» regresan a donde se vino: la bandeja de
  // «Nueva nota» (si se entró por el menú) o el detalle del comprobante.
  const desde = (useLocation().state as { volverA?: string } | null)?.volverA

  const [previa, setPrevia] = useState<PreviaNotaCredito>()
  const [error, setError] = useState<string>()
  const [motivo, setMotivo] = useState<Motivo>()
  const [descripcion, setDescripcion] = useState('')
  const [cantidades, setCantidades] = useState<Record<number, string>>({})
  const [monto, setMonto] = useState('')
  const [linea, setLinea] = useState<number>()
  const [correcciones, setCorrecciones] = useState<Record<number, string>>({})   // 03
  const [afectacion, setAfectacion] = useState('10')                            // 10
  const [cuotas, setCuotas] = useState<CuotaEditable[]>([{ monto: '', vence: '' }])   // 13
  const [calculo, setCalculo] = useState<CalculoNotaCredito>()
  const [calculando, setCalculando] = useState(false)
  const [emitiendo, setEmitiendo] = useState(false)
  const [falloEmitir, setFalloEmitir] = useState<string>()
  // 052: ¿volvió al almacén? (si la empresa lleva inventario)
  const [inventario, setInventario] = useState<EstadoInventario>()
  const [retorno, setRetorno] = useState<'volvio' | 'danada' | 'no_volvio'>('volvio')
  const [retornoSucursal, setRetornoSucursal] = useState('')
  useEffect(() => {
    let vivo = true
    inventarioServicio.estado().then(e => { if (vivo) setInventario(e) }).catch(() => { /* sin inventario */ })
    return () => { vivo = false }
  }, [])

  // LA CLAVE NACE AL ABRIR LA PANTALLA: dos clics en «Emitir» son la misma nota.
  const clave = useRef(nuevaClave())

  useEffect(() => {
    if (!id) return
    notaCreditoServicio.previa(id)
      .then(setPrevia)
      .catch(e => setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar el comprobante.'))
  }, [id])

  const peticion = useMemo(() => ({
    clave: clave.current,
    motivo,
    descripcion: descripcion.trim(),
    lineas: motivo === '07'
      ? Object.entries(cantidades)
          .map(([n, c]) => ({ numero: Number(n), cantidad: Number(c.replace(',', '.')) }))
          .filter(x => x.cantidad > 0)
      : undefined,
    monto: motivo && CON_MONTO.includes(motivo) ? Number(monto.replace(',', '.')) || undefined : undefined,
    linea: motivo && CON_PRODUCTO.includes(motivo) ? linea : undefined,
    correcciones: motivo === '03'
      ? Object.entries(correcciones)
          .map(([n, d]) => ({ numero: Number(n), descripcion: d.trim() }))
          .filter(x => x.descripcion.length > 0)
      : undefined,
    afectacion: motivo === '10' ? afectacion : undefined,
    cuotas: motivo === '13'
      ? cuotas.map(c => ({ monto: Number(c.monto.replace(',', '.')) || 0, vence: c.vence }))
          .filter(c => c.monto > 0 || c.vence)
      : undefined,
    // 052
    retorno: motivo && DEVUELVEN.includes(motivo) && inventario?.encendido ? retorno : undefined,
    retornoSucursalId: motivo && DEVUELVEN.includes(motivo) && inventario?.encendido && retornoSucursal ? retornoSucursal : undefined,
  }), [motivo, descripcion, cantidades, monto, linea, correcciones, afectacion, cuotas, retorno, retornoSucursal, inventario])

  // Calcular en el back, un momento después de que se deja de escribir.
  useEffect(() => {
    if (!id || !motivo || !previa?.puede) { setCalculo(undefined); return }
    setCalculando(true)
    const t = setTimeout(() => {
      notaCreditoServicio.calcular(id, peticion)
        .then(setCalculo)
        .catch(e => setCalculo({ problema: e instanceof ErrorApi ? e.message : 'No se pudo calcular.' }))
        .finally(() => setCalculando(false))
    }, 350)
    return () => clearTimeout(t)
  }, [id, motivo, peticion, previa?.puede])

  // e167: la grilla de líneas, de 10 en 10 y con búsqueda.
  const pl = usePaginaLineas(previa?.lineas ?? [])

  if (error) return <Aviso>{error}</Aviso>
  if (!previa) return <Cargando />

  const anteriores = previa.importeTotal - previa.saldo
  const listo = !!calculo && !calculo.problema && descripcion.trim().length >= 5 && !calculando

  const emitir = async () => {
    if (!id) return
    setEmitiendo(true); setFalloEmitir(undefined)
    try {
      const r = await notaCreditoServicio.emitir(id, peticion)
      navegar(`/facturacion/comprobantes/${r.id}`, { state: { reciente: r.mensaje } })
    } catch (e) {
      setFalloEmitir(e instanceof ErrorApi ? e.message : 'No se pudo emitir la nota de crédito.')
    } finally {
      setEmitiendo(false)
    }
  }

  // Los que admite el comprobante (el back ya quita los de solo facturas).
  const admitidos = previa.motivos?.map(m => m.codigo)
  const disponibles = MOTIVOS.filter(m =>
    (admitidos ? admitidos.includes(m.codigo) : !['03', '08', '10', '11', '12', '13'].includes(m.codigo)) &&
    (m.codigo !== '02' || previa.tipo === '01') &&
    (m.codigo !== '04' || previa.afectacionUnica) &&
    (m.codigo !== '11' || previa.tieneExportacion) &&
    (m.codigo !== '12' || previa.tieneIvap) &&
    (m.codigo !== '13' || previa.alCredito))

  const simbolo = previa.moneda === 'PEN' ? 'S/' : previa.moneda === 'USD' ? 'US$' : previa.moneda
  const filasDetalle: FilaDetalle[] = previa.lineas.map(l => ({
    numero: l.numero, codigo: null, descripcion: l.descripcion, cantidad: l.cantidad, unidad: l.unidadMedida,
    valorUnitario: l.precioUnitario, descuento: 0, total: l.importeTotal,
  }))
  const barra = (
    <BarraLineas cuantas={previa.lineas.length} q={pl.q} onBuscar={pl.buscar} filas={filasDetalle}
                 moneda={previa.moneda} etiquetaUnitario="Precio unit." />
  )
  const paginas = pl.hayMas ? <Paginacion {...pl.paginacion} /> : null
  const dinero = (n: number) => `${simbolo} ${miles.format(n)}`
  const motivoElegido = MOTIVOS.find(m => m.codigo === motivo)
  const devueltas = Object.values(cantidades).filter(c => Number(c.replace(',', '.')) > 0).length
  // Diseño 15 nov: ± y «todo» en la cantidad a devolver. Escriben en el mismo
  // estado que el campo; el back revisa igual lo que se pide.
  const ponerCantidad = (n: number, v: number, max: number) =>
    setCantidades(c => ({ ...c, [n]: String(Math.max(0, Math.min(max, Math.round(v * 1000) / 1000))) }))

  return (
    <div className="nc nota">
      {/* --- Encabezado ---------------------------------------------------- */}
      <div className="nc-encabezado">
        <div>
          <p className="vc-tipo">Nota de crédito</p>
          <h1 className="titulo-pagina">Para la {previa.tipo === '01' ? 'factura' : 'boleta'} {previa.numero}</h1>
          <p className="nc-bajada">
            <span className="nc-pastilla">{previa.tipo === '01' ? 'Factura' : 'Boleta'}</span>
            <span>{previa.cliente?.razonSocial}</span>
            <span className="mono">{previa.cliente?.numeroDocumento}</span>
            <span>· emitido el {fecha(previa.fechaEmision)}</span>
            {previa.ambiente === 'beta' && <span className="nc-pastilla gris">prueba</span>}
          </p>
        </div>
        <Boton estilo="secundario" onClick={() => navegar(desde ?? `/facturacion/comprobantes/${previa.id}`)}>
          Volver
        </Boton>
      </div>

      {!previa.puede && <Aviso>{previa.problema}</Aviso>}

      <div className={previa.puede ? 'nc-cuerpo con-resumen' : 'nc-cuerpo'}>
      <div className="nc-principal">
      {/* --- 1. El comprobante que se modifica ------------------------------ */}
      <section className="bloque nc-tarjeta">
        <h2 className="nc-titulo"><span className="nc-paso">1</span>La {previa.tipo === '01' ? 'factura' : 'boleta'} que modificas</h2>
        <div className="nt-cifras">
          <div><span>Total {previa.tipo === '01' ? 'de la factura' : 'de la boleta'}</span><strong>{dinero(previa.importeTotal)}</strong></div>
          <div><span>Notas de crédito anteriores</span><strong>{anteriores > 0 ? `− ${dinero(anteriores)}` : '—'}</strong></div>
          <div className="queda"><span>Queda por acreditar</span><strong>{dinero(previa.saldo)}</strong></div>
        </div>

        {/* 24 oct: el plazo para corregir, como hacen los sistemas comerciales: avisa, no bloquea. */}
        {previa.puede && previa.plazoCorreccion && (
          <p className={`nota se-aplica${previa.plazoVencido ? ' vencido' : ''}`}>
            {previa.plazoVencido
              ? <>Se aplica: plazo para corregir vencido el {fecha(previa.plazoCorreccion)} (15 días hábiles del mes siguiente a la emisión). La nota se emite igual; consúltalo con tu contador.</>
              : <>Se aplica: comprobante del {fecha(previa.fechaEmision)}. Plazo para corregir: hasta el {fecha(previa.plazoCorreccion)} (15 días hábiles del mes siguiente). La nota se emite igual.</>}
          </p>
        )}

        {previa.puede && previa.aTiempoDeBaja && !previa.hayNotas && (
          <Aviso tono="ojo">
            Todavía estás dentro de los 7 días: si quieres anular <strong>todo</strong>, «{previa.tipo === '01' ? 'Comunicar baja' : 'Anular'}»
            en el detalle del comprobante es más simple. La nota de crédito sirve igual, y también para devoluciones y descuentos.
          </Aviso>
        )}

        {previa.notas.length > 0 && (
          <details className="nota-anteriores">
            <summary>Notas anteriores de este comprobante ({previa.notas.length})</summary>
            <ul className="lista-nota">
              {previa.notas.map(n => (
                <li key={n.id}>
                  <span className="mono">{n.numero}</span> · {fecha(n.fechaEmision)} · {previa.moneda} {n.importeTotal.toFixed(2)} · {n.estado}
                  {!n.cuenta && <span className="secundario"> (no cuenta: no vale ante SUNAT)</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {previa.puede && (
        <>
          {/* --- 2. ¿Qué pasó? -------------------------------------------- */}
          <section className="bloque nc-tarjeta">
            <h2 className="nc-titulo"><span className="nc-paso">2</span>¿Qué pasó?</h2>
            {GRUPOS.map(g => {
              const delGrupo = disponibles.filter(m => g.codigos.includes(m.codigo))
              if (delGrupo.length === 0) return null
              return (
                <div key={g.titulo} className="nt-grupo">
                  <p className="nt-grupo-titulo">{g.titulo}</p>
                  <div className="motivos-nota nt-motivos">
                    {delGrupo.map(m => {
                      const bloqueado = TODO.includes(m.codigo) && previa.hayNotas
                      return (
                        <button key={m.codigo} type="button" disabled={bloqueado}
                                className={`opcion-cuenta nt-motivo${motivo === m.codigo ? ' elegida' : ''}`}
                                onClick={() => { setMotivo(m.codigo); setFalloEmitir(undefined) }}>
                          <span className="nt-icono" aria-hidden="true">{ICONO[m.codigo]}</span>
                          <span className="nt-motivo-texto">
                            <strong>{m.titulo}</strong>
                            <span>{bloqueado ? 'No se puede: ya tiene notas. Usa «algunos productos» o un descuento.' : m.texto}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </section>

          {/* --- 3. Qué se devuelve -------------------------------------- */}
          {motivo && (
            <section className="bloque nc-tarjeta">
              <h2 className="nc-titulo"><span className="nc-paso">3</span>{motivo === '07' ? '¿Qué productos y cuántos?'
                : TODO.includes(motivo) ? 'Se devuelve todo el comprobante'
                : motivo === '03' ? '¿Cómo debió decir?'
                : motivo === '13' ? 'Las cuotas nuevas'
                : '¿De cuánto?'}</h2>

              {motivo === '03' && (
                <>
                  {barra}
                  <table className="tabla nota-tabla">
                    <thead>
                      <tr><th>#</th><th>Dice</th><th>Debe decir</th></tr>
                    </thead>
                    <tbody>
                      {pl.visibles.map(l => (
                        <tr key={l.numero}>
                          <td className="secundario">{l.numero}</td>
                          <td>{l.descripcion}</td>
                          <td>
                            <input className="correccion-nota" maxLength={250} value={correcciones[l.numero] ?? ''}
                                   placeholder="Déjalo vacío si está bien"
                                   onChange={e => setCorrecciones(c => ({ ...c, [l.numero]: e.target.value }))} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {paginas}
                  <p className="nota se-aplica">Se aplica: la nota lleva solo los productos corregidos, en cero. No cambia lo que el cliente debe.</p>
                </>
              )}

              {motivo === '13' && (
                <>
                  {(previa.cuotas?.length ?? 0) > 0 && (
                    <p className="secundario">
                      Hoy: {previa.cuotas!.map(c => `cuota ${c.numero} de ${previa.moneda} ${c.monto.toFixed(2)} al ${fecha(c.vence)}`).join(' · ')}.
                    </p>
                  )}
                  <div className="cuotas-nota">
                    {cuotas.map((c, i) => (
                      <div className="fila-cuota" key={i}>
                        <span className="secundario">Cuota {i + 1}</span>
                        <input className="mono numero-nota" inputMode="decimal" value={c.monto} placeholder="0.00" aria-label={`Monto de la cuota ${i + 1}`}
                               onChange={e => setCuotas(q => q.map((x, j) => j === i ? { ...x, monto: e.target.value.replace(/[^\d.,]/g, '') } : x))} />
                        <input type="date" value={c.vence} aria-label={`Vencimiento de la cuota ${i + 1}`}
                               onChange={e => setCuotas(q => q.map((x, j) => j === i ? { ...x, vence: e.target.value } : x))} />
                        {cuotas.length > 1 && (
                          <Boton estilo="secundario" onClick={() => setCuotas(q => q.filter((_, j) => j !== i))}>Quitar</Boton>
                        )}
                      </div>
                    ))}
                  </div>
                  <Boton estilo="secundario" onClick={() => setCuotas(q => [...q, { monto: '', vence: '' }])}>Agregar cuota</Boton>
                  <p className="nota se-aplica">Se aplica: la nota va en cero y lleva el nuevo monto pendiente (la suma de las cuotas). Cada cuota vence después de hoy.</p>
                </>
              )}

              {motivo === '10' && (
                <label className="campo">
                  <span className="etiqueta">¿Lleva IGV?</span>
                  <select value={afectacion} onChange={e => setAfectacion(e.target.value)}>
                    <option value="10">Sí, gravado (18%)</option>
                    <option value="20">Exonerado</option>
                    <option value="30">Inafecto</option>
                  </select>
                </label>
              )}

              {(motivo === '07' || TODO.includes(motivo)) && (
                <>
                  {barra}
                  <table className="tabla nota-tabla">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Producto</th>
                        <th className="derecha">Vendido</th>
                        <th className="derecha">Ya devuelto</th>
                        {motivo === '07' && <th className="derecha">Devolver ahora</th>}
                        <th className="derecha">Precio unit.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pl.visibles.map(l => (
                        <tr key={l.numero}>
                          <td className="secundario">{l.numero}</td>
                          <td>{l.descripcion}</td>
                          <td className="derecha mono">{l.cantidad} {l.unidadMedida}</td>
                          <td className="derecha mono">{l.devuelta || '—'}</td>
                          {motivo === '07' && (
                            <td className="derecha">
                              <div className="nt-paso-cantidad">
                                <button type="button" aria-label={`Una menos en la línea ${l.numero}`} disabled={l.disponible <= 0}
                                        onClick={() => ponerCantidad(l.numero, Number((cantidades[l.numero] ?? '0').replace(',', '.')) - 1, l.disponible)}>−</button>
                                <input className="mono numero-nota" inputMode="decimal" disabled={l.disponible <= 0}
                                       value={cantidades[l.numero] ?? ''} placeholder="0"
                                       aria-label={`Cantidad a devolver de la línea ${l.numero}`}
                                       aria-invalid={Number((cantidades[l.numero] ?? '').replace(',', '.')) > l.disponible ? true : undefined}
                                       onChange={e => setCantidades(c => ({ ...c, [l.numero]: e.target.value.replace(/[^\d.,]/g, '') }))} />
                                <button type="button" aria-label={`Una más en la línea ${l.numero}`} disabled={l.disponible <= 0}
                                        onClick={() => ponerCantidad(l.numero, Number((cantidades[l.numero] ?? '0').replace(',', '.')) + 1, l.disponible)}>+</button>
                              </div>
                              <div className="secundario">
                                quedan {l.disponible}
                                {l.disponible > 0 && <> · <button type="button" className="enlace" onClick={() => ponerCantidad(l.numero, l.disponible, l.disponible)}>todo</button></>}
                              </div>
                            </td>
                          )}
                          <td className="derecha mono">{l.precioUnitario.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {paginas}
                </>
              )}

              {CON_PRODUCTO.includes(motivo) && (
                <label className="campo">
                  <span className="etiqueta">¿A qué producto?<Asterisco /></span>
                  <select value={linea ?? ''} onChange={e => setLinea(e.target.value ? Number(e.target.value) : undefined)}>
                    <option value="">Elige…</option>
                    {previa.lineas.map(l => (
                      <option key={l.numero} value={l.numero}>{l.numero}. {l.descripcion} — {previa.moneda} {l.importeTotal.toFixed(2)}</option>
                    ))}
                  </select>
                </label>
              )}

              {CON_MONTO.includes(motivo) && (
                <label className="campo nota-monto">
                  <span className="etiqueta">Monto{motivo === '11' ? '' : ' con IGV'} ({previa.moneda})<Asterisco /></span>
                  <input className="mono numero-nota" inputMode="decimal" value={monto} placeholder="0.00"
                         onChange={e => setMonto(e.target.value.replace(/[^\d.,]/g, ''))} />
                  <span className="pista">No puede pasar de lo que queda: {simbolo} {previa.saldo.toFixed(2)}.</span>
                </label>
              )}
            </section>
          )}

          {/* --- 052: ¿la mercadería volvió al almacén? ---------------------- */}
          {motivo && DEVUELVEN.includes(motivo) && inventario?.encendido && (
            <section className="bloque nc-tarjeta">
              <h2 className="nc-titulo"><span className="nc-paso">4</span>¿La mercadería volvió al almacén?</h2>
              <div className="casillas">
                <label className="casilla">
                  <input type="radio" name="retorno" checked={retorno === 'volvio'} onChange={() => setRetorno('volvio')} />
                  <span><strong>Sí, volvió</strong><em>Entra otra vez al stock.</em></span>
                </label>
                <label className="casilla">
                  <input type="radio" name="retorno" checked={retorno === 'danada'} onChange={() => setRetorno('danada')} />
                  <span><strong>Volvió pero dañada</strong><em>Entra y sale como merma (queda el registro).</em></span>
                </label>
                <label className="casilla">
                  <input type="radio" name="retorno" checked={retorno === 'no_volvio'} onChange={() => setRetorno('no_volvio')} />
                  <span><strong>No volvió</strong><em>El cliente se la quedó o se perdió: el stock no cambia.</em></span>
                </label>
              </div>
              {retorno !== 'no_volvio' && inventario.sucursales.length > 1 && (
                <label className="campo" style={{ marginTop: 'var(--e3)' }}>
                  <span className="etiqueta">Entra a</span>
                  <select value={retornoSucursal} onChange={e => setRetornoSucursal(e.target.value)}>
                    <option value="">La sucursal que emitió el comprobante</option>
                    {inventario.sucursales.map(s => <option key={s.id} value={s.id}>{s.codigo} {s.nombre}</option>)}
                  </select>
                </label>
              )}
              <p className="nota se-aplica">
                Se aplica: el stock entra cuando SUNAT acepta la nota, no antes. Si el comprobante estaba «se entrega después»
                y aún no salía con guía, primero se libera lo reservado.
              </p>
            </section>
          )}

          {/* --- La explicación (antes iba bajo los motivos) ------------------- */}
          <section className="bloque nc-tarjeta">
            <label className="campo">
              <span className="etiqueta">Explica en una línea (sale en el PDF y va a SUNAT)<Asterisco /></span>
              <input value={descripcion} maxLength={250} onChange={e => setDescripcion(e.target.value)}
                     placeholder="Ej.: el cliente canceló el pedido antes de la entrega"
                     aria-invalid={!!motivo && descripcion.trim().length > 0 && descripcion.trim().length < 5 ? true : undefined} />
              <span className="pista">Al menos 5 letras. Es el motivo que leerá SUNAT y tu cliente.</span>
            </label>
          </section>
        </>
      )}
      </div>

      {/* DISEÑO 15 NOV: EL RESUMEN DE LA DERECHA. Reemplaza «Revisa antes de
          emitir» y la barra de abajo: mismas cifras (las calcula el back) y el
          mismo botón Emitir, con sus mismas reglas. */}
      {previa.puede && (
        <aside className="nc-resumen" aria-label="Resumen de la nota">
          <div className="nc-resumen-cab">
            <small>Vas a emitir</small>
            <strong className="mono">{calculo?.serie ?? previa.serieNota}-…</strong>
            <span className="nc-pastilla">Nota de crédito · el número lo pone el sistema</span>
          </div>
          <dl className="nc-resumen-datos">
            <div><dt>Modifica</dt><dd className="mono">{previa.numero}</dd></div>
            <div><dt>Cliente</dt><dd>{previa.cliente?.razonSocial ?? '—'}</dd></div>
            <div><dt>Motivo</dt><dd>{motivoElegido?.titulo ?? '—'}</dd></div>
            {motivo === '07' && <div><dt>Devuelve</dt><dd>{devueltas} {devueltas === 1 ? 'producto' : 'productos'}</dd></div>}
            {motivo && DEVUELVEN.includes(motivo) && inventario?.encendido && (
              <div><dt>Mercadería</dt><dd>{retorno === 'volvio' ? 'Vuelve al almacén' : retorno === 'danada' ? 'Vuelve dañada' : 'No vuelve'}</dd></div>
            )}
          </dl>
          <dl className="nc-resumen-totales">
            {calculo && !calculo.problema && calculo.gravado != null && <div><dt>Valor</dt><dd className="mono">{dinero(calculo.gravado)}</dd></div>}
            {calculo && !calculo.problema && calculo.igv != null && <div><dt>IGV</dt><dd className="mono">{dinero(calculo.igv)}</dd></div>}
            <div className="total"><dt>Esta nota</dt><dd className="mono">{calculo?.total != null ? dinero(calculo.total) : '—'}</dd></div>
            <div><dt>Quedaba</dt><dd className="mono">{dinero(previa.saldo)}</dd></div>
            {motivo === '13'
              ? <div className="neto"><dt>Nuevo monto pendiente</dt><dd className="mono">{calculo?.cuotas != null ? dinero(calculo.cuotas) : '—'}</dd></div>
              : <div className="neto"><dt>Queda después</dt><dd className="mono">{dinero(calculo?.saldoDespues ?? previa.saldo)}</dd></div>}
          </dl>
          <ul className="nc-resumen-falta" aria-label="Qué falta">
            <li className={motivo ? 'si' : 'no'}>{motivo ? 'Motivo elegido' : 'Elige qué pasó'}</li>
            <li className={descripcion.trim().length >= 5 ? 'si' : 'no'}>
              {descripcion.trim().length >= 5 ? 'Explicación escrita' : 'Falta explicar en una línea qué pasó'}
            </li>
            {calculo?.problema && <li className="no">{calculo.problema}</li>}
            {calculando && <li className="espera">Calculando…</li>}
          </ul>
          {falloEmitir && <div className="nc-resumen-aviso"><Aviso>{falloEmitir}</Aviso></div>}
          <div className="nc-resumen-botones">
            <Boton onClick={() => void emitir()} disabled={!listo} ocupado={emitiendo} textoOcupado="Emitiendo…">
              Emitir nota de crédito
            </Boton>
            <Boton estilo="secundario" onClick={() => navegar(desde ?? `/facturacion/comprobantes/${previa.id}`)}>Cancelar</Boton>
          </div>
          <p className="nc-resumen-nota">
            {previa.serieNueva
              ? <>No tienes serie de notas de crédito: se crea {previa.serieNota} al emitir esta.</>
              : <>Sale con tu serie {previa.serieNota}.</>}
            {' '}Se envía al cliente por correo, como una factura.
          </p>
        </aside>
      )}
      </div>
    </div>
  )
}