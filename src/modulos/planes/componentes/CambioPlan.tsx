import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Boton } from '../../../componentes/Boton'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { NOMBRE_PLAN, soles } from '../../../nucleo/planes/planes'
import { planesServicio, type CodigoPlan, type CotizacionCambio } from '../servicios/planesServicio'

/**
 * e230 (083) — CAMBIAR DE PLAN, como las suscripciones de software:
 *
 *   · SUBIR: empieza ya. Si ya pagó un periodo que sigue corriendo, paga solo
 *     la diferencia por los días que quedan (con su tarjeta, en el momento).
 *     Sin tarjeta, o si es menos de S/ 3, sube ya y la diferencia va al
 *     próximo cobro.
 *   · BAJAR: no se devuelve nada; sigue con lo que pagó hasta el último día y
 *     el plan nuevo empieza en el próximo cobro. Se puede deshacer.
 *   · Sin un periodo pagado (mes gratis, cortesía…): cambia ya, sin cobrar.
 *
 * El monto lo calcula la base; aquí solo se muestra y se confirma.
 */
export function useCambioPlan(onHecho: (mensaje: string) => Promise<void>) {
  const mensaje = useMensaje()
  const [q, setQ] = useState<CotizacionCambio & { empresaId: string }>()
  const [cargando, setCargando] = useState<string>()
  const [ocupado, setOcupado] = useState(false)

  async function hacer(empresaId: string, plan: CodigoPlan, pagar: boolean) {
    const r = await planesServicio.cambiar(empresaId, plan, pagar)
    if (r.estado === 'procesando') {
      mensaje.ojo((r as { error?: string }).error ?? 'El pago se está confirmando. Tu plan sube solo en unos minutos.')
      await onHecho('')
      return
    }
    await onHecho(r.mensaje)
  }

  /** Abrir el cambio de una empresa a un plan. Lo que no necesita confirmación se hace directo. */
  async function abrir(empresaId: string, plan: CodigoPlan) {
    setCargando(empresaId + plan)
    try {
      const c = await planesServicio.cotizarCambio(empresaId, plan)
      if (c.accion === 'igual') return
      if (c.accion === 'inmediato' || c.accion === 'deshacer') {
        await hacer(empresaId, plan, false)
        return
      }
      setQ({ ...c, empresaId })
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo calcular el cambio de plan.')
    } finally { setCargando(undefined) }
  }

  async function confirmar(pagar: boolean) {
    if (!q) return
    setOcupado(true)
    try { await hacer(q.empresaId, q.nuevo, pagar); setQ(undefined) }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo cambiar el plan.') }
    finally { setOcupado(false) }
  }

  const dialogo = q && (
    <Dialogo titulo={q.accion === 'programado' ? `Bajar a ${NOMBRE_PLAN[q.nuevo]}` : `Subir a ${NOMBRE_PLAN[q.nuevo]}`}
             abierto onCerrar={() => !ocupado && setQ(undefined)}
             acciones={<Acciones q={q} ocupado={ocupado} onCancelar={() => setQ(undefined)} onConfirmar={confirmar} />}>
      {q.accion === 'programado' ? <Bajar q={q} /> : <Subir q={q} />}
    </Dialogo>
  )

  return { abrir, dialogo, cargando }
}

/** ¿Se puede pagar la diferencia ahora con su tarjeta? */
const pagaAhora = (q: CotizacionCambio) => !q.alProximo && q.conTarjeta && !!q.tarjeta && !!q.comprobante

