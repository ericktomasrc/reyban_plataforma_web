import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Asterisco, Campo } from '../../../componentes/Campo'

// =============================================================================
// 040 — CONTADO O CRÉDITO, Y DETRACCIÓN (lo que pregunta «Emitir Factura» en
// SUNAT SOL). Solo facturas.
// =============================================================================

export interface CuotaEnEdicion { clave: string; monto: string; vence: string }

export interface PagoEnEdicion {
  forma: 'contado' | 'credito'
  cuotas: CuotaEnEdicion[]
}

export interface DetraccionEnEdicion {
  activa: boolean
  codigo: string
  porcentaje: string
  cuenta: string
  medioPago: string
  /** Quien emite la marcó o desmarcó a mano: ya no se propone sola. */
  tocada: boolean
}

export const pagoInicial = (): PagoEnEdicion => ({ forma: 'contado', cuotas: [] })

export const detraccionInicial = (): DetraccionEnEdicion => ({
  activa: false, codigo: '', porcentaje: '', cuenta: '', medioPago: '001', tocada: false,
})

/**
 * Catálogo 54: los bienes y servicios sujetos a detracción más comunes, con la
 * tasa que se usa hoy. LA TASA ES UNA SUGERENCIA: se puede cambiar, y quien
 * emite (o su contador) es quien sabe la que le toca.
 */
export const CODIGOS_DETRACCION: { codigo: string; nombre: string; tasa: number; grupo: 'Servicios' | 'Bienes' }[] = [
  { codigo: '022', nombre: 'Otros servicios empresariales (contables, legales, consultoría, publicidad…)', tasa: 12, grupo: 'Servicios' },
  { codigo: '037', nombre: 'Demás servicios gravados con el IGV', tasa: 12, grupo: 'Servicios' },
  { codigo: '012', nombre: 'Intermediación laboral y tercerización', tasa: 12, grupo: 'Servicios' },
  { codigo: '020', nombre: 'Mantenimiento y reparación de bienes muebles', tasa: 12, grupo: 'Servicios' },
  { codigo: '019', nombre: 'Arrendamiento de bienes', tasa: 10, grupo: 'Servicios' },
  { codigo: '021', nombre: 'Movimiento de carga', tasa: 10, grupo: 'Servicios' },
  { codigo: '024', nombre: 'Comisión mercantil', tasa: 10, grupo: 'Servicios' },
  { codigo: '025', nombre: 'Fabricación de bienes por encargo', tasa: 10, grupo: 'Servicios' },
  { codigo: '026', nombre: 'Servicio de transporte de personas', tasa: 10, grupo: 'Servicios' },
  { codigo: '027', nombre: 'Servicio de transporte de carga', tasa: 4, grupo: 'Servicios' },
  { codigo: '030', nombre: 'Contratos de construcción', tasa: 4, grupo: 'Servicios' },
  { codigo: '004', nombre: 'Recursos hidrobiológicos', tasa: 4, grupo: 'Bienes' },
  { codigo: '008', nombre: 'Madera', tasa: 4, grupo: 'Bienes' },
  { codigo: '009', nombre: 'Arena y piedra', tasa: 10, grupo: 'Bienes' },
  { codigo: '010', nombre: 'Residuos, subproductos, desechos, recortes y desperdicios', tasa: 15, grupo: 'Bienes' },
  { codigo: '014', nombre: 'Carnes y despojos comestibles', tasa: 4, grupo: 'Bienes' },
  { codigo: '023', nombre: 'Leche', tasa: 4, grupo: 'Bienes' },
  { codigo: '031', nombre: 'Oro gravado con el IGV', tasa: 10, grupo: 'Bienes' },
  { codigo: '034', nombre: 'Minerales metálicos no auríferos', tasa: 10, grupo: 'Bienes' },
  { codigo: '035', nombre: 'Bienes exonerados del IGV', tasa: 1.5, grupo: 'Bienes' },
  { codigo: '039', nombre: 'Minerales no metálicos', tasa: 10, grupo: 'Bienes' },
  { codigo: '040', nombre: 'Bien inmueble gravado con IGV', tasa: 4, grupo: 'Bienes' },
]

