// =============================================================================
// Las formas que devuelve la parte de «mi perfil» de la API.
//
// TODO LO DE AQUÍ ES SOBRE UNO MISMO. Ningún tipo de este archivo lleva un
// identificador de usuario que se pueda mandar: el back lo saca de la cookie.
// =============================================================================

/** GET /api/perfil */
export interface MiPerfil {
  id: string
  nombre: string
  correo: string
  esSuperAdmin: boolean

  dosfaActivo: boolean
  dosfaActivadoEn: string | null

  claveCambiadaEn: string | null
  ultimoIngresoEn: string | null
  creadoEn: string

  /** Nula para el super administrador: vive fuera de las empresas. */
  empresa: { ruc: string; razonSocial: string } | null

  roles: string[]

  /**
   * Cuántos de los ocho códigos de recuperación siguen sin usar.
   *
   * Es el número más útil de la pantalla: hasta que existió, quien había gastado
   * seis no se enteraba hasta quedarse sin ninguno.
   */
  codigosRestantes: number

  /** Sesiones vivas, contando la de ahora. */
  sesionesAbiertas: number
}

/** POST /api/perfil/codigos-recuperacion */
export interface CodigosNuevos {
  codigos: string[]
  aviso: string
}

/** DELETE /api/perfil/sesiones */
export interface SesionesCerradas {
  cerradas: number
  mensaje: string
}
