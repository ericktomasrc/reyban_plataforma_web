import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { notaCreditoServicio } from '../servicios/facturacionServicio'
import type { CalculoNotaCredito, PreviaNotaCredito } from '../tipos'

/**
 * 031 — NOTA DE CRÉDITO (maqueta aprobada el 18 oct 2026).
 *
 * Nace siempre del comprobante original: el cliente, la moneda y los precios
 * vienen de él y no se tocan. Aquí solo se elige QUÉ pasó y CUÁNTO.
 *
 * EL TOTAL LO CALCULA EL BACK («Simular»), con los mismos redondeos con los
 * que se va a emitir: la pantalla nunca enseña una cifra distinta de la que
 * sale. Un doble clic manda la misma clave y no hace dos notas.
 */

type Motivo = '01' | '02' | '06' | '07' | '04' | '05' | '09'

const MOTIVOS: { codigo: Motivo; titulo: string; texto: string }[] = [
  { codigo: '01', titulo: 'Anular toda la venta', texto: 'La venta no se hizo o se emitió por error. Devuelve el total.' },
  { codigo: '07', titulo: 'Me devolvieron algunos productos', texto: 'Eliges qué productos y cuántos.' },
  { codigo: '06', titulo: 'Me devolvieron todo', texto: 'Devolución de toda la mercadería.' },
  { codigo: '04', titulo: 'Hice un descuento después (a todo)', texto: 'Un monto sobre toda la venta.' },
  { codigo: '05', titulo: 'Hice un descuento después (a un producto)', texto: 'Un monto sobre un solo producto.' },
  { codigo: '02', titulo: 'Me equivoqué de RUC', texto: 'Anula todo. Luego emites una factura nueva al RUC correcto.' },
  { codigo: '09', titulo: 'Bajó el valor de un producto', texto: 'Disminución en el valor, con un monto.' },
]

const TODO: Motivo[] = ['01', '02', '06']

function nuevaClave() {
  try { return crypto.randomUUID().replace(/-/g, '') }
  catch { return `${Date.now()}${Math.random().toString(16).slice(2)}` }
}

