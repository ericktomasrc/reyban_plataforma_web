/**
 * 24 OCT — EL RECHAZO DE SUNAT EN PALABRAS.
 *
 * SUNAT contesta con un código y un texto técnico («cac:ApplicableTransportMeans/
 * cbc:RegistrationNationalityID…»). Aquí se dice QUÉ dato está mal, el valor
 * que se mandó y CÓMO corregirlo. El texto de SUNAT queda plegado debajo, para
 * soporte.
 */

interface Explicacion { campo: string; corregir: string }

const ERRORES: Record<string, Explicacion> = {
  '2567': { campo: 'La placa del vehículo',
            corregir: 'Escríbela con 6 a 8 letras y números, sin guion ni espacios, como en la tarjeta de propiedad. Ej.: ABC123.' },
  '3355': { campo: 'El certificado de habilitación vehicular (TUC)',
            corregir: 'Escríbelo como figura en el certificado: de 10 a 15 letras y números (no es la tarjeta de propiedad). Ej.: 15M21028441E. Si es tu propio vehículo y no lo tienes, déjalo vacío.' },
  '3452': { campo: 'El certificado de habilitación vehicular (TUC) en transporte público',
            corregir: 'Pide a la empresa de transporte el número de certificado de su vehículo y escríbelo tal cual.' },
  '3454': { campo: 'El certificado de habilitación vehicular (TUC) en transporte público',
            corregir: 'Pide a la empresa de transporte el número de certificado de su vehículo y escríbelo tal cual.' },
  '2573': { campo: 'El conductor',
            corregir: 'Revisa su documento y su licencia: 9 o 10 letras y números, como en el brevete (una letra y el DNI). Ej.: Q41025874.' },
  '3353': { campo: 'El registro MTC',
            corregir: 'Escribe el número de registro del MTC tal como figura en la constancia (letras y números).' },
  '2574': { campo: 'La guía del remitente',
            corregir: 'Escribe el número de la guía del remitente que amparas (T001-453) y el RUC de quien la emitió.' },
  '4407': { campo: 'La autorización especial del vehículo',
            corregir: 'Elige qué entidad la dio (MTC, Digesa, Senasa…) o quita el número de autorización si no corresponde.' },
  '3390': { campo: 'El transportista subcontratado', corregir: 'Escribe su RUC y su razón social.' },
  '4424': { campo: 'El transportista subcontratado', corregir: 'Marca «Subcontraté el traslado» o quita sus datos.' },
  '3380': { campo: 'Un documento relacionado', corregir: 'Escribe el RUC de quien lo emitió (si lo emitiste tú, vacío = tu RUC).' },
  '3617': { campo: 'La fecha de entrega al transportista',
            corregir: 'Tiene que ser el mismo día del traslado o antes.' },
}

/** Saca el número de error, el texto y el valor del JSON que devuelve SUNAT. */
function leerRechazo(codigo: string | null, mensaje: string | null) {
  const texto = mensaje ?? ''
  const num = /"numError"\s*:\s*"?(\d+)/.exec(texto)?.[1] ?? (codigo && codigo !== '99' ? codigo : null)
  const des = /"desError"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(texto)?.[1]?.replace(/\\"/g, '"') ?? null
  const valor = /valor:\s*"([^"]*)"/.exec(des ?? texto)?.[1] ?? null
  // El texto de SUNAT sin la parte del nodo XML.
  const limpio = (des ?? texto).replace(/\s*\(nodo:.*$/s, '').replace(/^[^:]*:\s*\d+\s*$/, '').trim()
  return { num, valor, limpio }
}

export function RechazoGuia({ codigo, mensaje }: { codigo: string | null; mensaje: string | null }) {
  const { num, valor, limpio } = leerRechazo(codigo, mensaje)
  const e = num ? ERRORES[num] : undefined

  return (
    <div className="rechazo-sunat">
      <strong>SUNAT la rechazó. Qué corregir:</strong>
      <ul>
        {e ? (
          <li>
            <strong>{e.campo}</strong>{valor !== null && <> — mandaste «<span className="mono">{valor}</span>»</>}. {e.corregir}
          </li>
        ) : (
          <li>{limpio || 'SUNAT no dio detalle.'}{valor !== null && <> (valor: «<span className="mono">{valor}</span>»)</>}</li>
        )}
      </ul>
      <p className="nota">La guía rechazada no sustenta el traslado y no se edita: usa «Corregir y emitir otra», corrige ese dato y emite.</p>
      {mensaje && (
        <details>
          <summary>Detalle técnico de SUNAT{num ? ` (error ${num})` : ''}</summary>
          <code className="mono">{mensaje}</code>
        </details>
      )}
    </div>
  )
}