import type { PlanYo } from '../sesion/tipos'

/**
 * 069 — LO QUE EL PLAN DE LA EMPRESA ABIERTA TRAE.
 *
 * Comodidad, no seguridad: esconde menús y pantallas. La API responde 402 en
 * lo que el plan no trae aunque alguien escriba la URL.
 */
export const NOMBRE_PLAN: Record<string, string> = {
  basico: 'Básico', pro: 'Pro', max: 'Max', todo: 'Todo', sin: 'ningún plan todavía',
}

function coincide(ruta: string, prefijo: string) {
  if (!ruta.startsWith(prefijo)) return false
  return ruta.length === prefijo.length || ruta[prefijo.length] === '/' || prefijo.endsWith('/')
}

/** El prefijo más largo que coincide (de los bloqueados o de los libres). */
function masLargo(ruta: string, plan?: PlanYo | null): { prefijo: string; bloquea: boolean } | null {
  const b = plan?.bloqueadas
  if (!b || b.web.length === 0) return null
  let mejor: { prefijo: string; bloquea: boolean } | null = null
  for (const [lista, bloquea] of [[b.web, true], [b.libres, false]] as const)
    for (const p of lista)
      if (coincide(ruta, p) && (!mejor || p.length > mejor.prefijo.length)) mejor = { prefijo: p, bloquea }
  return mejor
}

/** ¿Esta pantalla está en su plan? (sin empresa, apagados o acceso total: sí). */
export function rutaPermitida(plan: PlanYo | null | undefined, ruta: string): boolean {
  const m = masLargo(ruta.split('?')[0], plan)
  return !m || !m.bloquea
}

/** El plan que trae una pantalla bloqueada ('pro', 'max' o 'sin'). */
export function planQueLaTrae(plan: PlanYo | null | undefined, ruta: string): string | null {
  const m = masLargo(ruta.split('?')[0], plan)
  if (!m || !m.bloquea) return null
  return plan?.bloqueadas?.minimos[m.prefijo] ?? 'sin'
}

/** Días que faltan (redondeado hacia arriba); null si ya pasó o no hay fecha. */
export function diasQueFaltan(iso?: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  return ms > 0 ? Math.ceil(ms / 86_400_000) : null
}

export const soles = (n: number | null | undefined) =>
  n === null || n === undefined ? '—'
    : 'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 })