/**
 * Las fechas que llegan de la API vienen en UTC. Aquí se pintan en la hora de
 * quien mira, que es la única que le dice algo.
 *
 * POR QUÉ EN UN ARCHIVO APARTE: en cuanto haya tres pantallas con fechas, cada
 * una las formateará a su manera y la misma hora se verá distinta según dónde
 * la mires. Un solo sitio, un solo formato.
 */

const conHora = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const soloDia = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' })

// ════════════════════════════════════════════════════════════════════════════
// UNA FECHA SIN HORA NO ES UN INSTANTE, Y NO SE CONVIERTE DE ZONA
//
// La API manda las fechas de calendario —un `DateOnly`, como la fecha de
// emisión— así: «2026-10-04». `new Date('2026-10-04')` lo lee como medianoche
// UTC, y pintado en hora de Lima eso son las 19:00 del día ANTERIOR. Así salían
// como «3 oct.» facturas que el XML firmado dice que son del 4.
//
// Una fecha de calendario es la misma en todas partes: el 4 es el 4. Se pinta
// tal cual, fijando la zona en UTC para que el formateador no la mueva. Las que
// traen hora (instantes: cuándo se aceptó, cuándo vence un bloqueo) siguen
// pasándose a la hora de quien mira, como siempre.
// ════════════════════════════════════════════════════════════════════════════
const soloCalendario = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'UTC' })

const SOLO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/

export function fechaYHora(valor: string | null | undefined): string {
  if (!valor) return '—'
  const d = new Date(valor)
  return isNaN(d.getTime()) ? '—' : conHora.format(d)
}

export function fecha(valor: string | null | undefined): string {
  if (!valor) return '—'

  const dia = SOLO_DIA.exec(valor)
  if (dia) {
    const d = new Date(Date.UTC(+dia[1], +dia[2] - 1, +dia[3]))
    return isNaN(d.getTime()) ? '—' : soloCalendario.format(d)
  }

  const d = new Date(valor)
  return isNaN(d.getTime()) ? '—' : soloDia.format(d)
}

/** Si la fecha ya pasó, no hay bloqueo que contar. */
export function esFutura(valor: string | null | undefined): boolean {
  if (!valor) return false
  const d = new Date(valor)
  return !isNaN(d.getTime()) && d.getTime() > Date.now()
}
