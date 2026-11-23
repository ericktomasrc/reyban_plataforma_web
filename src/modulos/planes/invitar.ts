/**
 * e281 (096): el código del enlace para invitar (?invita=…). El registro lo
 * guarda en este navegador y el Plan Cartera lo propone para anotarlo.
 */
export const CLAVE_INVITA = 'reyban_invita'

export function guardarCodigoInvitacion(codigo: string | null) {
  if (!codigo) return
  try { localStorage.setItem(CLAVE_INVITA, codigo.slice(0, 40)) } catch { /* sin almacenamiento: se escribe a mano */ }
}

export function codigoInvitacionGuardado(): string {
  try { return localStorage.getItem(CLAVE_INVITA) ?? '' } catch { return '' }
}

export function olvidarCodigoInvitacion() {
  try { localStorage.removeItem(CLAVE_INVITA) } catch { /* nada */ }
}