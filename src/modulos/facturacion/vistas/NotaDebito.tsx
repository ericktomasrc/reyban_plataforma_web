import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Asterisco } from '../../../componentes/Campo'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { notaDebitoServicio } from '../servicios/facturacionServicio'
import type { CalculoNotaDebito, PreviaNotaDebito } from '../tipos'
import '../comprobante.css'
import { CapaOcupado } from '../../../componentes/CapaOcupado'

/**
 * 22 OCT — NOTA DE DÉBITO (maqueta aprobada el 22 oct 2026).
 *
 * Cobrar más sobre una factura o boleta ya aceptada. Como la nota de crédito,
 * nace del comprobante original: cliente, moneda y tipo de cambio vienen de
 * él. Aquí se elige POR QUÉ (catálogo 10) y CUÁNTO. El total lo calcula el
 * back con los mismos redondeos con que se emite.
 *
 * e167: el mismo diseño que «Nuevo comprobante» (tarjetas numeradas y barra
 * fija con Emitir). Solo cambia cómo se ve; los motivos y el cálculo, igual.
 */

type Motivo = '01' | '02' | '03' | '10' | '11'   // 24 oct: el catálogo 10 entero

const MOTIVOS: { codigo: Motivo; titulo: string; texto: string }[] = [
  { codigo: '01', titulo: 'Intereses por pago tardío', texto: 'El cliente pagó después del vencimiento.' },
  { codigo: '02', titulo: 'Subió el valor', texto: 'Un producto o servicio costó más de lo facturado.' },
  { codigo: '03', titulo: 'Penalidad u otro cargo', texto: 'Flete, penalidad del contrato u otro concepto.' },
  { codigo: '10', titulo: 'Ajuste de exportación', texto: 'Un monto más sobre lo exportado.' },
  { codigo: '11', titulo: 'Ajuste del IVAP', texto: 'Un monto más sobre lo afecto al IVAP (arroz pilado).' },
]

const AFECTACIONES: [string, string][] = [
  ['30', 'Inafecto (sin IGV)'],
  ['10', 'Gravado (con IGV 18 %)'],
  ['20', 'Exonerado'],
]

/** Diseño 15 nov: un ícono por motivo. */
const ICONO: Record<Motivo, string> = { '01': '◷', '02': '↑', '03': '!', '10': '⇄', '11': '◇' }
const miles = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function nuevaClave() {
  try { return crypto.randomUUID().replace(/-/g, '') }
  catch { return `${Date.now()}${Math.random().toString(16).slice(2)}` }
}

