import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Aviso } from '../../componentes/Aviso'
import { Boton } from '../../componentes/Boton'
import { Cargando, Vacio } from '../../componentes/Cargando'
import { Paginacion } from '../../componentes/Paginacion'
import { ErrorApi } from '../../nucleo/api/errores'
import { fecha, fechaYHora } from '../../nucleo/formato/fechas'
import { useMensaje } from '../../nucleo/mensajes/ProveedorMensajes'
import '../facturacion/comprobantes-lista.css'
import '../deudas/deudas.css'
import './ventas.css'
import {
  CLASE_ESTADO, MESES, NOMBRE_ESTADO, dinero, textoMedio, ventasServicio,
  type EstadoVenta, type FiltroVentas, type PaginaVentas, type ReportesVentas, type ResumenVentas,
} from './ventasServicio'

/**
 * e274 (091) — VENTAS (super admin). Lo que te pagan tus clientes por sus
 * planes, como en CulqiPanel, y sus reportes. Solo lectura: registrar un pago a
 * mano sigue en Planes y cobros › Pagos.
 */
type Vista = 'ventas' | 'reportes'

const hoyLima = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
const inicioMes = () => hoyLima().slice(0, 8) + '01'
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

export function Ventas() {
  const [vista, setVista] = useState<Vista>('ventas')
  const [pruebas, setPruebas] = useState(false)
  const [resumen, setResumen] = useState<ResumenVentas>()

  useEffect(() => {
    let vivo = true
    ventasServicio.resumen(pruebas).then(r => { if (vivo) setResumen(r) }).catch(() => { /* la lista ya avisa */ })
    return () => { vivo = false }
  }, [pruebas])

  return (
    <div className="ddu-pagina vnt-pagina">
      <div className="encabezado-pagina cmp-encab">
        <div>
          <h1 className="titulo-pagina">Ventas
            {resumen && <span className="lst-cuenta">{plural(resumen.mesPagos, 'pago', 'pagos')} este mes</span>}
          </h1>
          <p className="bajada-pagina">Lo que te pagan tus clientes por sus planes: con tarjeta (Culqi) o por transferencia.</p>
        </div>
        <label className="vnt-pruebas" title="En QA los pagos son de prueba: márcalo para verlos">
          <input type="checkbox" checked={pruebas} onChange={e => setPruebas(e.target.checked)} /> Ver también los de prueba
        </label>
      </div>

      <div className="cmp-chips vnt-vistas" role="tablist" aria-label="Ventas">
        {([['ventas', 'Ventas'], ['reportes', 'Reportes']] as const).map(([v, t]) => (
          <button key={v} type="button" role="tab" aria-selected={vista === v} className={vista === v ? 'cmp-chip elegido' : 'cmp-chip'}
                  onClick={() => setVista(v)}>{t}</button>
        ))}
      </div>

      {resumen && (
        <div className="cmp-mes estatico vnt-franja">
          <div className="cmp-mes-dato elegido"><span>Cobrado este mes</span><strong>S/ {dinero(resumen.mes)}</strong><small>{plural(resumen.mesPagos, 'pago', 'pagos')}</small></div>
          <div className="cmp-mes-dato"><span>Hoy</span><strong>S/ {dinero(resumen.hoy)}</strong><small>{plural(resumen.hoyPagos, 'pago', 'pagos')}</small></div>
          <div className="cmp-mes-dato"><span>Ingreso fijo al mes</span><strong>S/ {dinero(resumen.fijo)}</strong><small>{plural(resumen.clientes, 'cliente paga', 'clientes pagan')}</small></div>
          <div className="cmp-mes-dato ojo"><span>Por cobrar esta semana</span><strong>S/ {dinero(resumen.semana)}</strong><small>{plural(resumen.semanaCuentas, 'cuenta', 'cuentas')}</small></div>
          <div className="cmp-mes-dato mal"><span>Atrasados</span><strong>{resumen.atrasados}</strong><small>{resumen.rechazadosMes > 0 ? `${plural(resumen.rechazadosMes, 'rechazo', 'rechazos')} este mes` : 'ningún rechazo este mes'}</small></div>
        </div>
      )}

      {vista === 'ventas' ? <Lista pruebas={pruebas} /> : <Reportes pruebas={pruebas} />}
    </div>
  )
}

