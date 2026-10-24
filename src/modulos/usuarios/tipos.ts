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

  /** 048: nunca entró y su enlace ya venció (o se anuló): hay que reenviarla. */
  invitacionVencida?: boolean

  /** Con fecha futura, la cuenta está bloqueada por intentos fallidos. */
  bloqueadoHasta: string | null

  /** 046: el rol principal (sin las casillas que se suman). */
  roles: { rolId: string; nombre: string }[]

  // --- 046: la ficha (nulos en las de antes: «ficha incompleta») ------------
  tipoDocumento?: '1' | '4' | '7' | null
  numeroDocumento?: string | null
  nombres?: string | null
  apellidoPaterno?: string | null
  apellidoMaterno?: string | null
  celular?: string | null
  fechaNacimiento?: string | null
  direccion?: string | null
  ubigeo?: string | null
  cargo?: string | null
  fechaIngreso?: string | null
  fichaIncompleta?: boolean

  // --- 046: el acceso ---------------------------------------------------------
  notas?: boolean
  personal?: boolean
  esAdministrador?: boolean
  alcance?: TipoAlcance
  /** Vacío = todas. */
  sucursales?: string[]
  sucursalDefecto?: string | null
  /** ¿Quien mira puede cambiar su acceso? (A sí mismo, nunca.) */
  gestionable?: boolean
}

export type TipoAlcance = 'empresa' | 'sucursal' | 'propio'

export const NOMBRE_ALCANCE: Record<TipoAlcance, string> = {
  empresa: 'Toda la empresa',
  sucursal: 'Su sucursal',
  propio: 'Solo lo suyo',
}

export const EXPLICA_ALCANCE: Record<TipoAlcance, string> = {
  empresa: 've todo (la central)',
  sucursal: 've todo lo de sus sucursales (por ejemplo, para hacer notas de otros cajeros)',
  propio: 've solo los comprobantes que él emitió',
}

/** 046: GET /api/usuarios/opciones — lo que puede dar quien abre la ficha. */
export interface OpcionesPersonal {
  /** Jefe de sucursal: solo su personal, sus sucursales y roles iguales o menores. */
  restringido: boolean
  roles: { id: string; nombre: string; descripcion: string | null; deSistema: boolean; permisos: string[]; incluyeNotas: boolean }[]
  alcances: TipoAlcance[]
  sucursales: { id: string; codigo: string; nombre: string }[]
  totalSucursales: number
  puedeNotas: boolean
  puedePersonal: boolean
}

/** 046: lo que se manda del acceso. */
export interface DatosAcceso {
  rol: string
  alcance: TipoAlcance
  sucursales: string[]
  sucursalDefecto: string | null
  notas: boolean
  personal: boolean
}

/** 046: GET /api/usuarios/estudio — la gente de la Cuenta Profesional que también entra. */
export interface DelEstudio {
  nombre: string
  nivel: 'dueno' | 'colaborador_admin' | 'colaborador'
  rol: string
  alcance: TipoAlcance
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
