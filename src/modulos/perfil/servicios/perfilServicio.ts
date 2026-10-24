import { api } from '../../../nucleo/api/cliente'
import type { FichaParaEnviar } from '../../usuarios/componentes/CamposFicha'
import type { CambioCorreo, CodigosNuevos, MiFicha, MiPerfil, SesionesCerradas } from '../tipos'

// =============================================================================
// LA CAPA DE SERVICIO DE «MI PERFIL»
//
// Ninguna llamada manda un identificador de usuario. El back usa el de la
// cookie, y por eso no hay forma de que una de estas llamadas toque la cuenta
// de otra persona ni por error ni a propósito.
//
// EL CAMBIO DE CONTRASEÑA NO ESTÁ AQUÍ: vive en `accesoServicio.cambiarClave`,
// porque el mismo endpoint sirve para el cambio obligatorio del primer ingreso.
// Duplicarlo daría dos sitios que mantener y un día dirían cosas distintas.
// =============================================================================

export const perfilServicio = {
  /** GET /api/perfil — datos, segundo factor, códigos que quedan y sesiones. */
  mio: () =>
    api.obtener<MiPerfil>('/api/perfil'),

  /**
   * PUT /api/perfil — solo el nombre (el super administrador, que no tiene
   * ficha; los demás lo cambian con su ficha).
   */
  cambiarNombre: (nombre: string) =>
    api.cambiar<{ nombre: string; mensaje: string }>('/api/perfil', { nombre }),

  /**
   * POST /api/perfil/codigos-recuperacion — ocho nuevos, los viejos se anulan.
   *
   * PIDE LA CONTRASEÑA Y UN CÓDIGO DEL TELÉFONO. El del teléfono es el que
   * importa: estos ocho códigos son la puerta de atrás del segundo factor, así
   * que si se pudieran generar con la contraseña sola, el segundo factor no
   * estaría protegiendo nada.
   */
  codigosNuevos: (clave: string, codigo: string) =>
    api.crear<CodigosNuevos>('/api/perfil/codigos-recuperacion', { clave, codigo }),

  /** 048: GET /api/perfil/ficha — mis datos personales. */
  ficha: () =>
    api.obtener<MiFicha>('/api/perfil/ficha'),

  /**
   * 048: PUT /api/perfil/ficha — completarlos o corregirlos. El cargo y la
   * fecha de ingreso no se tocan: los pone quien da el trabajo.
   */
  guardarFicha: (ficha: FichaParaEnviar) =>
    api.cambiar<{ mensaje: string; nombre: string }>('/api/perfil/ficha', ficha),

  /**
   * 048: POST /api/perfil/correo — pedir el cambio. Con contraseña y código
   * del teléfono; vale cuando se abre el enlace que llega al correo NUEVO.
   */
  cambiarCorreo: (nuevo: string, clave: string, codigo: string) =>
    api.crear<CambioCorreo>('/api/perfil/correo', { nuevo, clave, codigo }),

  /** 048: POST /api/correo/confirmar — el enlace (sin sesión). */
  confirmarCorreo: (token: string) =>
    api.crear<{ mensaje: string; nuevo: string }>('/api/correo/confirmar', { token }),

  /** DELETE /api/perfil/sesiones — todas menos esta. */
  cerrarOtrasSesiones: () =>
    api.borrar<SesionesCerradas>('/api/perfil/sesiones'),
}
