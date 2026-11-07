import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
import { Pestanas } from '../../../componentes/Pestanas'
import { ErrorApi } from '../../../nucleo/api/errores'
import { Permisos } from '../../../nucleo/autorizacion/permisos'
import { fecha } from '../../../nucleo/formato/fechas'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { usePestana } from '../../../nucleo/hooks/usePestana'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { NOMBRE_PLAN, diasQueFaltan, soles } from '../../../nucleo/planes/planes'
import { useSesion } from '../../../nucleo/sesion/SesionContexto'
import { useConexionSunat } from '../../../nucleo/sunat/conexionSunat'
import { ArmadorPlanes } from '../componentes/ArmadorPlanes'
import { PanelPagos } from '../componentes/PanelPagos'
import { FilaRegla, GrupoRegla } from '../componentes/Reglas'
import {
  NOMBRE_AJUSTE, NOMBRE_ESTADO, planesServicio,
  type CodigoPlan, type ConfigPlanes, type DatosPublicos, type EstadoCuenta, type PlanCatalogo, type Reglas, type ResumenCuenta, type TipoAjuste, type Tramo,
} from '../servicios/planesServicio'

const VISTAS = ['cuentas', 'armador', 'precios', 'pagos'] as const
type Filtro = 'todas' | 'negocio' | 'profesional' | 'prueba' | 'tratos' | 'acceso_total'

/**
 * 069 — PLANES Y COBROS (super administrador).
 *
 *   Interruptor general   apagados: todos ven todo y no se cobra (QA y la PC).
 *   Cuentas               todas, Negocio y Profesional: plan, lo que pagan y
 *                         «Ajustar» (su plan, acceso total y un trato especial
 *                         con fecha de fin y motivo, que queda en la bitácora).
 *   Armar los planes      menús y submenús arrastrando a Básico, Pro, Max o
 *                         «Sin plan»; antes de guardar dice a cuántas afecta.
 *   Precios y reglas      Básico/Pro/Max, tramos de la Cartera, mes gratis.
 *   Pagos (073)           el panel de pagos (Culqi, reglas de cobro, empresa
 *                         que emite el comprobante, medios) y los pagos.
 */
