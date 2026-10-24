import { api } from '../../../nucleo/api/cliente'
import type { QrSegundoFactor, RespuestaIngreso, Yo } from '../../../nucleo/sesion/tipos'

// =============================================================================
// LA CAPA DE SERVICIO DEL MÓDULO DE ACCESO
//
// Ninguna vista llama a `api` directamente: llama aquí. Así, las rutas de la
// API están escritas en un solo sitio por módulo, y el día que una cambie no
// hay que buscarla por las pantallas.
//
// También es lo que permite probar una vista sin servidor: se sustituye este
// objeto y ya está.
// =============================================================================

export const accesoServicio = {
  /** POST /api/sesion — el navegador se queda con la cookie. */
  ingresar: (correo: string, clave: string) =>
    api.crear<RespuestaIngreso>('/api/sesion', { correo, clave }),

  /** DELETE /api/sesion — revoca la sesión en la base, no solo en el navegador. */
  salir: () =>
    api.borrar<void>('/api/sesion'),

  /** GET /api/yo — quién soy, qué puedo y qué menú veo. */
  yo: () =>
    api.obtener<Yo>('/api/yo'),

  /** POST /api/clave — cierra además las demás sesiones del usuario. */
  cambiarClave: (claveActual: string, claveNueva: string) =>
    api.crear<{ mensaje: string }>('/api/clave', { claveActual, claveNueva }),

  /** 24 oct: crear la contraseña quien entra solo con Google (recién entrado). */
  crearClave: (claveNueva: string) =>
    api.crear<{ mensaje: string; configurarSegundoFactor: boolean }>('/api/clave/crear', { claveNueva }),


  // ---------------------------------------------------------------------
  // EL SEGUNDO FACTOR
  //
  // Todo esto se llama con la sesión a medias: existe, pero no sirve para
  // nada más hasta que se supere.
  // ---------------------------------------------------------------------

  /** POST /api/2fa/preparar — genera el secreto y devuelve el QR. */
  prepararSegundoFactor: () =>
    api.crear<QrSegundoFactor>('/api/2fa/preparar'),

  /** POST /api/2fa/confirmar — lo activa y entrega los 8 códigos, una vez. */
  confirmarSegundoFactor: (codigo: string) =>
    api.crear<{ codigosRecuperacion: string[]; aviso: string }>(
      '/api/2fa/confirmar', { codigo }),

  /** POST /api/2fa — los seis dígitos al entrar. */
  validarSegundoFactor: (codigo: string) =>
    api.crear<{ mensaje: string }>('/api/2fa', { codigo }),

  /** POST /api/2fa/recuperacion — cuando se perdió el teléfono. */
  usarCodigoRecuperacion: (codigo: string) =>
    api.crear<{ mensaje: string; quedan: number; aviso: string | null }>(
      '/api/2fa/recuperacion', { codigo }),

  /**
   * POST /api/2fa/reiniciar-el-mio — cambiar de teléfono, con la sesión abierta.
   *
   * ES EL ÚNICO DE ESTE BLOQUE QUE NECESITA SESIÓN COMPLETA, y el único que
   * pide la contraseña. Sin ella, quien encuentre un ordenador desbloqueado se
   * pone el segundo factor en su propio teléfono y se queda con la cuenta.
   *
   * Corta todas las sesiones, incluida la de quien lo llama: después hay que
   * volver a entrar y escanear un QR nuevo.
   */
  reiniciarMiSegundoFactor: (clave: string) =>
    api.crear<{ mensaje: string }>('/api/2fa/reiniciar-el-mio', { clave }),
}
