import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Boton } from '../../../componentes/Boton'
import { Dialogo } from '../../../componentes/Dialogo'
import { EVENTO_TOPE } from '../../../nucleo/api/cliente'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { soles } from '../../../nucleo/planes/planes'
import { planesServicio, type TopeComprobantes } from '../servicios/planesServicio'

/**
 * e234 (085) — EL TOPE DE COMPROBANTES DEL MES.
 *
 *   · <TarjetaTope/>: en Inicio, la barrita «4,120 de 6,000» y, desde el 80 %,
 *     el aviso con «Comprar paquete».
 *   · <AvisoTopeGlobal/>: cuando la API frena una emisión (402 «tope»), se abre
 *     «Llegaste a tu tope» con el paquete o subir de plan. Va en la cabecera.
 *   · useComprarPaquete(): el diálogo de compra (con la tarjeta guardada).
 *
 * El precio y la cantidad los pone la base; aquí solo se muestran.
 */

const n = (x: number | undefined) => (x ?? 0).toLocaleString('en-US')
const EVENTO_TOPE_CAMBIO = 'reyban:tope-cambio'

export function useComprarPaquete() {
  const mensaje = useMensaje()
  const [q, setQ] = useState<TopeComprobantes>()
  const [ocupado, setOcupado] = useState(false)

  async function comprar() {
    if (!q) return
    setOcupado(true)
    try {
      const r = await planesServicio.comprarPaquete(q.empresa)
      if (r.estado === 'procesando') mensaje.ojo(r.error ?? 'El pago se está confirmando. El paquete se suma solo en unos minutos.')
      else mensaje.bien(r.mensaje)
      setQ(undefined)
      window.dispatchEvent(new Event(EVENTO_TOPE_CAMBIO))
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo comprar el paquete.')
    } finally { setOcupado(false) }
  }

  const p = q?.paquete
  const conTarjeta = !!q?.conTarjeta && !!q?.tarjeta
  const dialogo = q && p && (
    <Dialogo titulo={`Paquete de ${n(p.cantidad)} comprobantes extra`} abierto onCerrar={() => !ocupado && setQ(undefined)}
      acciones={<>
        <Boton estilo="secundario" disabled={ocupado} onClick={() => setQ(undefined)}>Cancelar</Boton>
        {q.puedeComprar && conTarjeta && (
          <Boton ocupado={ocupado} onClick={() => void comprar()}>Pagar {soles(p.precio)} y sumarlos</Boton>
        )}
      </>}>
      <div className="cambio-plan">
        <div className="cambio-plan-monto">
          <span>Pagas hoy</span>
          <strong>{soles(p.precio)}{p.precioNormal > p.precio && <s className="tope-tachado">{soles(p.precioNormal)}</s>}</strong>
          <small>+{n(p.cantidad)} comprobantes. Se usan solo cuando pasas tu tope del mes, y lo que no uses pasa al mes siguiente: no vencen.</small>
        </div>
        {q.puedeComprar && conTarjeta && <div className="cambio-plan-tarjeta">💳 {q.tarjeta!.marca} •••• {q.tarjeta!.ultimos4}<span>tu tarjeta guardada</span></div>}
        {q.puedeComprar && !conTarjeta && (
          <p className="nota">Para comprarlo, agrega tu tarjeta en <Link to="/mi-plan/pagos" onClick={() => setQ(undefined)}>Mi plan › Mis pagos</Link>.
            Se cobra al instante y el paquete se activa solo.</p>
        )}
        {!q.puedeComprar && <p className="nota">Los paquetes los compra el dueño de la cuenta (o un colaborador administrador). Avísale para que lo compre desde Inicio o Mi plan.</p>}
        {q.sinDineroReal && conTarjeta && <p className="nota">Modo de prueba: no se mueve dinero real.</p>}
      </div>
    </Dialogo>
  )

  return { abrir: setQ, dialogo }
}

/** Lee el tope de la empresa abierta (o de la indicada) y se refresca al comprar. */
export function useTope(empresaId?: string) {
  const [q, setQ] = useState<TopeComprobantes>()
  const leer = useCallback(() => {
    planesServicio.comprobantes(empresaId).then(setQ).catch(() => setQ(undefined))
  }, [empresaId])
  useEffect(() => {
    leer()
    window.addEventListener(EVENTO_TOPE_CAMBIO, leer)
    return () => window.removeEventListener(EVENTO_TOPE_CAMBIO, leer)
  }, [leer])
  return q
}

