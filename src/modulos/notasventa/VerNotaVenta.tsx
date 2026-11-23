import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Aviso } from '../../componentes/Aviso'
import { Boton } from '../../componentes/Boton'
import { Cargando } from '../../componentes/Cargando'
import { Dialogo } from '../../componentes/Dialogo'
import { ErrorApi } from '../../nucleo/api/errores'
import { fecha } from '../../nucleo/formato/fechas'
import { useConfirmar } from '../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../nucleo/mensajes/ProveedorMensajes'
import { MEDIOS, NOMBRE_MEDIO, type MedioPago } from '../deudas/deudasServicio'
import '../deudas/deudas.css'
import './notas-venta.css'
import { claseEstado, dinero, enLima } from './formatoNotas'
import { NOMBRE_ESTADO, notasVentaServicio, type NotaVenta, type PagoNota } from './notasVentaServicio'
import { imprimirTicket } from './imprimirTicket'
import { TicketNota } from './TicketNota'

/**
 * e282 (097) — UNA NOTA DE VENTA: su ticket, convertirla en boleta o factura,
 * entregar lo que estaba separado, sus pagos (fiado) y anularla con motivo.
 */
export function VerNotaVenta() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navegar = useNavigate()
  const mensaje = useMensaje()
  const { pedir, dialogo } = useConfirmar()
  const [n, setN] = useState<NotaVenta>()
  const [fallo, setFallo] = useState<string>()
  const [recargar, setRecargar] = useState(0)
  const [anulando, setAnulando] = useState(false)
  const [entregando, setEntregando] = useState(false)
  const [pagando, setPagando] = useState(false)
  const [anulandoPago, setAnulandoPago] = useState<PagoNota>()
  const ticket = useRef<HTMLDivElement>(null)
  const impreso = useRef(false)

  useEffect(() => {
    let vivo = true
    notasVentaServicio.ver(id)
      .then(x => { if (vivo) { setN(x); setFallo(undefined) } })
      .catch(e => { if (vivo) setFallo(e instanceof ErrorApi ? e.message : 'No se pudo leer la nota.') })
    return () => { vivo = false }
  }, [id, recargar])

  // Recién guardada: el ticket a la impresora, una vez.
  useEffect(() => {
    if (!n || impreso.current || params.get('imprimir') !== '1' || !ticket.current) return
    impreso.current = true
    imprimirTicket(ticket.current, n.numero)
    setParams({}, { replace: true })
  }, [n, params, setParams])

  if (fallo) return <Aviso>{fallo}</Aviso>
  if (!n) return <Cargando />

  const hecho = (m: string) => { mensaje.bien(m); setRecargar(x => x + 1) }
  const anulada = n.estado === 'anulada'
  const conRuc = n.cliente?.tipoDocumento === '6'
  const tipoSugerido = conRuc ? '01' : '03'
  const porEntregar = !n.entregadoEn && !anulada
  const borrador = n.borradores[0]

  async function convertir(tipo: '01' | '03') {
    if (!await pedir({
      titulo: tipo === '01' ? '¿Convertir en factura?' : '¿Convertir en boleta?',
      confirmar: 'Sí, abrir el emisor',
      mensaje: (
        <>
          <p>Se abre la pantalla de emitir con {n!.cliente ? <strong>{n!.cliente.nombre}</strong> : 'el cliente por elegir'} y los productos de
            la nota ya puestos. Revisa y emite.</p>
          <p>Al emitir, la nota queda «convertida» y enlazada. <strong>El stock no se descuenta otra vez.</strong>
            {n!.forma === 'fiado' && n!.saldo > 0 && <> Lo que debe sigue en esta nota (S/ {dinero(n!.saldo)}).</>}</p>
        </>
      ),
    })) return
    navegar(`/facturacion/comprobantes/nuevo?nota=${n!.id}&tipo=${tipo}`)
  }

  return (
    <div className="nv-pagina nv-ver">
      {dialogo}
      <div className="encabezado-pagina nv-encab">
        <div>
          <p className="nv-migas"><Link to="/facturacion/notas-venta">Notas de venta</Link> › {n.numero}</p>
          <h1 className="titulo-pagina">{n.numero} <span className={`ddu-estado ${claseEstado[n.estado]}`}>{NOMBRE_ESTADO[n.estado]}</span></h1>
          <p className="bajada-pagina">{n.clienteNombre} · {enLima(n.fecha)}{n.vendedor ? ` · vendió ${n.vendedor}` : ''}</p>
        </div>
        <div className="nv-acciones">
          <Boton estilo="secundario" onClick={() => ticket.current && imprimirTicket(ticket.current, n.numero)}>Imprimir ticket</Boton>
          {!anulada && !n.documento && n.puede.anular && <Boton estilo="secundario" onClick={() => setAnulando(true)}>Anular</Boton>}
          {!anulada && !n.documento && n.puede.emitir && (
            <Boton onClick={() => void convertir(tipoSugerido)}>{tipoSugerido === '01' ? 'Convertir en factura' : 'Convertir en boleta'}</Boton>
          )}
        </div>
      </div>

      {anulada && <Aviso tono="info">Anulada el {enLima(n.anuladoEn!)}: {n.anuladoMotivo}. Lo que había salido del stock volvió.</Aviso>}

      <div className="nv-ver-dos">
        <div className="nv-ticket-caja">
          <TicketNota ref={ticket} n={n} />
        </div>

        <div className="nv-paneles">
          <section className="bloque nv-panel">
            <h2>Comprobante electrónico</h2>
            {n.documento ? (
              <p className="secundario">Convertida en {n.documento.tipo === '01' ? 'la factura' : 'la boleta'}{' '}
                <Link className="mono" to={`/facturacion/comprobantes/${n.documento.id}`}>{n.documento.numero}</Link>. El stock salió una sola vez (con esta nota).</p>
            ) : anulada ? <p className="secundario">Una nota anulada no se convierte.</p> : (
              <>
                <p className="secundario">Abre el emisor con el cliente y los productos de esta nota ya puestos. Al emitir, la nota queda «convertida» y
                  enlazada a su boleta o factura. <strong>El stock no se descuenta dos veces.</strong></p>
                {borrador && (
                  <p className="nv-borrador">Ya empezaste {borrador.tipo === '01' ? 'una factura' : 'una boleta'} con esta nota:{' '}
                    <Link to={`/facturacion/comprobantes/${borrador.id}/editar`}>continuar</Link>.</p>
                )}
                {n.puede.emitir && (
                  <div className="nv-fila-botones">
                    <Boton estilo={tipoSugerido === '03' ? 'principal' : 'secundario'} onClick={() => void convertir('03')}>Convertir en boleta</Boton>
                    <Boton estilo={tipoSugerido === '01' ? 'principal' : 'secundario'} onClick={() => void convertir('01')}>Convertir en factura</Boton>
                  </div>
                )}
              </>
            )}
          </section>

          {porEntregar && (
            <section className="bloque nv-panel">
              <h2>{n.forma === 'pedido' ? 'Pedido por entregar' : 'Se lo lleva después'}</h2>
              <p className="secundario">El stock está <strong>separado</strong>{n.entregaFecha ? ` (entrega el ${fecha(n.entregaFecha)})` : ''}: nadie más lo puede vender.
                Al entregarlo, sale del stock{n.forma === 'pedido' ? ' y eliges cómo paga' : ''}.</p>
              {n.puede.emitir && <div className="nv-fila-botones"><Boton onClick={() => setEntregando(true)}>Entregar</Boton></div>}
            </section>
          )}

          {(n.forma === 'fiado' || n.pagos.length > 0) && (
            <section className="bloque nv-panel">
              <h2>Pagos</h2>
              {n.forma === 'fiado' && !anulada && (
                n.saldo > 0
                  ? <p className="secundario">{n.pagado > 0 ? <>Pagó S/ {dinero(n.pagado)}. </> : 'Todavía no paga. '}Debe <strong>S/ {dinero(n.saldo)}</strong>
                      {n.vence ? ` hasta el ${fecha(n.vence)}` : ''}. También sale en <Link to="/cobros/por-cobrar">Cobros y pagos › Por cobrar</Link>.</p>
                  : <p className="secundario">Pagada del todo.</p>
              )}
              {n.pagos.length > 0 && (
                <table className="tabla lst ddu-mini">
                  <thead><tr><th>Fecha</th><th>Cómo</th><th className="derecha">Monto</th><th /></tr></thead>
                  <tbody>{n.pagos.map(p => (
                    <tr key={p.id} className={p.anuladoEn ? 'apagada' : undefined}>
                      <td className="sin-corte">{fecha(p.fecha)}</td>
                      <td>{NOMBRE_MEDIO[p.medio] ?? p.medio}{p.referencia ? ` · ${p.referencia}` : ''}<div className="secundario">{p.registro}</div></td>
                      <td className="derecha mono">{p.anuladoEn ? <s>{dinero(p.monto)}</s> : dinero(p.monto)}</td>
                      <td className="derecha">{p.anuladoEn ? <span className="secundario">Anulado · {p.anuladoMotivo}</span>
                        : n.puede.emitir && <button type="button" className="enlace" onClick={() => setAnulandoPago(p)}>Anular</button>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
              {n.forma === 'fiado' && !anulada && n.saldo > 0 && n.puede.emitir && (
                <div className="nv-fila-botones"><Boton onClick={() => setPagando(true)}>Registrar pago</Boton></div>
              )}
            </section>
          )}
        </div>
      </div>

      {anulando && <DialogoAnular n={n} onCerrar={() => setAnulando(false)} onHecho={m => { setAnulando(false); hecho(m) }} />}
      {entregando && <DialogoEntregar n={n} onCerrar={() => setEntregando(false)} onHecho={m => { setEntregando(false); hecho(m) }} />}
      {pagando && <DialogoPagoNota n={n} onCerrar={() => setPagando(false)} onHecho={m => { setPagando(false); hecho(m) }} />}
      {anulandoPago && <DialogoAnularPago pago={anulandoPago} onCerrar={() => setAnulandoPago(undefined)} onHecho={m => { setAnulandoPago(undefined); hecho(m) }} />}
    </div>
  )
}

const hoyLima = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
const masDias = (d: number) => { const x = new Date(`${hoyLima()}T12:00:00`); x.setDate(x.getDate() + d); return x.toLocaleDateString('en-CA') }
const error = (e: unknown, def: string) => e instanceof ErrorApi ? e.message : def

/** Anular con motivo. Nada se borra; el stock vuelve. */
function DialogoAnular({ n, onCerrar, onHecho }: { n: NotaVenta; onCerrar: () => void; onHecho: (m: string) => void }) {
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string>()
  async function anular() {
    setOcupado(true); setFallo(undefined)
    try { onHecho((await notasVentaServicio.anular(n.id, motivo.trim())).mensaje) }
    catch (e) { setFallo(error(e, 'No se pudo anular.')) }
    finally { setOcupado(false) }
  }
  return (
    <Dialogo titulo={`¿Anular la nota ${n.numero}?`} abierto onCerrar={onCerrar}
      acciones={<>
        <Boton estilo="secundario" onClick={onCerrar}>No, volver</Boton>
        <Boton estilo="peligro" onClick={() => void anular()} ocupado={ocupado} disabled={motivo.trim().length < 3}>Sí, anular</Boton>
      </>}>
      <p>La nota no se borra: queda anulada con su motivo. Lo que salió del stock (o estaba separado) vuelve a estar disponible.</p>
      {n.pagado > 0 && <Aviso>Tiene pagos anotados (S/ {dinero(n.pagado)}): anúlalos primero en «Pagos».</Aviso>}
      <label className="campo"><span className="nv-rotulo">Motivo</span>
        <input value={motivo} maxLength={200} autoFocus placeholder="Ej.: el cliente no lo llevó" onChange={e => setMotivo(e.target.value)} /></label>
      {fallo && <Aviso>{fallo}</Aviso>}
    </Dialogo>
  )
}

/** Entregar lo separado: sale del stock (un pedido elige cómo paga). */
function DialogoEntregar({ n, onCerrar, onHecho }: { n: NotaVenta; onCerrar: () => void; onHecho: (m: string) => void }) {
  const pedido = n.forma === 'pedido'
  const [forma, setForma] = useState<'contado' | 'fiado'>('contado')
  const [medio, setMedio] = useState<MedioPago>('efectivo')
  const [vence, setVence] = useState(masDias(7))
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string>()
  async function entregar() {
    setOcupado(true); setFallo(undefined)
    try { onHecho((await notasVentaServicio.entregar(n.id, pedido ? { forma, medio, vence } : {})).mensaje) }
    catch (e) { setFallo(error(e, 'No se pudo entregar.')) }
    finally { setOcupado(false) }
  }
  return (
    <Dialogo titulo={`¿Entregar ${n.numero}?`} abierto onCerrar={onCerrar}
      acciones={<>
        <Boton estilo="secundario" onClick={onCerrar}>No, volver</Boton>
        <Boton onClick={() => void entregar()} ocupado={ocupado} disabled={pedido && forma === 'fiado' && (!vence || vence < hoyLima())}>Sí, entregar</Boton>
      </>}>
      <p>Los productos salen del stock ahora (S/ {dinero(n.total)}).</p>
      {pedido && (
        <>
          <span className="nv-rotulo">¿Cómo paga?</span>
          <div className="segmentado nv-seg" role="radiogroup" aria-label="Cómo paga">
            <button type="button" role="radio" aria-checked={forma === 'contado'} className={forma === 'contado' ? 'elegido' : undefined} onClick={() => setForma('contado')}>Contado</button>
            <button type="button" role="radio" aria-checked={forma === 'fiado'} className={forma === 'fiado' ? 'elegido' : undefined} onClick={() => setForma('fiado')}>Fiado</button>
          </div>
          {forma === 'contado' ? (
            <div className="cmp-chips nv-medios" role="group" aria-label="Medio de pago">
              {MEDIOS.map(([v, t]) => <button key={v} type="button" className={medio === v ? 'cmp-chip elegido' : 'cmp-chip'} aria-pressed={medio === v} onClick={() => setMedio(v)}>{t}</button>)}
            </div>
          ) : (
            <label className="campo"><span className="nv-rotulo">Paga hasta</span>
              <input type="date" value={vence} min={hoyLima()} onChange={e => setVence(e.target.value)} /></label>
          )}
        </>
      )}
      {fallo && <Aviso>{fallo}</Aviso>}
    </Dialogo>
  )
}

/** Un pago (parcial o total) de una nota fiada. */
function DialogoPagoNota({ n, onCerrar, onHecho }: { n: NotaVenta; onCerrar: () => void; onHecho: (m: string) => void }) {
  const [monto, setMonto] = useState(n.saldo.toFixed(2))
  const [fechaP, setFechaP] = useState(hoyLima())
  const [medio, setMedio] = useState<MedioPago>('efectivo')
  const [referencia, setReferencia] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string>()
  const m = Number(monto.replace(',', '.'))
  const queda = Math.round((n.saldo - (m || 0)) * 100) / 100
  async function guardar() {
    setOcupado(true); setFallo(undefined)
    try { onHecho((await notasVentaServicio.pagar(n.id, { monto: m, fecha: fechaP, medio, referencia: referencia.trim() || null })).mensaje) }
    catch (e) { setFallo(error(e, 'No se pudo anotar el pago.')) }
    finally { setOcupado(false) }
  }
  return (
    <Dialogo titulo={`Registrar pago · ${n.clienteNombre}`} abierto onCerrar={onCerrar}
      acciones={<>
        <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={() => void guardar()} ocupado={ocupado} textoOcupado="Guardando…" disabled={!(m > 0 && m <= n.saldo + 0.005 && fechaP)}>Guardar pago</Boton>
      </>}>
      <div className="ddu-resumen"><span>Total <strong>S/ {dinero(n.total)}</strong></span><span>Debe <strong>S/ {dinero(n.saldo)}</strong></span></div>
      <div className="pareja">
        <label className="campo"><span className="nv-rotulo">Monto que paga</span>
          <input className="mono ddu-monto" inputMode="decimal" value={monto} autoFocus onChange={e => setMonto(e.target.value)} onFocus={e => e.target.select()} /></label>
        <label className="campo"><span className="nv-rotulo">Fecha</span>
          <input type="date" value={fechaP} max={hoyLima()} onChange={e => setFechaP(e.target.value)} /></label>
      </div>
      <div className="campo"><span className="nv-rotulo">Cómo pagó</span>
        <div className="cmp-chips ddu-medios" role="group" aria-label="Medio de pago">
          {MEDIOS.map(([v, t]) => <button key={v} type="button" className={medio === v ? 'cmp-chip elegido' : 'cmp-chip'} aria-pressed={medio === v} onClick={() => setMedio(v)}>{t}</button>)}
        </div>
      </div>
      <label className="campo"><span className="nv-rotulo">Referencia (opcional)</span>
        <input value={referencia} maxLength={80} placeholder="N.º de operación, quién pagó…" onChange={e => setReferencia(e.target.value)} /></label>
      {m > n.saldo + 0.005
        ? <Aviso>Es más de lo que debe (S/ {dinero(n.saldo)}).</Aviso>
        : m > 0 && <div className="ddu-resumen ddu-queda"><span>{queda <= 0.005 ? 'Con este pago queda' : 'Después de este pago le queda'}</span><strong>{queda <= 0.005 ? 'pagada del todo' : `S/ ${dinero(queda)}`}</strong></div>}
      {fallo && <Aviso>{fallo}</Aviso>}
    </Dialogo>
  )
}

function DialogoAnularPago({ pago, onCerrar, onHecho }: { pago: PagoNota; onCerrar: () => void; onHecho: (m: string) => void }) {
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string>()
  async function anular() {
    setOcupado(true); setFallo(undefined)
    try { onHecho((await notasVentaServicio.anularPago(pago.id, motivo.trim())).mensaje) }
    catch (e) { setFallo(error(e, 'No se pudo anular el pago.')) }
    finally { setOcupado(false) }
  }
  return (
    <Dialogo titulo="¿Anular este pago?" abierto onCerrar={onCerrar}
      acciones={<>
        <Boton estilo="secundario" onClick={onCerrar}>No, volver</Boton>
        <Boton estilo="peligro" onClick={() => void anular()} ocupado={ocupado} disabled={motivo.trim().length < 3}>Sí, anular pago</Boton>
      </>}>
      <p>El pago de <strong>S/ {dinero(pago.monto)}</strong> del {fecha(pago.fecha)} no se borra: queda anulado y lo que debe vuelve a subir.</p>
      <label className="campo"><span className="nv-rotulo">Motivo</span>
        <input value={motivo} maxLength={200} autoFocus placeholder="Ej.: se anotó dos veces" onChange={e => setMotivo(e.target.value)} /></label>
      {fallo && <Aviso>{fallo}</Aviso>}
    </Dialogo>
  )
}
