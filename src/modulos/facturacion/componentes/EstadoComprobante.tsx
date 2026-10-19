import type { EstadoDocumento } from '../tipos'

/**
 * El estado de un comprobante, con su color y su explicación.
 *
 * ESTÁ EN SU PROPIO ARCHIVO porque aparece en tres sitios —la lista, el
 * detalle y el resultado de emitir— y son los mismos siete estados. Escrito
 * tres veces, el día que se añada uno se queda en dos.
 *
 * LA DISTINCIÓN QUE MÁS IMPORTA, y que la pantalla tiene que dejar clarísima:
 *
 *   · **Error** — no se pudo ni entregar al servicio. Se arregla reintentando.
 *     El comprobante NO existe para SUNAT y no gastó correlativo.
 *
 *   · **Rechazado** — SUNAT dijo que no. NO se reintenta nunca: el documento
 *     está mal y mañana estará igual de mal. Se corrige emitiendo otro.
 *
 * Confundirlos lleva a reintentar lo que no se debe o a rehacer lo que solo
 * había que reenviar.
 */

const ESTADOS: Record<EstadoDocumento, { texto: string; clase: string; explica: string }> = {
  borrador: {
    texto: 'Borrador',
    clase: 'estado',
    explica: 'Solo existe aquí. Todavía no se ha mandado a ningún sitio.',
  },
  encolado: {
    texto: 'En camino',
    clase: 'estado aviso',
    explica: 'El servicio lo aceptó y está esperando a SUNAT. Es lo normal durante unos segundos.',
  },
  aceptado: {
    texto: 'Aceptado',
    clase: 'estado bueno',
    explica: 'SUNAT lo aceptó. Ya se le puede entregar al cliente.',
  },
  observado: {
    texto: 'Con observaciones',
    clase: 'estado aviso',
    explica: 'SUNAT lo aceptó pero le puso reparos. Es válido; conviene leer qué dice.',
  },
  rechazado: {
    texto: 'Rechazado',
    clase: 'estado malo',
    explica: 'SUNAT lo rechazó. No se reintenta: hay que corregir y emitir otro.',
  },
  anulado: {
    texto: 'Anulado',
    clase: 'estado malo',
    explica: 'Se comunicó su baja a SUNAT.',
  },
  error: {
    texto: 'No se pudo enviar',
    clase: 'estado malo',
    explica: 'No llegó al servicio. No gastó número y se puede reintentar.',
  },
}

export function EstadoComprobante({ estado, conAyuda }: {
  estado: EstadoDocumento
  conAyuda?: boolean
}) {
  const e = ESTADOS[estado] ?? { texto: estado, clase: 'estado', explica: '' }

  return (
    <>
      <span className={e.clase} title={conAyuda ? undefined : e.explica}>
        {e.texto}
      </span>
      {conAyuda && e.explica && <div className="secundario">{e.explica}</div>}
    </>
  )
}

export function explicarEstado(estado: EstadoDocumento): string {
  return ESTADOS[estado]?.explica ?? ''
}
