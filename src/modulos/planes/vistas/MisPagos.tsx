import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha, fechaYHora } from '../../../nucleo/formato/fechas'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { abrirCheckout, autenticar3ds } from '../../../nucleo/pagos/culqi'
import { soles } from '../../../nucleo/planes/planes'
import {
  NOMBRE_ESTADO_COBRO, NOMBRE_ESTADO_PAGO, NOMBRE_MEDIO, TARJETAS_SIMULADAS, cobrosServicio,
  type Autenticacion3ds, type DatosPago, type MisPagos, type Periodo,
} from '../servicios/cobrosServicio'

/**
 * 073 — MIS PAGOS.
 *
 *   1. Datos de tu comprobante   RUC (10 o 20) → factura · DNI → boleta.
 *   2. Tu tarjeta                la guarda Culqi; aquí solo la marca y los 4 últimos.
 *   3. Pagar                     el mes o el año. El monto lo pone la plataforma.
 *   Historial                    todos los pagos, con su estado.
 *
 * Paga el dueño de la cuenta o un colaborador administrador; los demás miran.
 */
export function MisPagosPagina() {
  const mensaje = useMensaje()
  const [d, setD] = useState<MisPagos>()
  const [error, setError] = useState<string>()

  const cargar = useCallback(async () => {
    try { setD(await cobrosServicio.mio()); setError(undefined) }
    catch (e) { setError(e instanceof ErrorApi ? e.message : 'No se pudieron cargar tus pagos.') }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  if (error) return <Aviso>{error}</Aviso>
  if (!d) return <Cargando />

  const hecho = async (m: string) => { if (m) mensaje.bien(m); await cargar() }

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">Mis pagos</h1>
          <p className="secundario">Tu tarjeta, los datos de tu comprobante y todo lo que has pagado. <Link to="/mi-plan">← Volver a Mi plan</Link></p>
        </div>
      </div>

      <BandaModo d={d} />
      {!d.puedePagar && <Aviso tono="info">Solo el dueño de la cuenta (o un colaborador administrador) paga y cambia estos datos. Tú puedes ver el historial.</Aviso>}

      <div className="pagos-cuerpo">
        <div className="pagos-pasos">
          <DatosComprobante d={d} onHecho={hecho} />
          {d.medios.tarjeta && <Tarjetas d={d} onHecho={hecho} />}
          {d.medios.transferencia && d.transferencia && (
            <section className="bloque paso-pago">
              <h2><span className="numero-paso otro">⇄</span> ¿Prefieres pagar por transferencia?</h2>
              <p className="secundario">Transfiere el monto de tu plan a esta cuenta y envíanos la constancia{d.correoPagos ? <> a <strong>{d.correoPagos}</strong></> : ''}. Lo registramos y te llega tu comprobante.</p>
              <pre className="datos-banco">{d.transferencia}</pre>
            </section>
          )}
        </div>
        <aside className="pagos-resumen">
          <EstadoDePago d={d} />
          {d.medios.tarjeta && <Pagar d={d} onHecho={hecho} />}
        </aside>
      </div>

      <Historial d={d} />
    </>
  )
}

// =============================================================================
function BandaModo({ d }: { d: MisPagos }) {
  if (d.modo === 'simulado')
    return <div className="banda-modo simulado">🧪 <strong>Modo SIMULADO:</strong> los pagos son de prueba y no se mueve dinero. Usa las tarjetas de prueba de la lista.</div>
  if (d.modo === 'prueba')
    return <div className="banda-modo prueba">🟡 <strong>Culqi en modo PRUEBA:</strong> usa las tarjetas de prueba de Culqi. No se mueve dinero real.</div>
  if (d.modo === 'apagado')
    return <div className="banda-modo apagado">Los pagos con tarjeta todavía no están disponibles.{d.medios.transferencia ? ' Puedes pagar por transferencia (más abajo).' : ''}</div>
  return null
}

function EstadoDePago({ d }: { d: MisPagos }) {
  const e = d.estado
  const enGratis = e.pruebaHasta && new Date(e.pruebaHasta) > new Date()
  const tono = e.pago === 'al_dia' ? 'ok' : e.pago === 'no_emite' ? 'mal' : 'ojo'
  return (
    <div className={`estado-pago ${tono}`}>
      <div><span className="rotulo">Estado</span><strong>{NOMBRE_ESTADO_PAGO[e.pago]}</strong></div>
      {enGratis && <div><span className="rotulo">Mes gratis</span><strong>hasta el {fecha(e.pruebaHasta)}</strong></div>}
      <div><span className="rotulo">Pagado hasta</span><strong>{e.proximo ? fecha(diaAntes(e.proximo)) : '—'}</strong></div>
      {e.pago !== 'al_dia' && (
        <p className="nota">
          {e.pago === 'reintento' && `Tu tarjeta no pasó. Lo intentaremos de nuevo los días ${e.reintentos.join(' y ')}. Si quieres, paga ahora con otra tarjeta.`}
          {e.pago === 'gracia' && `Tienes ${e.graciaDias} días para ponerte al día. Después no podrás emitir hasta pagar (no se borra nada).`}
          {e.pago === 'no_emite' && 'Puedes entrar y ver todo, pero no emitir hasta que pagues. Apenas pagas, se desbloquea solo.'}
        </p>
      )}
    </div>
  )
}

const diaAntes = (iso: string) => {
  const x = new Date(iso + 'T12:00:00')
  x.setDate(x.getDate() - 1)
  return x.toISOString().slice(0, 10)
}

// =============================================================================
// 1. DATOS DEL COMPROBANTE
// =============================================================================
function rucValido(r: string) {
  if (!/^(10|15|17|20)\d{9}$/.test(r)) return false
  const w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const s = w.reduce((t, p, i) => t + p * Number(r[i]), 0)
  let dv = 11 - (s % 11)
  if (dv === 10) dv = 0
  else if (dv === 11) dv = 1
  return dv === Number(r[10])
}

function DatosComprobante({ d, onHecho }: { d: MisPagos; onHecho: (m: string) => Promise<void> }) {
  const mensaje = useMensaje()
  const inicial: DatosPago = d.datos ?? {
    tipoDoc: d.sugerido?.tipoDoc === 'ruc' ? 'ruc' : 'dni',
    numero: d.sugerido?.numero ?? '', nombre: d.sugerido?.nombre ?? '', direccion: '',
    correo: d.sugerido?.correo ?? '', telefono: d.sugerido?.telefono ?? '',
  }
  const [editando, setEditando] = useState(!d.datos)
  const [f, setF] = useState<DatosPago>(inicial)
  const [ocupado, setOcupado] = useState(false)
  const cambia = <K extends keyof DatosPago>(k: K, v: DatosPago[K]) => setF(x => ({ ...x, [k]: v }))

  const num = f.numero.replace(/\s/g, '')
  const malNumero = num.length > 0 && (f.tipoDoc === 'ruc' ? (num.length === 11 && !rucValido(num)) || num.length > 11 : num.length > 8)

  async function guardar() {
    setOcupado(true)
    try { await onHecho((await cobrosServicio.datos({ ...f, numero: num })).mensaje); setEditando(false) }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudieron guardar tus datos.') }
    finally { setOcupado(false) }
  }

  return (
    <section className="bloque paso-pago">
      <h2><span className={`numero-paso${d.datos ? ' hecho' : ''}`}>{d.datos ? '✓' : '1'}</span> Datos de tu comprobante</h2>
      {!editando && d.datos ? (
        <div className="resumen-datos">
          <p>
            <span className="etiqueta acento">{d.datos.tipoDoc === 'ruc' ? 'FACTURA' : 'BOLETA'}</span>{' '}
            <strong>{d.datos.nombre}</strong> · {d.datos.tipoDoc === 'ruc' ? 'RUC' : 'DNI'} {d.datos.numero}
          </p>
          <p className="secundario">{d.datos.direccion && <>{d.datos.direccion} · </>}Llega a <strong>{d.datos.correo}</strong>{d.datos.telefono && <> · Cel. {d.datos.telefono}</>}</p>
          {d.puedePagar && <Boton estilo="plano" onClick={() => setEditando(true)}>Cambiar</Boton>}
        </div>
      ) : (
        <>
          <p className="secundario">Con <strong>RUC</strong> (10 o 20) te llega <strong>factura</strong>; con <strong>DNI</strong>, <strong>boleta</strong>. Te la enviamos al correo con cada pago.</p>
          <div className="elige-doc" role="radiogroup" aria-label="Tipo de comprobante">
            {(['ruc', 'dni'] as const).map(t => (
              <label key={t} className={f.tipoDoc === t ? 'activo' : undefined}>
                <input type="radio" name="tipoDoc" checked={f.tipoDoc === t} disabled={!d.puedePagar} onChange={() => cambia('tipoDoc', t)} />
                <strong>{t === 'ruc' ? 'Factura' : 'Boleta'}</strong><span>{t === 'ruc' ? 'con RUC 10 o 20' : 'con DNI'}</span>
              </label>
            ))}
          </div>
          <div className="rejilla-datos">
            <label className="campo">
              <span>{f.tipoDoc === 'ruc' ? 'RUC' : 'DNI'} *</span>
              <input inputMode="numeric" maxLength={f.tipoDoc === 'ruc' ? 11 : 8} value={f.numero} disabled={!d.puedePagar}
                     onChange={e => cambia('numero', e.target.value.replace(/\D/g, ''))} aria-invalid={malNumero} />
              {malNumero && <small className="mal">{f.tipoDoc === 'ruc' ? 'Ese RUC no es válido: revisa los 11 números.' : 'El DNI tiene 8 números.'}</small>}
            </label>
            <label className="campo">
              <span>{f.tipoDoc === 'ruc' ? 'Razón social' : 'Nombre completo'} *</span>
              <input value={f.nombre} maxLength={200} disabled={!d.puedePagar} onChange={e => cambia('nombre', e.target.value)} />
            </label>
            <label className="campo ancho">
              <span>Dirección{f.tipoDoc === 'ruc' ? ' fiscal *' : ' (opcional)'}</span>
              <input value={f.direccion ?? ''} maxLength={300} disabled={!d.puedePagar} onChange={e => cambia('direccion', e.target.value)} />
            </label>
            <label className="campo">
              <span>Correo para el comprobante *</span>
              <input type="email" value={f.correo} maxLength={200} disabled={!d.puedePagar} onChange={e => cambia('correo', e.target.value)} />
            </label>
            <label className="campo">
              <span>Celular{d.modo === 'prueba' || d.modo === 'real' ? ' *' : ''}</span>
              <input inputMode="tel" value={f.telefono ?? ''} maxLength={20} disabled={!d.puedePagar}
                     onChange={e => cambia('telefono', e.target.value.replace(/[^\d+ ]/g, ''))} />
              {(d.modo === 'prueba' || d.modo === 'real') && <small>Culqi lo pide para guardar tu tarjeta.</small>}
            </label>
          </div>
          {d.puedePagar && (
            <div className="acciones-bloque">
              {d.datos && <Boton estilo="plano" onClick={() => { setF(inicial); setEditando(false) }}>Cancelar</Boton>}
              <Boton ocupado={ocupado} disabled={malNumero} onClick={() => void guardar()}>Guardar mis datos</Boton>
            </div>
          )}
        </>
      )}
    </section>
  )
}

// =============================================================================
// 2. TARJETAS
// =============================================================================
function Tarjetas({ d, onHecho }: { d: MisPagos; onHecho: (m: string) => Promise<void> }) {
  const mensaje = useMensaje()
  const { pedir, dialogo } = useConfirmar()
  const [simulada, setSimulada] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const montoCentimos = Math.round((d.mensual?.monto ?? 0) * 100)

  async function enviar(token: string, auth?: Autenticacion3ds): Promise<void> {
    setOcupado('agregar')
    try {
      const r = await cobrosServicio.tarjeta(token, auth)
      if (r.requiere3ds && !auth) {
        let datos: Autenticacion3ds | null
        if (d.modo === 'simulado') {
          const ok = await pedir({
            titulo: 'Tu banco pide confirmar que eres tú',
            mensaje: <>Es la verificación <strong>3DS</strong> (en real, tu banco te manda un código o te pide abrir su app). Aquí es simulada: pulsa «Confirmar».</>,
            confirmar: 'Confirmar',
          })
          datos = ok ? { cavv: 'sim_cavv_ok' } : null
        } else {
          datos = await autenticar3ds(d.culqi!.llavePublica, token, d.datos?.correo ?? '', montoCentimos)
        }
        if (!datos) { mensaje.error('No se confirmó con tu banco. La tarjeta no se guardó.'); return }
        await enviar(token, datos)
        return
      }
      if (r.requiere3ds) { mensaje.error('Tu banco no confirmó la tarjeta. Prueba con otra.'); return }
      await onHecho(r.mensaje)
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : e instanceof Error ? e.message : 'No se pudo guardar la tarjeta.')
    } finally { setOcupado(null) }
  }

  async function agregar() {
    if (!d.datos) { mensaje.error('Primero completa los datos de tu comprobante (paso 1).'); return }
    if (d.modo === 'simulado') { setSimulada(true); return }
    if (!d.culqi) return
    try {
      await abrirCheckout({
        llavePublica: d.culqi.llavePublica, correo: d.datos.correo, montoCentimos,
        onToken: t => void enviar(t),
        onError: m => mensaje.error(m),
      })
    } catch (e) { mensaje.error(e instanceof Error ? e.message : 'No se pudo abrir el formulario de Culqi.') }
  }

  async function quitar(id: string, nombre: string) {
    if (!await pedir({ titulo: '¿Quitar esta tarjeta?', mensaje: <>Ya no se le cobrará a tu <strong>{nombre}</strong>. Tus pagos anteriores no cambian.</>,
                       confirmar: 'Quitar', tono: 'peligro' })) return
    setOcupado(id)
    try { await onHecho((await cobrosServicio.quitarTarjeta(id)).mensaje) }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo quitar.') }
    finally { setOcupado(null) }
  }

  async function principal(id: string) {
    setOcupado(id)
    try { await onHecho((await cobrosServicio.principal(id)).mensaje) }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo cambiar.') }
    finally { setOcupado(null) }
  }

  return (
    <section className="bloque paso-pago">
      <h2><span className={`numero-paso${d.tarjetas.length ? ' hecho' : !d.datos ? ' bloqueado' : ''}`}>{d.tarjetas.length ? '✓' : '2'}</span> Tu tarjeta</h2>
      {!d.datos ? <p className="paso-bloqueado">🔒 Primero guarda los datos de tu comprobante (paso 1). Así sabemos a nombre de quién va la factura o boleta.</p> : <>
      {d.tarjetas.length === 0
        ? <p className="secundario">Todavía no tienes una tarjeta guardada.</p>
        : (
          <ul className="lista-tarjetas">
            {d.tarjetas.map(t => (
              <li key={t.id} className={t.principal ? 'principal' : undefined}>
                <span className="marca-tarjeta">{t.marca}</span>
                <span className="numero-tarjeta">•••• {t.ultimos4}</span>
                {t.principal ? <span className="etiqueta acento">Se cobra a esta</span>
                  : d.puedePagar && <Boton estilo="plano" ocupado={ocupado === t.id} onClick={() => void principal(t.id)}>Cobrar a esta</Boton>}
                {d.puedePagar && <button type="button" className="enlace" onClick={() => void quitar(t.id, `${t.marca} •••• ${t.ultimos4}`)}>Quitar</button>}
              </li>
            ))}
          </ul>
        )}
      {d.puedePagar && <Boton estilo={d.tarjetas.length ? 'secundario' : 'principal'} ocupado={ocupado === 'agregar'} onClick={() => void agregar()}>{d.tarjetas.length ? '+ Agregar otra tarjeta' : '+ Agregar mi tarjeta'}</Boton>}
      <p className="nota seguridad">🔒 {d.modo === 'simulado'
        ? 'Modo simulado: solo sirven las tarjetas de prueba y el número no sale de tu navegador.'
        : 'Tu tarjeta la escribes en el formulario seguro de Culqi y la guarda Culqi, no Reyban. Nosotros solo vemos la marca y los 4 últimos números.'}</p>
      </>}

      <TarjetaSimulada abierta={simulada} onCerrar={() => setSimulada(false)} onToken={t => { setSimulada(false); void enviar(t) }} />
      {dialogo}
    </section>
  )
}

