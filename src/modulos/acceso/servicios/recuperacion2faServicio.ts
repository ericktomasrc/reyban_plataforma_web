import { api } from '../../../nucleo/api/cliente'

// =============================================================================
// 039 — RECUPERAR EL SEGUNDO FACTOR CON ESPERA
//
// Para quien perdió el teléfono Y sus ocho códigos. Pedir y completar van con
// la sesión a medias (ya puso su contraseña); confirmar va sin sesión, desde
// el enlace del correo. La lista y cancelar, para administradores.
// =============================================================================

export type EstadoRecuperacion = 'por_confirmar' | 'en_espera' | 'completada' | 'cancelada' | 'vencida'
export type NivelRecuperacion = 'usuario' | 'administrador' | 'super'

export interface MiRecuperacion {
  estado: EstadoRecuperacion
  nivel: NivelRecuperacion
  horasEspera: number
  pedidaEn: string
  disponibleEn: string | null
  /** La espera terminó: ya se puede configurar el teléfono nuevo. */
  lista: boolean
  disponibleTexto: string | null
  esperaTexto: string
}

export interface PedidoRecuperacion {
  resultado: 'pedida' | 'en_curso'
  enviado?: boolean
  mensaje?: string
  /** Solo en desarrollo con el correo apagado. */
  enlaceDePrueba?: string | null
  recuperacion: MiRecuperacion | null
}

export interface RecuperacionEnCurso {
  id: string
  usuarioId: string
  nombre: string
  correo: string
  empresa: string
  estado: EstadoRecuperacion
  nivel: NivelRecuperacion
  pedidaEn: string
  disponibleEn: string | null
  lista: boolean
  disponibleTexto: string | null
}

export const recuperacion2faServicio = {
  mia: () =>
    api.obtener<{ recuperacion: MiRecuperacion | null }>('/api/2fa/espera'),

  pedir: () =>
    api.crear<PedidoRecuperacion>('/api/2fa/espera'),

  completar: () =>
    api.crear<{ mensaje: string }>('/api/2fa/espera/completar'),

  /** Sin sesión: el enlace del correo. POST, para que nadie lo dispare solo con abrirlo. */
  confirmar: (token: string) =>
    api.crear<{ recuperacion: MiRecuperacion }>(`/api/recuperar-segundo-factor/${encodeURIComponent(token)}`),

  enCurso: () =>
    api.obtener<RecuperacionEnCurso[]>('/api/recuperaciones-2fa'),

  cancelar: (id: string) =>
    api.crear<{ mensaje: string }>(`/api/recuperaciones-2fa/${id}/cancelar`),

  /** Permiso «usuarios.sesiones_revocar». */
  cerrarSesiones: (usuarioId: string) =>
    api.crear<{ mensaje: string }>(`/api/usuarios/${usuarioId}/cerrar-sesiones`),
}

export const NIVEL_TEXTO: Record<NivelRecuperacion, string> = {
  usuario: 'Usuario',
  administrador: 'Administrador',
  super: 'Super administrador',
}