export function NotaDebito() {
  const { id } = useParams()
  const navegar = useNavigate()
  // 15 nov: «Volver» y «Cancelar» regresan a donde se vino: la bandeja de
  // «Nueva nota» (si se entró por el menú) o el detalle del comprobante.
  const desde = (useLocation().state as { volverA?: string } | null)?.volverA

  const [previa, setPrevia] = useState<PreviaNotaDebito>()
  const [error, setError] = useState<string>()
  const [motivo, setMotivo] = useState<Motivo>()
  const [descripcion, setDescripcion] = useState('')
  const [monto, setMonto] = useState('')
  const [afectacion, setAfectacion] = useState('30')
  const [linea, setLinea] = useState<number>()
  const [calculo, setCalculo] = useState<CalculoNotaDebito>()
  const [calculando, setCalculando] = useState(false)
  const [emitiendo, setEmitiendo] = useState(false)
  const [falloEmitir, setFalloEmitir] = useState<string>()

  // LA CLAVE NACE AL ABRIR LA PANTALLA: dos clics en «Emitir» son la misma nota.
  const clave = useRef(nuevaClave())

  useEffect(() => {
    if (!id) return
    notaDebitoServicio.previa(id)
      .then(setPrevia)
      .catch(e => setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar el comprobante.'))
  }, [id])

  const peticion = useMemo(() => ({
    clave: clave.current,
    motivo,
    descripcion: descripcion.trim(),
    monto: Number(monto.replace(',', '.')) || undefined,
    afectacion: motivo === '02' || motivo === '10' || motivo === '11' ? undefined : afectacion,
    linea: motivo === '02' ? linea : undefined,
  }), [motivo, descripcion, monto, afectacion, linea])

  useEffect(() => {
    if (!id || !motivo || !previa?.puede || !peticion.monto) { setCalculo(undefined); return }
    setCalculando(true)
    const t = setTimeout(() => {
      notaDebitoServicio.calcular(id, peticion)
        .then(setCalculo)
        .catch(e => setCalculo({ problema: e instanceof ErrorApi ? e.message : 'No se pudo calcular.' }))
        .finally(() => setCalculando(false))
    }, 350)
    return () => clearTimeout(t)
  }, [id, motivo, peticion, previa?.puede])

  if (error) return <Aviso>{error}</Aviso>
  if (!previa) return <Cargando />

  const listo = !!calculo && !calculo.problema && descripcion.trim().length >= 5 && !calculando
  const totalACobrar = previa.importeTotal - previa.creditos + previa.debitos + (calculo?.total ?? 0)
  const lineasPosibles = previa.lineas.filter(l => l.sePuede)

  const emitir = async () => {
    if (!id) return
    setEmitiendo(true); setFalloEmitir(undefined)
    try {
      const r = await notaDebitoServicio.emitir(id, peticion)
      navegar(`/facturacion/comprobantes/${r.id}`, { state: { reciente: r.mensaje, abrirWhatsapp: r.whatsapp } })
    } catch (e) {
      setFalloEmitir(e instanceof ErrorApi ? e.message : 'No se pudo emitir la nota de débito.')
    } finally {
      setEmitiendo(false)
    }
  }

  const simbolo = previa.moneda === 'PEN' ? 'S/' : previa.moneda === 'USD' ? 'US$' : previa.moneda
  const dinero = (n: number) => `${simbolo} ${miles.format(n)}`
  const debia = previa.importeTotal - previa.creditos + previa.debitos
  const anteriores = previa.debitos - previa.creditos
  const conMonto = Number(monto.replace(',', '.')) > 0
  const motivoElegido = MOTIVOS.find(m => m.codigo === motivo)

  return (
    <div className="nc nota">
      {emitiendo && <CapaOcupado texto="Emitiendo la nota de débito…" detalle="Se firma y se envía a SUNAT. No cierres esta ventana." />}
      {/* --- Encabezado ---------------------------------------------------- */}
      <div className="nc-encabezado">
        <div>
          <p className="vc-tipo">Nota de débito</p>
          <h1 className="titulo-pagina">Para la {previa.tipo === '01' ? 'factura' : 'boleta'} {previa.numero}</h1>
          <p className="nc-bajada">
            <span className="nc-pastilla">{previa.tipo === '01' ? 'Factura' : 'Boleta'}</span>
            <span>{previa.cliente?.razonSocial}</span>
            <span className="mono">{previa.cliente?.numeroDocumento}</span>
            <span>· emitido el {fecha(previa.fechaEmision)}</span>
            {previa.formaPago === 'credito' && previa.vence && <span>· al crédito, vencía el {fecha(previa.vence)}</span>}
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
      {/* --- 1. El comprobante ------------------------------------------- */}
      <section className="bloque nc-tarjeta">
        <h2 className="nc-titulo"><span className="nc-paso">1</span>La {previa.tipo === '01' ? 'factura' : 'boleta'} a la que cobras más</h2>
        <div className="nt-cifras">
          <div><span>Total {previa.tipo === '01' ? 'de la factura' : 'de la boleta'}</span><strong>{dinero(previa.importeTotal)}</strong></div>
          <div><span>Notas anteriores</span><strong>{anteriores === 0 ? '—' : `${anteriores < 0 ? '−' : '+'} ${dinero(Math.abs(anteriores))}`}</strong></div>
          <div className="queda"><span>Hoy se debe</span><strong>{dinero(debia)}</strong></div>
        </div>
        {previa.notas.length > 0 && (
          <details className="nota-anteriores">
            <summary>Notas de débito anteriores de este comprobante ({previa.notas.length})</summary>
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
          {/* --- 2. ¿Por qué? -------------------------------------------------- */}
          <section className="bloque nc-tarjeta">
            <h2 className="nc-titulo"><span className="nc-paso">2</span>¿Por qué cobras más?</h2>
            <div className="motivos-nota nt-motivos">
              {MOTIVOS.filter(m => !previa.motivos || previa.motivos.some(x => x.codigo === m.codigo)).map(m => {
                const bloqueado = m.codigo === '02' && lineasPosibles.length === 0
                return (
                  <button key={m.codigo} type="button" disabled={bloqueado}
                          className={`opcion-cuenta nt-motivo${motivo === m.codigo ? ' elegida' : ''}`}
                          onClick={() => { setMotivo(m.codigo); setFalloEmitir(undefined) }}>
                    <span className="nt-icono" aria-hidden="true">{ICONO[m.codigo]}</span>
                    <span className="nt-motivo-texto">
                      <strong>{m.titulo}</strong>
                      <span>{bloqueado ? 'No se puede: ningún producto del comprobante admite un aumento.' : m.texto}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* --- 3. ¿Cuánto? --------------------------------------------------- */}
          {motivo && (
            <section className="bloque nc-tarjeta">
              <h2 className="nc-titulo"><span className="nc-paso">3</span>¿Cuánto?</h2>

              {motivo === '02' && (
                <label className="campo">
                  <span className="etiqueta">¿A qué producto?<Asterisco /></span>
                  <select value={linea ?? ''} onChange={e => setLinea(e.target.value ? Number(e.target.value) : undefined)}>
                    <option value="">Elige…</option>
                    {lineasPosibles.map(l => (
                      <option key={l.numero} value={l.numero}>{l.numero}. {l.descripcion} — {previa.moneda} {l.importeTotal.toFixed(2)}</option>
                    ))}
                  </select>
                  <span className="pista">El aumento lleva el mismo IGV que ese producto.</span>
                </label>
              )}

              <div className="pareja">
                <label className="campo">
                  <span className="etiqueta">Monto{motivo === '02' || motivo === '11' || (!['10', '11'].includes(motivo) && afectacion === '10') ? ' con IGV' : ''} ({previa.moneda})<Asterisco /></span>
                  <input className="mono numero-nota" inputMode="decimal" value={monto} placeholder="0.00"
                         onChange={e => setMonto(e.target.value.replace(/[^\d.,]/g, ''))} />
                </label>

                {!['02', '10', '11'].includes(motivo) && (
                  <label className="campo">
                    <span className="etiqueta">IGV</span>
                    <select value={afectacion} onChange={e => setAfectacion(e.target.value)}>
                      {AFECTACIONES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                    </select>
                  </label>
                )}
              </div>

              {['10', '11'].includes(motivo) && (
                <p className="nota se-aplica">
                  Se aplica: {motivo === '10' ? 'exportación (sin IGV)' : 'IVAP 4%'}, como las líneas del comprobante original.
                </p>
              )}

              {['01', '03'].includes(motivo) && (
                <p className="nota">
                  Los intereses moratorios y las penalidades normalmente no llevan IGV (no son una venta).
                  Si tienes dudas, confírmalo con tu contador.
                </p>
              )}
            </section>
          )}

          {/* --- La explicación (antes iba bajo los motivos) ------------------- */}
          <section className="bloque nc-tarjeta">
            <label className="campo">
              <span className="etiqueta">Explica en una línea (sale en el PDF y va a SUNAT)<Asterisco /></span>
              <input value={descripcion} maxLength={250} onChange={e => setDescripcion(e.target.value)}
                     placeholder="Ej.: intereses por 15 días de atraso en el pago"
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
            <span className="nc-pastilla">Nota de débito · el número lo pone el sistema</span>
          </div>
          <dl className="nc-resumen-datos">
            <div><dt>Modifica</dt><dd className="mono">{previa.numero}</dd></div>
            <div><dt>Cliente</dt><dd>{previa.cliente?.razonSocial ?? '—'}</dd></div>
            <div><dt>Motivo</dt><dd>{motivoElegido?.titulo ?? '—'}</dd></div>
          </dl>
          <dl className="nc-resumen-totales">
            {calculo && !calculo.problema && (calculo.igv
              ? <>
                  <div><dt>Valor</dt><dd className="mono">{dinero(calculo.gravado ?? 0)}</dd></div>
                  <div><dt>IGV</dt><dd className="mono">{dinero(calculo.igv)}</dd></div>
                </>
              : <div><dt>IGV</dt><dd>sin IGV</dd></div>)}
            <div className="total"><dt>Esta nota</dt><dd className="mono">{calculo?.total != null ? `+ ${dinero(calculo.total)}` : '—'}</dd></div>
            <div><dt>El cliente debía</dt><dd className="mono">{dinero(debia)}</dd></div>
            <div className="neto"><dt>Ahora debe</dt><dd className="mono">{dinero(totalACobrar)}</dd></div>
          </dl>
          <ul className="nc-resumen-falta" aria-label="Qué falta">
            <li className={motivo ? 'si' : 'no'}>{motivo ? 'Motivo elegido' : 'Elige por qué cobras más'}</li>
            <li className={conMonto ? 'si' : 'no'}>{conMonto ? 'Monto escrito' : 'Falta el monto'}</li>
            <li className={descripcion.trim().length >= 5 ? 'si' : 'no'}>
              {descripcion.trim().length >= 5 ? 'Explicación escrita' : 'Falta explicar en una línea por qué'}
            </li>
            {calculo?.problema && <li className="no">{calculo.problema}</li>}
            {calculando && <li className="espera">Calculando…</li>}
          </ul>
          {falloEmitir && <div className="nc-resumen-aviso"><Aviso>{falloEmitir}</Aviso></div>}
          <div className="nc-resumen-botones">
            <Boton onClick={() => void emitir()} disabled={!listo} ocupado={emitiendo} textoOcupado="Emitiendo…">
              Emitir nota de débito
            </Boton>
            <Boton estilo="secundario" onClick={() => navegar(desde ?? `/facturacion/comprobantes/${previa.id}`)}>Cancelar</Boton>
          </div>
          <p className="nc-resumen-nota">
            {previa.serieNueva
              ? <>No tienes serie de notas de débito: se crea {previa.serieNota} al emitir esta.</>
              : <>Sale con tu serie {previa.serieNota}.</>}
            {' '}Se envía al cliente por correo, como una factura.
          </p>
        </aside>
      )}
      </div>
    </div>
  )
}