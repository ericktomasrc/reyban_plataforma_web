import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Aviso } from '../../componentes/Aviso'
import { Boton } from '../../componentes/Boton'
import { Cargando, Vacio } from '../../componentes/Cargando'
import { Dialogo } from '../../componentes/Dialogo'
import { Paginacion } from '../../componentes/Paginacion'
import { ErrorApi } from '../../nucleo/api/errores'
import { Permisos } from '../../nucleo/autorizacion/permisos'
import { fecha } from '../../nucleo/formato/fechas'
import { useMensaje } from '../../nucleo/mensajes/ProveedorMensajes'
import { useSesion } from '../../nucleo/sesion/SesionContexto'
import '../facturacion/comprobantes-lista.css'
import './deudas.css'
import {
  MEDIOS, NOMBRE_MEDIO, deudasServicio,
  type DetalleDeuda, type Deuda, type FiltroDeuda, type Lado, type MedioPago, type PaginaDeudas, type PagoDeuda,
} from './deudasServicio'

/**
 * e267 (090) — COBROS Y PAGOS. «Por cobrar»: lo que te deben (facturas y
 * boletas al crédito). «Por pagar»: lo que debes (compras y gastos al crédito).
 * Cada deuda acepta pagos parciales; un pago no se borra: se anula con motivo.
 */

