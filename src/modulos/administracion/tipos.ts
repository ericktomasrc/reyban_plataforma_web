// =============================================================================
// Las formas que devuelve la parte de administración de la API.
//
// Escritas a mano, igual que las de sesión. Cuando el back se estabilice se
// generan del /openapi/v1.json y dejan de poder desincronizarse.
// =============================================================================

/** GET /api/admin/empresas */
export interface EmpresaEnLista {
  id: string

  /** El nombre para mostrar. Es el que se ve en toda la plataforma. */
  nombre: string

  /**
   * Los oficiales, del servicio. Desde la parte C llegan en el alta; nulos
   * solo en una empresa que nunca se conectó.
   */
  ruc: string | null
  razonSocial: string | null

  /** «beta» o «produccion», según el servicio. */
  ambiente: string | null

  /** Tiene RUC: está conectada con su clave del servicio. */
  conectada: boolean

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

  /**
   * Las marcas de facturación, de lo último que dijo el servicio (sin
   * preguntarle al abrir la lista). Nulo si no tiene clave del servicio.
   * Los `null` de dentro son «todavía no se preguntó»: no se pinta nada.
   */
  facturacion: MarcasFacturacion | null
}

export interface MarcasFacturacion {
  /** El alta se guardó aquí pero el servicio no recibió la confirmación. */
  altaSinConfirmar: boolean

  /** Falso: sin identificador o sin correo de respuesta, ningún receptor recibe su correo. */
  correosAlReceptor: boolean | null

  /** Certificado, SOL, una serie y la dirección revisada. Sin esto no se activa Facturación. */
  listoParaEmitir: boolean | null

  /** Hay una clave anterior guardada que nadie comprobó que esté revocada. */
  claveAnteriorPendiente: boolean

  /**
   * Hasta cuándo vale el certificado digital, de la revisión diaria (paso
   * 6.1). Nulo si todavía no se preguntó o si no tiene certificado activo.
   */
  certificadoValidoHasta: string | null

  consultadoEn: string | null
}

/** GET /api/admin/modulos — el catálogo, no lo contratado. */
export interface ModuloDelCatalogo {
  codigo: string
  nombre: string
  descripcion: string | null
  ruta: string
  icono: string | null
}

/**
 * Lo que se manda en POST /api/admin/empresas.
 *
 * DESDE LA PARTE C EL ALTA CREA TAMBIÉN EL EMISOR EN EL SERVICIO: el RUC, la
 * razón social y la dirección se teclean aquí una vez y viajan solos. La
 * dirección NO se queda en la plataforma: vive en el servicio.
 */
export interface AltaEmpresa {
  /** El nombre para mostrar. Si no va: nombre comercial o razón social. */
  nombre?: string

  ruc: string
  razonSocial: string
  nombreComercial?: string

  direccion: string
  ubigeo: string
  distrito: string
  provincia: string
  departamento: string

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
 * elige él. Quien da de alta la empresa nunca la conoce. Y TAMPOCO LA CLAVE
 * DEL SERVICIO: la plataforma la guarda cifrada; aquí solo su pista.
 *
 * `invitacionEnviada` en false significa que la empresa quedó creada pero el
 * correo no salió. Se reenvía desde la pantalla de usuarios de esa empresa, o
 * volviendo a pulsar el botón del enlace.
 */
export interface EmpresaCreada {
  empresa: {
    id: string
    nombre: string
    ruc: string
    razonSocial: string
    ambiente: string | null
  }
  administrador: {
    id: string
    correo: string
    nombre: string
    invitacionEnviada: boolean
    expiraEn: string
  }
  emisor: {
    id: string
    estado: string
    ambiente: string
    pista: string
    abandonado: string | null
  }
  mensaje: string
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