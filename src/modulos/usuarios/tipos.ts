// =============================================================================
// Las formas que devuelve la parte de usuarios y roles de la API.
// =============================================================================

/** GET /api/usuarios — solo los de mi empresa; el aislamiento no deja más. */
export interface UsuarioEnLista {
  id: string
  correo: string
  nombre: string
  activo: boolean
  dosfaActivo: boolean

  ultimoIngresoEn: string | null

  /** Con fecha futura, la cuenta está bloqueada por intentos fallidos. */
  bloqueadoHasta: string | null

  roles: { rolId: string; nombre: string }[]
}

/** GET /api/roles — los de sistema y los propios de la empresa. */
export interface RolDisponible {
  id: string
  nombre: string
  descripcion: string | null

  /** Los de sistema no se pueden modificar; sí asignar. */
  editable: boolean
  deSistema: boolean

  permisos: string[]
}

/**
 * Lo que devuelve el alta.
 *
 * NO HAY CONTRASEÑA AQUÍ, y esa es la idea: la elige su dueño al abrir el
 * enlace que le llega por correo. Quien crea la cuenta nunca llega a conocerla.
 *
 * `invitacionEnviada` en false significa que la cuenta existe pero el correo
 * no salió — el servidor de correo puede estar caído, y eso no puede impedir
 * crear un usuario. Se reenvía con un clic.
 */
export interface UsuarioInvitado {
  id: string
  correo: string
  nombre: string
  invitacionEnviada: boolean
  expiraEn: string
}

/** Lo que devuelve reenviar el enlace. */
export interface EnlaceEnviado {
  enviado: boolean
  correo: string
  expiraEn: string
  mensaje: string
}

/**
 * Lo que devuelve editar un usuario.
 *
 * `avisoAlAnterior` es si el correo de aviso llegó a salir hacia la dirección
 * ANTIGUA. Si el correo cambió y esto viene en false, el arreglo está hecho
 * pero su dueño no se enteró — y conviene decírselo a quien lo hizo.
 */
export interface UsuarioEditado {
  id: string
  correo: string
  nombre: string
  correoCambiado: boolean
  avisoAlAnterior: boolean
  mensaje: string
}