export function PlanesCobrosPagina() {
  const { puede } = useSesion()
  const [vista, setVista] = usePestana(VISTAS)
  const [config, setConfig] = useState<ConfigPlanes>()
  const [error, setError] = useState<string>()

  const cargar = useCallback(async () => {
    try { setConfig(await planesServicio.config()); setError(undefined) }
    catch (e) { setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar Planes y cobros.') }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  if (error) return <Aviso>{error}</Aviso>
  if (!config) return <Cargando />

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">Planes y cobros</h1>
          <p className="secundario">Todas las cuentas (Negocio y Profesional) en un solo lugar: qué plan tienen, cuánto pagan y los ajustes que les diste.</p>
        </div>
      </div>

      <Interruptor config={config} puede={puede(Permisos.Plataforma.PlanesArmar)} onCambio={cargar} />

      <Pestanas etiqueta="Planes y cobros" valor={vista} onCambio={setVista} opciones={[
        { valor: 'cuentas', texto: 'Cuentas' },
        { valor: 'armador', texto: 'Armar los planes' },
        { valor: 'precios', texto: 'Precios y reglas' },
        { valor: 'pagos', texto: 'Pagos' },
      ]} />

      {vista === 'cuentas' && <Cuentas puedeAjustar={puede(Permisos.Plataforma.PlanesDescuentos)} encendidos={config.interruptor.encendidos} />}
      {vista === 'armador' && <ArmadorPlanes puede={puede(Permisos.Plataforma.PlanesArmar)} catalogo={config.catalogo} />}
      {vista === 'precios' && <PreciosYReglas config={config} puede={puede(Permisos.Plataforma.PlanesArmar)} onHecho={cargar} />}
      {vista === 'pagos' && <PanelPagos puedeConfigurar={puede(Permisos.Plataforma.CobrosConfigurar)} puedeRegistrar={puede(Permisos.Plataforma.CobrosRegistrar)} />}
    </>
  )
}

// =============================================================================
// EL INTERRUPTOR GENERAL
// =============================================================================
function Interruptor({ config, puede, onCambio }: { config: ConfigPlanes; puede: boolean; onCambio: () => Promise<void> }) {
  const mensaje = useMensaje()
  const { refrescar } = useSesion()
  const conexion = useConexionSunat()
  const { pedir, dialogo } = useConfirmar()
  const [ocupado, setOcupado] = useState(false)
  const encendidos = config.interruptor.encendidos
  const produccion = !!conexion?.fija

  async function cambiar() {
    const ok = await pedir(encendidos
      ? {
          titulo: '¿Apagar los planes y cobros?',
          mensaje: produccion
            ? <>Estás en <strong>producción</strong>. Todas las cuentas verán todos los menús y no se cobrará nada hasta que los vuelvas a encender.</>
            : 'Todas las cuentas verán todos los menús y no se cobrará nada. Los meses gratis siguen corriendo.',
          confirmar: 'Apagar', tono: produccion ? 'peligro' : 'normal',
        }
      : {
          titulo: '¿Encender los planes y cobros?',
          mensaje: 'Cada cuenta verá solo los menús de su plan, o todo lo del Max si sigue en su mes gratis. Las que terminaron su mes gratis pasan a su plan (Básico si no eligieron otro).',
          confirmar: 'Encender',
        })
    if (!ok) return
    setOcupado(true)
    try {
      const r = await planesServicio.interruptor(!encendidos)
      mensaje.bien(r.mensaje)
      await onCambio()
      await refrescar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo cambiar.')
    } finally { setOcupado(false) }
  }

  return (
    <div className={'bloque interruptor-planes' + (encendidos ? ' encendido' : '')}>
      <div>
        <h2>Interruptor general de planes</h2>
        <p className="secundario">
          {encendidos
            ? 'Encendidos: cada cuenta ve los menús de su plan (o todo lo del Max en su mes gratis) y se cobra.'
            : 'Apagados: todas las cuentas ven todos los menús y no se cobra ni hay avisos de pago. Úsalo mientras desarrollas y pruebas. Cada cuenta nueva igual nace en Básico con su mes gratis, así que al encenderlos todo queda como debe.'}
        </p>
        <p className="nota">
          Este servidor: <strong>{produccion ? 'producción' : 'QA o desarrollo'}</strong>. En QA y en tu PC empieza apagado; en producción, encendido.
          {config.interruptor.cambiadoPor && <> Último cambio: {config.interruptor.cambiadoPor}, {fecha(config.interruptor.cambiadoEn)}.</>}
        </p>
      </div>
      <div className="interruptor-accion">
        <span className={'etiqueta ' + (encendidos ? 'acento' : 'aviso')}>{encendidos ? 'Encendidos' : 'Apagados'}</span>
        {puede && <Boton estilo={encendidos ? 'secundario' : 'principal'} ocupado={ocupado} onClick={() => void cambiar()}>
          {encendidos ? 'Apagar' : 'Encender'}
        </Boton>}
      </div>
      {dialogo}
    </div>
  )
}

// =============================================================================
// CUENTAS
// =============================================================================
function Cuentas({ puedeAjustar, encendidos }: { puedeAjustar: boolean; encendidos: boolean }) {
  const [lista, setLista] = useState<ResumenCuenta[]>()
  const [error, setError] = useState<string>()
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [buscar, setBuscar] = useState('')
  // e215: «Ajustar su cuenta» desde Empresas › Módulos llega con ?ajustar=<cuenta>.
  const [ajustando, setAjustando] = useState<string | undefined>(() => new URLSearchParams(window.location.search).get('ajustar') ?? undefined)
  const [abiertas, setAbiertas] = useState<string[]>([])
  const alternar = (id: string) => setAbiertas(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id])

  const cargar = useCallback(async () => {
    try { setLista(await planesServicio.cuentas()); setError(undefined) }
    catch (e) { setError(e instanceof ErrorApi ? e.message : 'No se pudieron cargar las cuentas.') }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    return (lista ?? []).filter(c =>
      (filtro === 'todas'
        || (filtro === 'negocio' && c.tipo === 'negocio')
        || (filtro === 'profesional' && c.tipo === 'profesional')
        || (filtro === 'prueba' && c.estado === 'prueba')
        || (filtro === 'tratos' && ['cortesia', 'meses_gratis', 'precio_especial'].includes(c.estado))
        || (filtro === 'acceso_total' && c.accesoTotal))
      && (!q || (c.titular ?? '').toLowerCase().includes(q)
              || (c.dueno?.nombre ?? '').toLowerCase().includes(q) || (c.dueno?.correo ?? '').toLowerCase().includes(q)
              || c.empresas.some(e => e.nombre.toLowerCase().includes(q) || (e.ruc ?? '').includes(q))))
  }, [lista, filtro, buscar])

  if (error) return <Aviso>{error}</Aviso>
  if (!lista) return <Cargando />

  const cuenta = (f: (c: ResumenCuenta) => boolean) => lista.filter(f).length
  const esperado = lista.reduce((s, c) => s + (c.estado === 'al_dia' || c.estado === 'precio_especial' ? c.mensual.total : 0), 0)

  return (
    <>
      <details className="explica" open>
        <summary>Cómo se lee esta pantalla</summary>
        <ul>
          <li><strong>Cuenta</strong>: quien se registró. <em>Negocio</em> = una empresa; <em>Profesional</em> = un estudio contable con su Cartera de empresas.</li>
          <li><strong>Plan</strong>: lo que contrató (Básico, Pro o Max; en la Cartera, cuántas empresas paga y cuántas subió a Pro o Max).</li>
          <li><strong>Al mes</strong>: lo que paga hoy. Tachado, el precio real cuando está pagando el de lanzamiento.</li>
          <li><strong>Estado</strong>: <em>Al día</em> paga su plan · <em>Mes gratis</em> en su primer mes · <em>Cortesía</em>, <em>Meses gratis</em> o <em>Precio especial</em> = un trato que le diste, con fecha de fin · <em>Acceso total</em> = cuenta de prueba, ve todo y no paga · <em>Planes apagados</em> = el interruptor de arriba está apagado.</li>
          <li><strong>Ajustar</strong>: cambiar su plan, darle acceso total o un trato especial. Todo queda en la bitácora.</li>
        </ul>
      </details>

      <div className="resumen-planes">
        <div><strong>{soles(esperado)}</strong><span>Cobro mensual esperado</span></div>
        <div><strong>{cuenta(c => c.estado === 'al_dia')}</strong><span>Cuentas que pagan</span></div>
        <div><strong>{cuenta(c => c.estado === 'prueba')}</strong><span>En mes gratis</span></div>
        <div><strong>{cuenta(c => ['cortesia', 'meses_gratis', 'precio_especial'].includes(c.estado))}</strong><span>Con trato especial</span></div>
        <div><strong>{cuenta(c => c.accesoTotal)}</strong><span>Cuentas de prueba (acceso total)</span></div>
      </div>
      {!encendidos && <p className="nota">Con los planes apagados nadie paga: las cifras de «al mes» son lo que pagarían al encenderlos.</p>}

      <div className="filtros-planes">
        <Pestanas<Filtro> etiqueta="Filtrar cuentas" valor={filtro} onCambio={setFiltro} opciones={[
          { valor: 'todas', texto: 'Todas', cuenta: lista.length },
          { valor: 'negocio', texto: 'Negocio', cuenta: cuenta(c => c.tipo === 'negocio') },
          { valor: 'profesional', texto: 'Profesional', cuenta: cuenta(c => c.tipo === 'profesional') },
          { valor: 'prueba', texto: 'En mes gratis', cuenta: cuenta(c => c.estado === 'prueba') },
          { valor: 'tratos', texto: 'Con trato especial', cuenta: cuenta(c => ['cortesia', 'meses_gratis', 'precio_especial'].includes(c.estado)) },
          { valor: 'acceso_total', texto: 'Cuentas de prueba', cuenta: cuenta(c => c.accesoTotal) },
        ]} />
        <input className="buscar-planes" type="search" placeholder="Buscar por nombre o RUC" value={buscar} onChange={e => setBuscar(e.target.value)} />
      </div>

      <div className="bloque sin-relleno">
        <table className="tabla">
          <thead><tr><th>Cuenta</th><th>Plan</th><th>Al mes</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {visibles.map(c => {
              const abierta = abiertas.includes(c.id)
              return (
              <Fragment key={c.id}>
              <tr>
                <td>
                  {/* 31 oct: el CLIENTE (quien se registró) arriba; sus empresas dentro. */}
                  <div className="principal">{c.dueno?.nombre ?? c.titular ?? c.empresas[0]?.nombre ?? 'Sin nombre'}</div>
                  <div className="secundario">
                    <span className={'etiqueta ' + (c.tipo === 'profesional' ? 'aviso' : 'acento')}>{c.tipo === 'profesional' ? 'Cuenta Profesional' : 'Cuenta Negocio'}</span>
                    {c.dueno?.correo && <> {c.dueno.correo}</>}
                    {c.estadoCuenta !== 'activa' && ` · ${c.estadoCuenta}`}
                  </div>
                  {c.tipo === 'negocio'
                    ? c.empresas[0] && <div className="secundario">Empresa: {c.empresas[0].nombre}{c.empresas[0].ruc && ` · RUC ${c.empresas[0].ruc}`}</div>
                    : <button type="button" className="enlace abrir-cartera" onClick={() => alternar(c.id)}>
                        {abierta ? '▾' : '▸'} Su Cartera: {c.empresas.length} empresa{c.empresas.length === 1 ? '' : 's'}
                      </button>}
                </td>
                <td><ResumenPlan c={c} /></td>
                <td>{soles(c.mensual.total)}{c.mensual.total < c.mensual.regular && c.estado === 'al_dia' && <div className="secundario"><s>{soles(c.mensual.regular)}</s></div>}</td>
                <td><EstadoCuenta c={c} /></td>
                <td><button type="button" className="enlace" onClick={() => setAjustando(c.id)}>{puedeAjustar ? 'Ajustar' : 'Ver'}</button></td>
              </tr>
              {abierta && c.empresas.map(e => (
                <tr key={e.id} className="fila-cartera">
                  <td><div className="principal">↳ {e.nombre}</div>
                    <div className="secundario">{e.ruc ? `RUC ${e.ruc}` : 'Sin RUC'}{e.esDelEstudio && ' · su propio estudio'}{e.pausada && ' · en pausa'}</div></td>
                  <td>{NOMBRE_PLAN[e.plan]}</td>
                  <td className="secundario">{e.esDelEstudio && e.plan === 'basico' ? 'Gratis' : e.plan === 'basico' ? 'En el cupo' : 'Subida'}</td>
                  <td className="secundario" colSpan={2}>{porQueVe(c, e)}</td>
                </tr>
              ))}
              {abierta && c.empresas.length === 0 && (
                <tr className="fila-cartera"><td colSpan={5} className="secundario">↳ Todavía no agregó empresas a su Cartera.</td></tr>
              )}
              </Fragment>
            )})}
            {visibles.length === 0 && <tr><td colSpan={5} className="secundario">No hay cuentas con ese filtro.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="nota">Aquí aparece toda cuenta que se registra, pague o no. Las empresas de una Cartera van dentro de su cuenta (búscalas por RUC).</p>

      {ajustando && <AjustarCuenta id={ajustando} puede={puedeAjustar} onCerrar={() => setAjustando(undefined)} onCambio={cargar} />}
    </>
  )
}

function ResumenPlan({ c }: { c: ResumenCuenta }) {
  if (c.accesoTotal) return <>Acceso total<div className="secundario">ve todos los menús</div></>
  const gratis = c.estadoEncendido === 'prueba' && diasQueFaltan(c.pruebaHasta) !== null
  if (c.tipo === 'negocio') return <>{gratis ? 'Mes gratis' : NOMBRE_PLAN[c.empresas[0]?.plan ?? 'basico']}
    {gratis && <div className="secundario">después: {NOMBRE_PLAN[c.empresas[0]?.plan ?? 'basico']}</div>}</>
  const pro = c.empresas.filter(e => e.plan === 'pro').length
  const max = c.empresas.filter(e => e.plan === 'max').length
  return <>Cartera {c.cobradas}{gratis && ' · mes gratis'}{(pro > 0 || max > 0) && <div className="secundario">{[pro && `${pro} Pro`, max && `${max} Max`].filter(Boolean).join(' · ')}</div>}</>
}

function EstadoCuenta({ c }: { c: ResumenCuenta }) {
  const dias = diasQueFaltan(c.pruebaHasta)
  const vigente = c.ajustes.find(a => a.vigente)
  const tono = c.estado === 'al_dia' ? 'acento' : c.estado === 'apagado' ? '' : 'aviso'
  return (
    <>
      <span className={'etiqueta ' + tono}>{NOMBRE_ESTADO[c.estado]}</span>
      {c.estado === 'apagado' && (
        <div className="secundario">Encendidos: {NOMBRE_ESTADO[c.estadoEncendido].toLowerCase()}
          {c.estadoEncendido === 'prueba' && dias !== null && ` (${dias} día${dias === 1 ? '' : 's'})`}</div>
      )}
      <div className="secundario">
        {c.estado === 'prueba' && dias !== null && `Termina en ${dias} día${dias === 1 ? '' : 's'}`}
        {c.estado === 'acceso_total' && (c.accesoTotalMotivo ?? 'Cuenta de prueba')}
        {vigente && ['cortesia', 'meses_gratis', 'precio_especial'].includes(c.estado) && `hasta ${fecha(vigente.hasta)}`}
      </div>
      {c.canceladoEn && <div className="texto-peligro">Canceló el {fecha(c.canceladoEn)}{c.activoHasta ? ` · activo hasta el ${fecha(c.activoHasta)}` : ''}{c.canceladoMotivo ? ` · «${c.canceladoMotivo}»` : ''}</div>}
    </>
  )
}

const hoyMas = (dias: number) => {
  const d = new Date(Date.now() + dias * 86_400_000)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
}

function AjustarCuenta({ id, puede, onCerrar, onCambio }: { id: string; puede: boolean; onCerrar: () => void; onCambio: () => Promise<void> }) {
  const mensaje = useMensaje()
  const [c, setC] = useState<ResumenCuenta>()
  const [ocupado, setOcupado] = useState<string>()
  const [tipo, setTipo] = useState<TipoAjuste>('cortesia')
  const [plan, setPlan] = useState<CodigoPlan>('pro')
  const [meses, setMeses] = useState(1)
  const [precio, setPrecio] = useState('')
  const [hasta, setHasta] = useState(hoyMas(90))
  const [motivo, setMotivo] = useState('')
  const [motivoTotal, setMotivoTotal] = useState('Cuenta de prueba')
  const [lanzamiento, setLanzamiento] = useState('')
  const [cupos, setCupos] = useState('')
  const [error, setError] = useState<string>()

  const cargar = useCallback(async () => {
    try { const r = await planesServicio.cuenta(id); setC(r); setCupos(String(r.cupos ?? r.cobradas)); setError(undefined) }
    catch (e) { setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar la cuenta.') }
  }, [id])
  useEffect(() => { void cargar() }, [cargar])

  async function hacer(clave: string, f: () => Promise<{ mensaje: string }>, despues?: () => void) {
    setOcupado(clave)
    try { mensaje.bien((await f()).mensaje); despues?.(); await cargar(); await onCambio() }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo guardar.') }
    finally { setOcupado(undefined) }
  }

  return (
    <Dialogo titulo={c ? `Ajustar · ${c.titular ?? c.empresas[0]?.nombre ?? 'cuenta'}` : 'Ajustar cuenta'} abierto ancho="grande" onCerrar={onCerrar}
             acciones={<Boton estilo="secundario" onClick={onCerrar}>Cerrar</Boton>}>
      {error ? <Aviso>{error}</Aviso> : !c ? <Cargando /> : (
        <div className="ajustar-cuenta">
          {/* ---- 1. Plan contratado y lo que ve hoy -------------------------- */}
          <section>
            <h3><span className="numero-paso">1</span> Su plan y lo que ve hoy</h3>
            <div className="explica">
              <p><strong>Plan contratado</strong> (Básico, Pro o Max): lo que el cliente eligió y <strong>lo que paga</strong>.
                Lo elige el cliente en «Mi plan»; aquí lo puedes cambiar tú.</p>
              <p><strong>Ve hoy</strong>: los menús que de verdad le salen. Puede ser más que su plan mientras tenga algo a su favor:
                los planes apagados, su mes gratis, una cortesía o un plan mejor, o el acceso total. La columna «Por qué» lo dice.
                Cuando eso termina, vuelve solo a su plan contratado.</p>
            </div>
            <dl className="datos-ajuste">
              <dt>Cliente</dt><dd>{c.dueno ? <>{c.dueno.nombre} · {c.dueno.correo}</> : (c.titular ?? '—')}</dd>
              <dt>Tipo de cuenta</dt><dd>{c.tipo === 'profesional' ? `Profesional (Cartera): paga ${c.cobradas} empresas y usa ${c.usados}` : 'Negocio (una empresa)'}</dd>
              <dt>Paga hoy</dt><dd><strong>{soles(c.mensual.total)}</strong> al mes — {EXPLICA_ESTADO[c.estado]}</dd>
              {c.estado === 'apagado' && <><dt>Encendidos</dt><dd>pagaría <strong>{soles(c.totalEncendido)}</strong> al mes — {EXPLICA_ESTADO[c.estadoEncendido]}</dd></>}
              {c.estado !== 'al_dia' && c.estado !== 'precio_especial' && c.estado !== 'apagado' && c.mensual.base + c.mensual.extras > 0 &&
                <><dt>Pagaría</dt><dd>{soles(c.mensual.base + c.mensual.extras)} al mes con su plan, cuando termine lo de arriba</dd></>}
              {c.pruebaHasta && <><dt>Mes gratis</dt><dd>{diasQueFaltan(c.pruebaHasta) !== null ? `hasta el ${fecha(c.pruebaHasta)}` : `terminó el ${fecha(c.pruebaHasta)}`}</dd></>}
              <dt>Medio de pago</dt><dd>Sin tarjeta todavía (el cobro con tarjeta llega en la entrega de Cobros)</dd>
            </dl>
            <table className="tabla compacta">
              <thead><tr><th>Empresa</th><th>Plan contratado (paga)</th><th>Ve hoy</th><th>Por qué</th></tr></thead>
              <tbody>
                {c.empresas.map(e => (
                  <tr key={e.id}>
                    <td><div className="principal">{e.nombre}</div><div className="secundario">{e.ruc ?? 'Sin RUC'}{e.esDelEstudio && ' · su estudio'}{e.pausada && ' · en pausa'}</div></td>
                    <td>
                      {puede ? (
                        <select value={e.plan} disabled={ocupado === e.id} aria-label={`Plan de ${e.nombre}`}
                                onChange={ev => void hacer(e.id, () => planesServicio.planEmpresa(e.id, ev.target.value as CodigoPlan))}>
                          <option value="basico">Básico</option><option value="pro">Pro</option><option value="max">Max</option>
                        </select>
                      ) : NOMBRE_PLAN[e.plan]}
                      {e.pruebaHasta && diasQueFaltan(e.pruebaHasta) !== null && <div className="secundario">desde el {fecha(e.pruebaHasta)}, al terminar su mes gratis</div>}
                    </td>
                    <td><strong>{e.efectivo === 'todo' ? 'Todos los menús' : NOMBRE_PLAN[e.efectivo]}</strong>
                      {!c.encendidos && <div className="secundario">Encendidos vería: {e.efectivoEncendido === 'todo' ? 'todo' : NOMBRE_PLAN[e.efectivoEncendido]}</div>}</td>
                    <td className="secundario">{porQueVe(c, e)}</td>
                  </tr>
                ))}
                {c.empresas.length === 0 && <tr><td colSpan={4} className="secundario">Todavía no agregó empresas.</td></tr>}
              </tbody>
            </table>
            {puede && c.tipo === 'profesional' && (
              <div className="cupos-ajuste">
                <span className="rotulo">Empresas que paga la Cartera (cupos)</span>
                <div className="cupos-fila">
                  <span className="con-unidad">
                    <input type="number" min={c.minimo} value={cupos} onChange={e => setCupos(e.target.value)} aria-label="Cupos" />
                    <em>empresas</em>
                  </span>
                  <Boton estilo="secundario" ocupado={ocupado === 'cupos'} disabled={!Number(cupos) || Number(cupos) === c.cupos}
                         onClick={() => void hacer('cupos', () => planesServicio.cuposCuenta(c.id, Number(cupos)))}>Guardar cupos</Boton>
                </div>
                <span className="pista">
                  Paga estas empresas aunque use menos (hoy usa {c.usados}{c.empresas.some(e => e.esDelEstudio) ? ', sin contar su propio estudio' : ''}).
                  El mínimo es {c.minimo}: con menos, igual se cobran {c.minimo}.
                  {c.cupos === null && ` Todavía no eligió: hoy se le cobrarían ${c.cobradas}.`}
                </span>
              </div>
            )}
          </section>

          {/* ---- 079. Precio de lanzamiento de esta cuenta --------------------- */}
          <section>
            <h3>Precio de lanzamiento</h3>
            <div className="fila-ajuste">
              {c.lanzamientoHasta && c.lanzamientoHasta >= hoyMas(0)
                ? <span className="etiqueta acento">Paga el precio de lanzamiento hasta el {fecha(c.lanzamientoHasta)}</span>
                : <span className="etiqueta">{c.ofertaGeneral ? 'Paga el precio de lanzamiento mientras dure la oferta' : 'Paga el precio real'}</span>}
              {puede && <>
                <label className="campo"><span className="rotulo">Conservarlo hasta</span>
                  <input type="date" value={lanzamiento} onChange={e => setLanzamiento(e.target.value)} /></label>
                <Boton estilo="secundario" ocupado={ocupado === 'lanzamiento'} disabled={!lanzamiento}
                       onClick={() => void hacer('lanzamiento', () => planesServicio.lanzamiento(c.id, lanzamiento))}>Guardar fecha</Boton>
                {c.lanzamientoHasta && <Boton estilo="plano" ocupado={ocupado === 'sin-lanzamiento'}
                       onClick={() => void hacer('sin-lanzamiento', () => planesServicio.lanzamiento(c.id, null))}>Quitar (paga el real)</Boton>}
              </>}
            </div>
            <p className="secundario">Quien se registra durante la oferta lo conserva los meses que digan las reglas, aunque la oferta termine.</p>
          </section>

          {/* ---- 2. Acceso total -------------------------------------------- */}
          <section>
            <h3><span className="numero-paso">2</span> Acceso total (cuentas de prueba)</h3>
            <div className="comparar-acceso">
              <div>
                <strong>Con su plan</strong>
                <ul><li>Ve solo los menús de su plan (Básico, Pro o Max).</li><li>Paga su plan, tiene su mes gratis y sus avisos de pago.</li><li>Es lo normal para un cliente.</li></ul>
              </div>
              <div>
                <strong>Con acceso total</strong>
                <ul><li>Ve <strong>todos</strong> los menús, también lo que está «Sin plan» (lo nuevo).</li><li>No paga nada y no tiene fecha de fin.</li><li>Para tus cuentas de prueba o internas, no para clientes (para un cliente usa un trato especial con fecha).</li></ul>
              </div>
            </div>
            {c.accesoTotal ? (
              <div className="fila-ajuste">
                <span className="etiqueta acento">Activado · {c.accesoTotalMotivo}</span>
                {puede && <Boton estilo="secundario" ocupado={ocupado === 'total'} onClick={() => void hacer('total', () => planesServicio.accesoTotal(c.id, false, ''))}>Quitar (vuelve a su plan)</Boton>}
              </div>
            ) : (
              <div className="fila-ajuste">
                <span className="etiqueta">No activado: usa su plan</span>
                {puede && <>
                  <label className="campo"><span className="rotulo">Para qué es</span>
                    <input value={motivoTotal} maxLength={300} onChange={e => setMotivoTotal(e.target.value)} /></label>
                  <Boton estilo="secundario" ocupado={ocupado === 'total'} disabled={motivoTotal.trim().length < 3}
                         onClick={() => void hacer('total', () => planesServicio.accesoTotal(c.id, true, motivoTotal.trim()))}>Dar acceso total</Boton>
                </>}
              </div>
            )}
          </section>

          {/* ---- 3. Trato especial ------------------------------------------ */}
          {puede && (
            <section>
              <h3><span className="numero-paso">3</span> Trato especial (con fecha de fin)</h3>
              <p className="secundario">Para un cliente real: un regalo o un descuento que termina solo en la fecha que pongas. Al terminar, vuelve a su plan y a su precio.</p>
              <table className="tabla compacta tabla-tratos">
                <thead><tr><th>Qué le das</th><th>Qué ve</th><th>Qué paga</th><th>Ejemplo</th></tr></thead>
                <tbody>
                  {(Object.keys(NOMBRE_AJUSTE) as TipoAjuste[]).map(t => (
                    <tr key={t} className={t === tipo ? 'elegida' : undefined} onClick={() => setTipo(t)}>
                      <td><label><input type="radio" name="tipo-ajuste" checked={t === tipo} onChange={() => setTipo(t)} /> {NOMBRE_AJUSTE[t]}</label></td>
                      <td>{EXPLICA_AJUSTE[t].ve}</td><td>{EXPLICA_AJUSTE[t].paga}</td><td className="secundario">{EXPLICA_AJUSTE[t].ejemplo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="rejilla-ajuste">
                {(tipo === 'cortesia' || tipo === 'plan_mejor') && (
                  <label className="campo"><span className="rotulo">Plan que verá</span>
                    <select value={plan} onChange={e => setPlan(e.target.value as CodigoPlan)}>
                      <option value="basico">Básico</option><option value="pro">Pro</option><option value="max">Max</option>
                    </select></label>
                )}
                {tipo === 'meses_gratis' && (
                  <label className="campo"><span className="rotulo">Cuántos meses</span>
                    <input type="number" min={1} max={24} value={meses} onChange={e => setMeses(Number(e.target.value) || 1)} /></label>
                )}
                {tipo === 'precio_especial' && (
                  <label className="campo"><span className="rotulo">Precio al mes</span>
                    <span className="con-moneda"><b>S/</b><input type="number" min={0} step="0.01" value={precio} onChange={e => setPrecio(e.target.value)} /></span></label>
                )}
                <label className="campo"><span className="rotulo">Termina el</span>
                  <input type="date" value={hasta} min={hoyMas(0)} onChange={e => setHasta(e.target.value)} /></label>
              </div>
              <label className="campo"><span className="rotulo">Motivo (queda en la bitácora con tu nombre)</span>
                <input value={motivo} maxLength={500} placeholder="Por ejemplo: me ayudó con SUNAT" onChange={e => setMotivo(e.target.value)} /></label>
              <Boton ocupado={ocupado === 'ajuste'}
                     disabled={motivo.trim().length < 5 || !hasta || (tipo === 'precio_especial' && precio === '')}
                     onClick={() => void hacer('ajuste', () => planesServicio.ajustar(c.id, {
                       tipo, plan: tipo === 'cortesia' || tipo === 'plan_mejor' ? plan : null,
                       meses: tipo === 'meses_gratis' ? meses : null,
                       precio: tipo === 'precio_especial' ? Number(precio) : null, hasta, motivo: motivo.trim(),
                     }), () => setMotivo(''))}>Guardar trato especial</Boton>
            </section>
          )}

          {/* ---- 4. Historial ------------------------------------------------ */}
          <section>
            <h3><span className="numero-paso">{puede ? 4 : 3}</span> Tratos que tuvo</h3>
            {c.ajustes.length === 0 ? <p className="secundario">Ninguno.</p> : (
              <ul className="lista-ajustes">
                {c.ajustes.map(a => (
                  <li key={a.id} className={a.vigente ? undefined : 'apagado'}>
                    <div>
                      <strong>{NOMBRE_AJUSTE[a.tipo]}</strong>
                      {a.plan && ` ${NOMBRE_PLAN[a.plan]}`}{a.meses && ` · ${a.meses} mes${a.meses === 1 ? '' : 'es'}`}{a.precio !== null && ` · ${soles(a.precio)}/mes`}
                      {' · hasta '}{fecha(a.hasta)}{a.vigente ? ' · vigente' : ''}
                      <div className="secundario">{a.motivo}{a.anuladoEn && ` · quitado el ${fecha(a.anuladoEn)}: ${a.anuladoMotivo}`}</div>
                    </div>
                    {puede && a.vigente && (
                      <button type="button" className="enlace" disabled={ocupado === a.id}
                              onClick={() => void hacer(a.id, () => planesServicio.anularAjuste(a.id, 'Quitado desde Planes y cobros'))}>Quitar antes de tiempo</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Dialogo>
  )
}

/** Qué significa el estado de lo que paga, en una frase. */
const EXPLICA_ESTADO: Record<EstadoCuenta, string> = {
  apagado: 'los planes están apagados: nadie paga y todos ven todo.',
  acceso_total: 'tiene acceso total (cuenta de prueba): no paga.',
  prueba: 'está en su mes gratis.',
  cortesia: 'tiene una cortesía: no paga hasta su fecha.',
  meses_gratis: 'tiene meses gratis: no paga hasta su fecha.',
  precio_especial: 'paga un precio especial hasta su fecha.',
  al_dia: 'paga su plan.',
}

const EXPLICA_AJUSTE: Record<TipoAjuste, { ve: string; paga: string; ejemplo: string }> = {
  cortesia:        { ve: 'El plan que elijas',  paga: 'Nada',                  ejemplo: 'Tu contador: Pro gratis hasta marzo' },
  plan_mejor:      { ve: 'El plan que elijas',  paga: 'Su plan de siempre',    ejemplo: 'Paga Básico y le das Max 2 meses para que lo pruebe' },
  meses_gratis:    { ve: 'Su plan',             paga: 'Nada',                  ejemplo: 'Le regalas 2 meses por recomendar a otro' },
  precio_especial: { ve: 'Su plan',             paga: 'El precio que pongas',  ejemplo: 'Un conocido paga S/ 20 en vez de S/ 39' },
  ampliar_prueba:  { ve: 'Lo del mes gratis',   paga: 'Nada',                  ejemplo: 'Su mes gratis termina hoy y necesita 2 semanas más' },
}

/** Por qué una empresa ve lo que ve (para la columna «Por qué»). */
function porQueVe(c: ResumenCuenta, e: ResumenCuenta['empresas'][number]): string {
  // Con los planes apagados todos ven todo; se explica lo que vería encendidos.
  const razon = (() => {
    if (c.accesoTotal) return 'Tiene acceso total (cuenta de prueba)'
    if (e.pruebaHasta && diasQueFaltan(e.pruebaHasta) !== null)
      return `Mes gratis${e.pruebaMotivo === 'ruc_nuevo' ? ' por RUC nuevo' : ''} hasta el ${fecha(e.pruebaHasta)}`
    const vigente = c.ajustes.find(a => a.vigente && (a.tipo === 'ampliar_prueba' || ((a.tipo === 'cortesia' || a.tipo === 'plan_mejor') && a.plan === e.efectivoEncendido)))
    if (vigente && e.efectivoEncendido !== e.plan) return `${NOMBRE_AJUSTE[vigente.tipo]} hasta el ${fecha(vigente.hasta)}`
    if (c.tipo === 'profesional' && e.pruebaHasta) return 'Su mes gratis ya terminó: su plan contratado'
    if (c.tipo === 'profesional' && !e.pruebaHasta && !e.esDelEstudio) return 'Sin mes gratis (pasó el tope de la Cartera): su plan contratado'
    return 'Su plan contratado'
  })()
  return c.encendidos ? razon : `Planes apagados: hoy ve todo. Encendidos: ${razon.charAt(0).toLowerCase() + razon.slice(1)}`
}

// =============================================================================
// PRECIOS Y REGLAS — en pestañas: Planes · Tramos de la Cartera · Mes gratis y reglas
// =============================================================================
type VistaPrecios = 'planes' | 'tramos' | 'reglas' | 'publica'

function PreciosYReglas({ config, puede, onHecho }: { config: ConfigPlanes; puede: boolean; onHecho: () => Promise<void> }) {
  const mensaje = useMensaje()
  const [vista, setVista] = useState<VistaPrecios>('planes')
  const [planes, setPlanes] = useState<PlanCatalogo[]>(config.catalogo.planes)
  const [tramos, setTramos] = useState<Tramo[]>(config.catalogo.tramos)
  const [reglas, setReglas] = useState<Reglas>(config.catalogo.reglas)
  const [ocupado, setOcupado] = useState<string>()

  const num = (v: string) => v === '' ? null : Number(v)
  const cambiarPlan = (i: number, campo: keyof PlanCatalogo, v: number | null) =>
    setPlanes(ps => ps.map((p, j) => j === i ? { ...p, [campo]: v } : p))
  const cambiarTramo = (i: number, campo: keyof Tramo, v: number | null) =>
    setTramos(ts => ts.map((t, j) => j === i ? { ...t, [campo]: v } : t))
  const regla = <K extends keyof Reglas>(k: K, v: Reglas[K]) => setReglas(r => ({ ...r, [k]: v }))

  async function guardar(clave: string, f: () => Promise<{ mensaje: string }>) {
    setOcupado(clave)
    try { mensaje.bien((await f()).mensaje); await onHecho() }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo guardar.') }
    finally { setOcupado(undefined) }
  }
  const guardarPrecios = () => guardar('precios', () => planesServicio.precios(
    planes.map(p => ({ codigo: p.codigo, precioRegular: p.precioRegular, precioOferta: p.precioOferta, sucursalesMax: p.sucursalesMax,
                       carteraExtraRegular: p.carteraExtraRegular, carteraExtraOferta: p.carteraExtraOferta })),
    tramos))

  // Ejemplo con los tramos escritos (sin guardar): cuánto paga una Cartera de 12.
  const ejemplo = 12
  const ejemploTotal = tramos.reduce((s, t) => {
    if (t.desde > ejemplo) return s
    return s + Math.max(0, Math.min(ejemplo, t.hasta ?? ejemplo) - t.desde + 1) * t.precioOferta
  }, 0)

  return (
    <>
      <Pestanas<VistaPrecios> etiqueta="Precios y reglas" valor={vista} onCambio={setVista} opciones={[
        { valor: 'planes', texto: 'Precios de Básico, Pro y Max' },
        { valor: 'tramos', texto: 'Precio de la Cartera' },
        { valor: 'reglas', texto: 'Mes gratis y otras reglas' },
        { valor: 'publica', texto: 'Página pública' },
      ]} />

      {vista === 'planes' && (
        <div className="bloque">
          <p className="secundario">
            Lo que paga al mes una <strong>Cuenta Negocio</strong> por su empresa. El cliente ve el precio real tachado y paga el de
            lanzamiento mientras dure la oferta (fecha en «Mes gratis y otras reglas»). Todos los montos son en soles, con IGV.
          </p>
          <div className="tarjetas-precio">
            {planes.map((p, i) => (
              <div key={p.codigo} className="tarjeta-precio">
                <h3>{p.nombre}</h3>
                <CampoPrecio etiqueta="Precio real (va tachado)" pista="al mes" valor={p.precioRegular} disabled={!puede}
                             onCambio={v => cambiarPlan(i, 'precioRegular', v ?? 0)} />
                <CampoPrecio etiqueta="Precio de lanzamiento (el que paga)" pista="al mes · vacío = paga el real" valor={p.precioOferta} disabled={!puede}
                             onCambio={v => cambiarPlan(i, 'precioOferta', v)} />
                <label className="campo-regla">
                  <span className="rotulo">Sucursales permitidas</span>
                  <span className="con-unidad">
                    <input type="number" min={1} step={1} disabled={!puede} placeholder="sin límite" value={p.sucursalesMax ?? ''}
                           onChange={e => cambiarPlan(i, 'sucursalesMax', num(e.target.value))} />
                    <em>sucursales · vacío = ilimitadas</em>
                  </span>
                </label>
                <div className="subgrupo-precio">
                  <span className="rotulo">En la Cartera (Cuenta Profesional)</span>
                  <p className="pista">{p.codigo === 'basico'
                    ? 'Cada empresa de la Cartera ya viene en Básico: no se suma nada.'
                    : `Lo que se suma al mes por cada empresa de la Cartera que sube a ${p.nombre}.`}</p>
                  {p.codigo !== 'basico' && <>
                  <CampoPrecio etiqueta="Subir a este plan · real" pista="por empresa, al mes" valor={p.carteraExtraRegular} disabled={!puede}
                               onCambio={v => cambiarPlan(i, 'carteraExtraRegular', v ?? 0)} />
                  <CampoPrecio etiqueta="Subir a este plan · lanzamiento" pista="por empresa, al mes" valor={p.carteraExtraOferta} disabled={!puede}
                               onCambio={v => cambiarPlan(i, 'carteraExtraOferta', v)} />
                  </>}
                </div>
              </div>
            ))}
          </div>
          {puede && <div className="acciones-bloque"><Boton ocupado={ocupado === 'precios'} onClick={() => void guardarPrecios()}>Guardar precios</Boton></div>}
        </div>
      )}

      {vista === 'tramos' && (
        <div className="bloque">
          <p className="secundario">
            Lo que paga al mes la <strong>Cartera</strong> (Cuenta Profesional) por cada empresa, en Básico. Es escalonado: cada
            empresa paga el precio de su tramo. Con los precios de abajo, una Cartera de {ejemplo} empresas paga{' '}
            <strong>{soles(ejemploTotal)}</strong> al mes (precio de lanzamiento).
          </p>
          <table className="tabla compacta tabla-tramos">
            <thead><tr><th>Empresas del tramo</th><th>Precio que paga hoy (lanzamiento), por empresa</th><th>Precio real, por empresa (se ve tachado)</th><th /></tr></thead>
            <tbody>
              {tramos.map((t, i) => (
                <tr key={i}>
                  <td>
                    <span className="rango-tramo">
                      de la <input type="number" min={1} step={1} disabled={!puede || i === 0} value={t.desde} aria-label="Desde"
                                   onChange={e => cambiarTramo(i, 'desde', Number(e.target.value))} />
                      a la <input type="number" min={1} step={1} disabled={!puede} placeholder="∞" value={t.hasta ?? ''} aria-label="Hasta"
                                  onChange={e => cambiarTramo(i, 'hasta', num(e.target.value))} />
                    </span>
                    {t.hasta === null && <div className="pista">en adelante</div>}
                  </td>
                  <td><CampoSoles valor={t.precioOferta} disabled={!puede} onCambio={v => cambiarTramo(i, 'precioOferta', v ?? 0)} /></td>
                  <td><CampoSoles valor={t.precioRegular} disabled={!puede} onCambio={v => cambiarTramo(i, 'precioRegular', v ?? 0)} /></td>
                  <td>{puede && tramos.length > 1 && <button type="button" className="enlace" onClick={() => setTramos(ts => ts.filter((_, j) => j !== i))}>Quitar</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pista">Los tramos van seguidos (1 a 5, 6 a 10…) y el último no tiene fin. Las subidas a Pro y Max se cobran aparte (pestaña «Precios de Básico, Pro y Max»).</p>
          {puede && (
            <div className="acciones-bloque">
              <Boton estilo="plano" onClick={() => setTramos(ts => {
                const ultimo = ts[ts.length - 1]
                const desde = (ultimo?.hasta ?? (ultimo ? ultimo.desde + 9 : 0)) + 1
                return [...ts.map((t, j) => j === ts.length - 1 && t.hasta === null ? { ...t, hasta: desde - 1 } : t),
                        { desde, hasta: null, precioOferta: ultimo?.precioOferta ?? 10, precioRegular: ultimo?.precioRegular ?? 15 }]
              })}>Agregar tramo</Boton>
              <Boton ocupado={ocupado === 'precios'} onClick={() => void guardarPrecios()}>Guardar precios de la Cartera</Boton>
            </div>
          )}
        </div>
      )}

      {vista === 'publica' && <PaginaPublica inicial={config.publica} puede={puede} onHecho={onHecho} />}

      {vista === 'reglas' && (
        <div className="bloque reglas-planes">
          <GrupoRegla titulo="Mes gratis de una cuenta nueva" texto="Toda cuenta nueva (Negocio o Profesional) lo tiene una vez, desde que se crea, aunque los planes estén apagados.">
            <FilaRegla etiqueta="Qué ve en su mes gratis" ayuda="Los menús que tiene durante el mes gratis. Max = prueba todo (inventario, caja, lotes…) y al terminar elige; Básico = solo emitir. Al terminar, cada uno pasa al plan que eligió (Básico si no eligió).">
              <select disabled={!puede} value={reglas.planPrueba ?? 'max'} onChange={e => regla('planPrueba', e.target.value as CodigoPlan)}>
                <option value="max">Max (todo)</option><option value="pro">Pro</option><option value="basico">Básico (solo emitir)</option>
              </select>
            </FilaRegla>
            <FilaRegla etiqueta="Duración" ayuda="Cuántos días dura el mes gratis.">
              <span className="con-unidad"><input type="number" min={0} max={365} disabled={!puede} value={reglas.diasPrueba}
                onChange={e => regla('diasPrueba', Number(e.target.value))} /><em>días</em></span>
            </FilaRegla>
            <FilaRegla etiqueta="Empresas con mes gratis en la Cartera" ayuda="Solo para el mes gratis: en una Cuenta Profesional, cuántas de sus empresas lo reciben con todo lo del Max. Ejemplo: con 10, si agrega 14 empresas en su primer mes, 10 van gratis y las otras 4 pagan desde el primer día.">
              <span className="con-unidad"><input type="number" min={0} disabled={!puede} value={reglas.pruebaCarteraEmpresas}
                onChange={e => regla('pruebaCarteraEmpresas', Number(e.target.value))} /><em>empresas</em></span>
            </FilaRegla>
          </GrupoRegla>

          <GrupoRegla titulo="Mes gratis por RUC nuevo" texto="Solo Cuenta Profesional, después de su mes gratis: cada RUC que se suma a la Cartera por primera vez tiene un mes gratis. Un RUC lo tiene una sola vez en la vida.">
            <FilaRegla etiqueta="Activado" ayuda="Si lo apagas, los RUC nuevos pagan desde el primer día.">
              <label className="interruptor-chico"><input type="checkbox" disabled={!puede} checked={reglas.rucGratisActivo}
                onChange={e => regla('rucGratisActivo', e.target.checked)} /><span>{reglas.rucGratisActivo ? 'Sí' : 'No'}</span></label>
            </FilaRegla>
            <FilaRegla etiqueta="Tope al mes" ayuda="Cuántos RUC nuevos gratis puede sumar cada cuenta en un mes (para que no se abuse).">
              <span className="con-unidad"><input type="number" min={0} max={100} disabled={!puede || !reglas.rucGratisActivo} value={reglas.rucGratisTope}
                onChange={e => regla('rucGratisTope', Number(e.target.value))} /><em>RUC por cuenta, al mes</em></span>
            </FilaRegla>
          </GrupoRegla>

          <GrupoRegla titulo="Cartera" texto="Para lo que paga la Cuenta Profesional. No tiene que ver con el mes gratis.">
            <FilaRegla etiqueta="Mínimo de empresas que se paga" ayuda="La Cartera paga al menos esta cantidad de empresas, aunque tenga menos. Ejemplo: con 2, un estudio con una sola empresa paga 2 (si solo va a tener una, le conviene la Cuenta Negocio).">
              <span className="con-unidad"><input type="number" min={1} disabled={!puede} value={reglas.carteraMinimo}
                onChange={e => regla('carteraMinimo', Number(e.target.value))} /><em>empresas</em></span>
            </FilaRegla>
          </GrupoRegla>

          <GrupoRegla titulo="Precios" texto="Para todos los planes y la Cartera.">
            <FilaRegla etiqueta="Oferta (precio de lanzamiento)" ayuda="Encendida: se muestra el precio real tachado y se cobra el de lanzamiento hasta la fecha de fin. Apagada: solo el precio real.">
              <label className="interruptor-chico"><input type="checkbox" disabled={!puede} checked={reglas.ofertaActiva ?? true}
                onChange={e => regla('ofertaActiva', e.target.checked)} /><span>{(reglas.ofertaActiva ?? true) ? 'Encendida' : 'Apagada'}</span></label>
            </FilaRegla>
            <FilaRegla etiqueta="Fin de la oferta" ayuda="El último día con precio de lanzamiento. Llegado ese día termina sola, aunque siga encendida. Indecopi pide que toda oferta diga hasta cuándo.">
              <input type="date" disabled={!puede || !(reglas.ofertaActiva ?? true)} value={reglas.ofertaHasta ?? ''} onChange={e => regla('ofertaHasta', e.target.value || null)} />
            </FilaRegla>
            <FilaRegla etiqueta="Quien entra en la oferta la conserva" ayuda="Una cuenta que se registra mientras hay oferta sigue pagando el precio de lanzamiento estos meses, aunque la oferta termine. 0 = la pierde al terminar la oferta.">
              <span className="con-unidad"><input type="number" min={0} max={60} disabled={!puede} value={reglas.lanzamientoMeses ?? 12}
                onChange={e => regla('lanzamientoMeses', Number(e.target.value))} /><em>meses</em></span>
            </FilaRegla>
            <FilaRegla etiqueta="Meses gratis del pago anual" ayuda="Quien paga el año completo paga 12 menos estos meses (2 = paga 10).">
              <span className="con-unidad"><input type="number" min={0} max={11} disabled={!puede} value={reglas.anualMesesGratis}
                onChange={e => regla('anualMesesGratis', Number(e.target.value))} /><em>meses</em></span>
            </FilaRegla>
          </GrupoRegla>

          {puede && <div className="acciones-bloque"><Boton ocupado={ocupado === 'reglas'} onClick={() => void guardar('reglas', () => planesServicio.reglas(reglas))}>Guardar reglas</Boton></div>}
        </div>
      )}
    </>
  )
}

function CampoSoles({ valor, disabled, onCambio }: { valor: number | null; disabled?: boolean; onCambio: (v: number | null) => void }) {
  return (
    <span className="con-moneda">
      <b>S/</b>
      <input type="number" min={0} step="0.01" disabled={disabled} value={valor ?? ''}
             onChange={e => onCambio(e.target.value === '' ? null : Number(e.target.value))} />
    </span>
  )
}

function CampoPrecio({ etiqueta, pista, valor, disabled, onCambio }: {
  etiqueta: string; pista: string; valor: number | null; disabled?: boolean; onCambio: (v: number | null) => void
}) {
  return (
    <label className="campo-regla">
      <span className="rotulo">{etiqueta}</span>
      <span className="con-unidad"><CampoSoles valor={valor} disabled={disabled} onCambio={onCambio} /><em>{pista}</em></span>
    </label>
  )
}

// 073: GrupoRegla y FilaRegla viven ahora en ../componentes/Reglas.tsx (las usa también el panel de pagos).

// =============================================================================
// 074: LA PÁGINA PÚBLICA — los datos de Reyban que se muestran sin sesión
// =============================================================================
function PaginaPublica({ inicial, puede, onHecho }: { inicial: DatosPublicos; puede: boolean; onHecho: () => Promise<void> }) {
  const mensaje = useMensaje()
  const [d, setD] = useState<DatosPublicos>(inicial)
  const [ocupado, setOcupado] = useState(false)
  const cambia = <K extends keyof DatosPublicos>(k: K, v: DatosPublicos[K]) => setD(x => ({ ...x, [k]: v }))
  async function guardar() {
    setOcupado(true)
    try { mensaje.bien((await planesServicio.paginaPublica(d)).mensaje); await onHecho() }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo guardar.') }
    finally { setOcupado(false) }
  }
  return (
    <div className="bloque reglas-planes sin-mayusculas">
      <p className="secundario">
        La página que se ve <strong>sin iniciar sesión</strong>: inicio, precios, términos, privacidad, devoluciones y contacto. La
        piden <strong>Culqi</strong> (para aprobar tu cuenta) y <strong>Google</strong> (para «Entrar con Google»). Los precios salen
        solos de las otras pestañas; aquí van los datos de tu empresa. Se ve en <code>/conoce</code> y, en la dirección
        <code> facturacion.reybanconsulting.com</code>, también en la raíz.
      </p>
      <p><a href="/conoce" target="_blank" rel="noreferrer">Ver la página pública →</a> · <a href="/precios" target="_blank" rel="noreferrer">Precios</a> ·{' '}
        <a href="/terminos" target="_blank" rel="noreferrer">Términos</a> · <a href="/privacidad" target="_blank" rel="noreferrer">Privacidad</a> ·{' '}
        <a href="/devoluciones" target="_blank" rel="noreferrer">Devoluciones</a> · <a href="/contacto" target="_blank" rel="noreferrer">Contacto</a></p>
      <GrupoRegla titulo="Tu empresa" texto="Sale en el pie de cada página, en Contacto y dentro de los textos legales.">
        <FilaRegla etiqueta="Razón social" ayuda="Tal como está en tu ficha RUC.">
          <input className="ancho" maxLength={200} disabled={!puede} value={d.razonSocial} onChange={e => cambia('razonSocial', e.target.value)} />
        </FilaRegla>
        <FilaRegla etiqueta="RUC" ayuda="Culqi lo revisa. Se valida el dígito verificador.">
          <input inputMode="numeric" maxLength={11} disabled={!puede} value={d.ruc ?? ''} onChange={e => cambia('ruc', e.target.value.replace(/\D/g, '') || null)} />
        </FilaRegla>
        <FilaRegla etiqueta="Dirección" ayuda="Puede ser la fiscal completa o solo «Lima, Perú».">
          <input className="ancho" maxLength={300} disabled={!puede} value={d.direccion} onChange={e => cambia('direccion', e.target.value)} />
        </FilaRegla>
      </GrupoRegla>
      <GrupoRegla titulo="Contacto" texto="A dónde te escriben los clientes, Culqi y quien pida algo sobre sus datos o una devolución.">
        <FilaRegla etiqueta="Correo" ayuda="Se muestra en todas las páginas.">
          <input type="email" maxLength={200} disabled={!puede} value={d.correo} onChange={e => cambia('correo', e.target.value)} />
        </FilaRegla>
        <FilaRegla etiqueta="WhatsApp" ayuda="Opcional. Con código de país, por ejemplo +51 987 654 321. Vacío = no se muestra.">
          <input inputMode="tel" maxLength={20} disabled={!puede} value={d.whatsapp ?? ''} placeholder="+51 9…" onChange={e => cambia('whatsapp', e.target.value || null)} />
        </FilaRegla>
      </GrupoRegla>
      <GrupoRegla titulo="Textos legales" texto="Términos, privacidad y devoluciones. Cuando el abogado los revise o los cambies, actualiza la fecha.">
        <FilaRegla etiqueta="Última actualización" ayuda="La fecha que se muestra arriba de cada texto legal.">
          <input type="date" disabled={!puede} value={d.actualizado} onChange={e => cambia('actualizado', e.target.value)} />
        </FilaRegla>
      </GrupoRegla>
      {puede && <div className="acciones-bloque"><Boton ocupado={ocupado} onClick={() => void guardar()}>Guardar la página pública</Boton></div>}
    </div>
  )
}