/** En Inicio: cuántos lleva este mes, con su barrita y el aviso desde el 80 %. */
export function TarjetaTope() {
  const q = useTope()
  const paquete = useComprarPaquete()
  if (!q?.aplica) return null
  const capacidad = (q.emitidos ?? 0) + (q.disponible ?? 0)
  const pct = q.porcentaje ?? 0
  const color = pct >= 95 ? 'rojo' : pct >= 80 ? 'ambar' : 'verde'
  const mes = new Date().toLocaleDateString('es-PE', { month: 'long', timeZone: 'America/Lima' })
  return (
    <section className="bloque tope-tarjeta">
      <div className="tope-cabeza">
        <div>
          <h2>Comprobantes de {mes}</h2>
          <p className="secundario">Facturas y boletas · se reinicia el {fecha(q.reinicia!)}
            {(q.saldo ?? 0) > 0 && <> · te quedan {n(q.saldo)} de paquetes (no vencen)</>}</p>
        </div>
        <div className="tope-numero">{n(q.emitidos)} <span>de {n(capacidad)}</span></div>
      </div>
      <div className="tope-barra"><i className={color} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
      <div className="tope-pie secundario">
        <span>{pct} % usado · te quedan {n(q.disponible)}</span>
        <span>Las notas de crédito y las anulaciones no cuentan</span>
      </div>
      {pct >= 80 && (
        <div className={'tope-alerta ' + (q.bloqueado ? 'rojo' : 'ambar')}>
          <span>
            {q.bloqueado
              ? <><strong>Llegaste a tu tope del mes.</strong> Las facturas y boletas nuevas están en pausa hasta el {fecha(q.reinicia!)}. </>
              : <><strong>Vas por el {pct} % de tus comprobantes.</strong> Para no quedarte sin emitir, </>}
            compra un paquete de {n(q.paquete?.cantidad)} más ({soles(q.paquete?.precio)}) o sube de plan.
          </span>
          <span className="tope-acciones">
            <Boton onClick={() => paquete.abrir(q)}>Comprar paquete</Boton>
            <Link to="/mi-plan" className="enlace">Ver planes</Link>
          </span>
        </div>
      )}
      {paquete.dialogo}
    </section>
  )
}

/** En la cabecera: cuando la API frena una emisión por el tope. */
export function AvisoTopeGlobal() {
  const [q, setQ] = useState<TopeComprobantes>()
  const paquete = useComprarPaquete()
  useEffect(() => {
    // Lo que manda la API trae el tope; se vuelve a leer para saber la tarjeta.
    const abrir = () => { planesServicio.comprobantes().then(r => { if (r.aplica) setQ(r) }).catch(() => {}) }
    window.addEventListener(EVENTO_TOPE, abrir)
    return () => window.removeEventListener(EVENTO_TOPE, abrir)
  }, [])

  if (paquete.dialogo) return paquete.dialogo
  if (!q) return null
  return (
    <Dialogo titulo="Llegaste a tu tope de este mes" abierto onCerrar={() => setQ(undefined)}
      acciones={<>
        <Boton estilo="secundario" onClick={() => setQ(undefined)}>Ahora no</Boton>
        <Boton onClick={() => { paquete.abrir(q); setQ(undefined) }}>Comprar paquete · {soles(q.paquete?.precio)}</Boton>
      </>}>
      <div className="cambio-plan">
        <div className="tope-alerta rojo" style={{ marginTop: 0 }}>
          <span>Ya emitiste tus <strong>{n(q.emitidos)} comprobantes</strong> de este mes. Las facturas y boletas nuevas están en pausa
            hasta el {fecha(q.reinicia!)}.</span>
        </div>
        <p>Para seguir emitiendo ahora mismo:</p>
        <div className="tope-opcion">
          <strong>Paquete extra: +{n(q.paquete?.cantidad)} comprobantes</strong> · {soles(q.paquete?.precio)}
          {(q.paquete?.precioNormal ?? 0) > (q.paquete?.precio ?? 0) && <s className="tope-tachado">{soles(q.paquete?.precioNormal)}</s>}
          <div className="secundario">Se activa al instante y lo que no uses pasa al mes siguiente.</div>
        </div>
        <div className="tope-opcion">
          <strong>Subir de plan</strong> · más comprobantes cada mes
          <div className="secundario">En <Link to="/mi-plan" onClick={() => setQ(undefined)}>Mi plan</Link>: pagas solo la diferencia por los días que quedan.</div>
        </div>
        <p className="nota">Puedes seguir haciendo notas de crédito, anular comprobantes y ver todo lo emitido. Lo que ya está en camino a SUNAT sigue su curso.</p>
      </div>
    </Dialogo>
  )
}

/** En las tarjetas de planes: «6,000 comprobantes al mes» con el normal tachado (lanzamiento). */
export function textoTope(p: { topeRegular?: number | null; topeOferta?: number | null }, oferta: boolean) {
  if (!p.topeRegular) return null
  const hoy = oferta ? (p.topeOferta ?? p.topeRegular) : p.topeRegular
  return (
    <>
      <strong>{n(hoy)}</strong> comprobantes al mes
      {hoy > p.topeRegular && <> <s className="tope-tachado">{n(p.topeRegular)}</s></>}
    </>
  )
}