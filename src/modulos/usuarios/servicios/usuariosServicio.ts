import { api } from '../../../nucleo/api/cliente'
import type {
  DatosAcceso, DelEstudio, EnlaceEnviado, OpcionesPersonal, RolDisponible, UsuarioEditado, UsuarioEnLista, UsuarioInvitado,
} from '../tipos'
import type { FichaParaEnviar } from '../componentes/CamposFicha'

// =============================================================================
// LA CAPA DE SERVICIO DEL MÓDULO DE USUARIOS
//
// Esto lo usa el ADMINISTRADOR DE UNA EMPRESA, no el super administrador.
//
// Ninguna llamada de aquí manda un identificador de empresa, y no es un olvido:
// el aislamiento de la base ya recorta cada consulta a la empresa de quien
// pregunta. Mandarlo sería darle a entender a quien lea esto que el filtro lo
// decide el front — y ese es exactamente el error que el diseño evita.
// =============================================================================

export const usuariosServicio = {
  /** GET /api/usuarios — incluye los desactivados. */
  listar: () =>
    api.obtener<UsuarioEnLista[]>('/api/usuarios'),

  /** GET /api/roles — los de sistema más los propios de la empresa. */
  roles: () =>
    api.obtener<RolDisponible[]>('/api/roles'),

  /**
   * POST /api/usuarios — crea la cuenta y le manda un enlace por correo.
   *
   * No devuelve ninguna contraseña porque no genera ninguna: la elige su dueño
   * al abrir el enlace.
   */
  crear: (correo: string, nombre: string, roles: string[]) =>
    api.crear<UsuarioInvitado>('/api/usuarios', { correo, nombre, roles }),

  /**
   * PUT /api/usuarios/{id} — solo el nombre y el correo.
   *
   * No toca la contraseña, ni los roles, ni el segundo factor: cada una de
   * esas cosas tiene su propia llamada, con su propio permiso y su propio
   * rastro en la bitácora.
   *
   * Si el correo cambia, el back avisa a la dirección ANTIGUA. Es lo que evita
   * que un administrador se quede con la cuenta de alguien cambiándole el
   * correo y pidiendo después un enlace de acceso.
   */
  editar: (id: string, correo: string, nombre: string) =>
    api.cambiar<UsuarioEditado>(`/api/usuarios/${id}`, { correo, nombre }),

  /**
   * PUT /api/usuarios/{id}/roles — reemplaza la lista entera.
   *
   * El back rechaza que alguien cambie sus propios roles: si no, el único
   * administrador de una empresa podría dejarse fuera de un clic y ya no
   * habría forma de volver desde dentro.
   */
  cambiarRoles: (id: string, roles: string[]) =>
    api.cambiar<{ mensaje: string }>(`/api/usuarios/${id}/roles`, { roles }),

  // --- 046: Personal de la empresa ------------------------------------------

  /** GET /api/usuarios/opciones — roles, alcances y sucursales que puedo dar. */
  opciones: () =>
    api.obtener<OpcionesPersonal>('/api/usuarios/opciones'),

  /** GET /api/usuarios/estudio — los de Mi equipo que también entran (solo lectura). */
  estudio: () =>
    api.obtener<DelEstudio[]>('/api/usuarios/estudio'),

  /** POST /api/usuarios con la ficha y el acceso. Le llega el enlace por correo. */
  crearConFicha: (correo: string, ficha: FichaParaEnviar, acceso: DatosAcceso) =>
    api.crear<UsuarioInvitado>('/api/usuarios', { correo, ficha, acceso }),

  /** PUT /api/usuarios/{id} con la ficha (el nombre sale de nombres y apellidos). */
  editarConFicha: (id: string, correo: string, ficha: FichaParaEnviar) =>
    api.cambiar<UsuarioEditado>(`/api/usuarios/${id}`, { correo, ficha }),

  /** PUT /api/usuarios/{id}/acceso — rol, alcance, sucursales y casillas. */
  cambiarAcceso: (id: string, acceso: DatosAcceso) =>
    api.cambiar<{ mensaje: string }>(`/api/usuarios/${id}/acceso`, acceso),

  /** POST .../desactivar — cierra además sus sesiones abiertas, al instante. */
  desactivar: (id: string) =>
    api.crear<{ mensaje: string }>(`/api/usuarios/${id}/desactivar`),

  /** POST .../reactivar — levanta también el bloqueo por intentos fallidos. */
  reactivar: (id: string) =>
    api.crear<{ mensaje: string }>(`/api/usuarios/${id}/reactivar`),

  /**
   * POST .../invitacion — le manda un enlace nuevo por correo.
   *
   * SIRVE PARA LAS DOS COSAS: reenviar la invitación a quien nunca llegó a
   * entrar, y restablecer la contraseña de quien la perdió. Por debajo son lo
   * mismo, y el correo elige su texto según si esa persona entró alguna vez.
   *
   * Los enlaces anteriores de esa persona quedan anulados al instante.
   */
  enviarEnlace: (id: string) =>
    api.crear<EnlaceEnviado>(`/api/usuarios/${id}/invitacion`),
}
