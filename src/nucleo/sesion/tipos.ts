// =============================================================================
// Las formas que devuelve la parte de sesión de la API.
//
// Escritas a mano por ahora. Cuando la API crezca se generan del
// /openapi/v1.json y dejan de poder desincronizarse con el back.
// =============================================================================

export interface Usuario {
  id: string
  nombre: string
  correo: string
  esSuperAdmin: boolean
  dosfaActivo: boolean
  claveCambioForzado: boolean
}

export interface Empresa {
  id: string
  ruc: string
  razonSocial: string
}

export interface EntradaMenu {
  codigo: string
  nombre: string
  ruta: string
  icono: string | null
}

/** GET /api/yo */
/**
 * Quién está viendo como quién, cuando el super administrador entra a la cuenta
 * de un cliente para dar soporte.
 *
 * NULO CASI SIEMPRE. Con valor, TODO LO DEMÁS DE `Yo` es ya del usuario
 * suplantado: el usuario, la empresa, los permisos y el menú. Eso es lo que se
 * busca —el front pinta la plataforma del cliente sin saber nada—, y es la
 * razón de que este campo tenga que existir: sin él no habría ninguna señal de
 * que la cuenta no es la propia, ni forma de volver.
 */
export interface Suplantacion {
  /** Quien está de verdad al teclado. */
  suplantador: string

  /** A quién está viendo. */
  suplantado: string

  desde: string
}

export interface Yo {
  usuario: Usuario

  /** Nulo para el super administrador: vive fuera de las empresas. */
  empresa: Empresa | null

  permisos: string[]

  /** Nula salvo mientras se está viendo la cuenta de otro. */
  suplantacion: Suplantacion | null

  /**
   * Los nombres de sus roles, para enseñarlos en la cabecera.
   *
   * SON SOLO PARA MOSTRAR. Lo que decide qué puede hacer cada uno son los
   * permisos. Si una pantalla empezara a preguntar por el nombre del rol,
   * sería el mismo error que el back tiene prohibido: un rol nuevo obligaría
   * a tocar código.
   *
   * Sale vacío para el super administrador: no tiene roles porque no le hacen
   * falta.
   */
  roles: string[]

  /**
   * Lo calcula la base cruzando módulo contratado, rol y permiso.
   * El front lo pinta; no decide qué va dentro.
   */
  menu: EntradaMenu[]

  /** Mientras sea true, el usuario no puede hacer nada más que cambiarla. */
  debeCambiarClave: boolean

  /** La sesión existe pero todavía no superó el segundo factor. */
  segundoFactorPendiente: boolean

  /**
   * Distingue las dos pantallas del segundo factor: enseñarle el QR porque
   * todavía no lo tiene, o pedirle el código porque ya lo configuró.
   *
   * Viene del servidor y no se deduce en el front, para que al recargar la
   * página a medio camino se sepa igual por dónde iba.
   */
  debeConfigurarSegundoFactor: boolean
}

/** POST /api/sesion */
export interface RespuestaIngreso {
  segundoFactorPendiente: boolean
  debeConfigurarSegundoFactor: boolean
  cambioDeClaveForzado: boolean
}

/** POST /api/2fa/preparar */
export interface QrSegundoFactor {
  /** La dirección otpauth:// que se convierte en código de barras. */
  direccionQr: string

  /** El secreto en texto, por si el teléfono no puede leer el QR. */
  secretoLegible: string

  correo: string
  secreto: string
}
