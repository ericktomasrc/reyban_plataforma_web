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

  /** Lo que se enseña en vez del correo: lo de antes de la @, único (016). */
  alias: string
  esSuperAdmin: boolean
  dosfaActivo: boolean
  claveCambioForzado: boolean
}

export interface Empresa {
  id: string

  /** El nombre para mostrar: el de la cabecera. */
  nombre: string

  /** Los oficiales, del servicio. Nulos solo si nunca se conectó. */
  ruc: string | null
  razonSocial: string | null

  /** El correo del dueño de la empresa (017). Nulo en las del super administrador. */
  correoTitular: string | null
}

/**
 * La cuenta del usuario (migración 016). Nula para el super administrador.
 *
 * Quien se registra solo tiene cuenta ANTES que empresa: la agrega después.
 */
export interface Cuenta {
  id: string
  tipo: 'negocio' | 'profesional'
  estado: 'pendiente' | 'activa' | 'suspendida'

  /** Del registro. Nulo en las cuentas que nacieron con una empresa. */
  titularNombre: string | null

  /**
   * Su lugar en la cuenta (018). Nulo = usuario de una sola empresa (la
   * cajera): no ve la cartera.
   */
  nivel: 'dueno' | 'colaborador_admin' | 'colaborador' | null
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

/** 046: una sucursal que se puede elegir arriba. */
export interface SucursalArriba {
  id: string
  codigo: string
  nombre: string
}

/**
 * 046: qué ve y desde qué sucursal. Lo calcula la base en cada petición.
 *
 *   empresa   todo (puede elegir «Todas»)
 *   sucursal  lo de sus sucursales (elige entre las suyas)
 *   propio    solo lo que emitió
 */
export interface Alcance {
  tipo: 'empresa' | 'sucursal' | 'propio'
  /** La elegida arriba; null = «Todas». */
  vista: string | null
  /** Con la que entra y la que viene elegida al emitir. */
  defecto: string | null
  /** Sucursales activas de la empresa (con una sola no hay selector). */
  total: number
  /** Las que puede elegir arriba. */
  sucursales: SucursalArriba[]
}

/**
 * 048: LA FICHA DE QUIEN ENTRÓ. Nula para el super administrador y en «ver como».
 *
 * Cada comprobante queda firmado por una persona identificada: emitir, anular,
 * hacer notas y agregar una empresa piden documento, nombres y apellidos.
 */
export interface FichaYo {
  /** Le faltan documento, nombres o apellidos. */
  incompleta: boolean
  /** Hasta cuándo puede emitir así (los que ya existían: 15 días de aviso). */
  plazo: string | null
  /** Incompleta y sin plazo: emitir, anular y notas piden completarla. */
  exigida: boolean
  /** Lo invitaron y aún no revisó sus datos: el paso «Tus datos» al entrar. */
  pedirAhora: boolean
}

export interface Yo {
  usuario: Usuario

  /** 048. */
  ficha?: FichaYo | null

  /** 046. Nulo para el super administrador y sin empresa abierta. */
  alcance?: Alcance | null

  /**
   * Nulo para el super administrador —vive fuera de las empresas— y para quien
   * se acaba de registrar y todavía no agregó la suya.
   */
  empresa: Empresa | null

  /** Nula para el super administrador. */
  cuenta: Cuenta | null

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