import { api } from '../../../nucleo/api/cliente'

// =============================================================================
// 038 — RECUPERAR EL ACCESO POR CORREO (sin sesión, como el registro).
// =============================================================================

export interface EnlacePedido {
  mensaje: string
  /** Solo en desarrollo con el correo apagado; nulo siempre en otro caso. */
  enlaceDePrueba: string | null
}

export interface EnlaceClave {
  correo: string
  nombre: string
  expiraEn: string
}

export const recuperarAccesoServicio = {
  /** Responde lo mismo exista o no el correo. */
  pedir: (correo: string) =>
    api.crear<EnlacePedido>('/api/acceso/recuperar', { correo }),

  revisar: (token: string) =>
    api.obtener<EnlaceClave>(`/api/restablecer/${encodeURIComponent(token)}`),

  cambiar: (token: string, clave: string) =>
    api.crear<{ mensaje: string }>(`/api/restablecer/${encodeURIComponent(token)}`, { clave }),
}