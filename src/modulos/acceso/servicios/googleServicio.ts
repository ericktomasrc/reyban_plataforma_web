import { api } from '../../../nucleo/api/cliente'

// =============================================================================
// 049 — ENTRAR CON GOOGLE. El ir y volver de Google es navegación (no fetch):
// el botón es un enlace a /api/google/entrar. Aquí, lo que sí es llamada.
// =============================================================================

export const googleServicio = {
  /** ¿Hay botón? (sin las credenciales de Google Cloud en el .env, no). */
  config: () => api.obtener<{ activo: boolean }>('/api/google/config'),

  /** El registro a medias: Google ya dijo quién es. */
  pendiente: (t: string) =>
    api.obtener<{ correo: string; nombre: string | null }>(`/api/google/pendiente?t=${encodeURIComponent(t)}`),

  /** Crear la cuenta: deja la sesión abierta. */
  registro: (token: string, tipo: 'negocio' | 'profesional', acepto: boolean) =>
    api.crear<{ mensaje: string }>('/api/google/registro', { token, tipo, acepto }),
}

/** Lo que vuelve en /?google=… cuando no se pudo entrar. */
export const MENSAJE_GOOGLE: Record<string, string> = {
  cancelado: 'Cancelaste el ingreso con Google.',
  vencido: 'El ingreso con Google tardó demasiado o se abrió en otra pestaña. Vuelve a intentarlo.',
  fallo: 'Google no respondió bien. Vuelve a intentarlo en un momento.',
  sin_verificar: 'Esa cuenta de Google no tiene el correo verificado.',
  otro_google: 'Ese correo ya está enlazado a otra cuenta de Google. Entra con esa, o con tu contraseña.',
  super: 'El super administrador entra con su contraseña y su segundo factor, no con Google.',
  inactivo: 'Tu usuario está desactivado. Habla con tu administrador.',
  suspendida: 'Tu empresa o tu cuenta está suspendida. Habla con tu administrador.',
  bloqueado: 'Tu usuario está bloqueado por intentos fallidos. Prueba en unos minutos.',
  no_configurado: '«Entrar con Google» todavía no está disponible.',
}