function Subir({ q }: { q: CotizacionCambio }) {
  const monto = q.monto ?? 0
  const ahora = pagaAhora(q)
  return (
    <div className="cambio-plan">
      <p>{NOMBRE_PLAN[q.nuevo]} se activa <strong>ahora mismo</strong>. Solo pagas la diferencia por los días que quedan de lo que ya pagaste:</p>
      <div className="cambio-plan-monto">
        <span>{ahora ? 'Hoy pagas' : 'Se suma a tu próximo cobro'}</span>
        <strong>{soles(monto)}</strong>
        <small>
          Diferencia {soles(q.diferenciaMensual ?? 0)} al mes ({NOMBRE_PLAN[q.nuevo]} − {NOMBRE_PLAN[q.actual]})
          {q.periodo === 'anual' ? ` × ${12 - (q.mesesGratisAnual ?? 0)} meses del pago anual` : ''}
          {' '}× {q.dias} días que quedan (hasta el {fecha(q.hasta!)}) ÷ {q.diasPeriodo} días del periodo
        </small>
      </div>
      <div className="cambio-plan-filas">
        <div><span>Desde tu próximo cobro, cada mes</span><strong>{soles(q.nuevoMensual ?? 0)}</strong></div>
        {ahora && <div><span>Comprobante de hoy</span><strong>{q.comprobante === 'factura' ? 'Factura a tu RUC' : 'Boleta a tu DNI'}</strong></div>}
      </div>
      {ahora && <div className="cambio-plan-tarjeta">💳 {q.tarjeta!.marca} •••• {q.tarjeta!.ultimos4}<span>tu tarjeta guardada</span></div>}
      {!ahora && q.alProximo && <p className="nota">Como la diferencia es menor a {soles(q.minimo ?? 3)}, no se cobra hoy: va en tu próximo cobro.</p>}
      {!ahora && !q.alProximo && (
        <p className="nota">No tienes una tarjeta guardada{!q.comprobante ? ' ni los datos de tu comprobante' : ''}: subes ahora y la diferencia va en tu
          próximo cobro. Si prefieres pagarla hoy, agrega tu tarjeta en <Link to="/mi-plan/pagos">Mis pagos</Link>.</p>
      )}
      {q.sinDineroReal && ahora && <p className="nota">Modo de prueba: no se mueve dinero real.</p>}
    </div>
  )
}

function Bajar({ q }: { q: CotizacionCambio }) {
  return (
    <div className="cambio-plan">
      <p>Ya pagaste {NOMBRE_PLAN[q.actual]} hasta el <strong>{fecha(q.pagadoHasta!)}</strong>: lo sigues usando hasta ese día.</p>
      <div className="cambio-plan-filas">
        <div><span>Hasta el {fecha(q.pagadoHasta!)}</span><strong>{NOMBRE_PLAN[q.actual]} (ya pagado)</strong></div>
        <div><span>Desde el {fecha(q.desde!)}</span><strong>{NOMBRE_PLAN[q.nuevo]}</strong></div>
      </div>
      <p className="nota">Al pasar a {NOMBRE_PLAN[q.nuevo]} se esconden los menús que ese plan no trae. <strong>No se borra nada</strong>: si vuelves a
        subir, todo está ahí. Lo ya pagado no se devuelve.</p>
      <p className="nota">Puedes deshacerlo hasta el {fecha(q.pagadoHasta!)}.</p>
    </div>
  )
}

function Acciones({ q, ocupado, onCancelar, onConfirmar }: {
  q: CotizacionCambio; ocupado: boolean; onCancelar: () => void; onConfirmar: (pagar: boolean) => void
}) {
  const ahora = q.accion === 'cobrar' && pagaAhora(q)
  return (
    <>
      <Boton estilo="secundario" disabled={ocupado} onClick={onCancelar}>Cancelar</Boton>
      <Boton ocupado={ocupado} onClick={() => onConfirmar(ahora)}>
        {q.accion === 'programado' ? `Bajar a ${NOMBRE_PLAN[q.nuevo]} el ${fecha(q.desde!)}`
          : ahora ? `Pagar ${soles(q.monto ?? 0)} y subir a ${NOMBRE_PLAN[q.nuevo]}`
          : `Subir a ${NOMBRE_PLAN[q.nuevo]} ahora`}
      </Boton>
    </>
  )
}