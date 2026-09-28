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

export function fechaYHora(valor: string | null | undefined): string {
  if (!valor) return '—'
  const d = new Date(valor)
  return isNaN(d.getTime()) ? '—' : conHora.format(d)
}

export function fecha(valor: string | null | undefined): string {
  if (!valor) return '—'
  const d = new Date(valor)
  return isNaN(d.getTime()) ? '—' : soloDia.format(d)
}

/** Si la fecha ya pasó, no hay bloqueo que contar. */
export function esFutura(valor: string | null | undefined): boolean {
  if (!valor) return false
  const d = new Date(valor)
  return !isNaN(d.getTime()) && d.getTime() > Date.now()
}