// -----------------------------------------------------------------------------
function Lista({ pruebas }: { pruebas: boolean }) {
  const mensaje = useMensaje()
  const [estado, setEstado] = useState<EstadoVenta | ''>('')
  const [q, setQ] = useState('')
  const [buscar, setBuscar] = useState('')
  const [desde, setDesde] = useState(inicioMes())
  const [hasta, setHasta] = useState(hoyLima())
  const [plan, setPlan] = useState('')
  const [medio, setMedio] = useState<'' | 'tarjeta' | 'otro'>('')
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(20)
  const [datos, setDatos] = useState<PaginaVentas>()
  const [fallo, setFallo] = useState<string>()
  const [bajando, setBajando] = useState(false)

  useEffect(() => { const t = window.setTimeout(() => { setBuscar(q.trim()); setPagina(1) }, 400); return () => window.clearTimeout(t) }, [q])

  const filtro: FiltroVentas = { estado, q: buscar || undefined, desde: desde || undefined, hasta: hasta || undefined, plan, medio, pruebas, pagina, porPagina }
  const clave = JSON.stringify(filtro)
  useEffect(() => {
    let vivo = true
    ventasServicio.listar(JSON.parse(clave) as FiltroVentas)
      .then(d => { if (vivo) { setDatos(d); setFallo(undefined) } })
      .catch(e => { if (vivo) setFallo(e instanceof ErrorApi ? e.message : 'No se pudieron leer las ventas.') })
    return () => { vivo = false }
  }, [clave])

  async function excel() {
    setBajando(true)
    try { await ventasServicio.excel(filtro) }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo bajar el Excel.') }
    finally { setBajando(false) }
  }
  const cambia = <T,>(f: (v: T) => void) => (v: T) => { f(v); setPagina(1) }

  return (
    <>
      <div className="lst-caja">
        <div className="lst-filtros vnt-filtros">
          <label className="lst-buscar"><span className="solo-lector">Buscar</span>
            <input type="search" value={q} placeholder="Cliente, RUC, N.° de pago, comprobante o ID de Culqi" onChange={e => setQ(e.target.value)} /></label>
          <label className="vnt-fecha"><span>Desde</span><input type="date" value={desde} onChange={e => cambia(setDesde)(e.target.value)} /></label>
          <label className="vnt-fecha"><span>Hasta</span><input type="date" value={hasta} onChange={e => cambia(setHasta)(e.target.value)} /></label>
          <select aria-label="Plan" value={plan} onChange={e => cambia(setPlan)(e.target.value)}>
            <option value="">Plan: todos</option>
            {['Básico', 'Pro', 'Max', 'Cartera'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select aria-label="Medio" value={medio} onChange={e => cambia(setMedio)(e.target.value as '' | 'tarjeta' | 'otro')}>
            <option value="">Medio: todos</option><option value="tarjeta">Tarjeta</option><option value="otro">Transferencia y otros</option>
          </select>
          {datos && datos.total > 0 && <Boton estilo="secundario" onClick={() => void excel()} ocupado={bajando} textoOcupado="Bajando…">Descargar Excel</Boton>}
        </div>
        <div className="cmp-chips" role="group" aria-label="Estado">
          {([['', 'Todos'], ['pagado', 'Pagados'], ['rechazado', 'Rechazados'], ['devuelto', 'Devueltos']] as const).map(([v, t]) => (
            <button key={v} type="button" className={estado === v ? 'cmp-chip elegido' : 'cmp-chip'} aria-pressed={estado === v} onClick={() => cambia(setEstado)(v)}>{t}</button>
          ))}
          {datos && datos.total > 0 && <span className="vnt-suma">Pagado en lo filtrado: <strong>S/ {dinero(datos.suma)}</strong></span>}
        </div>

        {fallo && <div className="relleno"><Aviso>{fallo}</Aviso></div>}
        {!datos && !fallo && <div className="relleno"><Cargando /></div>}
        {datos && (datos.filas.length === 0 ? (
          <div className="relleno"><Vacio>{buscar ? `Nada con «${buscar}».` : pruebas ? 'No hay ventas en esas fechas.' : 'No hay ventas con dinero real en esas fechas. En QA, marca «Ver también los de prueba».'}</Vacio></div>
        ) : (
          <div className="bloque sin-relleno lst-tabla">
            <div className="tabla-envoltura">
              <table className="tabla lst">
                <thead><tr><th>Fecha</th><th>Cliente</th><th>Plan</th><th>Medio</th><th className="derecha">Monto</th><th>Estado</th><th>Comprobante · Culqi</th></tr></thead>
                <tbody>
                  {datos.filas.map(v => (
                    <tr key={v.id}>
                      <td className="sin-corte"><div>{fechaYHora(v.fecha)}</div><div className="secundario">P-{String(v.numero).padStart(6, '0')}</div></td>
                      <td className="lst-nombre"><div className="principal" title={v.cuenta ?? ''}>{v.cuenta ?? '—'}</div>
                        <div className="secundario">{v.tipoCuenta === 'profesional' ? `Cartera · ${plural(v.empresas, 'empresa', 'empresas')}` : v.empresa ?? '—'}</div></td>
                      <td><span className="vnt-plan">{v.plan}</span><div className="secundario">{v.periodo === 'anual' ? 'Anual' : v.periodo === 'mensual' ? 'Mensual' : 'Otro'}</div></td>
                      <td className="sin-corte">{textoMedio(v.medio, v.tarjeta)}{v.modo === 'prueba' || v.modo === 'simulado' ? <div className="secundario">de prueba</div> : null}</td>
                      <td className="derecha lst-precio">S/ {dinero(v.monto)}</td>
                      <td><span className={`ddu-estado ${CLASE_ESTADO[v.estado]}`}>{NOMBRE_ESTADO[v.estado]}</span></td>
                      <td><div className="mono">{v.comprobanteNumero ?? (v.estado === 'pagado' ? 'emitiéndose…' : '—')}</div>
                        <div className="secundario vnt-ref" title={v.error ?? v.referencia ?? ''}>{v.estado === 'rechazado' ? v.error ?? '' : v.modo === 'manual' ? `manual · ${v.referencia ?? ''}` : v.referencia ?? ''}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      {datos && datos.filas.length > 0 && (
        <Paginacion total={datos.total} pagina={pagina} porPagina={porPagina} onCambiar={setPagina} onPorPagina={n => { setPorPagina(n); setPagina(1) }} />
      )}
      <p className="nota ddu-nota">
        Los montos incluyen IGV. Lo cobrado con tarjeta llega a tu banco según los abonos de Culqi (CulqiPanel › Abonos).
        Un pago por transferencia se registra en <Link to="/admin/planes?ver=pagos">Planes y cobros › Pagos</Link>.
      </p>
    </>
  )
}

// -----------------------------------------------------------------------------
function Reportes({ pruebas }: { pruebas: boolean }) {
  const mensaje = useMensaje()
  const [meses, setMeses] = useState(6)
  const [datos, setDatos] = useState<ReportesVentas>()
  const [fallo, setFallo] = useState<string>()
  const [bajando, setBajando] = useState(false)

  useEffect(() => {
    let vivo = true
    ventasServicio.reportes(meses, pruebas)
      .then(d => { if (vivo) { setDatos(d); setFallo(undefined) } })
      .catch(e => { if (vivo) setFallo(e instanceof ErrorApi ? e.message : 'No se pudieron leer los reportes.') })
    return () => { vivo = false }
  }, [meses, pruebas])

  async function excel() {
    setBajando(true)
    try { await ventasServicio.reportesExcel(meses, pruebas) }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo bajar el Excel.') }
    finally { setBajando(false) }
  }

  if (fallo) return <Aviso>{fallo}</Aviso>
  if (!datos) return <Cargando />
  const max = Math.max(1, ...datos.meses.map(m => m.cobrado))
  const maxPlan = Math.max(1, ...datos.planes.map(p => p.cobrado))
  const mesActual = datos.meses.at(-1)?.mes
  const nombreMes = (m: string) => MESES[Number(m.slice(5, 7)) - 1]?.slice(0, 3) ?? m

  return (
    <>
      <div className="vnt-barra-acciones">
        <select aria-label="Periodo" value={meses} onChange={e => setMeses(Number(e.target.value))}>
          <option value={6}>Últimos 6 meses</option><option value={12}>Últimos 12 meses</option><option value={24}>Últimos 24 meses</option>
        </select>
        <Boton estilo="secundario" onClick={() => void excel()} ocupado={bajando} textoOcupado="Bajando…">Descargar Excel</Boton>
      </div>
      <div className="vnt-reportes">
        <section className="bloque vnt-caja">
          <h2>Cobrado por mes</h2>
          <p className="secundario">Con IGV. El mes en curso va hasta hoy.</p>
          <div className="vnt-grafico" role="img" aria-label="Cobrado por mes">
            {datos.meses.map(m => (
              <div key={m.mes} className="vnt-col" title={`${m.pagos} pagos`}>
                <span className="vnt-valor">{m.cobrado > 0 ? `S/ ${Math.round(m.cobrado).toLocaleString('es-PE')}` : '—'}</span>
                <i className={m.mes === mesActual ? 'actual' : undefined} style={{ height: `${Math.max(2, (m.cobrado / max) * 170)}px` }} />
                <span className="vnt-mes">{nombreMes(m.mes)}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="bloque sin-relleno vnt-caja">
          <h2 className="vnt-titulo-tabla">Por plan · este mes</h2>
          {datos.planes.length === 0 ? <div className="relleno"><Vacio>Todavía no hay pagos este mes.</Vacio></div> : (
            <table className="tabla lst">
              <thead><tr><th>Plan</th><th className="derecha">Clientes</th><th className="derecha">Cobrado</th><th /></tr></thead>
              <tbody>{datos.planes.map(p => (
                <tr key={p.plan}><td><span className="vnt-plan">{p.plan}</span></td><td className="derecha">{p.clientes}</td>
                  <td className="derecha lst-precio">S/ {dinero(p.cobrado)}</td>
                  <td><div className="ddu-barra vnt-barra"><i style={{ width: `${(p.cobrado / maxPlan) * 100}%` }} /></div></td></tr>
              ))}</tbody>
            </table>
          )}
        </section>
      </div>
      <section className="bloque sin-relleno vnt-caja vnt-atrasados">
        <div className="vnt-titulo-tabla"><h2>Atrasados y en reintento</h2><span className="secundario">Los que pueden dejar de pagar: llámalos a tiempo.</span></div>
        {datos.atrasados.length === 0 ? <div className="relleno"><Vacio>Nadie está atrasado.</Vacio></div> : (
          <table className="tabla lst">
            <thead><tr><th>Cliente</th><th>Estado</th><th className="derecha">Debe</th><th>Detalle</th></tr></thead>
            <tbody>{datos.atrasados.map(a => (
              <tr key={a.cuentaId}>
                <td className="lst-nombre"><div className="principal">{a.cuenta ?? '—'}</div><div className="secundario">{[a.plan, a.tarjeta ?? 'sin tarjeta'].filter(Boolean).join(' · ')}</div></td>
                <td><span className={`ddu-estado ${a.estado === 'no_emite' ? 'mal' : 'ojo'}`}>{a.estado === 'no_emite' ? 'No emite' : a.estado === 'gracia' ? 'En gracia' : 'En reintento'}</span></td>
                <td className="derecha lst-precio">{a.debe != null ? `S/ ${dinero(a.debe)}` : '—'}</td>
                <td className="secundario">{[a.intentos > 0 ? plural(a.intentos, 'intento', 'intentos') : null, a.error, a.fallaDesde ? `desde el ${fecha(a.fallaDesde)}` : null].filter(Boolean).join(' · ')}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </>
  )
}