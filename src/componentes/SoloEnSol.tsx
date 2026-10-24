/**
 * 24 OCT — «LO QUE SE HACE EN SOL (no en este sistema)».
 *
 * Hay trámites que SUNAT no recibe desde sistemas propios: solo en su portal
 * (SUNAT Operaciones en Línea, con Clave SOL). Para que nadie los busque aquí,
 * cada pantalla que toca el tema los dice, plegados y en pequeño.
 */

type Tema = 'guias' | 'comprobantes'

const LISTA: Record<Tema, { que: string; donde: string; aqui?: string }[]> = {
  guias: [
    { que: 'GRE por evento (no se pudo llegar, o la carga pasó a otro vehículo en el camino)',
      donde: 'SOL › Guía de remisión electrónica › Emisión de GRE por evento, antes de reiniciar el traslado.',
      aqui: 'Después: «Registrar evento hecho en SOL» en la guía.' },
    { que: 'Anular (dar de baja) una guía',
      donde: 'SOL › Guía de remisión electrónica. SUNAT no tiene servicio para darlas de baja desde sistemas.',
      aqui: 'Después: «Registrar anulación hecha en SOL» en la guía.' },
    { que: 'Las credenciales de guías (ID y clave de la API)',
      donde: 'SOL › Credenciales de API SUNAT › Gestión de credenciales (aplicación «GRE Emisión de comprobantes»).',
      aqui: 'Después: pégalas en Configuración de guías.' },
    { que: 'La guía de bienes fiscalizados (GRE BF: insumos químicos y bienes controlados)',
      donde: 'SOL › SOL GREBF. Este sistema no la emite.' },
  ],
  comprobantes: [
    { que: 'El usuario secundario SOL con el que se envían los comprobantes',
      donde: 'SOL › Administración de usuarios secundarios.',
      aqui: 'Después: ponlo en el paso «SUNAT» de Configurar la empresa.' },
    { que: 'El depósito de la detracción',
      donde: 'Lo hace el cliente en el Banco de la Nación o en SOL; aquí solo se indica en la factura.' },
    { que: 'El registro de ventas (SIRE) y las declaraciones mensuales',
      donde: 'SOL › SIRE y Declaración y pago. Este sistema todavía no los presenta.' },
  ],
}

export function SoloEnSol({ temas }: { temas: Tema[] }) {
  return (
    <details className="solo-en-sol">
      <summary>Lo que se hace en el portal de SUNAT (SOL), no en este sistema</summary>
      <ul>
        {temas.flatMap(t => LISTA[t]).map(x => (
          <li key={x.que}>
            <strong>{x.que}:</strong> {x.donde}
            {x.aqui && <span className="secundario"> {x.aqui}</span>}
          </li>
        ))}
      </ul>
    </details>
  )
}