/** Catálogo 59: medio de pago de la detracción. */
export const MEDIOS_PAGO_DETRACCION: { codigo: string; nombre: string }[] = [
  { codigo: '001', nombre: 'Depósito en cuenta' },
  { codigo: '002', nombre: 'Giro' },
  { codigo: '003', nombre: 'Transferencia de fondos' },
  { codigo: '004', nombre: 'Orden de pago' },
  { codigo: '005', nombre: 'Tarjeta de débito' },
  { codigo: '006', nombre: 'Tarjeta de crédito' },
  { codigo: '007', nombre: 'Cheque no negociable' },
  { codigo: '008', nombre: 'Efectivo (sin obligación de medio de pago)' },
  { codigo: '009', nombre: 'Efectivo, en los demás casos' },
  { codigo: '999', nombre: 'Otros medios de pago' },
]

export const nombreDetraccion = (codigo: string) =>
  CODIGOS_DETRACCION.find(c => c.codigo === codigo)?.nombre ?? `Código ${codigo}`

/** El umbral de la norma: operaciones de S/ 700 o menos no llevan detracción. */
export const UMBRAL_DETRACCION = 700

export const CUENTA_BN = /^[0-9][0-9-]{4,23}[0-9]$/

const num = (s: string) => {
  const n = Number((s ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Suma días a «AAAA-MM-DD» sin pasar por la zona del navegador. */
export function sumarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

/** Detracción en soles, redondeada al entero como el depósito del Banco de la Nación. */
export function montoDetraccion(det: DetraccionEnEdicion, totalSoles: number): number | null {
  if (!det.activa || !(totalSoles > 0) || !(num(det.porcentaje) > 0)) return null
  return Math.round(totalSoles * num(det.porcentaje) / 100)
}

/**
 * Lo que de verdad se le cobra al cliente a crédito: el total menos la
 * detracción (que va al Banco de la Nación, no al vendedor). En la moneda de
 * la factura.
 */
export function netoPendiente(total: number, moneda: string, tipoCambio: number, detSoles: number | null): number {
  if (!detSoles) return r2(total)
  const enMoneda = moneda === 'PEN' ? detSoles : tipoCambio > 0 ? detSoles / tipoCambio : 0
  return r2(Math.max(0, total - enMoneda))
}

/** Reparte un monto en `n` cuotas cada `dias` días. La última absorbe el redondeo. */
export function repartir(monto: number, n: number, desde: string, dias: number): CuotaEnEdicion[] {
  const base = Math.floor((monto / n) * 100) / 100
  return Array.from({ length: n }, (_, i) => ({
    clave: crypto.randomUUID(),
    monto: (i === n - 1 ? r2(monto - base * (n - 1)) : base).toFixed(2),
    vence: sumarDias(desde, dias * (i + 1)),
  }))
}

/** Qué está mal, para guardar. Null si nada. */
export function revisarPago(
  tipo: string, pago: PagoEnEdicion, det: DetraccionEnEdicion, fechaEmision: string, total: number,
): string | undefined {
  if (tipo !== '01') return undefined

  if (pago.forma === 'credito') {
    for (const [i, c] of pago.cuotas.entries()) {
      if (!(num(c.monto) > 0)) return `La cuota ${i + 1} tiene que ser mayor que cero.`
      if (!c.vence) return `A la cuota ${i + 1} le falta la fecha de vencimiento.`
      if (c.vence <= fechaEmision) return `La cuota ${i + 1} tiene que vencer después de la fecha de emisión.`
    }
    const suma = r2(pago.cuotas.reduce((s, c) => s + num(c.monto), 0))
    if (suma > r2(total)) return `Las cuotas suman ${suma.toFixed(2)} y el total es ${total.toFixed(2)}: no pueden pasar del total.`
  }

  if (det.activa) {
    if (!/^[0-9]{3}$/.test(det.codigo)) return 'Elige el bien o servicio sujeto a detracción.'
    if (!(num(det.porcentaje) > 0 && num(det.porcentaje) <= 100)) return 'El porcentaje de detracción va entre 0 y 100 (por ejemplo 12).'
    if (!CUENTA_BN.test(det.cuenta.trim())) return 'Falta la cuenta de detracciones del Banco de la Nación (números y guiones).'
  }

  return undefined
}


/**
 * El bloque «Forma de pago y detracción» de la pantalla de emisión.
 */
export function PagoYDetraccion({
  moneda, total, totalSoles, tipoCambio, fechaEmision, pago, onPago, det, onDet,
}: {
  moneda: string
  total: number
  /** El total en soles (en dólares, con el tipo de cambio). 0 si todavía no se sabe. */
  totalSoles: number
  tipoCambio: number
  fechaEmision: string
  pago: PagoEnEdicion
  onPago: (p: PagoEnEdicion) => void
  det: DetraccionEnEdicion
  onDet: (d: DetraccionEnEdicion) => void
}) {
  const detSoles = montoDetraccion(det, totalSoles)
  const neto = netoPendiente(total, moneda, tipoCambio, detSoles)
  const sumaCuotas = r2(pago.cuotas.reduce((s, c) => s + num(c.monto), 0))
  const simbolo = moneda === 'PEN' ? 'S/' : 'US$'

  function ponerForma(forma: 'contado' | 'credito') {
    if (forma === 'contado') onPago({ forma, cuotas: [] })
    // Al pasar a crédito, una cuota por el neto a 30 días: lo más común.
    else onPago({ forma, cuotas: pago.cuotas.length ? pago.cuotas : repartir(neto, 1, fechaEmision, 30) })
  }

  const cambiarCuota = (clave: string, campo: 'monto' | 'vence', valor: string) =>
    onPago({ ...pago, cuotas: pago.cuotas.map(c => c.clave === clave ? { ...c, [campo]: valor } : c) })

  function elegirCodigo(codigo: string) {
    const c = CODIGOS_DETRACCION.find(x => x.codigo === codigo)
    onDet({ ...det, codigo, porcentaje: c ? String(c.tasa) : det.porcentaje, tocada: true })
  }

  const sugerirDetraccion = !det.activa && totalSoles > UMBRAL_DETRACCION

  return (
    <div className="bloque">
      <h2 className="subtitulo">Forma de pago y detracción</h2>

      {/* --- Contado o crédito ---------------------------------------------- */}
      <div className="campo">
        <span className="etiqueta">Tipo de transacción<Asterisco /></span>
        <div className="opciones-en-linea" role="radiogroup">
          <label className="casilla">
            <input type="radio" name="forma-pago" checked={pago.forma === 'contado'}
                   onChange={() => ponerForma('contado')} />
            <span>Al contado</span>
          </label>
          <label className="casilla">
            <input type="radio" name="forma-pago" checked={pago.forma === 'credito'}
                   onChange={() => ponerForma('credito')} />
            <span>Al crédito</span>
          </label>
        </div>
      </div>

      {pago.forma === 'credito' && (
        <div className="cuotas">
          <p className="nota">
            SUNAT pide las cuotas con su monto y su fecha de vencimiento. Suman lo que el cliente
            te debe: <strong>{simbolo} {neto.toFixed(2)}</strong>
            {detSoles ? <> (el total menos la detracción)</> : null}.
          </p>

          {pago.cuotas.map((c, i) => (
            <div key={c.clave} className="fila-cuota">
              <span className="numero">{i + 1}</span>
              <Campo etiqueta={`Monto (${simbolo})`} obligatorio inputMode="decimal" value={c.monto}
                     onChange={e => cambiarCuota(c.clave, 'monto', e.target.value)}
                     mal={!(num(c.monto) > 0)} />
              <label className="campo">
                <span className="etiqueta">Vence<Asterisco /></span>
                <input type="date" value={c.vence} min={sumarDias(fechaEmision, 1)}
                       onChange={e => cambiarCuota(c.clave, 'vence', e.target.value)}
                       aria-invalid={!c.vence || c.vence <= fechaEmision ? true : undefined} />
              </label>
              {pago.cuotas.length > 1 && (
                <Boton estilo="plano" onClick={() => onPago({ ...pago, cuotas: pago.cuotas.filter(x => x.clave !== c.clave) })}>
                  Quitar
                </Boton>
              )}
            </div>
          ))}

          <div className="botonera">
            <Boton estilo="secundario" onClick={() => onPago({
              ...pago,
              cuotas: [...pago.cuotas, {
                clave: crypto.randomUUID(),
                monto: Math.max(0, r2(neto - sumaCuotas)).toFixed(2),
                vence: sumarDias(pago.cuotas.at(-1)?.vence || fechaEmision, 30),
              }],
            })}>
              Añadir cuota
            </Boton>
            {[1, 2, 3].map(n => (
              <Boton key={n} estilo="plano" onClick={() => onPago({ ...pago, cuotas: repartir(neto, n, fechaEmision, 30) })}>
                {n === 1 ? '1 cuota a 30 días' : `${n} cuotas cada 30 días`}
              </Boton>
            ))}
          </div>

          {sumaCuotas !== neto && (
            <p className={sumaCuotas > r2(total) ? 'pista mal' : 'pista'}>
              Las cuotas suman {simbolo} {sumaCuotas.toFixed(2)}
              {sumaCuotas > r2(total)
                ? ': pasan del total de la factura.'
                : `; lo que se cobra a crédito es ${simbolo} ${neto.toFixed(2)}. Si el resto se pagó al contado, está bien.`}
            </p>
          )}
        </div>
      )}

      {/* --- Detracción ------------------------------------------------------ */}
      <div className="campo">
        <span className="etiqueta">¿Operación sujeta a detracción?</span>
        <div className="opciones-en-linea" role="radiogroup">
          <label className="casilla">
            <input type="radio" name="detraccion" checked={det.activa}
                   onChange={() => onDet({ ...det, activa: true, tocada: true })} />
            <span>Sí</span>
          </label>
          <label className="casilla">
            <input type="radio" name="detraccion" checked={!det.activa}
                   onChange={() => onDet({ ...det, activa: false, tocada: true })} />
            <span>No</span>
          </label>
        </div>
      </div>

      {sugerirDetraccion && (
        <Aviso tono="ojo">
          La factura pasa de <strong>S/ {UMBRAL_DETRACCION}</strong>. Si es un servicio o bien sujeto a
          detracción —por ejemplo, <strong>servicios contables</strong> (código 022, 12 %)—, marca «Sí»:
          SUNAT la exige.
        </Aviso>
      )}

      {det.activa && (
        <>
          <label className="campo">
            <span className="etiqueta">Bien o servicio sujeto a detracción<Asterisco /></span>
            <select value={det.codigo} onChange={e => elegirCodigo(e.target.value)}>
              <option value="">Elige…</option>
              {(['Servicios', 'Bienes'] as const).map(g => (
                <optgroup key={g} label={g}>
                  {CODIGOS_DETRACCION.filter(c => c.grupo === g).map(c => (
                    <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <div className="pareja">
            <Campo etiqueta="Porcentaje (%)" obligatorio inputMode="decimal" value={det.porcentaje}
                   onChange={e => onDet({ ...det, porcentaje: e.target.value })}
                   pista="Propuesto según el código. Si tu caso es otro, cámbialo." />
            <label className="campo">
              <span className="etiqueta">Medio de pago<Asterisco /></span>
              <select value={det.medioPago} onChange={e => onDet({ ...det, medioPago: e.target.value })}>
                {MEDIOS_PAGO_DETRACCION.map(m => (
                  <option key={m.codigo} value={m.codigo}>{m.codigo} · {m.nombre}</option>
                ))}
              </select>
            </label>
          </div>

          <Campo etiqueta="Cuenta de detracciones (Banco de la Nación)" obligatorio value={det.cuenta}
                 onChange={e => onDet({ ...det, cuenta: e.target.value })}
                 placeholder="00-000-000000" mal={!!det.cuenta.trim() && !CUENTA_BN.test(det.cuenta.trim())}
                 pista="La de tu empresa. Se guarda y la próxima factura la trae puesta." />

          <div className="resumen-detraccion">
            <span>Monto de la detracción</span>
            <strong className="mono">{detSoles != null ? `S/ ${detSoles.toFixed(2)}` : '—'}</strong>
            <span className="secundario">
              Siempre en soles, redondeado al entero (como el depósito del banco).
              {moneda !== 'PEN' && ' Con el tipo de cambio de la factura.'}
              {totalSoles > 0 && totalSoles <= UMBRAL_DETRACCION && ' Ojo: la factura no pasa de S/ 700; normalmente no lleva detracción.'}
            </span>
          </div>
        </>
      )}
    </div>
  )
}