const dinero = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const simbolo = (m: string) => (m === 'USD' ? 'US$' : 'S/')
const hoyLima = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`

function textoEstado(d: Deuda) {
  if (d.estado === 'pagada') return 'Pagada'
  if (d.estado === 'vencida') return d.dias === 0 ? 'Vence hoy' : `Vencida hace ${dias(-d.dias)}`
  if (d.dias === 0) return 'Vence hoy'
  return d.estado === 'porvencer' ? `Vence en ${dias(d.dias)}` : 'Al día'
}
const claseEstado: Record<string, string> = { vencida: 'mal', porvencer: 'ojo', aldia: 'gris', pagada: 'bien' }

export function Deudas({ lado }: { lado: Lado }) {
  const { puede } = useSesion()
  const mensaje = useMensaje()
  const registra = puede(Permisos.Deudas.Registrar)
  const cobrar = lado === 'cobrar'
  const [estado, setEstado] = useState<FiltroDeuda>('pendientes')
  const [q, setQ] = useState('')
  const [buscar, setBuscar] = useState('')
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(20)
  const [datos, setDatos] = useState<PaginaDeudas>()
  const [fallo, setFallo] = useState<string>()
  const [vuelta, setVuelta] = useState(0)
  const [viendo, setViendo] = useState<Deuda>()
  const [pagando, setPagando] = useState<Deuda>()
  const [bajando, setBajando] = useState(false)

  useEffect(() => { const t = window.setTimeout(() => { setBuscar(q.trim()); setPagina(1) }, 400); return () => window.clearTimeout(t) }, [q])

  useEffect(() => {
    let vivo = true
    deudasServicio.listar({ lado, estado, q: buscar || undefined, pagina, porPagina })
      .then(d => { if (vivo) { setDatos(d); setFallo(undefined) } })
      .catch(e => { if (vivo) setFallo(e instanceof ErrorApi ? e.message : 'No se pudo leer la lista.') })
    return () => { vivo = false }
  }, [lado, estado, buscar, pagina, porPagina, vuelta])

  const recargar = () => setVuelta(v => v + 1)
  const elegir = (e: FiltroDeuda) => { setEstado(e); setPagina(1) }
  const c = datos?.cifras

  async function excel() {
    setBajando(true)
    try { await deudasServicio.excel({ lado, estado, q: buscar || undefined }) }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo bajar el Excel.') }
    finally { setBajando(false) }
  }

  return (
    <div className="ddu-pagina">
      <div className="encabezado-pagina cmp-encab">
        <div>
          <h1 className="titulo-pagina">
            {cobrar ? 'Por cobrar' : 'Por pagar'}
            {c && c.pendientes > 0 && (
              <span className="lst-cuenta">
                {c.pendientes} {c.pendientes === 1 ? 'deuda' : 'deudas'} · {c.personas} {cobrar ? (c.personas === 1 ? 'cliente' : 'clientes') : (c.personas === 1 ? 'proveedor' : 'proveedores')}
              </span>
            )}
          </h1>
          <p className="bajada-pagina">
            {cobrar
              ? <>Lo que te deben tus clientes: las facturas y boletas emitidas <strong>al crédito</strong>. Las ventas al contado no aparecen aquí.</>
              : <>Lo que debes: las compras y gastos anotados <strong>al crédito</strong> en <Link to="/compras">Compras y gastos</Link>.</>}
          </p>
        </div>
        {datos && datos.total > 0 && <Boton estilo="secundario" onClick={() => void excel()} ocupado={bajando} textoOcupado="Bajando…">Descargar Excel</Boton>}
      </div>

      {/* Las cifras: cada una filtra la lista. */}
      {c && (
        <div className="cmp-mes" role="group" aria-label="Mostrar">
          <button type="button" className={`cmp-mes-dato${estado === 'pendientes' ? ' elegido' : ''}`} onClick={() => elegir('pendientes')}>
            <span>{cobrar ? 'Total por cobrar' : 'Total por pagar'}</span><strong>S/ {dinero(c.pendiente)}</strong>
            <small>{c.pendientes} {c.pendientes === 1 ? 'deuda' : 'deudas'}{c.pendienteUsd > 0 ? ` · y US$ ${dinero(c.pendienteUsd)}` : ''}</small>
          </button>
          <button type="button" className={`cmp-mes-dato mal${estado === 'vencidas' ? ' elegido' : ''}`} onClick={() => elegir('vencidas')}>
            <span>Vencido</span><strong>S/ {dinero(c.vencido)}</strong><small>{c.vencidas === 0 ? 'nada vencido' : `${c.vencidas} ${c.vencidas === 1 ? 'deuda' : 'deudas'}`}</small>
          </button>
          <button type="button" className={`cmp-mes-dato ojo${estado === 'porvencer' ? ' elegido' : ''}`} onClick={() => elegir('porvencer')}>
            <span>Vence esta semana</span><strong>S/ {dinero(c.semana)}</strong><small>{c.porVencer === 0 ? 'nada esta semana' : `${c.porVencer} ${c.porVencer === 1 ? 'deuda' : 'deudas'}`}</small>
          </button>
          <button type="button" className={`cmp-mes-dato bien${estado === 'pagadas' ? ' elegido' : ''}`} onClick={() => elegir('pagadas')}>
            <span>{cobrar ? 'Cobrado este mes' : 'Pagado este mes'}</span><strong>S/ {dinero(c.mes)}</strong>
            <small>{c.pagosMes} {c.pagosMes === 1 ? 'pago' : 'pagos'}</small>
          </button>
        </div>
      )}

      <div className="lst-caja">
        <div className="cmp-chips" role="group" aria-label="Qué ver">
          {([['pendientes', 'Pendientes'], ['vencidas', 'Vencidas'], ['porvencer', 'Por vencer'], ['pagadas', 'Pagadas'], ['todas', 'Todas']] as const).map(([v, t]) => (
            <button key={v} type="button" className={estado === v ? 'cmp-chip elegido' : 'cmp-chip'} aria-pressed={estado === v} onClick={() => elegir(v)}>{t}</button>
          ))}
        </div>
        <div className="lst-filtros">
          <label className="lst-buscar"><span className="solo-lector">Buscar</span>
            <input type="search" value={q} placeholder={cobrar ? 'Buscar cliente, RUC/DNI o comprobante' : 'Buscar proveedor, RUC o documento'} onChange={e => setQ(e.target.value)} /></label>
        </div>

        {fallo && <div className="relleno"><Aviso>{fallo}</Aviso></div>}
        {!datos && !fallo && <div className="relleno"><Cargando /></div>}
        {datos && (datos.filas.length === 0 ? (
          <div className="relleno">
            <Vacio>
              {buscar ? `Nada con «${buscar}».`
                : estado === 'pagadas' ? 'Todavía no hay deudas pagadas del todo.'
                : estado === 'vencidas' ? 'Nada vencido.'
                : estado === 'porvencer' ? 'Nada vence esta semana.'
                : cobrar ? 'Nadie te debe. Cuando emitas una factura o boleta al crédito, aparece aquí.'
                : 'No debes nada. Cuando anotes una compra o gasto al crédito, aparece aquí.'}
            </Vacio>
          </div>
        ) : (
          <div className="bloque sin-relleno lst-tabla">
            <div className="tabla-envoltura">
              <table className="tabla lst tabla-clic">
                <thead><tr>
                  <th>{cobrar ? 'Cliente' : 'Proveedor'}</th><th>{cobrar ? 'Comprobante' : 'Documento'}</th><th>Emitido</th><th>Vence</th>
                  <th className="derecha">Total</th><th className="derecha">Pagado</th><th className="derecha">Saldo</th><th>Estado</th><th />
                </tr></thead>
                <tbody>
                  {datos.filas.map(d => (
                    <tr key={d.id} onClick={() => setViendo(d)}>
                      <td className="lst-nombre"><div className="principal" title={d.nombre}>{d.nombre}</div>
                        {d.numeroDoc && <div className="secundario">{d.tipoDoc === '6' ? 'RUC' : d.tipoDoc === '1' ? 'DNI' : 'Doc.'} {d.numeroDoc}</div>}</td>
                      <td><span className="mono">{d.comprobante}</span>
                        {d.cuotas && d.cuotas > 1 && d.cuota && <div className="secundario">cuota {d.cuota} de {d.cuotas}</div>}</td>
                      <td className="secundario sin-corte">{fecha(d.emitido)}</td>
                      <td className="sin-corte">{fecha(d.vence)}</td>
                      <td className="derecha mono">{simbolo(d.moneda)} {dinero(d.total - d.nc)}</td>
                      <td className="derecha mono">
                        {dinero(d.pagado)}
                        {d.pagado > 0 && d.saldo > 0 && <div className="ddu-barra" aria-hidden="true"><i style={{ width: `${Math.min(100, (d.pagado / Math.max(d.total - d.nc, 0.01)) * 100)}%` }} /></div>}
                      </td>
                      <td className="derecha lst-precio">{dinero(d.saldo)}</td>
                      <td><span className={`ddu-estado ${claseEstado[d.estado]}`}>{textoEstado(d)}</span></td>
                      <td className="derecha" onClick={e => e.stopPropagation()}>
                        {registra && d.estado !== 'pagada' && (
                          <Boton estilo={d.estado === 'vencida' ? 'principal' : 'secundario'} onClick={() => setPagando(d)}>{lado === 'cobrar' ? 'Cobrar' : 'Pagar'}</Boton>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      {datos && datos.filas.length > 0 && (
        <Paginacion total={datos.total} pagina={datos.pagina} porPagina={datos.porPagina} onCambiar={setPagina}
                    onPorPagina={n => { setPorPagina(n); setPagina(1) }} />
      )}
      <p className="nota ddu-nota">
        {cobrar
          ? 'Al tocar una deuda ves sus cuotas y sus pagos. Las notas de crédito de la factura bajan lo que se debe solas.'
          : 'Al tocar una deuda ves sus pagos. Para anotar una compra al crédito: Compras y gastos › + Compra › Pago: Al crédito.'}
      </p>

      {viendo && (
        <DialogoDeuda deuda={viendo} registra={registra} onCerrar={() => setViendo(undefined)}
                      onPagar={d => { setViendo(undefined); setPagando(d) }}
                      onCambio={recargar} />
      )}
      {pagando && (
        <DialogoPago deuda={pagando} onCerrar={() => setPagando(undefined)}
                     onHecho={m => { setPagando(undefined); mensaje.bien(m); recargar() }} />
      )}
    </div>
  )
}

/** Anotar un pago (parcial o total). */
function DialogoPago({ deuda, onCerrar, onHecho }: { deuda: Deuda; onCerrar: () => void; onHecho: (m: string) => void }) {
  const [monto, setMonto] = useState(String(deuda.saldo))
  const [fechaP, setFechaP] = useState(hoyLima())
  const [medio, setMedio] = useState<MedioPago>('efectivo')
  const [referencia, setReferencia] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string>()
  const [pagos, setPagos] = useState<PagoDeuda[]>()
  const m = Number(monto.replace(',', '.'))
  const queda = Math.round((deuda.saldo - (m || 0)) * 100) / 100
  const s = simbolo(deuda.moneda)

  useEffect(() => {
    let vivo = true
    deudasServicio.ver(deuda.origen, deuda.id).then(d => { if (vivo) setPagos(d.pagos.filter(p => !p.anuladoEn)) }).catch(() => { /* solo informativo */ })
    return () => { vivo = false }
  }, [deuda])

  async function guardar() {
    setOcupado(true); setFallo(undefined)
    try {
      const r = await deudasServicio.pagar({ origen: deuda.origen, id: deuda.id, monto: m, fecha: fechaP, medio, referencia: referencia.trim() || null })
      onHecho(r.mensaje)
    } catch (e) {
      setFallo(e instanceof ErrorApi ? e.message : 'No se pudo anotar el pago.')
    } finally { setOcupado(false) }
  }

  const listo = m > 0 && m <= deuda.saldo + 0.005 && !!fechaP
  return (
    <Dialogo titulo={`Registrar pago · ${deuda.nombre}`} abierto onCerrar={onCerrar}
      acciones={<>
        <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={() => void guardar()} ocupado={ocupado} textoOcupado="Guardando…" disabled={!listo}>Guardar pago</Boton>
      </>}>
      <p className="ddu-sub">
        <span className="mono">{deuda.comprobante}</span> · total {s} {dinero(deuda.total - deuda.nc)} · {textoEstado(deuda).toLowerCase()}
      </p>
      <div className="ddu-resumen"><span>Pagado <strong>{s} {dinero(deuda.pagado)}</strong></span><span>Saldo <strong>{s} {dinero(deuda.saldo)}</strong></span></div>
      <div className="pareja">
        <label className="campo"><span className="etiqueta">{deuda.origen === 'documento' ? 'Monto que paga' : 'Monto que pagas'}</span>
          <input className="mono ddu-monto" inputMode="decimal" value={monto} autoFocus onChange={e => setMonto(e.target.value)} onFocus={e => e.target.select()} /></label>
        <label className="campo"><span className="etiqueta">Fecha</span>
          <input type="date" value={fechaP} max={hoyLima()} onChange={e => setFechaP(e.target.value)} /></label>
      </div>
      <div className="campo"><span className="etiqueta">Cómo {deuda.origen === 'documento' ? 'pagó' : 'pagaste'}</span>
        <div className="cmp-chips ddu-medios" role="group" aria-label="Medio de pago">
          {MEDIOS.map(([v, t]) => (
            <button key={v} type="button" className={medio === v ? 'cmp-chip elegido' : 'cmp-chip'} aria-pressed={medio === v} onClick={() => setMedio(v)}>{t}</button>
          ))}
        </div>
      </div>
      <label className="campo"><span className="etiqueta">Referencia o nota (opcional)</span>
        <input value={referencia} maxLength={80} placeholder="N.º de operación, quién pagó…" onChange={e => setReferencia(e.target.value)} /></label>
      {m > deuda.saldo + 0.005
        ? <Aviso>Es más de lo que falta ({s} {dinero(deuda.saldo)}).</Aviso>
        : m > 0 && <div className="ddu-resumen ddu-queda"><span>{queda <= 0.005 ? 'Con este pago queda' : 'Después de este pago le queda'}</span><strong>{queda <= 0.005 ? 'pagada del todo' : `${s} ${dinero(queda)}`}</strong></div>}
      {pagos && pagos.length > 0 && (
        <div className="ddu-historial">
          <div className="ddu-historial-t">Pagos anteriores</div>
          {pagos.map(p => (
            <div key={p.id}><span>{fecha(p.fecha)} · {NOMBRE_MEDIO[p.medio] ?? p.medio}{p.referencia ? ` · ${p.referencia}` : ''}</span><strong>{s} {dinero(p.monto)}</strong></div>
          ))}
        </div>
      )}
      {fallo && <Aviso>{fallo}</Aviso>}
    </Dialogo>
  )
}

/** Una deuda: sus cuotas y sus pagos (con «Anular» en cada pago). */
function DialogoDeuda({ deuda, registra, onCerrar, onPagar, onCambio }: {
  deuda: Deuda; registra: boolean; onCerrar: () => void; onPagar: (d: Deuda) => void; onCambio: () => void
}) {
  const mensaje = useMensaje()
  const [d, setD] = useState<DetalleDeuda>()
  const [fallo, setFallo] = useState<string>()
  const [vuelta, setVuelta] = useState(0)
  const [anulando, setAnulando] = useState<PagoDeuda>()
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const s = simbolo(deuda.moneda)

  useEffect(() => {
    let vivo = true
    deudasServicio.ver(deuda.origen, deuda.id)
      .then(x => { if (vivo) { setD(x); setFallo(undefined) } })
      .catch(e => { if (vivo) setFallo(e instanceof ErrorApi ? e.message : 'No se pudo leer la deuda.') })
    return () => { vivo = false }
  }, [deuda, vuelta])

  async function anular() {
    if (!anulando) return
    setOcupado(true)
    try {
      mensaje.bien((await deudasServicio.anularPago(anulando.id, motivo.trim())).mensaje)
      setAnulando(undefined); setMotivo(''); setVuelta(v => v + 1); onCambio()
    } catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo anular el pago.') }
    finally { setOcupado(false) }
  }

  const x = d ?? deuda
  return (
    <Dialogo titulo={x.nombre} abierto onCerrar={onCerrar} ancho="grande"
      acciones={<>
        <Boton estilo="secundario" onClick={onCerrar}>Cerrar</Boton>
        {registra && x.estado !== 'pagada' && <Boton onClick={() => onPagar(x)}>Registrar pago</Boton>}
      </>}>
      <p className="ddu-sub">
        {x.origen === 'documento'
          ? <><Link to={`/facturacion/comprobantes/${x.id}`} className="mono">{x.comprobante}</Link> · emitido el {fecha(x.emitido)}</>
          : <><span className="mono">{x.comprobante}</span> · {x.clase === 'gasto' ? 'gasto' : 'compra'} del {fecha(x.emitido)} · <Link to="/compras">ver en Compras y gastos</Link></>}
      </p>
      <div className="cmp-mes estatico ddu-cifras">
        <div className="cmp-mes-dato"><span>Total</span><strong>{s} {dinero(x.total)}</strong><small>{x.nc > 0 ? `− ${s} ${dinero(x.nc)} en notas de crédito` : x.origen === 'documento' ? 'suma de las cuotas' : 'de la compra'}</small></div>
        <div className="cmp-mes-dato bien"><span>Pagado</span><strong>{s} {dinero(x.pagado)}</strong><small>{d ? `${d.pagos.filter(p => !p.anuladoEn).length} pagos` : ' '}</small></div>
        <div className={`cmp-mes-dato ${x.estado === 'vencida' ? 'mal' : x.estado === 'porvencer' ? 'ojo' : ''}`}><span>Saldo</span><strong>{s} {dinero(x.saldo)}</strong><small>{textoEstado(x)}</small></div>
      </div>
      {fallo && <Aviso>{fallo}</Aviso>}
      {!d && !fallo && <Cargando />}
      {d && d.detalleCuotas.length > 0 && (
        <section className="ddu-bloque">
          <div className="ddu-bloque-t">Cuotas</div>
          <table className="tabla lst ddu-mini">
            <thead><tr><th>Cuota</th><th>Vence</th><th className="derecha">Monto</th></tr></thead>
            <tbody>{d.detalleCuotas.map(q => (
              <tr key={q.numero} className={x.cuota === q.numero && x.estado !== 'pagada' ? 'ddu-toca' : undefined}>
                <td>{q.numero} de {d.detalleCuotas.length}{x.cuota === q.numero && x.estado !== 'pagada' ? <span className="etiqueta acento">la que toca</span> : null}</td>
                <td>{fecha(q.vence)}</td><td className="derecha mono">{dinero(q.monto)}</td></tr>
            ))}</tbody>
          </table>
        </section>
      )}
      {d && (
        <section className="ddu-bloque">
          <div className="ddu-bloque-t">Pagos</div>
          {d.pagos.length === 0 ? <p className="secundario">Todavía no hay pagos.</p> : (
            <table className="tabla lst ddu-mini">
              <thead><tr><th>Fecha</th><th>Cómo</th><th>Referencia</th><th className="derecha">Monto</th><th /></tr></thead>
              <tbody>{d.pagos.map(p => (
                <tr key={p.id} className={p.anuladoEn ? 'apagada' : undefined}>
                  <td className="sin-corte">{fecha(p.fecha)}</td>
                  <td>{NOMBRE_MEDIO[p.medio] ?? p.medio}<div className="secundario">{p.registro}</div></td>
                  <td className="secundario">{p.referencia ?? '—'}</td>
                  <td className="derecha mono">{p.anuladoEn ? <s>{dinero(p.monto)}</s> : dinero(p.monto)}</td>
                  <td className="derecha">
                    {p.anuladoEn ? <span className="secundario" title={p.anuladoMotivo ?? ''}>Anulado · {p.anuladoMotivo}</span>
                      : registra && <button type="button" className="enlace" onClick={() => { setAnulando(p); setMotivo('') }}>Anular</button>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
          {anulando && (
            <div className="ddu-anular">
              <span>Anular el pago de <strong>{s} {dinero(anulando.monto)}</strong> del {fecha(anulando.fecha)}. No se borra.</span>
              <input value={motivo} maxLength={200} autoFocus placeholder="Motivo (ej.: se anotó dos veces)" onChange={e => setMotivo(e.target.value)} />
              <Boton estilo="secundario" onClick={() => setAnulando(undefined)}>Cancelar</Boton>
              <Boton onClick={() => void anular()} ocupado={ocupado} disabled={motivo.trim().length < 3}>Anular pago</Boton>
            </div>
          )}
        </section>
      )}
    </Dialogo>
  )
}