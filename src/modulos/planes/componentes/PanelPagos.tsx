import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
import { Pestanas } from '../../../componentes/Pestanas'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha, fechaYHora } from '../../../nucleo/formato/fechas'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { soles } from '../../../nucleo/planes/planes'
import {
  NOMBRE_ESTADO_COBRO, NOMBRE_MEDIO, NOMBRE_MODO, cobrosServicio,
  type ConfigCobros, type CuentaParaPago, type PagoAdmin,
} from '../servicios/cobrosServicio'
import { FilaRegla, GrupoRegla } from './Reglas'

type Vista = 'panel' | 'pagos'

/**
 * 073 — EL PANEL DE PAGOS (Planes y cobros › Pagos).
 *
 *   Conexión con Culqi   el modo (apagado / simulado / Culqi), si las llaves
 *                        del .env están y de qué tipo (nunca su valor), la
 *                        dirección del aviso para pegar en CulqiPanel y
 *                        «Probar conexión».
 *   Reglas de cobro      reintentos, gracia, qué pasa al vencer, aviso previo.
 *   Comprobante          la empresa que emite, sus series, el correo y la
 *                        descripción.
 *   Medios de pago       tarjeta, transferencia (con los datos del banco), Yape.
 *   Pagos recibidos      todos los pagos; registrar uno a mano y anularlo.
 */
export function PanelPagos({ puedeConfigurar, puedeRegistrar }: { puedeConfigurar: boolean; puedeRegistrar: boolean }) {
  const [vista, setVista] = useState<Vista>('panel')
  return (
    <>
      <Pestanas<Vista> etiqueta="Pagos" valor={vista} onCambio={setVista} opciones={[
        { valor: 'panel', texto: 'Conexión y reglas' },
        { valor: 'pagos', texto: 'Pagos recibidos' },
      ]} />
      {vista === 'panel' && <Panel puede={puedeConfigurar} />}
      {vista === 'pagos' && <PagosRecibidos puedeRegistrar={puedeRegistrar} />}
    </>
  )
}

