import { api } from '../../../nucleo/api/cliente'

// =============================================================================
// RECUPERAR LA EMPRESA (fase 4a, migración 021)
//
// Como el registro y la invitación, casi todo se llama SIN SESIÓN: quien
// recupera su empresa puede no tener cuenta todavía. Lo que protege es el
// enlace, que solo llega al correo del titular.
// =============================================================================

export type EstadoEnlace = 'ok' | 'vencido' | 'usado' | 'no_existe' | 'no_pausada'

/** GET /api/recuperar/{token} */
export interface InfoRecuperacion {
  estado: EstadoEnlace
  nombre: string | null
  ruc: string | null

  /** El correo del titular: con él se entra. */
  correo: string | null
  pausadaEn: string | null
  motivo: string | null

  /** Quién la tenía (el estudio o el contador). */
  quien: string | null
  comprobantes: number
  clientes: number
  series: string[] | null
  expiraEn: string | null

  /** Ese correo ya tiene cuenta: se entra y se agrega, no se crea otra. */
  correoConCuenta: boolean
}

export const recuperacionServicio = {
  pedir: (ruc: string, captcha: string) =>
    api.crear<{ mensaje: string; enlaceDePrueba: string | null }>('/api/recuperar/pedir', { ruc, captcha }),

  ver: (token: string) =>
    api.obtener<InfoRecuperacion>(`/api/recuperar/${encodeURIComponent(token)}`),

  cuentaNueva: (token: string, nombre: string, aceptaTerminos: boolean) =>
    api.crear<{ mensaje: string; invitacion: string }>(
      `/api/recuperar/${encodeURIComponent(token)}/cuenta-nueva`, { nombre, aceptaTerminos }),

  aMiCuenta: (token: string) =>
    api.crear<{ mensaje: string }>(`/api/recuperar/${encodeURIComponent(token)}/a-mi-cuenta`),
}

/**
 * Quien abre el enlace sin haber entrado, teniendo ya cuenta: se guarda el
 * enlace aquí, entra, y el Inicio lo devuelve a esta pantalla. Es la ÚNICA
 * cosa que se guarda en el navegador, y solo dura la pestaña.
 */
export const ENLACE_PENDIENTE = 'recuperar_pendiente'