/** El formulario del modo simulado. Solo acepta las tarjetas de la lista y NO manda el número. */
function TarjetaSimulada({ abierta, onCerrar, onToken }: { abierta: boolean; onCerrar: () => void; onToken: (t: string) => void }) {
  const [numero, setNumero] = useState('')
  const [vence, setVence] = useState('')
  const [cvv, setCvv] = useState('')
  const [mal, setMal] = useState<string>()

  function guardar() {
    const n = numero.replace(/\D/g, '')
    const t = TARJETAS_SIMULADAS.find(x => x.numero.replace(/\s/g, '') === n)
    if (!t) { setMal('En modo simulado solo sirven las tarjetas de prueba de la lista. No escribas una tarjeta real.'); return }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(vence)) { setMal('La fecha va como MM/AA, por ejemplo 12/29.'); return }
    if (!/^\d{3,4}$/.test(cvv)) { setMal('El código de seguridad tiene 3 o 4 números (en prueba, cualquiera).'); return }
    setMal(undefined); setNumero(''); setVence(''); setCvv('')
    onToken(`sim_tok_${t.caso}_${n.slice(-4)}_${t.marca}`)
  }

  return (
    <Dialogo titulo="Agregar tarjeta (simulada)" abierto={abierta} onCerrar={onCerrar}
             acciones={<><Boton estilo="plano" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar}>Guardar tarjeta</Boton></>}>
      <p className="secundario">🧪 Modo simulado. Elige una tarjeta de prueba (cualquier fecha futura y cualquier código):</p>
      <ul className="tarjetas-prueba">
        {TARJETAS_SIMULADAS.map(t => (
          <li key={t.numero}>
            <button type="button" className="enlace" onClick={() => { setNumero(t.numero); setVence('12/29'); setCvv('123'); setMal(undefined) }}>{t.numero}</button>
            <span>{t.marca} · {t.texto}</span>
          </li>
        ))}
      </ul>
      <div className="rejilla-datos">
        <label className="campo ancho"><span>Número de tarjeta</span>
          <input inputMode="numeric" autoComplete="off" value={numero} onChange={e => setNumero(e.target.value)} /></label>
        <label className="campo"><span>Vence (MM/AA)</span>
          <input autoComplete="off" placeholder="12/29" maxLength={5} value={vence} onChange={e => setVence(e.target.value)} /></label>
        <label className="campo"><span>Código (CVV)</span>
          <input inputMode="numeric" autoComplete="off" maxLength={4} value={cvv} onChange={e => setCvv(e.target.value)} /></label>
      </div>
      {mal && <Aviso>{mal}</Aviso>}
    </Dialogo>
  )
}

