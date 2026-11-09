import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { NOMBRE_PLAN, diasQueFaltan, soles } from '../../../nucleo/planes/planes'
import { useSesion } from '../../../nucleo/sesion/SesionContexto'
import { useCambioPlan } from '../componentes/CambioPlan'
import { textoTope } from '../componentes/TopeComprobantes'
import {
  etiquetaPlan, extraHoy, menusDelPlan, planesServicio, precioCartera, precioHoy,
  type Catalogo, type CodigoPlan, type MiPlan, type PlanCatalogo, type ResumenCuenta,
} from '../servicios/planesServicio'

/**
 * 069 — MI PLAN.
 *
 *   Cuenta Negocio       «Elige tu plan»: Básico, Pro y Max con el precio real
 *                        tachado y el de lanzamiento.
 *   Cuenta Profesional   «Plan Cartera»: cuántas empresas trabaja (precio
 *                        graduado), cuáles suben a Pro o Max y cuál es la de su
 *                        propio estudio (gratis y fuera del cupo).
 *
 * Lo cambia el dueño de la cuenta o un colaborador administrador; los demás lo
 * ven. Se paga en «Mis pagos» (073): tarjeta, datos del comprobante e historial.
 */
export function MiPlanPagina() {
  const mensaje = useMensaje()
  const { refrescar } = useSesion()
  const [datos, setDatos] = useState<MiPlan>()
  const [error, setError] = useState<string>()

  const cargar = useCallback(async () => {
    try { setDatos(await planesServicio.mio()); setError(undefined) }
    catch (e) { setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar tu plan.') }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  const hecho = async (m: string) => { if (m) mensaje.bien(m); await cargar(); await refrescar() }

  if (error) return <Aviso>{error}</Aviso>
  if (!datos) return <Cargando />

  const { catalogo, cuenta } = datos

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">{cuenta?.tipo === 'profesional' ? 'Plan Cartera' : 'Elige tu plan'}</h1>
          <p className="secundario">
            {cuenta?.tipo === 'profesional'
              ? 'Tú decides cuántas empresas trabajas. Cada una trae el Plan Básico, y subes a Pro o Max solo las que lo necesitan.'
              : 'Usuarios ilimitados en todos los planes. Cambias de plan cuando quieras.'}
          </p>
        </div>
      </div>

      {!catalogo.encendidos && (
        <Aviso tono="info">Los planes todavía no están activos: por ahora tienes todos los menús y no se cobra nada.</Aviso>
      )}
      {cuenta && <EstadoDeLaCuenta cuenta={cuenta} />}
      {!datos.puedeCambiar && (
        <p className="nota-cartera">Lo cambia el dueño de la cuenta (o un colaborador administrador). Aquí ves lo que tiene.</p>
      )}

      {cuenta?.tipo === 'profesional'
        ? <PlanCartera catalogo={catalogo} cuenta={cuenta} puede={datos.puedeCambiar} onHecho={hecho} />
        : <ElegirPlan catalogo={catalogo} cuenta={cuenta} empresa={datos.empresa} puede={datos.puedeCambiar} onHecho={hecho} />}

      {cuenta && !cuenta.accesoTotal && <CancelarPlan cuenta={cuenta} puede={datos.puedeCambiar} onHecho={hecho} />}
    </>
  )
}

function EstadoDeLaCuenta({ cuenta }: { cuenta: ResumenCuenta }) {
  const dias = diasQueFaltan(cuenta.pruebaHasta)
  const vigente = cuenta.ajustes.find(a => a.vigente)
  if (cuenta.estado === 'acceso_total')
    return <div className="franja-plan">Esta cuenta tiene <strong>acceso total</strong>: todos los menús, sin costo.</div>
  if ((cuenta.estado === 'prueba' || (cuenta.estado === 'apagado' && cuenta.estadoEncendido === 'prueba')) && dias !== null) {
    const despues = cuenta.tipo === 'negocio' ? NOMBRE_PLAN[cuenta.empresas[0]?.plan ?? 'basico'] : null
    return (
      <div className="tarjeta-gratis">
        <span className="regalo-gratis" aria-hidden="true">🎁</span>
        <div>
          <span className="rotulo">Tu plan ahora</span>
          <h2>Mes gratis</h2>
          <p>
            Te quedan <strong>{dias} día{dias === 1 ? '' : 's'}</strong> (hasta el {fecha(cuenta.pruebaHasta!)}).{' '}
            {cuenta.tipo === 'negocio'
              ? <>Mientras dure tienes <strong>todo lo del {NOMBRE_PLAN[cuenta.planPrueba]}</strong>, sin pagar.</>
              : <>Tus primeras {cuenta.empresas.filter(e => e.pruebaMotivo === 'cuenta').length || 'empresas'} empresas tienen <strong>todo lo del {NOMBRE_PLAN[cuenta.planPrueba]}</strong>, sin pagar.</>}
          </p>
          <p className="secundario">
            {despues
              ? <>Al terminar pasas al plan <strong>{despues}</strong>. Si quieres otro, elígelo abajo: empieza cuando termine tu mes gratis.</>
              : <>Al terminar, cada empresa pasa al plan que tenga elegido abajo y se cobran los cupos de tu Cartera.</>}
          </p>
        </div>
      </div>
    )
  }
  if (vigente && cuenta.estado !== 'al_dia')
    return <div className="franja-plan">Tienes un trato especial hasta el <strong>{fecha(vigente.hasta)}</strong>.</div>
  return null
}

// =============================================================================
// CUENTA NEGOCIO
// =============================================================================
function ElegirPlan({ catalogo, cuenta, empresa, puede, onHecho }: {
  catalogo: Catalogo; cuenta: ResumenCuenta | null; empresa: MiPlan['empresa']; puede: boolean; onHecho: (m: string) => Promise<void>
}) {
  const [anual, setAnual] = useState(false)
  // 083: subir paga la diferencia por los días que quedan; bajar empieza en el próximo cobro.
  const cambio = useCambioPlan(onHecho)
  const laEmpresa: { id: string; plan: CodigoPlan; pruebaHasta: string | null; planProgramado?: CodigoPlan | null; planProgramadoDesde?: string | null } | null =
    cuenta?.empresas[0] ?? (empresa ? { id: empresa.id, plan: empresa.plan, pruebaHasta: empresa.pruebaHasta } : null)
  // 31 oct: en su mes gratis el plan elegido es «para después»; lo que usa ahora es el Max.
  const enGratis = !cuenta?.accesoTotal && diasQueFaltan(laEmpresa?.pruebaHasta ?? cuenta?.pruebaHasta) !== null
  const enOferta = conOferta(catalogo, cuenta)   // 079: también si la cuenta guarda el precio de lanzamiento
  const uso = cuenta?.empresas[0]?.uso ?? null
  const meses = 12 - catalogo.reglas.anualMesesGratis

  const orden = (c: CodigoPlan) => catalogo.planes.find(p => p.codigo === c)?.orden ?? 0
  const subeOBaja = (c: CodigoPlan) => !laEmpresa || enGratis || !catalogo.encendidos ? 'Elegir'
    : orden(c) > orden(laEmpresa.plan) ? 'Subir a' : 'Bajar a'

  return (
    <>
      {/* 083: bajó de plan: sigue con lo pagado hasta el fin del periodo. */}
      {laEmpresa?.planProgramado && laEmpresa.planProgramadoDesde && (
        <div className="franja-programado">
          <span>📅 <strong>El {fecha(laEmpresa.planProgramadoDesde)} pasas a {NOMBRE_PLAN[laEmpresa.planProgramado]}.</strong> Hasta entonces sigues con {NOMBRE_PLAN[laEmpresa.plan]}.</span>
          {puede && <Boton estilo="secundario" ocupado={cambio.cargando === laEmpresa.id + laEmpresa.plan}
                           onClick={() => void cambio.abrir(laEmpresa.id, laEmpresa.plan)}>Deshacer</Boton>}
        </div>
      )}
      {!!cuenta?.pendientes && cuenta.pendientes > 0 && (
        <p className="nota-cartera">Tienes {soles(cuenta.pendientes)} de diferencia por cambio de plan que se suma a tu próximo cobro.</p>
      )}

      {/* 1 nov: lo que usó en su mes gratis decide qué le conviene. */}
      {enGratis && uso && (
        <div className="recomendacion-plan">
          {uso.usos.length > 0
            ? <>En tu mes gratis usaste <strong>{uso.usos.join(', ')}</strong>. Para seguir usándolo te conviene el plan{' '}
                <strong>{NOMBRE_PLAN[uso.recomendado]}</strong>. Tus datos se quedan guardados con cualquier plan.</>
            : <>Hasta ahora solo emitiste comprobantes: te basta el plan <strong>Básico</strong>. Si pruebas el inventario o la caja en tu mes gratis, te diremos qué plan te conviene.</>}
        </div>
      )}

      <div className="segmentado periodo-plan" role="tablist" aria-label="Periodo">
        <button type="button" className={!anual ? 'elegido' : undefined} onClick={() => setAnual(false)}>Mensual</button>
        <button type="button" className={anual ? 'elegido' : undefined} onClick={() => setAnual(true)}>
          Anual · {catalogo.reglas.anualMesesGratis} meses gratis
        </button>
      </div>

      <div className="tarjetas-plan">
        {catalogo.planes.map((p, i) => {
          const hoy = precioHoy(p, enOferta)
          const actual = laEmpresa?.plan === p.codigo
          const programado = laEmpresa?.planProgramado === p.codigo
          const ahora = enGratis && p.codigo === (cuenta?.planPrueba ?? 'max')
          const recomendado = enGratis && uso?.recomendado === p.codigo
          return (
            <div key={p.codigo} className={'tarjeta-plan' + (p.codigo === 'pro' ? ' destacada' : '') + (actual ? ' actual' : '') + (ahora ? ' ahora' : '')}>
              {recomendado
                ? <span className="cinta-plan recomendada">Recomendado para ti</span>
                : p.codigo === 'pro' && !uso && <span className="cinta-plan">El más elegido</span>}
              <h2>{p.nombre}</h2>
              <span className={'incluye-plan ' + p.codigo}>{etiquetaPlan(catalogo.planes, i)}</span>
              <p className="secundario">{p.paraQuien}</p>
              <div className="precio-plan">
                {hoy < p.precioRegular && <s>{soles(anual ? p.precioRegular * meses : p.precioRegular)}</s>}
                <strong>{soles(anual ? hoy * meses : hoy)}</strong>
                <span>{anual ? '/año' : '/mes'}</span>
              </div>
              {enOferta && hoy < p.precioRegular && <p className="nota oferta-plan">{TextoLanzamiento(catalogo, cuenta)}</p>}
              <ul className="lista-plan">
                {Menus(p).map(m => <li key={m} className={i > 0 ? 'nuevo-plan' : undefined}>{i > 0 && '+ '}{m}</li>)}
                <li className={i > 0 ? 'nuevo-plan' : undefined}>{i > 0 && '+ '}{p.sucursalesMax === null ? 'Sucursales ilimitadas' : p.sucursalesMax === 1 ? '1 sucursal' : `Hasta ${p.sucursalesMax} sucursales`}</li>
                {i === 0 && <li>Usuarios ilimitados</li>}
                {p.topeRegular && <li className="tope-plan">{textoTope(p, enOferta)}</li>}
              </ul>
              <div className="pie-tarjeta-plan">
                {ahora && <span className="etiqueta aviso">Lo que usas ahora · mes gratis</span>}
                {actual
                  ? <span className="etiqueta acento">{enGratis ? 'Elegido para después del mes gratis' : 'Tu plan'}</span>
                  : programado
                    ? <span className="etiqueta aviso">Desde el {fecha(laEmpresa!.planProgramadoDesde!)}</span>
                    : puede && laEmpresa && (
                      <Boton estilo={orden(p.codigo) > orden(laEmpresa.plan) ? 'principal' : 'secundario'} ocupado={cambio.cargando === laEmpresa.id + p.codigo}
                             onClick={() => void cambio.abrir(laEmpresa.id, p.codigo)}>
                        {enGratis ? `Elegir ${p.nombre} para después` : `${subeOBaja(p.codigo)} ${p.nombre}`}
                      </Boton>
                    )}
              </div>
            </div>
          )
        })}
      </div>
      {laEmpresa && (() => {
        // 083: si bajó de plan, lo que paga desde el próximo cobro es el plan nuevo.
        const elegido = catalogo.planes.find(p => p.codigo === (laEmpresa.planProgramado ?? laEmpresa.plan)) ?? catalogo.planes[0]
        const mensual = precioHoy(elegido, enOferta)
        const fin = laEmpresa.pruebaHasta ?? cuenta?.pruebaHasta ?? null
        return (
          <ResumenPago
            filas={[
              ...(enGratis ? [{ texto: <>Hoy, en tu mes gratis</>, monto: soles(0) }] : []),
              { texto: <>{enGratis ? `Desde el ${fecha(fin)}` : laEmpresa.planProgramadoDesde ? `Desde el ${fecha(laEmpresa.planProgramadoDesde)}, cada mes` : 'Cada mes'}: plan {elegido.nombre}</>,
                monto: `${soles(mensual)} al mes`, fuerte: true },
              { texto: <>O el año completo ({catalogo.reglas.anualMesesGratis} meses gratis)</>, monto: soles(mensual * meses) },
            ]}
            condiciones={[
              { ok: catalogo.encendidos, informativa: true, texto: catalogo.encendidos ? 'Planes y cobros encendidos' : 'Planes apagados: por ahora el pago es solo de prueba' },
              { ok: puede, texto: 'Eres el dueño de la cuenta (o colaborador administrador)' },
            ]}
            boton={enGratis ? `Dejar mi tarjeta · primer cobro el ${fecha(fin)}` : `Pagar ${soles(mensual)} al mes`}
            nota={enGratis
              ? 'Tu mes gratis no se corta: la tarjeta se cobra recién cuando termina, y después cada mes en la misma fecha. Precios con IGV.'
              : 'Se cobra cada mes en la misma fecha; te enviamos tu comprobante al correo. Precios con IGV.'} />
        )
      })()}
      {!enGratis && catalogo.encendidos && (
        <p className="nota">Si subes de plan, empieza en el momento y pagas solo la diferencia por los días que quedan. Si bajas, sigues con lo
          que pagaste hasta el final del periodo y el plan nuevo empieza en tu próximo cobro.</p>
      )}
      {cambio.dialogo}
    </>
  )
}

const Menus = (p: PlanCatalogo) => menusDelPlan(p.funciones)

// =============================================================================
// CUENTA PROFESIONAL — PLAN CARTERA
// =============================================================================
function PlanCartera({ catalogo, cuenta, puede, onHecho }: {
  catalogo: Catalogo; cuenta: ResumenCuenta; puede: boolean; onHecho: (m: string) => Promise<void>
}) {
  const mensaje = useMensaje()
  const minimo = catalogo.reglas.carteraMinimo
  const [n, setN] = useState(Math.max(cuenta.cupos ?? cuenta.usados, minimo))
  const [guardando, setGuardando] = useState<string>()
  const cambio = useCambioPlan(onHecho)   // 083
  const oferta = conOferta(catalogo, cuenta)   // 079
  // e232: subir de cupo con un periodo pagado corriendo suma la diferencia
  // por los días que quedan al próximo cobro: se dice antes de guardar.
  const [difCupos, setDifCupos] = useState<string | null>(null)
  useEffect(() => {
    if (!puede || n <= (cuenta.cupos ?? 0)) { setDifCupos(null); return }
    let vivo = true
    const t = setTimeout(() => {
      planesServicio.cotizarCupos(n)
        .then(r => { if (vivo) setDifCupos(r.texto) })
        .catch(() => { if (vivo) setDifCupos(null) })
    }, 350)
    return () => { vivo = false; clearTimeout(t) }
  }, [n, puede, cuenta.cupos])
  const plan = (c: CodigoPlan) => catalogo.planes.find(p => p.codigo === c)!

  const base = precioCartera(catalogo.tramos, n, !oferta)
  const baseReal = precioCartera(catalogo.tramos, n, true)
  const activas = cuenta.empresas.filter(e => !e.pausada)
  const extras = activas.reduce((s, e) => s + extraHoy(plan(e.plan), oferta), 0)
  const total = base + extras
  const meses = 12 - catalogo.reglas.anualMesesGratis
  const subidas = useMemo(() => ({
    pro: activas.filter(e => e.plan === 'pro').length,
    max: activas.filter(e => e.plan === 'max').length,
  }), [activas])

  async function hacer(clave: string, f: () => Promise<{ mensaje: string }>) {
    setGuardando(clave)
    try { await onHecho((await f()).mensaje) }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo guardar.') }
    finally { setGuardando(undefined) }
  }

  return (
    <div className="cartera-plan">
      <div className="bloque">
        <h2>¿Cuántas empresas vas a trabajar?</h2>
        <p className="secundario">Todas entran en <strong>Básico</strong>. Si alguna necesita Pro o Max, cámbiala en la tabla de abajo: solo esa paga la diferencia.</p>
        <div className="calculadora-cartera">
          <input type="number" min={minimo} max={10000} value={n} disabled={!puede} aria-label="Empresas"
                 onChange={e => setN(Math.max(minimo, Math.min(10000, Number(e.target.value) || minimo)))} />
          <div className="paquetes-cartera">
            {[5, 10, 20, 50].map(x => (
              <button key={x} type="button" disabled={!puede} className={n === x ? 'elegido' : undefined} onClick={() => setN(x)}>{x}</button>
            ))}
          </div>
        </div>
        <p className="secundario">
          Usas {cuenta.usados} {cuenta.usados === 1 ? 'empresa' : 'empresas'}
          {cuenta.empresas.some(e => e.esDelEstudio) && ' (sin contar la de tu estudio)'}.
          {n < cuenta.usados && ' Con menos cupos que empresas, el próximo mes se cobra lo que usas.'}
        </p>
        <div className="total-cartera">
          <div><span>{n} empresas en Básico</span>{oferta && baseReal > base && <s>{soles(baseReal)}</s>}<strong>{soles(base)}</strong></div>
          {subidas.pro > 0 && <div><span>{subidas.pro} a Pro (+{soles(extraHoy(plan('pro'), oferta))} c/u)</span><strong>{soles(subidas.pro * extraHoy(plan('pro'), oferta))}</strong></div>}
          {subidas.max > 0 && <div><span>{subidas.max} a Max (+{soles(extraHoy(plan('max'), oferta))} c/u)</span><strong>{soles(subidas.max * extraHoy(plan('max'), oferta))}</strong></div>}
          <div className="suma"><span>Al mes</span><strong>{soles(total)}</strong></div>
          <div className="secundario"><span>Al año ({catalogo.reglas.anualMesesGratis} meses gratis)</span><span>{soles(total * meses)}</span></div>
        </div>
        {puede && difCupos && n !== cuenta.cupos && <p className="franja-cupos">{difCupos}</p>}
        {puede && (
          <Boton ocupado={guardando === 'cupos'} disabled={n === cuenta.cupos}
                 onClick={() => void hacer('cupos', () => planesServicio.cupos(n))}>Guardar {n} empresas</Boton>
        )}

        {(() => {
          // Quién está gratis ahora y quién no (mes gratis de la cuenta o por RUC nuevo).
          const enGratisCuenta = !cuenta.accesoTotal && diasQueFaltan(cuenta.pruebaHasta) !== null
          const gratis = activas.filter(e => !cuenta.accesoTotal && diasQueFaltan(e.pruebaHasta) !== null)
          const cobrables = activas.filter(e => !gratis.includes(e) && !(e.esDelEstudio && e.plan === 'basico'))
          const extrasDe = (lista: typeof activas) => lista.reduce((x, e) => x + extraHoy(plan(e.plan), oferta), 0)
          const hoy = enGratisCuenta && cobrables.length > 0 ? precioCartera(catalogo.tramos, cobrables.length, !oferta) + extrasDe(cobrables) : 0
          const despues = base + extras
          return (
            <ResumenPago
              filas={[
                ...(gratis.length > 0 ? [{ texto: <>{gratis.length} empresa{gratis.length === 1 ? '' : 's'} en su mes gratis (no se cobran)</>, monto: soles(0) }] : []),
                ...(enGratisCuenta && cobrables.length > 0
                  ? [{ texto: <>{cobrables.length} empresa{cobrables.length === 1 ? '' : 's'} fuera del mes gratis: se pagan desde hoy</>, monto: soles(hoy), fuerte: true }]
                  : []),
                { texto: <>{enGratisCuenta ? `Desde el ${fecha(cuenta.pruebaHasta)}` : 'Cada mes'}: {Math.max(n, minimo)} empresas{subidas.pro + subidas.max > 0 ? ' y sus subidas' : ''}</>,
                  monto: `${soles(despues)} al mes`, fuerte: !(enGratisCuenta && cobrables.length > 0) },
              ]}
              condiciones={[
                { ok: catalogo.encendidos, informativa: true, texto: catalogo.encendidos ? 'Planes y cobros encendidos' : 'Planes apagados: por ahora el pago es solo de prueba' },
                { ok: puede, texto: 'Eres el dueño del estudio (o colaborador administrador)' },
                { ok: cuenta.cupos !== null && cuenta.cupos === n, texto: `Guardaste cuántas empresas trabajas (${n})` },
                ]}
              boton={enGratisCuenta && cobrables.length > 0 ? `Pagar hoy ${soles(hoy)}`
                : enGratisCuenta ? `Dejar mi tarjeta · primer cobro el ${fecha(cuenta.pruebaHasta)}`
                : `Pagar ${soles(despues)} al mes`}
              nota={<>Las empresas en su mes gratis se cobran recién cuando termina el suyo.
                {enGratisCuenta && ` Tu mes gratis cubre ${catalogo.reglas.pruebaCarteraEmpresas} empresas; desde la ${catalogo.reglas.pruebaCarteraEmpresas + 1}, cada una se paga desde el día en que la agregas.`}
                {' '}Todo va en un solo comprobante a nombre de tu estudio.</>} />
          )
        })()}
      </div>

      {/* 1 nov: qué trae cada plan, también en la Cartera. */}
      <details className="planes-cartera" open>
        <summary>Qué trae cada plan (y cuánto suma subir una empresa)</summary>
        <div className="planes-cartera-rejilla">
          {catalogo.planes.map((p, i) => (
            <div key={p.codigo}>
              <h3>{p.nombre} <span className="secundario">{p.codigo === 'basico' ? 'incluido en cada empresa' : `+${soles(extraHoy(p, oferta))} por empresa al mes`}</span></h3>
              <span className={'incluye-plan ' + p.codigo}>{etiquetaPlan(catalogo.planes, i)}</span>
              <ul className="lista-plan">
                {Menus(p).map(m => <li key={m} className={i > 0 ? 'nuevo-plan' : undefined}>{i > 0 && '+ '}{m}</li>)}
                <li className={i > 0 ? 'nuevo-plan' : undefined}>{i > 0 && '+ '}{p.sucursalesMax === null ? 'Sucursales ilimitadas' : p.sucursalesMax === 1 ? '1 sucursal' : `Hasta ${p.sucursalesMax} sucursales`}</li>
                {p.topeRegular && <li className="tope-plan">{textoTope(p, oferta)} por empresa</li>}
              </ul>
            </div>
          ))}
        </div>
      </details>

      <div className="bloque sin-relleno">
        <table className="tabla">
          <thead><tr><th>Empresa</th><th>Plan de la empresa</th><th>Cuánto suma al mes</th><th>Es mi estudio</th></tr></thead>
          <tbody>
            {cuenta.empresas.map(e => {
              const dias = diasQueFaltan(e.pruebaHasta)
              return (
                <tr key={e.id} className={e.pausada ? 'apagada' : undefined}>
                  <td>
                    <div className="principal">{e.nombre}</div>
                    <div className="secundario">{e.ruc ? `RUC ${e.ruc}` : 'Sin RUC'}{e.pausada && ' · en pausa (no ocupa cupo)'}
                      {dias !== null && ` · mes gratis: ${dias} día${dias === 1 ? '' : 's'}`}</div>
                    {dias !== null && e.uso && (
                      <div className="secundario recomendado-empresa">
                        Le conviene: <strong>{NOMBRE_PLAN[e.uso.recomendado]}</strong>
                        {e.uso.usos.length > 0 ? ` (usó ${e.uso.usos.join(', ')})` : ' (solo emitió)'}
                      </div>
                    )}
                  </td>
                  <td>
                    {puede ? (
                      <select value={e.plan} disabled={!!cambio.cargando} aria-label={`Plan de ${e.nombre}`}
                              onChange={ev => void cambio.abrir(e.id, ev.target.value as CodigoPlan)}>
                        {catalogo.planes.map(p => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
                      </select>
                    ) : NOMBRE_PLAN[e.plan]}
                    {e.planProgramado && e.planProgramadoDesde && (
                      <div className="secundario">
                        Desde el {fecha(e.planProgramadoDesde)}: {NOMBRE_PLAN[e.planProgramado]}
                        {puede && <> · <button type="button" className="enlace" onClick={() => void cambio.abrir(e.id, e.plan)}>Deshacer</button></>}
                      </div>
                    )}
                    {e.efectivo !== e.plan && <div className="secundario">Ve: {NOMBRE_PLAN[e.efectivo]}</div>}
                  </td>
                  <td>{e.esDelEstudio && e.plan === 'basico' ? 'Gratis'
                    : e.plan === 'basico' ? <span title="Ya está pagada dentro de tus empresas en Básico">Nada (incluida)</span>
                    : <>+{soles(extraHoy(plan(e.plan), oferta))} <span className="secundario">por {NOMBRE_PLAN[e.plan]}</span></>}</td>
                  <td>
                    {puede ? (
                      <input type="radio" name="estudio" checked={e.esDelEstudio} aria-label={`${e.nombre} es mi estudio`}
                             onChange={() => void hacer(e.id + 'e', () => planesServicio.estudio(e.id))} />
                    ) : e.esDelEstudio ? '✓' : ''}
                  </td>
                </tr>
              )
            })}
            {cuenta.empresas.length === 0 && <tr><td colSpan={4} className="secundario">Todavía no tienes empresas.</td></tr>}
          </tbody>
        </table>
        <ul className="ayuda-tabla">
          <li><strong>Plan de la empresa:</strong> cada una nace en Básico (ya incluida en tus empresas). Si la cambias a Pro o Max, se suma solo la diferencia de esa empresa.{' '}
            Si la subes a mitad de mes, pagas la diferencia por los días que faltan; si la bajas, el cambio empieza en tu próximo cobro.</li>
          <li><strong>Es mi estudio:</strong> marca la empresa de tu propio estudio contable (la tuya, la que factura tus honorarios). En Básico es <strong>gratis</strong> y no cuenta en tus empresas. Solo una.</li>
        </ul>
      </div>

      <div className="como-funciona">
        <h3>Cómo funciona</h3>
        <ul>
          <li>Pagas por las empresas que eliges, aunque no las uses todas. Puedes bajar para el mes siguiente.</li>
          <li>Precio escalonado: {catalogo.tramos.map(t => `${t.desde}${t.hasta ? '–' + t.hasta : '+'} a ${soles(oferta ? t.precioOferta : t.precioRegular)}`).join(' · ')} cada una.</li>
          <li>Si agregas una empresa de más, te decimos lo que cuesta y la sumas al confirmar. Nunca se bloquea a las que ya tienes.</li>
          <li>Pausar una empresa libera su cupo. La empresa de tu propio estudio es gratis en Básico y no ocupa cupo.</li>
          <li>Todo se factura a tu estudio, en una sola factura con el detalle.</li>
          {catalogo.reglas.rucGratisActivo && <li>Cada RUC nuevo que sumes tiene un mes gratis (una vez por RUC, hasta {catalogo.reglas.rucGratisTope} al mes).</li>}
        </ul>
      </div>
      {cambio.dialogo}
    </div>
  )
}

// =============================================================================
// 1 nov: EL PAGO. El botón ya está, con lo que cobraría y las condiciones;
// se activa con la entrega de Cobros (tarjeta con Culqi).
// =============================================================================
/** informativa: se muestra, pero no bloquea el botón (con los planes apagados se paga en modo de prueba). */
interface Condicion { ok: boolean; texto: string; informativa?: boolean }

/** 079: la oferta para esta cuenta: la de hoy, o la que guarda por haber entrado en ella. */
function conOferta(catalogo: Catalogo, cuenta: ResumenCuenta | null) {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
  return catalogo.enOferta || (!!cuenta?.lanzamientoHasta && cuenta.lanzamientoHasta >= hoy)
}

/** 079: qué se le promete con el precio de lanzamiento (Indecopi: con fecha). */
function TextoLanzamiento(catalogo: Catalogo, cuenta: ResumenCuenta | null) {
  if (cuenta?.lanzamientoHasta) return `Tu precio de lanzamiento se mantiene hasta el ${fecha(cuenta.lanzamientoHasta)}`
  const meses = catalogo.reglas.lanzamientoMeses ?? 12
  return `Precio de lanzamiento para quien contrate hasta el ${catalogo.reglas.ofertaHasta ? fecha(catalogo.reglas.ofertaHasta) : 'fin de la oferta'}` +
         (meses > 0 ? `: lo mantienes ${meses} meses pagando` : '')
}

function ResumenPago({ filas, condiciones, boton, nota }: {
  filas: { texto: ReactNode; monto?: string; fuerte?: boolean }[]
  condiciones: Condicion[]
  boton: string
  nota?: ReactNode
}) {
  const listo = condiciones.every(c => c.ok || c.informativa)
  return (
    <div className="resumen-pago">
      <h3>Lo que pagarías</h3>
      <div className="filas-pago">
        {filas.map((f, i) => (
          <div key={i} className={f.fuerte ? 'fuerte' : undefined}><span>{f.texto}</span>{f.monto && <strong>{f.monto}</strong>}</div>
        ))}
      </div>
      <ul className="condiciones-pago">
        {condiciones.map(c => <li key={c.texto} className={c.ok ? 'ok' : c.informativa ? 'info' : 'falta'}>{c.ok ? '✓' : c.informativa ? 'ℹ' : '✗'} {c.texto}</li>)}
      </ul>
      {/* 073: el pago se hace en «Mis pagos» (tarjeta, datos del comprobante e historial). */}
      {listo
        ? <Link className="boton" to="/mi-plan/pagos">💳 {boton}</Link>
        : <button type="button" className="boton" disabled title="Falta lo marcado con ✗">💳 {boton}</button>}
      {nota && <p className="nota">{nota}</p>}
    </div>
  )
}

// =============================================================================
// 081 — CANCELAR MI PLAN (tan fácil como contratar; nada se borra)
// =============================================================================
const MOTIVOS = ['Es muy caro para mí', 'Ya no lo necesito', 'Me cambio a otro sistema', 'Me falta una función', 'Cerré mi negocio', 'Otro motivo']

function CancelarPlan({ cuenta, puede, onHecho }: { cuenta: ResumenCuenta; puede: boolean; onHecho: (m: string) => Promise<void> }) {
  const mensaje = useMensaje()
  const { pedir, dialogo } = useConfirmar()
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
  const hasta = cuenta.activoHasta && cuenta.activoHasta >= hoy ? cuenta.activoHasta : null

  async function cancelar() {
    const ok = await pedir({
      titulo: '¿Cancelar tu plan?',
      mensaje: <>No se te cobrará más.{hasta ? <> Sigues usando todo hasta el <strong>{fecha(hasta)}</strong>.</> : null} Después podrás entrar,
        ver y descargar todos tus comprobantes, pero no emitir nuevos. <strong>No se borra nada</strong> y puedes reactivarlo cuando quieras.</>,
      confirmar: 'Sí, cancelar mi plan', tono: 'peligro',
    })
    if (!ok) return
    setOcupado(true)
    try { await onHecho((await planesServicio.cancelar(motivo || null)).mensaje); setAbierto(false) }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo cancelar.') }
    finally { setOcupado(false) }
  }

  async function reactivar() {
    setOcupado(true)
    try { await onHecho((await planesServicio.reactivar()).mensaje) }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo reactivar.') }
    finally { setOcupado(false) }
  }

  if (cuenta.canceladoEn) return (
    <section className="bloque cancelar-plan cancelado">
      <h2>Tu plan está cancelado</h2>
      <p>Lo cancelaste el <strong>{fecha(cuenta.canceladoEn)}</strong>. No se te cobra nada.{' '}
        {hasta ? <>Sigues usando todo hasta el <strong>{fecha(hasta)}</strong>; después podrás ver y descargar todo, pero no emitir.</>
               : <>Puedes entrar, ver y descargar todo, pero no emitir.</>} No se borró nada.</p>
      {puede && <Boton ocupado={ocupado} onClick={() => void reactivar()}>Reactivar mi plan</Boton>}
      {dialogo}
    </section>
  )

  if (!puede) return null
  return (
    <section className="bloque cancelar-plan">
      {!abierto ? (
        <p className="secundario">¿Ya no lo necesitas? <button type="button" className="enlace" onClick={() => setAbierto(true)}>Cancelar mi plan</button>.
          Sigues usando lo que pagaste hasta el final del periodo, y nada se borra.</p>
      ) : (
        <>
          <h2>Cancelar mi plan</h2>
          <p className="secundario">No se te cobrará más.{hasta ? <> Sigues usando todo hasta el <strong>{fecha(hasta)}</strong>.</> : null} Después
            podrás entrar, ver y descargar todo, pero no emitir. Puedes reactivarlo cuando quieras.</p>
          <label className="campo"><span>¿Por qué cancelas? (opcional, nos ayuda a mejorar)</span>
            <select value={motivo} onChange={e => setMotivo(e.target.value)}>
              <option value="">— Prefiero no decir —</option>
              {MOTIVOS.map(m => <option key={m}>{m}</option>)}
            </select>
          </label>
          <div className="acciones-bloque">
            <Boton estilo="secundario" onClick={() => setAbierto(false)}>Mejor no</Boton>
            <Boton estilo="peligro" ocupado={ocupado} onClick={() => void cancelar()}>Cancelar mi plan</Boton>
          </div>
        </>
      )}
      {dialogo}
    </section>
  )
}