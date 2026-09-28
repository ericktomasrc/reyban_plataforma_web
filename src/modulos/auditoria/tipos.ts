// =============================================================================
// Las formas que devuelve la parte de auditoría de la API.
// =============================================================================

/** Lo que devuelven los listados paginados. */
export interface Pagina<T> {
  total: number
  pagina: number
  porPagina: number
  filas: T[]
}

/** Una fila de la bitácora, en el listado. */
export interface Cambio {
  id: number
  ocurridoEn: string
  tabla: string
  filaId: string

  /** `I`, `U` o `D`. */
  operacion: string

  usuarioId: string | null

  /** El nombre de quien lo hizo. Nulo si no había sesión: una migración, el arranque. */
  usuario: string | null

  /** Qué columnas cambiaron, en un UPDATE. */
  camposCambiados: string[] | null

  ip: string | null
}

/**
 * El detalle, con el antes y el después.
 *
 * `antes` y `despues` son la fila completa en JSON. **Los valores sensibles
 * vienen tapados desde la base** —`clave_hash`, `secreto_2fa`— así que aquí
 * llega `[oculto]` y no el secreto. Queda el hecho del cambio, no su valor.
 */
export interface CambioDetalle extends Cambio {
  antes: string | null
  despues: string | null
  agente: string | null
}

/** Un evento de seguridad: lo que NO cambió ninguna fila. */
export interface Evento {
  id: number
  ocurridoEn: string
  tipo: string
  exito: boolean
  usuarioId: string | null
  usuario: string | null

  /** El correo que se intentó usar. Es lo único que hay cuando no existe el usuario. */
  correo: string | null

  /** JSON con contexto libre. Nunca contraseñas ni tokens. */
  detalle: string | null

  ip: string | null
}

/** Los filtros del listado de cambios. */
export interface FiltroCambios {
  tabla?: string
  usuarioId?: string
  operacion?: string
  desde?: string
  hasta?: string
  pagina?: number
}

/** Los filtros del listado de eventos. */
export interface FiltroEventos {
  tipo?: string
  exito?: boolean
  desde?: string
  hasta?: string
  pagina?: number
}