// =============================================================================
// 3. PAGAR
// =============================================================================
function Pagar({ d, onHecho }: { d: MisPagos; onHecho: (m: string) => Promise<void> }) {
  const mensaje = useMensaje()
  const { pedir, dialogo } = useConfirmar()
  const [periodo, setPeriodo] = useState<Periodo>('mensual')
  const [ocupado, setOcupado] = useState(false)
  const m = periodo === 'anual' ? d.anual : d.mensual
  const tarjeta = d.tarjetas.find(t => t.principal) ?? d.tarjetas[0]

  async function pagar() {
    if (!m || m.nada || !tarjeta) return
    const ok = await pedir({
      titulo: `¿Pagar ${soles(m.monto)}?`,
      mensaje: <>
        Se cobrará <strong>{soles(m.monto)}</strong> a tu <strong>{tarjeta.marca} •••• {tarjeta.ultimos4}</strong> por:<br />
        {m.concepto}<br />
        <span className="secundario">Cubre del {fecha(m.desde)} al {fecha(m.hasta)}.{d.modo !== 'real' ? ' (Pago de prueba: no se mueve dinero.)' : ''}</span>
      </>,
      confirmar: `Pagar ${soles(m.monto)}`,
    })
    if (!ok) return
    setOcupado(true)
    try {
      const r = await cobrosServicio.pagar(tarjeta.id, periodo)
      if (r.estado === 'procesando') mensaje.error(r.error ?? 'El pago quedó en proceso. Revisa en unos minutos.')
      await onHecho(r.mensaje ?? 'Pago registrado.')
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo hacer el pago.')
      await onHecho('')
    } finally { setOcupado(false) }
  }

  return (
    <section className="bloque resumen-pagar">
      <h2>Tu pago</h2>
      <div className="elige-periodo" role="radiogroup" aria-label="Periodo">
        {(['mensual', 'anual'] as const).map(p => (
          <label key={p} className={periodo === p ? 'activo' : undefined}>
            <input type="radio" name="periodo" checked={periodo === p} onChange={() => setPeriodo(p)} />
            {p === 'mensual' ? 'Mensual' : `Anual${d.anual?.mesesGratisAnual ? ` (${d.anual.mesesGratisAnual} meses gratis)` : ''}`}
          </label>
        ))}
      </div>
      {!m ? null : m.nada ? (
        <Aviso tono="info">{m.motivo}</Aviso>
      ) : (
        <div className="detalle-pago">
          <div className="monto-grande">{soles(m.monto)}<span>{periodo === 'anual' ? 'por el año' : 'al mes'}</span></div>
          <p className="concepto-pago">{m.concepto}</p>
          <div className="fila-resumen"><span>Cubre</span><strong>{fecha(m.desde)} – {fecha(m.hasta)}</strong></div>
          {m.adelantado && <p className="pista">Pagas por adelantado: empieza el {fecha(m.desde)}, cuando termina tu mes gratis o lo que ya pagaste. No pierdes ningún día.</p>}
          {m.apagados && <p className="pista">Los planes están apagados: este pago es solo para probar.</p>}
        </div>
      )}
      {d.puedePagar && m && !m.nada && (
        tarjeta
          ? <>
              <p className="se-cobra">Se cobra a tu <strong>{tarjeta.marca} •••• {tarjeta.ultimos4}</strong></p>
              <Boton ancho ocupado={ocupado} onClick={() => void pagar()}>💳 Pagar {soles(m.monto)}</Boton>
            </>
          : <Boton ancho disabled title="Primero agrega tu tarjeta">💳 Pagar {soles(m.monto)}</Boton>
      )}
      {d.puedePagar && m && !m.nada && !tarjeta && <p className="pista centro">{d.datos ? 'Agrega tu tarjeta (paso 2) para pagar.' : 'Completa los pasos 1 y 2 para pagar.'}</p>}
      {d.lanzamientoHasta && <p className="nota-lanzamiento">🏷️ Tu precio de lanzamiento se mantiene hasta el <strong>{fecha(d.lanzamientoHasta)}</strong>.</p>}
      <p className="pista centro">🔒 Pago seguro con Culqi · Precios con IGV</p>
      {dialogo}
    </section>
  )
}

