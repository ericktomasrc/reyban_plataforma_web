import type { LineaDocumento } from '../tipos'

/**
 * e166 — EL RECHAZO DE SUNAT EN PALABRAS, para facturas, boletas y notas
 * (como el de las guías, RechazoGuia).
 *
 * SUNAT contesta con un código y un texto técnico («El XML debe contener al
 * menos un tributo por linea de afectacion por IGV - Detalle: xxx.xxx.xxx
 * value='ticket: … error: Error en la linea: 1: 3105…'»). Aquí se dice QUÉ dato
 * está mal, en QUÉ línea si se sabe, y CÓMO corregirlo. El texto de SUNAT
 * queda plegado debajo, para soporte.
 *
 * Solo van los códigos que se conocen bien; el resto sale con el texto de
 * SUNAT limpio. Si aparece uno nuevo a menudo, se agrega aquí.
 */

interface Explicacion { campo: string; corregir: string }

const ERRORES: Record<string, Explicacion> = {
  '3105': { campo: 'Una línea sin valor',
            corregir: 'Una línea gravada, exonerada o inafecta quedó en cero (sin precio, o con todo descontado). Ponle su precio o baja el descuento.' },
  '2017': { campo: 'El cliente',
            corregir: 'Una factura exige que el cliente tenga RUC. Emite una boleta o elige un cliente con RUC.' },
  '2800': { campo: 'El tipo de documento del cliente',
            corregir: 'No corresponde a este comprobante. Revisa en la ficha del cliente si es DNI, RUC o carné de extranjería.' },
  '1032': { campo: 'El número del comprobante',
            corregir: 'Ese número ya figura en SUNAT como anulado o rechazado. Emite uno nuevo: saldrá con el número siguiente.' },
  '2010': { campo: 'Tu RUC',
            corregir: 'SUNAT dice que el RUC emisor no está activo. Revisa su situación en la consulta RUC de SUNAT.' },
  '2011': { campo: 'Tu RUC',
            corregir: 'SUNAT dice que el RUC emisor está «no habido». Hay que regularizar el domicilio fiscal en SUNAT.' },
  '2108': { campo: 'La fecha de emisión',
            corregir: 'Está fuera del plazo de envío (3 días la factura, 7 la boleta). Emite el comprobante con fecha de hoy.' },
  '3277': { campo: 'Los totales',
            corregir: 'La base imponible no cuadra con la suma de las líneas. Suele ser un redondeo: revisa los precios con muchos decimales y emite de nuevo.' },
  '3244': { campo: 'La forma de pago',
            corregir: 'Falta indicar si es al contado o al crédito. Elígela y emite de nuevo.' },
  '3249': { campo: 'Las cuotas',
            corregir: 'Al crédito hace falta al menos una cuota con su monto y su fecha de vencimiento.' },
  '3267': { campo: 'La fecha de una cuota',
            corregir: 'Cada cuota tiene que vencer después de la fecha de emisión.' },
  '2642': { campo: 'La afectación de las líneas',
            corregir: 'En una factura de exportación todas las líneas tienen que ser de exportación.' },
  '2644': { campo: 'El arroz pilado (IVAP)',
            corregir: 'Va en su propio comprobante: no se mezcla con otras líneas.' },
  '2335': { campo: 'La firma del comprobante',
            corregir: 'SUNAT dice que el documento fue alterado. Suele ser el certificado digital: revísalo en el panel del servicio.' },
}

/** El número de error, la línea que señala SUNAT y su texto sin la parte técnica. */
export function leerRechazo(codigo: string | null, mensaje: string | null) {
  const texto = mensaje ?? ''
  const num = codigo && codigo !== '0' && codigo !== '99'
    ? codigo
    : /error:\s*Error en la linea:\s*\d+:\s*(\d+)/i.exec(texto)?.[1] ?? null
  const linea = /Error en la linea:\s*(\d+)/i.exec(texto)?.[1] ?? null
  const limpio = texto.replace(/\s*-\s*Detalle:.*$/s, '').trim()
  return { num, linea: linea ? Number(linea) : null, limpio }
}

export function RechazoComprobante({ codigo, mensaje, lineas, nota }: {
  codigo: string | null
  mensaje: string | null
  lineas: LineaDocumento[]
  /** Qué hacer después (copiar y emitir otro, etc.). */
  nota?: string
}) {
  const { num, linea, limpio } = leerRechazo(codigo, mensaje)
  const e = num ? ERRORES[num] : undefined

  // En el 3105 se sabe qué líneas son: las que quedaron en cero.
  const enCero = num === '3105' ? lineas.filter(l => l.valorVenta <= 0) : []
  const marcada = linea && lineas.find(l => l.numero === linea)

  return (
    <div className="rechazo-sunat">
      <strong>SUNAT lo rechazó. Qué corregir:</strong>
      <ul>
        {e ? (
          <li><strong>{e.campo}.</strong> {e.corregir}</li>
        ) : (
          <li>{limpio || 'SUNAT no dio detalle.'}</li>
        )}
        {enCero.length > 0 ? (
          <li>
            {enCero.length === 1 ? 'Es la línea ' : 'Son las líneas '}
            {enCero.map((l, i) => <span key={l.numero}>{i > 0 && ', '}<strong>{l.numero}</strong> («{l.descripcion}»)</span>)}.
          </li>
        ) : marcada ? (
          <li>SUNAT señala la línea <strong>{marcada.numero}</strong> («{marcada.descripcion}»).</li>
        ) : null}
      </ul>
      {nota && <p className="nota">{nota}</p>}
      {mensaje && (
        <details>
          <summary>Detalle técnico de SUNAT{num ? ` (error ${num})` : ''}</summary>
          <code className="mono">{mensaje}</code>
        </details>
      )}
    </div>
  )
}