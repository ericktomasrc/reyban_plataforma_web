// =============================================================================
// Las formas que devuelve la parte de administración de la API.
//
// Escritas a mano, igual que las de sesión. Cuando el back se estabilice se
// generan del /openapi/v1.json y dejan de poder desincronizarse.
// =============================================================================

/** GET /api/admin/empresas */
export interface EmpresaEnLista {
  id: string
  ruc: string
  razonSocial: string
  activo: boolean

  /** Nulo mientras la empresa esté operativa. */
  suspendidaEn: string | null
  motivoSuspension: string | null

  /** Cuántos usuarios activos tiene dentro. */
  usuarios: number

  /** Los códigos de los módulos que tiene activos, no sus nombres. */
  modulos: string[]

  /** Cuánto duran los enlaces de invitación de esta empresa. */
  horasInvitacion: number
}

/** GET /api/admin/modulos — el catálogo, no lo contratado. */
export interface ModuloDelCatalogo {
  codigo: string
  nombre: string
  descripcion: string | null
  ruta: string
  icono: string | null
}

/** Lo que se manda en POST /api/admin/empresas */
export interface AltaEmpresa {
  ruc: string
  razonSocial: string
  nombreComercial?: string
  direccion?: string
  correoAdministrador: string
  nombreAdministrador: string
  modulos: string[]

  /** Horas que durarán sus enlaces. Si no va, la base pone 24. */
  horasInvitacion?: number
}

/**
 * Lo que devuelve el alta.
 *
 * NO HAY CONTRASEÑA AQUÍ: al administrador le llega un enlace por correo y la
 * elige él. Quien da de alta la empresa nunca la conoce.
 *
 * `invitacionEnviada` en false significa que la empresa quedó creada pero el
 * correo no salió. Se reenvía desde la pantalla de usuarios de esa empresa, o
 * volviendo a pulsar el botón del enlace.
 */
export interface EmpresaCreada {
  empresa: { id: string; ruc: string; razonSocial: string }
  administrador: {
    id: string
    correo: string
    nombre: string
    invitacionEnviada: boolean
    expiraEn: string
  }
}

/**
 * GET /api/admin/empresas/{id}/usuarios — para elegir a quién ver.
 *
 * Lo justo para reconocer a alguien en una lista. La gestión de usuarios de
 * verdad es de otra pantalla y de otro dueño: el administrador del cliente.
 */
export interface UsuariosDeEmpresa {
  empresa: string

  /**
   * Falso si está suspendida o desactivada.
   *
   * Importa porque suplantar a alguien de una empresa suspendida no enseña
   * nada: el aislamiento esconde sus datos también para ellos.
   */
  operativa: boolean

  usuarios: {
    id: string
    nombre: string
    correo: string
    activo: boolean
    dosfaActivo: boolean
    ultimoIngresoEn: string | null
    roles: string[]
  }[]
}