// =============================================================================
function Historial({ d }: { d: MisPagos }) {
  return (
    <section className="bloque">
      <h2>Historial de pagos</h2>
      {d.pagos.length === 0 ? <p className="secundario">Todavía no hay pagos.</p> : (
        <div className="tabla-envoltura">
          <table className="tabla compacta">
            <thead><tr><th>Fecha</th><th>N.°</th><th>Concepto</th><th>Cubre</th><th>Medio</th><th className="num">Monto</th><th>Estado</th><th>Comprobante</th></tr></thead>
            <tbody>
              {d.pagos.map(p => (
                <tr key={p.id}>
                  <td>{fechaYHora(p.fecha)}</td>
                  <td>P-{String(p.numero).padStart(6, '0')}</td>
                  <td>{p.concepto}{p.modo !== 'real' && p.modo !== 'manual' && <> <span className="etiqueta">prueba</span></>}</td>
                  <td>{fecha(p.desde)} – {fecha(p.hasta)}</td>
                  <td>{p.tarjeta ?? NOMBRE_MEDIO[p.medio]}</td>
                  <td className="num">{soles(p.monto)}</td>
                  <td>
                    <span className={`estado-cobro ${p.estado}`}>{NOMBRE_ESTADO_COBRO[p.estado]}</span>
                    {p.estado === 'rechazado' && p.error && <div className="pista">{p.error}</div>}
                  </td>
                  <td>{p.estado !== 'pagado' ? '—'
                    : p.comprobanteNumero ?? (p.comprobante === 'pendiente' ? <span className="pista">Llega pronto a tu correo</span> : '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}