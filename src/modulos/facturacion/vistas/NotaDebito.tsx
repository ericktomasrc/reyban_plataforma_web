import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { notaDebitoServicio } from '../servicios/facturacionServicio'
import type { CalculoNotaDebito, PreviaNotaDebito } from '../tipos'

/**
 * 22 OCT — NOTA DE DÉBITO (maqueta aprobada el 22 oct 2026).
 *
 * Cobrar más sobre una factura o boleta ya aceptada. Como la nota de crédito,
 * nace del comprobante original: cliente, moneda y tipo de cambio vienen de
 * él. Aquí se elige POR QUÉ (catálogo 10) y CUÁNTO. El total lo calcula el
 * back con los mismos redondeos con que se emite.
 */

type Motivo = '01' | '02' | '03'

const MOTIVOS: { codigo: Motivo; titulo: string; texto: string }[] = [
  { codigo: '01', titulo: 'Intereses por pago tardío', texto: 'El cliente pagó después del vencimiento.' },
  { codigo: '02', titulo: 'Subió el valor', texto: 'Un producto o servicio costó más de lo facturado.' },
  { codigo: '03', titulo: 'Penalidad u otro cargo', texto: 'Flete, penalidad del contrato u otro concepto.' },
]

const AFECTACIONES: [string, string][] = [
  ['30', 'Inafecto (sin IGV)'],
  ['10', 'Gravado (con IGV 18 %)'],
  ['20', 'Exonerado'],
]

function nuevaClave() {
  try { return crypto.randomUUID().replace(/-/g, '') }
  catch { return `${Date.now()}${Math.random().toString(16).slice(2)}` }
}

export function NotaDebito() {
  const { id } = useParams()
  const navegar = useNavigate()

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
    afectacion: motivo === '02' ? undefined : afectacion,
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

  return (
    <>
      <div className="encabezado-pagina">
        <h1 className="titulo-pagina">Nota de débito para {previa.numero}</h1>
        <Boton estilo="secundario" onClick={() => navegar(`/facturacion/comprobantes/${previa.id}`)}>
          Volver
        </Boton>
      </div>

      <div className="bloque">
        <p className="secundario">
          {previa.cliente?.razonSocial} · {previa.cliente?.numeroDocumento} · Emitido el {fecha(previa.fechaEmision)}
          {' '}· Total {previa.moneda} {previa.importeTotal.toFixed(2)}
          {previa.formaPago === 'credito' && previa.vence && <> · Al crédito, vencía el {fecha(previa.vence)}</>}
          {previa.ambiente === 'beta' && <> <span className="etiqueta aviso">prueba</span></>}
        </p>
        {!previa.puede && <Aviso>{previa.problema}</Aviso>}
      </div>

      {previa.puede && (
        <>
          {/* --- 1. ¿Por qué? -------------------------------------------------- */}
          <div className="bloque">
            <h2 className="subtitulo">1. ¿Por qué cobras más?</h2>
            <div className="motivos-nota">
              {MOTIVOS.map(m => (
                <button key={m.codigo} type="button"
                        disabled={m.codigo === '02' && lineasPosibles.length === 0}
                        className={`opcion-cuenta${motivo === m.codigo ? ' elegida' : ''}`}
                        onClick={() => { setMotivo(m.codigo); setFalloEmitir(undefined) }}>
                  <strong>{m.titulo}</strong>
                  <span>{m.texto}</span>
                </button>
              ))}
            </div>

            <label className="campo">
              <span className="etiqueta">Explica en una línea (sale en el PDF y va a SUNAT)</span>
              <input value={descripcion} maxLength={250} onChange={e => setDescripcion(e.target.value)}
                     placeholder="Ej.: intereses por 15 días de atraso en el pago" />
            </label>
          </div>

          {/* --- 2. ¿Cuánto? --------------------------------------------------- */}
          {motivo && (
            <div className="bloque">
              <h2 className="subtitulo">2. ¿Cuánto?</h2>

              {motivo === '02' && (
                <label className="campo">
                  <span className="etiqueta">¿A qué producto?</span>
                  <select value={linea ?? ''} onChange={e => setLinea(e.target.value ? Number(e.target.value) : undefined)}>
                    <option value="">Elige…</option>
                    {lineasPosibles.map(l => (
                      <option key={l.numero} value={l.numero}>{l.descripcion} — {previa.moneda} {l.importeTotal.toFixed(2)}</option>
                    ))}
                  </select>
                  <span className="pista">El aumento lleva el mismo IGV que ese producto.</span>
                </label>
              )}

              <div className="pareja">
                <label className="campo">
                  <span className="etiqueta">Monto{motivo === '02' || afectacion === '10' ? ' con IGV' : ''} ({previa.moneda})</span>
                  <input className="mono numero-nota" inputMode="decimal" value={monto} placeholder="0.00"
                         onChange={e => setMonto(e.target.value.replace(/[^\d.,]/g, ''))} />
                </label>

                {motivo !== '02' && (
                  <label className="campo">
                    <span className="etiqueta">IGV</span>
                    <select value={afectacion} onChange={e => setAfectacion(e.target.value)}>
                      {AFECTACIONES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                    </select>
                  </label>
                )}
              </div>

              {motivo !== '02' && (
                <p className="nota">
                  Los intereses moratorios y las penalidades normalmente no llevan IGV (no son una venta).
                  Si tienes dudas, confírmalo con tu contador.
                </p>
              )}
            </div>
          )}

          {/* --- 3. Revisar y emitir -------------------------------------------- */}
          {motivo && (
            <div className="bloque">
              <h2 className="subtitulo">3. Revisa antes de emitir</h2>

              <div className="cifras-nota">
                <div><span>Comprobante original</span><strong className="mono">{previa.importeTotal.toFixed(2)}</strong></div>
                <div><span>Notas anteriores</span>
                  <strong className="mono">{(previa.debitos - previa.creditos).toFixed(2)}</strong></div>
                <div><span>Esta nota de débito</span><strong className="mono">+ {calculo?.total?.toFixed(2) ?? '—'}</strong></div>
                <div><span>Total a cobrar</span><strong className="mono">{totalACobrar.toFixed(2)}</strong></div>
              </div>

              {calculo?.problema && <Aviso>{calculo.problema}</Aviso>}

              {calculo && !calculo.problema && (
                <p className="secundario">
                  Nota de débito <strong className="mono">{calculo.serie}</strong> (el número lo pone el sistema) ·
                  modifica {previa.numero} · al mismo cliente · en {previa.moneda} ·
                  «{calculo.descripcionLinea}» · {calculo.igv ? `gravado ${calculo.gravado?.toFixed(2)} · IGV ${calculo.igv.toFixed(2)}` : 'sin IGV'}
                </p>
              )}

              {descripcion.trim().length < 5 && <p className="nota">Falta explicar en una línea por qué.</p>}
              {falloEmitir && <Aviso>{falloEmitir}</Aviso>}

              <div className="acciones-linea">
                <Boton onClick={() => void emitir()} disabled={!listo} ocupado={emitiendo} textoOcupado="Emitiendo…">
                  Emitir nota de débito
                </Boton>
                <span className="secundario">
                  La serie {previa.serieNota} se crea sola la primera vez. Se envía al cliente por correo, como una factura.
                </span>
              </div>
            </div>
          )}

          {previa.notas.length > 0 && (
            <div className="bloque">
              <h2 className="subtitulo">Notas de débito anteriores de este comprobante</h2>
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