// =============================================================================
// CONEXIÓN Y REGLAS
// =============================================================================
function Panel({ puede }: { puede: boolean }) {
  const mensaje = useMensaje()
  const [c, setC] = useState<ConfigCobros>()
  const [f, setF] = useState<ConfigCobros>()
  const [reintentos, setReintentos] = useState('')
  const [error, setError] = useState<string>()
  const [ocupado, setOcupado] = useState<'guardar' | 'probar' | null>(null)

  const cargar = useCallback(async () => {
    try {
      const x = await cobrosServicio.config()
      setC(x); setF(x); setReintentos(x.reintentoDias.join(', ')); setError(undefined)
    } catch (e) { setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar el panel de pagos.') }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  if (error) return <Aviso>{error}</Aviso>
  if (!c || !f) return <Cargando />

  const cx = c.conexion
  const cambia = <K extends keyof ConfigCobros>(k: K, v: ConfigCobros[K]) => setF(x => x && ({ ...x, [k]: v }))
  const emisora = f.emisoras.find(e => e.id === f.emisora)

  async function guardar() {
    if (!f) return
    const dias = reintentos.split(/[,\s]+/).filter(Boolean).map(Number)
    if (dias.some(n => !Number.isInteger(n))) { mensaje.error('Los reintentos van como números separados por coma, por ejemplo: 3, 5'); return }
    setOcupado('guardar')
    try {
      const r = await cobrosServicio.guardarConfig({
        modo: f.modo, reintentoDias: dias, graciaDias: f.graciaDias, avisoDias: f.avisoDias, alVencer: f.alVencer,
        emisora: f.emisora, serieFactura: f.serieFactura, serieBoleta: f.serieBoleta, enviarCorreo: f.enviarCorreo,
        descripcion: f.descripcion, aceptaTarjeta: f.aceptaTarjeta, aceptaTransferencia: f.aceptaTransferencia,
        aceptaYape: f.aceptaYape, transferenciaDatos: f.transferenciaDatos, correoPagos: f.correoPagos,
      })
      mensaje.bien(r.mensaje)
      await cargar()
    } catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo guardar.') }
    finally { setOcupado(null) }
  }

  async function probar() {
    setOcupado('probar')
    try {
      const r = await cobrosServicio.probar()
      if (r.ok) mensaje.bien(r.mensaje); else mensaje.error(r.mensaje)
      await cargar()
    } catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo probar.') }
    finally { setOcupado(null) }
  }

  async function copiar(texto: string) {
    try { await navigator.clipboard.writeText(texto); mensaje.bien('Copiado. Pégalo en CulqiPanel › Desarrollo › Webhooks.') }
    catch { mensaje.error('No se pudo copiar: selecciónalo y cópialo a mano.') }
  }

  const sinGuardar = JSON.stringify({ ...f, reintentoDias: null }) !== JSON.stringify({ ...c, reintentoDias: null })
    || reintentos !== c.reintentoDias.join(', ')

  return (
    <div className="bloque reglas-planes panel-pagos sin-mayusculas">
      <div className="cifras-pagos">
        <div><span className="rotulo">Modo de verdad ahora</span><strong className={`modo-pago ${cx.modoEfectivo}`}>{NOMBRE_MODO[cx.modoEfectivo]}</strong></div>
        <div><span className="rotulo">Pagos este mes</span><strong>{c.mes.pagos}</strong></div>
        <div><span className="rotulo">Cobrado este mes (real + manual)</span><strong>{soles(c.mes.monto)}</strong></div>
        <div><span className="rotulo">Rechazados este mes</span><strong>{c.mes.rechazados}</strong></div>
      </div>
      {cx.problema && <Aviso tono="ojo">⚠ {cx.problema}</Aviso>}
      {cx.aviso && <Aviso tono="ojo">⚠ {cx.aviso}</Aviso>}

      <GrupoRegla titulo="1. Conexión con Culqi" texto="Cómo se cobra con tarjeta. Las llaves de Culqi NO se escriben aquí: van solo en el .env del servidor, así nadie que entre al panel las puede ver ni copiar.">
        <FilaRegla etiqueta="Modo" ayuda="Simulado: tarjetas de prueba sin Culqi ni dinero (en producción está bloqueado). Culqi: prueba o real lo decide la llave del .env (pk_test = prueba, pk_live = real), no un botón.">
          <div className="modos-pago" role="radiogroup" aria-label="Modo de pagos">
            {([
              ['apagado', '⏸ Apagado', 'Nadie paga con tarjeta'],
              ['simulado', '🧪 Simulado', cx.produccion ? 'Bloqueado en producción' : 'Sin Culqi, sin dinero'],
              ['culqi', '💳 Culqi', cx.llaves === 'real' ? 'Llaves REALES' : cx.llaves === 'prueba' ? 'Llaves de PRUEBA' : 'Faltan las llaves'],
            ] as const).map(([v, t, s]) => (
              <label key={v} className={f.modo === v ? 'activo' : undefined}>
                <input type="radio" name="modoPago" checked={f.modo === v} disabled={!puede || (v === 'simulado' && cx.produccion)}
                       onChange={() => cambia('modo', v)} />
                <strong>{t}</strong><span>{s}</span>
              </label>
            ))}
          </div>
        </FilaRegla>
        <FilaRegla etiqueta="Llaves en el servidor" ayuda="Lo que encuentra en el .env. De la secreta solo se dice si está: nunca se enseña.">
          <ul className="llaves-culqi">
            <li>{cx.llavePublica ? '✔' : '✗'} Llave pública: <code>{cx.llavePublica ?? 'falta (CULQI_LLAVE_PUBLICA)'}</code></li>
            <li>{cx.llaveSecreta ? '✔' : '✗'} Llave secreta: {cx.llaveSecreta ? 'configurada (no se muestra)' : <code>falta (CULQI_LLAVE_SECRETA)</code>}</li>
            <li>Tipo: <strong>{({ sin_llaves: 'sin llaves', prueba: 'PRUEBA', real: 'REAL', no_coinciden: 'no coinciden (una de prueba y otra real)', mal_escritas: 'mal copiadas' } as const)[cx.llaves]}</strong></li>
          </ul>
        </FilaRegla>
        <FilaRegla etiqueta="Aviso de Culqi (webhook)" ayuda="Pega esta dirección en CulqiPanel › Desarrollo › Webhooks, con los eventos de cargos y devoluciones. Cada aviso se comprueba preguntándole a Culqi: uno falso no puede marcar nada como pagado.">
          <div className="copiar-url">
            <code>{cx.webhookUrl}</code>
            <Boton estilo="plano" onClick={() => void copiar(cx.webhookUrl)}>Copiar</Boton>
          </div>
          <p className="pista">
            {cx.webhookProtegido ? '✔ Protegido con usuario y clave (CULQI_WEBHOOK_USUARIO y CULQI_WEBHOOK_CLAVE).' : 'Recomendado: pon un usuario y una clave en el aviso de CulqiPanel y los mismos en el .env (CULQI_WEBHOOK_USUARIO y CULQI_WEBHOOK_CLAVE).'}
            {' '}Último aviso recibido: <strong>{c.ultimoEventoEn ? fechaYHora(c.ultimoEventoEn) : 'ninguno todavía'}</strong>.
          </p>
        </FilaRegla>
        <FilaRegla etiqueta="Probar la conexión" ayuda="Le pregunta a Culqi si acepta la llave secreta. No cobra nada.">
          <div>
            <Boton estilo="secundario" ocupado={ocupado === 'probar'} disabled={!puede} onClick={() => void probar()}>Probar conexión</Boton>
            {c.prueba.en && <p className={`pista ${c.prueba.ok ? 'bien' : 'mal'}`}>{c.prueba.ok ? '✔' : '✗'} {c.prueba.detalle} ({fechaYHora(c.prueba.en)})</p>}
          </div>
        </FilaRegla>
      </GrupoRegla>

      <GrupoRegla titulo="2. Si la tarjeta falla" texto="Qué pasa cuando el cobro del mes no pasa. El cobro automático de cada día llega en la siguiente entrega; estas reglas ya quedan guardadas.">
        <FilaRegla etiqueta="Reintentos" ayuda="Los días (contados desde la fecha de cobro) en que se vuelve a intentar. Ejemplo: 3, 5 = se reintenta el día 3 y el día 5. Hasta 5 reintentos.">
          <span className="con-unidad"><input value={reintentos} disabled={!puede} onChange={e => setReintentos(e.target.value)} placeholder="3, 5" /><em>días</em></span>
        </FilaRegla>
        <FilaRegla etiqueta="Días de gracia" ayuda="Después del último reintento, cuántos días más tiene para ponerse al día. En esos días ve una franja que le pide actualizar su tarjeta.">
          <span className="con-unidad"><input type="number" min={0} max={30} disabled={!puede} value={f.graciaDias}
            onChange={e => cambia('graciaDias', Number(e.target.value))} /><em>días</em></span>
        </FilaRegla>
        <FilaRegla etiqueta="Al terminar la gracia" ayuda="No emite: puede entrar y ver todo, pero no emitir hasta pagar (nada se borra; apenas paga, se desbloquea solo). Solo aviso: sigue emitiendo y solo se le avisa.">
          <select disabled={!puede} value={f.alVencer} onChange={e => cambia('alVencer', e.target.value as ConfigCobros['alVencer'])}>
            <option value="no_emite">No puede emitir hasta pagar</option>
            <option value="solo_aviso">Solo se le avisa</option>
          </select>
        </FilaRegla>
        <FilaRegla etiqueta="Aviso antes del cobro" ayuda="Cuántos días antes se le avisa que se le va a cobrar (y desde cuándo puede adelantar el pago).">
          <span className="con-unidad"><input type="number" min={0} max={15} disabled={!puede} value={f.avisoDias}
            onChange={e => cambia('avisoDias', Number(e.target.value))} /><em>días antes</em></span>
        </FilaRegla>
      </GrupoRegla>

      <GrupoRegla titulo="3. Comprobante de Reyban" texto="Con cada pago, tu empresa le emite al cliente factura (si dio RUC 10 o 20) o boleta (si dio DNI). Tu empresa, sus series y el texto del comprobante se configuran en «Mi empresa».">
        <FilaRegla etiqueta="Empresa que emite" ayuda="La de «Mi empresa».">
          {emisora ? <strong>{emisora.razonSocial || emisora.nombre} · RUC {emisora.ruc}</strong>
            : c.emisora ? <strong>Mi empresa (configurada)</strong>
            : <span className="pista mal">✗ Aún no registras tu empresa</span>}
        </FilaRegla>
        <FilaRegla etiqueta="Series" ayuda="Factura para RUC, boleta para DNI.">
          <span>{c.serieFactura ?? '—'} · {c.serieBoleta ?? '—'}</span>
        </FilaRegla>
        <div className="acciones-bloque"><Link className="boton secundario" to={c.emisora ? '/admin/mi-empresa/comprobantes' : '/admin/mi-empresa'}>{c.emisora ? 'Cambiar en Mi empresa →' : 'Registrar mi empresa →'}</Link></div>
      </GrupoRegla>

      <GrupoRegla titulo="4. Medios de pago" texto="Lo que el cliente puede usar en «Mis pagos».">
        <FilaRegla etiqueta="Tarjeta (Culqi)" ayuda="Crédito o débito. Se guarda y se cobra sola cada mes.">
          <label className="interruptor-chico"><input type="checkbox" disabled={!puede} checked={f.aceptaTarjeta}
            onChange={e => cambia('aceptaTarjeta', e.target.checked)} /><span>{f.aceptaTarjeta ? 'Sí' : 'No'}</span></label>
        </FilaRegla>
        <FilaRegla etiqueta="Transferencia o depósito" ayuda="El cliente ve estos datos, transfiere y te manda la constancia. Tú lo registras en «Pagos recibidos».">
          <div className="medio-transferencia">
            <label className="interruptor-chico"><input type="checkbox" disabled={!puede} checked={f.aceptaTransferencia}
              onChange={e => cambia('aceptaTransferencia', e.target.checked)} /><span>{f.aceptaTransferencia ? 'Sí' : 'No'}</span></label>
            {f.aceptaTransferencia && (
              <textarea rows={4} maxLength={600} disabled={!puede} value={f.transferenciaDatos ?? ''}
                        placeholder={'Banco: BCP\nCuenta corriente: 000-0000000-0-00\nCCI: 002-000-000000000000-00\nTitular: tu empresa'}
                        onChange={e => cambia('transferenciaDatos', e.target.value)} />
            )}
          </div>
        </FilaRegla>
        <FilaRegla etiqueta="Correo para constancias" ayuda="A dónde te mandan la constancia de transferencia (y a dónde escriben por pagos).">
          <input type="email" maxLength={200} disabled={!puede} value={f.correoPagos ?? ''} placeholder="pagos@tuempresa.pe"
                 onChange={e => cambia('correoPagos', e.target.value || null)} />
        </FilaRegla>
        <FilaRegla etiqueta="Yape" ayuda="Culqi lo tiene. Lo activamos más adelante.">
          <span className="pista">Próximamente</span>
        </FilaRegla>
      </GrupoRegla>

      {puede && (
        <div className="acciones-bloque barra-guardar-pagos">
          {sinGuardar && <span className="pista">Tienes cambios sin guardar.</span>}
          <Boton ocupado={ocupado === 'guardar'} onClick={() => void guardar()}>Guardar el panel de pagos</Boton>
        </div>
      )}
      {c.modificadoEn && <p className="pista">Último cambio: {fechaYHora(c.modificadoEn)}{c.modificadoPor ? ` por ${c.modificadoPor}` : ''}. Todo cambio queda en la auditoría.</p>}

      <details className="como-culqi">
        <summary>¿Cómo conecto Culqi? (paso a paso)</summary>
        <ol>
          <li>Crea tu cuenta en <strong>culqi.com</strong> con tu RUC (10 o 20). Apenas te registras tienes el panel de integración.</li>
          <li>En <strong>CulqiPanel › Desarrollo › API Keys</strong> copia la llave pública (<code>pk_test_…</code>) y la secreta (<code>sk_test_…</code>).</li>
          <li>Ponlas en el <strong>.env</strong> del servidor como <code>CULQI_LLAVE_PUBLICA</code> y <code>CULQI_LLAVE_SECRETA</code> y reinicia la plataforma. <strong>Nunca</strong> las mandes por chat ni correo.</li>
          <li>En <strong>Desarrollo › Webhooks</strong> pega la dirección del aviso (botón «Copiar») y, si quieres, un usuario y una clave (los mismos en el .env).</li>
          <li>Aquí elige <strong>Culqi</strong>, guarda y pulsa <strong>Probar conexión</strong>. Prueba un pago con las tarjetas de prueba de Culqi.</li>
          <li>Cuando Culqi apruebe tu cuenta, cambia en el .env de producción las llaves por las reales (<code>pk_live_…</code>, <code>sk_live_…</code>). Este panel lo detecta solo.</li>
        </ol>
      </details>

      {c.eventos.length > 0 && (
        <details className="eventos-culqi">
          <summary>Últimos avisos de Culqi ({c.eventos.length})</summary>
          <table className="tabla compacta">
            <thead><tr><th>Fecha</th><th>Tipo</th><th>¿Válido?</th><th>Resultado</th></tr></thead>
            <tbody>{c.eventos.map(e => (
              <tr key={e.id}><td>{fechaYHora(e.en)}</td><td>{e.tipo ?? '—'}</td><td>{e.valido ? 'Sí' : 'No'}</td>
                <td>{e.aplicado ? '✔ ' : ''}{e.resultado ?? '—'}</td></tr>
            ))}</tbody>
          </table>
        </details>
      )}
    </div>
  )
}

// =============================================================================
// PAGOS RECIBIDOS
// =============================================================================
function PagosRecibidos({ puedeRegistrar }: { puedeRegistrar: boolean }) {
  const mensaje = useMensaje()
  const [filtro, setFiltro] = useState({ estado: '', texto: '', desde: '', hasta: '' })
  const [pagos, setPagos] = useState<PagoAdmin[]>()
  const [error, setError] = useState<string>()
  const [registrar, setRegistrar] = useState(false)
  const [anular, setAnular] = useState<PagoAdmin>()

  const cargar = useCallback(async () => {
    try { setPagos(await cobrosServicio.pagos(filtro)); setError(undefined) }
    catch (e) { setError(e instanceof ErrorApi ? e.message : 'No se pudieron cargar los pagos.') }
  }, [filtro])
  useEffect(() => {
    const t = setTimeout(() => { void cargar() }, 300)
    return () => clearTimeout(t)
  }, [cargar])

  const hecho = async (m: string) => { mensaje.bien(m); setRegistrar(false); setAnular(undefined); await cargar() }

  return (
    <div className="bloque">
      <div className="filtros-pagos">
        <input type="search" placeholder="Buscar: cliente, RUC/DNI, correo, código de Culqi o N.°" value={filtro.texto}
               onChange={e => setFiltro(x => ({ ...x, texto: e.target.value }))} />
        <select value={filtro.estado} onChange={e => setFiltro(x => ({ ...x, estado: e.target.value }))} aria-label="Estado">
          <option value="">Todos</option>
          {Object.entries(NOMBRE_ESTADO_COBRO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label>Desde <input type="date" value={filtro.desde} onChange={e => setFiltro(x => ({ ...x, desde: e.target.value }))} /></label>
        <label>Hasta <input type="date" value={filtro.hasta} onChange={e => setFiltro(x => ({ ...x, hasta: e.target.value }))} /></label>
        {puedeRegistrar && <Boton onClick={() => setRegistrar(true)}>+ Registrar pago (transferencia)</Boton>}
      </div>

      {error ? <Aviso>{error}</Aviso> : !pagos ? <Cargando /> : pagos.length === 0 ? <p className="secundario">No hay pagos con esos filtros.</p> : (
        <div className="tabla-envoltura">
          <table className="tabla compacta">
            <thead><tr><th>Fecha</th><th>N.°</th><th>Cliente</th><th>Concepto</th><th>Medio</th><th className="num">Monto</th><th>Estado</th><th>Referencia</th><th /></tr></thead>
            <tbody>
              {pagos.map(p => (
                <tr key={p.id}>
                  <td>{fechaYHora(p.fecha)}</td>
                  <td>P-{String(p.numero).padStart(6, '0')}</td>
                  <td><strong>{p.cuenta ?? '—'}</strong>{p.comprador && <div className="pista">{p.comprador}{p.documento ? ` · ${p.documento}` : ''}</div>}</td>
                  <td>{p.concepto}<div className="pista">{fecha(p.desde)} – {fecha(p.hasta)}</div></td>
                  <td>{NOMBRE_MEDIO[p.medio]}{p.modo !== 'real' && p.modo !== 'manual' && <> <span className="etiqueta">{p.modo}</span></>}
                    {p.registradoPor && <div className="pista">registró {p.registradoPor}</div>}</td>
                  <td className="num">{soles(p.monto)}</td>
                  <td><span className={`estado-cobro ${p.estado}`}>{NOMBRE_ESTADO_COBRO[p.estado]}</span>
                    {p.error && <div className="pista">{p.error}</div>}
                    {p.anuladoMotivo && <div className="pista">Motivo: {p.anuladoMotivo}</div>}</td>
                  <td><code className="ref">{p.referencia ?? '—'}</code></td>
                  <td>{puedeRegistrar && p.puedeAnular && <button type="button" className="enlace" onClick={() => setAnular(p)}>Anular</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {registrar && <RegistrarPago onCerrar={() => setRegistrar(false)} onHecho={hecho} />}
      {anular && <AnularPago pago={anular} onCerrar={() => setAnular(undefined)} onHecho={hecho} />}
    </div>
  )
}

function RegistrarPago({ onCerrar, onHecho }: { onCerrar: () => void; onHecho: (m: string) => Promise<void> }) {
  const mensaje = useMensaje()
  const [buscar, setBuscar] = useState('')
  const [cuentas, setCuentas] = useState<CuentaParaPago[]>([])
  const [cuenta, setCuenta] = useState<CuentaParaPago>()
  const [monto, setMonto] = useState('')
  const [medio, setMedio] = useState('transferencia')
  const [referencia, setReferencia] = useState('')
  const [meses, setMeses] = useState(1)
  const [notas, setNotas] = useState('')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    if (cuenta || buscar.trim().length < 2) return
    const t = setTimeout(() => { void cobrosServicio.cuentas(buscar).then(setCuentas).catch(() => setCuentas([])) }, 300)
    return () => clearTimeout(t)
  }, [buscar, cuenta])

  async function guardar() {
    if (!cuenta) { mensaje.error('Elige la cuenta que pagó.'); return }
    setOcupado(true)
    try {
      await onHecho((await cobrosServicio.manual({ cuentaId: cuenta.id, monto: Number(monto), medio, referencia, meses, notas: notas || undefined })).mensaje)
    } catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo registrar.') }
    finally { setOcupado(false) }
  }

  return (
    <Dialogo titulo="Registrar un pago por transferencia" abierto onCerrar={onCerrar} ancho="grande"
             acciones={<><Boton estilo="plano" onClick={onCerrar}>Cancelar</Boton><Boton ocupado={ocupado} onClick={() => void guardar()}>Registrar pago</Boton></>}>
      <div className="sin-mayusculas"><p className="secundario">Para pagos que llegaron a tu cuenta bancaria (transferencia, depósito, Yape o efectivo). La cuenta queda al día por los meses que cubre, y el comprobante sale con los datos que el cliente dejó en «Mis pagos».</p>
      {!cuenta ? (
        <>
          <label className="campo"><span>¿Quién pagó? Busca por nombre, correo, DNI o RUC</span>
            <input type="search" autoFocus value={buscar} onChange={e => setBuscar(e.target.value)} /></label>
          <ul className="resultados-cuentas">
            {cuentas.map(x => (
              <li key={x.id}><button type="button" onClick={() => setCuenta(x)}>
                <strong>{x.nombre ?? '—'}</strong> <span className="pista">{x.tipo === 'profesional' ? 'Cuenta Profesional' : 'Cuenta Negocio'} · {x.correo}</span>
                <span className="pista">{x.datos ? `Comprobante: ${x.datos}` : 'Sin datos de comprobante todavía'}</span>
              </button></li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <div className="cuenta-elegida">
            <strong>{cuenta.nombre}</strong> · {cuenta.correo} <button type="button" className="enlace" onClick={() => setCuenta(undefined)}>Cambiar</button>
            <div className="pista">{cuenta.proximo ? `Pagado hasta el ${fecha(cuenta.proximo)} (el nuevo pago sigue desde ahí)` : 'Sin pagos todavía'}
              {cuenta.datos ? ` · Comprobante: ${cuenta.datos}` : ' · Sin datos de comprobante: pídeselos para emitirle'}</div>
          </div>
          <div className="rejilla-datos">
            <label className="campo"><span>Monto que pagó (S/) *</span><input type="number" min={0} step="0.01" value={monto} onChange={e => setMonto(e.target.value)} /></label>
            <label className="campo"><span>Cómo pagó *</span>
              <select value={medio} onChange={e => setMedio(e.target.value)}>
                {(['transferencia', 'deposito', 'yape', 'efectivo', 'otro'] as const).map(m => <option key={m} value={m}>{NOMBRE_MEDIO[m]}</option>)}
              </select></label>
            <label className="campo"><span>N.° de operación *</span><input value={referencia} maxLength={60} onChange={e => setReferencia(e.target.value)} /></label>
            <label className="campo"><span>Meses que cubre *</span>
              <select value={meses} onChange={e => setMeses(Number(e.target.value))}>
                {[1, 2, 3, 6, 12, 24].map(n => <option key={n} value={n}>{n === 12 ? '12 (un año)' : n}</option>)}
              </select></label>
            <label className="campo ancho"><span>Notas (opcional)</span><input value={notas} maxLength={500} onChange={e => setNotas(e.target.value)} /></label>
          </div>
        </>
      )}
      </div>
    </Dialogo>
  )
}

function AnularPago({ pago, onCerrar, onHecho }: { pago: PagoAdmin; onCerrar: () => void; onHecho: (m: string) => Promise<void> }) {
  const mensaje = useMensaje()
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  async function anular() {
    setOcupado(true)
    try { await onHecho((await cobrosServicio.anular(pago.id, motivo)).mensaje) }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo anular.') }
    finally { setOcupado(false) }
  }
  return (
    <Dialogo titulo={`¿Anular el pago P-${String(pago.numero).padStart(6, '0')}?`} abierto onCerrar={onCerrar}
             acciones={<><Boton estilo="plano" onClick={onCerrar}>Cancelar</Boton><Boton estilo="peligro" ocupado={ocupado} onClick={() => void anular()}>Anular</Boton></>}>
      <p><strong>{soles(pago.monto)}</strong> de {pago.cuenta} — {pago.concepto}.</p>
      <p className="secundario">No se borra: queda en el historial como «Anulado» con su motivo, y la cuenta vuelve a lo que de verdad tiene pagado.</p>
      <label className="campo sin-mayusculas"><span>Motivo *</span><input autoFocus value={motivo} maxLength={300} onChange={e => setMotivo(e.target.value)} placeholder="Ej.: lo registré en la cuenta equivocada" /></label>
    </Dialogo>
  )
}