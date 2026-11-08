/**
 * e229 — «YA LOS REVISÉ»: hasta qué hora (de Lima) ya se miraron los errores
 * de hoy. Se guarda en este navegador; el log no se toca. Al día siguiente
 * no cuenta (la API solo lo usa si es de hoy).
 */
const CLAVE = 'reyban.erroresRevisados'
export const EVENTO_ERRORES_REVISADOS = 'reyban:errores-revisados'

export function revisadosHasta(): string | undefined {
  try { return localStorage.getItem(CLAVE) ?? undefined } catch { return undefined }
}

/** Ahora, en hora de Lima: «2026-11-08 07:39:00». */
export function marcarRevisados(): string {
  const ahora = new Date().toLocaleString('sv-SE', { timeZone: 'America/Lima', hour12: false })
  try { localStorage.setItem(CLAVE, ahora) } catch { /* sin almacenamiento: solo esta vez */ }
  window.dispatchEvent(new Event(EVENTO_ERRORES_REVISADOS))
  return ahora
}