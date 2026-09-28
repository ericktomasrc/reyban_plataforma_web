import { api } from '../../../nucleo/api/cliente'
import type { CodigosNuevos, MiPerfil, SesionesCerradas } from '../tipos'

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
   * PUT /api/perfil — solo el nombre.
   *
   * El correo no se cambia desde aquí a propósito: hacerlo bien exige mandar un
   * código a la dirección nueva y no creerse el cambio hasta que vuelva. Sin
   * eso, quien encuentre una sesión abierta se queda con la cuenta cambiando el
   * correo al suyo. Mientras no exista esa pantalla, lo cambia el administrador
   * de la empresa, que avisa a la dirección anterior.
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

  /** DELETE /api/perfil/sesiones — todas menos esta. */
  cerrarOtrasSesiones: () =>
    api.borrar<SesionesCerradas>('/api/perfil/sesiones'),
}
