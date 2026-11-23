import { useCallback, useEffect, useState } from 'react'
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
import { ListaConfirmar } from '../../../componentes/ListaConfirmar'
import { useCambioPlan } from '../componentes/CambioPlan'
import { InvitarContadores } from '../componentes/InvitarContadores'
import { textoTope } from '../componentes/TopeComprobantes'
import '../../facturacion/comprobantes-lista.css'
import '../planes.css'
import {
  etiquetaPlan, extraHoy, menusDelPlan, planesServicio, precioCartera, precioHoy, precioPorEmpresa,
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
    <div className="pln-pagina">
      <div className="encabezado-pagina cmp-encab">
        <div>
          <h1 className="titulo-pagina">{cuenta?.tipo === 'profesional' ? 'Plan Cartera' : 'Elige tu plan'}</h1>
          <p className="bajada-pagina">
            {cuenta?.tipo === 'profesional'
              ? 'Tú decides cuántas empresas trabajas y en qué plan va cada una. Primero eliges cuántas de cada plan; después las repartes a tus empresas.'
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
    </div>
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
        <div>
          <span className="rotulo">Tu plan ahora</span>
          <h2>Mes gratis</h2>
          <p>
            Te quedan <strong>{dias} día{dias === 1 ? '' : 's'}</strong> (hasta el {fecha(cuenta.pruebaHasta!)}).{' '}
            {cuenta.tipo === 'negocio'
              ? <>Mientras dure tienes <strong>todo lo del {NOMBRE_PLAN[cuenta.planPrueba]}</strong>, sin pagar.</>
              : (() => { const n = cuenta.empresas.filter(e => e.pruebaMotivo === 'cuenta').length
                         return n === 1 ? <>Tu primera empresa tiene <strong>todo lo del {NOMBRE_PLAN[cuenta.planPrueba]}</strong>, sin pagar.</>
                           : <>{n > 1 ? `Tus primeras ${n} empresas tienen` : 'Tus empresas tienen'} <strong>todo lo del {NOMBRE_PLAN[cuenta.planPrueba]}</strong>, sin pagar.</> })()}
          </p>
          <p className="secundario">
            {despues
              ? <>Al terminar pasas al plan <strong>{despues}</strong>. Si quieres otro, elígelo abajo: empieza cuando termine tu mes gratis.</>
              : <>Al terminar, cada empresa pasa al plan que le diste abajo y se cobra lo que elegiste.</>}
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
          <span><strong>El {fecha(laEmpresa.planProgramadoDesde)} pasas a {NOMBRE_PLAN[laEmpresa.planProgramado]}.</strong> Hasta entonces sigues con {NOMBRE_PLAN[laEmpresa.plan]}.</span>
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
                {Menus(p).map(m => <li key={m} className={i > 0 ? 'nuevo-plan' : undefined}>{m}</li>)}
                <li className={i > 0 ? 'nuevo-plan' : undefined}>{p.sucursalesMax === null ? 'Sucursales ilimitadas' : p.sucursalesMax === 1 ? '1 sucursal' : `Hasta ${p.sucursalesMax} sucursales`}</li>
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
// CUENTA PROFESIONAL — PLAN CARTERA (e280, 095): cuántas empresas de cada plan
// (Básico, Pro, Max) y después se reparten a las empresas. La empresa del
// estudio va aparte, en «Mi empresa»: Básico gratis y, si sube, la diferencia.
// =============================================================================
function PlanCartera({ catalogo, cuenta, puede, onHecho }: {
  catalogo: Catalogo; cuenta: ResumenCuenta; puede: boolean; onHecho: (m: string) => Promise<void>
}) {
  const mensaje = useMensaje()
  const { pedir, dialogo } = useConfirmar()
  const minimo = catalogo.reglas.carteraMinimo
  const oferta = conOferta(catalogo, cuenta)   // 079
  const cambio = useCambioPlan(onHecho)          // 083
  const plan = (c: CodigoPlan) => catalogo.planes.find(p => p.codigo === c)!

  const activas = cuenta.empresas.filter(e => !e.pausada)
  const cartera = cuenta.empresas.filter(e => !e.esDelEstudio)
  const estudio = cuenta.empresas.find(e => e.esDelEstudio && !e.pausada) ?? null
  const asigPro = cuenta.asignadasPro ?? activas.filter(e => !e.esDelEstudio && e.plan === 'pro').length
  const asigMax = cuenta.asignadasMax ?? activas.filter(e => !e.esDelEstudio && e.plan === 'max').length
  const asigBas = Math.max(0, cuenta.usados - asigPro - asigMax)
  const guardadoPro = Math.max(cuenta.cuposPro ?? 0, asigPro)
  const guardadoMax = Math.max(cuenta.cuposMax ?? 0, asigMax)
  const guardadoTotal = Math.max(cuenta.cupos ?? cuenta.usados, cuenta.usados, minimo)

  const [pro, setPro] = useState(guardadoPro)
  const [max, setMax] = useState(guardadoMax)
  const [bas, setBas] = useState(Math.max(guardadoTotal - guardadoPro - guardadoMax, asigBas))
  const total = Math.max(bas + pro + max, minimo)
  const cambiado = total !== guardadoTotal || pro !== (cuenta.cuposPro ?? 0) || max !== (cuenta.cuposMax ?? 0)
  const [guardando, setGuardando] = useState(false)

  // e232: subir con un periodo pagado corriendo suma la diferencia: se dice antes de guardar.
  const [difCupos, setDifCupos] = useState<string | null>(null)
  useEffect(() => {
    if (!puede || !cambiado) { setDifCupos(null); return }
    let vivo = true
    const t = setTimeout(() => {
      planesServicio.cotizarCupos(total, pro, max)
        .then(r => { if (vivo) setDifCupos(r.texto) })
        .catch(() => { if (vivo) setDifCupos(null) })
    }, 350)
    return () => { vivo = false; clearTimeout(t) }
  }, [total, pro, max, puede, cambiado])

  // Precios por empresa de cada plan (el de la primera empresa) y la cuenta exacta.
  const unidad = (c: CodigoPlan, regular = !oferta) => precioPorEmpresa(catalogo.tramos, catalogo.planes, c, regular)
  const base = precioCartera(catalogo.tramos, total, !oferta)
  const extras = pro * extraHoy(plan('pro'), oferta) + max * extraHoy(plan('max'), oferta)
  const sinDescCantidad = bas * unidad('basico') + pro * unidad('pro') + max * unidad('max') + Math.max(0, total - bas - pro - max) * unidad('basico')
  const descCantidad = Math.max(0, Math.round((sinDescCantidad - base - extras) * 100) / 100)
  const extraEstudio = estudio && estudio.plan !== 'basico' ? extraHoy(plan(estudio.plan), oferta) : 0
  const carteraMes = base + extras
  const d = cuenta.descuento
  const descBeneficio = d ? Math.round(carteraMes * d.porcentaje / 100 * Math.min(1, (d.empresasMax ?? total) / Math.max(total, 1)) * 100) / 100 : 0
  const alMes = Math.max(0, carteraMes + extraEstudio - descBeneficio)
  const meses = 12 - catalogo.reglas.anualMesesGratis
  const conTramos = catalogo.tramos.length > 1 && catalogo.tramos.some(t => t.precioOferta < catalogo.tramos[0].precioOferta)

  async function guardar() {
    const partes = [`${bas} Básico`, ...(pro ? [`${pro} Pro`] : []), ...(max ? [`${max} Max`] : [])].join(' + ')
    if (!await pedir({
      titulo: '¿Guardar tu Cartera?',
      confirmar: `Sí, guardar ${partes}`,
      mensaje: <>
        <p>Tu Cartera queda con <strong>{partes}</strong> ({total} empresas). Pagas por las que eliges, aunque todavía no las uses todas.</p>
        <ListaConfirmar filas={[
          { nombre: 'Tu cartera al mes', valor: soles(carteraMes) },
          ...(extraEstudio ? [{ nombre: `Mi empresa: subida a ${NOMBRE_PLAN[estudio!.plan]}`, valor: soles(extraEstudio) }] : []),
          ...(descBeneficio ? [{ nombre: `Descuento ${d!.porcentaje} %`, valor: `−${soles(descBeneficio)}` }] : []),
          { nombre: 'Un solo cobro al mes', valor: soles(alMes), fuerte: true },
        ]} />
        {difCupos && <p className="conf-ojo">{difCupos}</p>}
      </>,
    })) return
    setGuardando(true)
    try { await onHecho((await planesServicio.cupos(total, pro, max)).mensaje) }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo guardar.') }
    finally { setGuardando(false) }
  }

  // Cambiar el plan de una empresa: se pregunta antes (con cupo libre no se paga).
  async function cambiarPlan(e: (typeof cartera)[number], nuevo: CodigoPlan) {
    if (nuevo === e.plan && !e.planProgramado) return
    const libres = nuevo === 'pro' ? (cuenta.cuposPro ?? 0) - asigPro : nuevo === 'max' ? (cuenta.cuposMax ?? 0) - asigMax : 0
    const sube = (catalogo.planes.find(p => p.codigo === nuevo)?.orden ?? 0) > (catalogo.planes.find(p => p.codigo === e.plan)?.orden ?? 0)
    if (!await pedir({
      titulo: `¿Pasar ${e.nombre} a ${NOMBRE_PLAN[nuevo]}?`,
      confirmar: `Sí, pasar a ${NOMBRE_PLAN[nuevo]}`,
      mensaje: sube && nuevo !== 'basico'
        ? libres > 0
          ? <p>Usa uno de tus <strong>{NOMBRE_PLAN[nuevo]}</strong> que ya pagas ({libres} libre{libres === 1 ? '' : 's'}): <strong>no se cobra nada más</strong>.</p>
          : <p>No te quedan {NOMBRE_PLAN[nuevo]} libres: se suma <strong>+{soles(extraHoy(plan(nuevo), oferta))} al mes</strong>. Si ya pagaste el mes, te diremos la diferencia por los días que quedan.</p>
        : <p>Si ya pagaste el mes, sigue en {NOMBRE_PLAN[e.plan]} hasta el final del periodo y el cambio empieza en tu próximo cobro. Su cupo de {NOMBRE_PLAN[e.plan]} queda libre para otra empresa.</p>,
    })) return
    await cambio.abrir(e.id, nuevo)
  }

  const enGratisCuenta = !cuenta.accesoTotal && diasQueFaltan(cuenta.pruebaHasta) !== null
  const gratis = activas.filter(e => !cuenta.accesoTotal && diasQueFaltan(e.pruebaHasta) !== null)
  const cobrables = activas.filter(e => !gratis.includes(e) && !(e.esDelEstudio && e.plan === 'basico'))
  const hoy = enGratisCuenta && cobrables.length > 0
    ? precioCartera(catalogo.tramos, cobrables.length, !oferta) + cobrables.reduce((x, e) => x + extraHoy(plan(e.plan), oferta), 0) : 0
  const sinUsarPro = (cuenta.cuposPro ?? 0) - asigPro
  const sinUsarMax = (cuenta.cuposMax ?? 0) - asigMax

  const contadores: { c: CodigoPlan; v: number; set: (n: number) => void; min: number }[] = [
    { c: 'basico', v: bas, set: setBas, min: asigBas },
    { c: 'pro', v: pro, set: setPro, min: asigPro },
    { c: 'max', v: max, set: setMax, min: asigMax },
  ]

  return (
    <div className="cartera-plan">
      <section className="bloque">
        <h2>1. ¿Cuántas empresas quieres en cada plan?</h2>
        <p className="secundario">
          Usas {cuenta.usados} {cuenta.usados === 1 ? 'empresa' : 'empresas'}{estudio && ' (sin contar la de tu estudio)'}: {asigBas} en Básico
          {asigPro > 0 && `, ${asigPro} en Pro`}{asigMax > 0 && `, ${asigMax} en Max`}. Puedes elegir más de las que usas hoy.
          {total > bas + pro + max && ` El mínimo de la Cartera es ${minimo} empresas.`}
        </p>
        <div className="crt-planes">
          {contadores.map(({ c, v, set, min }) => {
            const i = catalogo.planes.findIndex(p => p.codigo === c)
            const p = catalogo.planes[i]
            const real = unidad(c, true)
            const precio = unidad(c)
            return (
              <div key={c} className={`crt-plan${v > 0 ? ' elegido' : ''}`}>
                <h3>{p.nombre}</h3>
                <div className="crt-precio">
                  {precio < real && <s>{soles(real)}</s>}<strong>{soles(precio)}</strong><span>por empresa al mes</span>
                </div>
                {precio < real && <span className="crt-lanz">precio de lanzamiento</span>}
                <div className="crt-contador" role="group" aria-label={`Empresas en ${p.nombre}`}>
                  <button type="button" disabled={!puede || v <= min} aria-label={`Una menos en ${p.nombre}`} onClick={() => set(Math.max(min, v - 1))}>−</button>
                  <input type="number" min={min} max={10000} value={v} disabled={!puede} aria-label={`Cuántas en ${p.nombre}`}
                         onChange={ev => set(Math.max(min, Math.min(10000, Math.floor(Number(ev.target.value) || 0))))} />
                  <button type="button" disabled={!puede} aria-label={`Una más en ${p.nombre}`} onClick={() => set(v + 1)}>+</button>
                </div>
                <div className="crt-sub">{v > 0 ? <>{v} × {soles(precio)} = <strong>{soles(v * precio)}</strong></> : '—'}</div>
                {min > 0 && <div className="crt-min secundario">{min} {min === 1 ? 'empresa ya lo usa' : 'empresas ya lo usan'}</div>}
                <span className={'incluye-plan ' + c}>{etiquetaPlan(catalogo.planes, i)}</span>
                <ul className="lista-plan">
                  {Menus(p).map(m => <li key={m} className={i > 0 ? 'nuevo-plan' : undefined}>{i > 0 && '+ '}{m}</li>)}
                  <li className={i > 0 ? 'nuevo-plan' : undefined}>{p.sucursalesMax === null ? 'Sucursales ilimitadas' : p.sucursalesMax === 1 ? '1 sucursal' : `Hasta ${p.sucursalesMax} sucursales`}</li>
                  {p.topeRegular && <li className="tope-plan">{textoTope(p, oferta)} por empresa</li>}
                </ul>
              </div>
            )
          })}
        </div>
        {conTramos && (
          <p className="nota">Descuento por cantidad: {catalogo.tramos.filter(t => t.precioOferta < catalogo.tramos[0].precioOferta).map(t =>
            `desde la empresa ${t.desde}, −${Math.round((1 - t.precioOferta / catalogo.tramos[0].precioOferta) * 100)} %`).join(' · ')} (sobre el precio de Básico).</p>
        )}

        <div className="crt-resumen">
          <ResumenPago
            filas={[
              { texto: <span className="crt-grupo">Tu cartera</span> },
              { texto: <>{bas + Math.max(0, total - bas - pro - max)} Básico</>, monto: soles((bas + Math.max(0, total - bas - pro - max)) * unidad('basico')) },
              ...(pro ? [{ texto: <>{pro} Pro</>, monto: soles(pro * unidad('pro')) }] : []),
              ...(max ? [{ texto: <>{max} Max</>, monto: soles(max * unidad('max')) }] : []),
              ...(descCantidad > 0 ? [{ texto: <>Descuento por cantidad</>, monto: `−${soles(descCantidad)}` }] : []),
              { texto: <span className="crt-grupo">Mi empresa</span> },
              ...(estudio
                ? [{ texto: <>{estudio.nombre}: Básico</>, monto: 'Gratis' },
                   ...(extraEstudio ? [{ texto: <>Subida a {NOMBRE_PLAN[estudio.plan]}</>, monto: soles(extraEstudio) }] : [])]
                : [{ texto: <><Link to="/mi-estudio/empresa">Registra tu empresa</Link>: en Básico es gratis</>, monto: soles(0) }]),
              ...(d ? [{ texto: <span className="crt-grupo">Beneficio</span> },
                       { texto: <>{d.motivo} ({d.porcentaje} %{d.empresasMax ? `, hasta ${d.empresasMax} empresas` : ''}, hasta el {fecha(d.hasta)})</>, monto: `−${soles(descBeneficio)}` }] : []),
              { texto: <>{enGratisCuenta ? `Desde el ${fecha(cuenta.pruebaHasta)}` : 'Cada mes'}: un solo cobro</>, monto: `${soles(alMes)} al mes`, fuerte: true },
              { texto: <>O el año completo ({catalogo.reglas.anualMesesGratis} meses gratis)</>, monto: soles(alMes * meses) },
              ...(gratis.length > 0 ? [{ texto: <>{gratis.length} empresa{gratis.length === 1 ? '' : 's'} en su mes gratis (no se cobran hoy)</>, monto: soles(0) }] : []),
              ...(enGratisCuenta && cobrables.length > 0
                ? [{ texto: <>{cobrables.length} empresa{cobrables.length === 1 ? '' : 's'} fuera del mes gratis: se pagan desde hoy</>, monto: soles(hoy), fuerte: true }] : []),
            ]}
            condiciones={[
              { ok: catalogo.encendidos, informativa: true, texto: catalogo.encendidos ? 'Planes y cobros encendidos' : 'Planes apagados: por ahora el pago es solo de prueba' },
              { ok: puede, texto: 'Eres el dueño del estudio (o colaborador administrador)' },
              { ok: cuenta.cupos !== null && !cambiado, texto: cambiado ? 'Falta guardar lo que elegiste' : 'Guardaste cuántas empresas de cada plan' },
            ]}
            extra={puede && (
              <>
                {difCupos && cambiado && <p className="franja-cupos">{difCupos}</p>}
                <Boton ocupado={guardando} disabled={!cambiado} ancho onClick={() => void guardar()}>
                  Guardar {[`${bas} Básico`, ...(pro ? [`${pro} Pro`] : []), ...(max ? [`${max} Max`] : [])].join(' + ')}
                </Boton>
              </>
            )}
            boton={enGratisCuenta && cobrables.length > 0 ? `Pagar hoy ${soles(hoy)}`
              : enGratisCuenta ? `Dejar mi tarjeta · primer cobro el ${fecha(cuenta.pruebaHasta)}`
              : `Pagar ${soles(alMes)} al mes`}
            nota={<>Las empresas en su mes gratis se cobran recién cuando termina el suyo.
              {enGratisCuenta && ` Tu mes gratis cubre ${catalogo.reglas.pruebaCarteraEmpresas} empresas; desde la ${catalogo.reglas.pruebaCarteraEmpresas + 1}, cada una se paga desde el día en que la agregas.`}
              {' '}Todo va en un solo comprobante a nombre de tu estudio. Precios con IGV.</>} />
        </div>
      </section>

      <section className="bloque sin-relleno">
        <div className="crt-cab-tabla">
          <h2>2. Reparte los planes a tus empresas</h2>
          <p className="secundario">Elige el plan de cada empresa. Con un cupo libre ya pagado, no se cobra nada más.</p>
          <div className="crt-cupos">
            <span className="crt-cupo">Básico: <strong>{asigBas}</strong> de {Math.max(guardadoTotal - guardadoPro - guardadoMax, asigBas)}</span>
            <span className={`crt-cupo${sinUsarPro > 0 ? ' ojo' : ''}`}>Pro: <strong>{asigPro}</strong> de {guardadoPro}{sinUsarPro > 0 && ` · ${sinUsarPro} sin asignar`}</span>
            <span className={`crt-cupo${sinUsarMax > 0 ? ' ojo' : ''}`}>Max: <strong>{asigMax}</strong> de {guardadoMax}{sinUsarMax > 0 && ` · ${sinUsarMax} sin asignar`}</span>
          </div>
        </div>
        <table className="tabla">
          <thead><tr><th>Empresa</th><th>Plan de la empresa</th><th>Cuánto suma al mes</th></tr></thead>
          <tbody>
            {cartera.map(e => {
              const dias = diasQueFaltan(e.pruebaHasta)
              return (
                <tr key={e.id} className={e.pausada ? 'apagada' : undefined}>
                  <td>
                    <div className="principal">{e.nombre}</div>
                    <div className="secundario">{e.ruc ? `RUC ${e.ruc}` : 'Sin RUC'}{e.pausada && ' · en pausa (no ocupa cupo)'}
                      {dias !== null && ` · mes gratis: ${dias} día${dias === 1 ? '' : 's'}`}</div>
                    {e.uso && (
                      <div className="secundario recomendado-empresa">
                        Le conviene: <strong>{NOMBRE_PLAN[e.uso.recomendado]}</strong>
                        {e.uso.usos.length > 0 ? ` (usa ${e.uso.usos.join(', ')})` : ' (solo emitió)'}
                      </div>
                    )}
                  </td>
                  <td>
                    {puede && !e.pausada ? (
                      <select value={e.plan} disabled={!!cambio.cargando} aria-label={`Plan de ${e.nombre}`}
                              onChange={ev => void cambiarPlan(e, ev.target.value as CodigoPlan)}>
                        {catalogo.planes.map(p => {
                          const libres = p.codigo === 'pro' ? sinUsarPro : p.codigo === 'max' ? sinUsarMax : 0
                          return <option key={p.codigo} value={p.codigo}>
                            {p.nombre}{p.codigo !== 'basico' && p.codigo !== e.plan ? (libres > 0 ? ` · ${libres} libre${libres === 1 ? '' : 's'}` : ` · +${soles(extraHoy(p, oferta))}`) : ''}
                          </option>
                        })}
                      </select>
                    ) : NOMBRE_PLAN[e.plan]}
                    {e.planProgramado && e.planProgramadoDesde && (
                      <div className="secundario">
                        Desde el {fecha(e.planProgramadoDesde)}: {NOMBRE_PLAN[e.planProgramado]}
                        {puede && <> · <button type="button" className="enlace" onClick={() => void cambio.abrir(e.id, e.plan)}>Deshacer</button></>}
                      </div>
                    )}
                    {e.efectivo !== e.plan && <div className="secundario">Hoy ve: {NOMBRE_PLAN[e.efectivo]}{dias !== null ? ' (mes gratis)' : ''}</div>}
                  </td>
                  <td>{e.pausada ? <span className="secundario">Nada (en pausa)</span>
                    : <span title="Ya está dentro de lo que elegiste arriba">Dentro de tus {NOMBRE_PLAN[e.plan]}</span>}</td>
                </tr>
              )
            })}
            {cartera.length === 0 && <tr><td colSpan={3} className="secundario">Todavía no tienes empresas en tu cartera. Agrégalas desde «Mi cartera».</td></tr>}
          </tbody>
        </table>
        {(sinUsarPro > 0 || sinUsarMax > 0) && (
          <div className="franja-programado crt-sin-usar">
            <span>Tienes <strong>{[sinUsarPro > 0 && `${sinUsarPro} Pro`, sinUsarMax > 0 && `${sinUsarMax} Max`].filter(Boolean).join(' y ')} sin usar</strong>:
              los pagas igual. Pásaselos a una empresa en la tabla, o bájalos arriba y guarda.</span>
          </div>
        )}
        <ul className="ayuda-tabla">
          <li><strong>Plan de la empresa:</strong> si la subes a mitad de mes y no tienes un cupo libre de ese plan, pagas la diferencia solo por los días que faltan;
            si la bajas, el cambio empieza en tu próximo cobro y su cupo queda libre para otra.</li>
          <li><strong>Tu propia empresa</strong> no va aquí: está en <Link to="/mi-estudio/empresa">Mi empresa</Link> (Básico gratis; si la subes, pagas solo la diferencia).</li>
        </ul>
      </section>

      {/* e281 (096): invitar a otros contadores. */}
      <InvitarContadores puede={puede} />

      <div className="como-funciona">
        <h3>Cómo funciona</h3>
        <ul>
          <li>Pagas por las empresas que eliges en cada plan, aunque no las uses todas. Puedes bajar para el mes siguiente.</li>
          <li>Precio por empresa al mes: Básico {soles(unidad('basico'))}, Pro {soles(unidad('pro'))} y Max {soles(unidad('max'))}{oferta ? ' (precio de lanzamiento)' : ''}.
            {conTramos && ' Con más empresas, el Básico baja (descuento por cantidad).'}</li>
          <li>Si agregas una empresa de más, te decimos lo que cuesta y la sumas al confirmar. Nunca se bloquea a las que ya tienes.</li>
          <li>Pausar una empresa libera su lugar. La empresa de tu propio estudio es gratis en Básico y no se cuenta.</li>
          <li>Todo se factura a tu estudio, en una sola factura con el detalle.</li>
          {catalogo.reglas.rucGratisActivo && <li>Cada RUC nuevo que sumes tiene un mes gratis (una vez por RUC, hasta {catalogo.reglas.rucGratisTope} al mes).</li>}
        </ul>
      </div>
      {cambio.dialogo}
      {dialogo}
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

function ResumenPago({ filas, condiciones, boton, nota, extra }: {
  filas: { texto: ReactNode; monto?: string; fuerte?: boolean }[]
  condiciones: Condicion[]
  boton: string
  nota?: ReactNode
  /** e280: algo antes del botón de pagar (en la Cartera, «Guardar»). */
  extra?: ReactNode
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
      {(() => {
        const pagar = listo
          ? <Link className={extra ? 'boton secundario' : 'boton'} to="/mi-plan/pagos">{boton}</Link>
          : <button type="button" className={extra ? 'boton secundario' : 'boton'} disabled title="Falta lo marcado con ✗">{boton}</button>
        // e280: con «Guardar» (Cartera), los dos botones van juntos, uno debajo del otro.
        return extra ? <div className="acciones-pago">{extra}{pagar}</div> : pagar
      })()}
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