export function NotaCredito() {
  const { id } = useParams()
  const navegar = useNavigate()

  const [previa, setPrevia] = useState<PreviaNotaCredito>()
  const [error, setError] = useState<string>()
  const [motivo, setMotivo] = useState<Motivo>()
  const [descripcion, setDescripcion] = useState('')
  const [cantidades, setCantidades] = useState<Record<number, string>>({})
  const [monto, setMonto] = useState('')
  const [linea, setLinea] = useState<number>()
  const [calculo, setCalculo] = useState<CalculoNotaCredito>()
  const [calculando, setCalculando] = useState(false)
  const [emitiendo, setEmitiendo] = useState(false)
  const [falloEmitir, setFalloEmitir] = useState<string>()

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
    monto: motivo && ['04', '05', '09'].includes(motivo) ? Number(monto.replace(',', '.')) || undefined : undefined,
    linea: motivo === '05' || motivo === '09' ? linea : undefined,
  }), [motivo, descripcion, cantidades, monto, linea])

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

  const disponibles = MOTIVOS.filter(m =>
    (m.codigo !== '02' || previa.tipo === '01') &&
    (m.codigo !== '04' || previa.afectacionUnica))

  return (
    <>
      <div className="encabezado-pagina">
        <h1 className="titulo-pagina">Nota de crédito para {previa.numero}</h1>
        <Boton estilo="secundario" onClick={() => navegar(`/facturacion/comprobantes/${previa.id}`)}>
          Volver
        </Boton>
      </div>

      <div className="bloque">
        <p className="secundario">
          {previa.cliente?.razonSocial} · {previa.cliente?.numeroDocumento} · Emitido el {fecha(previa.fechaEmision)}
          {' '}· Total {previa.moneda} {previa.importeTotal.toFixed(2)}
          {previa.ambiente === 'beta' && <> <span className="etiqueta aviso">prueba</span></>}
        </p>

        {!previa.puede && <Aviso>{previa.problema}</Aviso>}

        {previa.puede && previa.aTiempoDeBaja && !previa.hayNotas && (
          <Aviso tono="ojo">
            Todavía estás dentro de los 7 días: si quieres anular <strong>todo</strong>, «{previa.tipo === '01' ? 'Comunicar baja' : 'Anular'}»
            en el detalle del comprobante es más simple. La nota de crédito sirve igual, y también para devoluciones y descuentos.
          </Aviso>
        )}
      </div>

      {previa.puede && (
        <>
          {/* --- 1. ¿Qué pasó? -------------------------------------------- */}
          <div className="bloque">
            <h2 className="subtitulo">1. ¿Qué pasó?</h2>
            <div className="motivos-nota">
              {disponibles.map(m => {
                const bloqueado = TODO.includes(m.codigo) && previa.hayNotas
                return (
                  <button key={m.codigo} type="button" disabled={bloqueado}
                          className={`opcion-cuenta${motivo === m.codigo ? ' elegida' : ''}`}
                          onClick={() => { setMotivo(m.codigo); setFalloEmitir(undefined) }}>
                    <strong>{m.titulo}</strong>
                    <span>{bloqueado ? 'Ya tiene notas: usa devolución de algunos productos o un descuento.' : m.texto}</span>
                  </button>
                )
              })}
            </div>

            <label className="campo">
              <span className="etiqueta">Explica en una línea (sale en el PDF y va a SUNAT)</span>
              <input value={descripcion} maxLength={250} onChange={e => setDescripcion(e.target.value)}
                     placeholder="Ej.: el cliente canceló el pedido antes de la entrega" />
            </label>
          </div>

          {/* --- 2. Qué se devuelve -------------------------------------- */}
          {motivo && (
            <div className="bloque">
              <h2 className="subtitulo">2. {motivo === '07' ? '¿Qué productos y cuántos?'
                : TODO.includes(motivo) ? 'Se devuelve todo el comprobante'
                : '¿De cuánto?'}</h2>

              {(motivo === '07' || TODO.includes(motivo)) && (
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="derecha">Vendido</th>
                      <th className="derecha">Ya devuelto</th>
                      {motivo === '07' && <th className="derecha">Devolver ahora</th>}
                      <th className="derecha">Precio unit.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previa.lineas.map(l => (
                      <tr key={l.numero}>
                        <td>{l.descripcion}</td>
                        <td className="derecha mono">{l.cantidad} {l.unidadMedida}</td>
                        <td className="derecha mono">{l.devuelta || '—'}</td>
                        {motivo === '07' && (
                          <td className="derecha">
                            <input className="mono numero-nota" inputMode="decimal" disabled={l.disponible <= 0}
                                   value={cantidades[l.numero] ?? ''} placeholder="0"
                                   onChange={e => setCantidades(c => ({ ...c, [l.numero]: e.target.value.replace(/[^\d.,]/g, '') }))} />
                            <div className="secundario">quedan {l.disponible}</div>
                          </td>
                        )}
                        <td className="derecha mono">{l.precioUnitario.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {(motivo === '05' || motivo === '09') && (
                <label className="campo">
                  <span className="etiqueta">¿A qué producto?</span>
                  <select value={linea ?? ''} onChange={e => setLinea(e.target.value ? Number(e.target.value) : undefined)}>
                    <option value="">Elige…</option>
                    {previa.lineas.map(l => (
                      <option key={l.numero} value={l.numero}>{l.descripcion} — {previa.moneda} {l.importeTotal.toFixed(2)}</option>
                    ))}
                  </select>
                </label>
              )}

              {(motivo === '04' || motivo === '05' || motivo === '09') && (
                <label className="campo">
                  <span className="etiqueta">Monto con IGV ({previa.moneda})</span>
                  <input className="mono numero-nota" inputMode="decimal" value={monto} placeholder="0.00"
                         onChange={e => setMonto(e.target.value.replace(/[^\d.,]/g, ''))} />
                </label>
              )}
            </div>
          )}

          {/* --- 3. Revisar y emitir -------------------------------------- */}
          {motivo && (
            <div className="bloque">
              <h2 className="subtitulo">3. Revisa antes de emitir</h2>

              <div className="cifras-nota">
                <div><span>Comprobante original</span><strong className="mono">{previa.importeTotal.toFixed(2)}</strong></div>
                <div><span>Notas anteriores</span><strong className="mono">{anteriores.toFixed(2)}</strong></div>
                <div><span>Esta nota</span><strong className="mono">{calculo?.total?.toFixed(2) ?? '—'}</strong></div>
                <div><span>Queda después</span><strong className="mono">{calculo?.saldoDespues?.toFixed(2) ?? previa.saldo.toFixed(2)}</strong></div>
              </div>

              {calculo?.problema && <Aviso>{calculo.problema}</Aviso>}

              {calculo && !calculo.problema && (
                <p className="secundario">
                  Nota de crédito <strong className="mono">{calculo.serie}</strong> (el número lo pone el sistema) ·
                  modifica {previa.numero} · al mismo cliente · en {previa.moneda} ·
                  gravado {calculo.gravado?.toFixed(2)} · IGV {calculo.igv?.toFixed(2)}
                </p>
              )}

              {descripcion.trim().length < 5 && <p className="nota">Falta explicar en una línea qué pasó.</p>}
              {falloEmitir && <Aviso>{falloEmitir}</Aviso>}

              <div className="acciones-linea">
                <Boton onClick={() => void emitir()} disabled={!listo} ocupado={emitiendo} textoOcupado="Emitiendo…">
                  Emitir nota de crédito
                </Boton>
                <span className="secundario">
                  {previa.serieNueva
                    ? <>No tienes serie de notas de crédito configurada: se crea {previa.serieNota} al emitir esta.</>
                    : <>Sale con tu serie {previa.serieNota}.</>}
                  {' '}Se envía al cliente por correo, como una factura.
                </span>
              </div>
            </div>
          )}

          {previa.notas.length > 0 && (
            <div className="bloque">
              <h2 className="subtitulo">Notas anteriores de este comprobante</h2>
              <ul className="lista-nota">
                {previa.notas.map(n => (
                  <li key={n.id}>
                    <span className="mono">{n.numero}</span> · {fecha(n.fechaEmision)} · {previa.moneda} {n.importeTotal.toFixed(2)} · {n.estado}
                    {!n.cuenta && <span className="secundario"> (no cuenta: no vale ante SUNAT)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </>
  )
}