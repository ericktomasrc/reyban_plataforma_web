import { api } from '../../../nucleo/api/cliente'

// =============================================================================
// EL REGISTRO LIBRE (migración 016)
//
// Como la invitación, se llama SIN SESIÓN: quien se registra todavía no tiene
// contraseña. Lo que protege la puerta está en el back: el captcha, el enlace
// al correo y el tope por red.
// =============================================================================

export type TipoCuenta = 'negocio' | 'profesional'
export type TipoTitular = 'natural' | 'juridica'

/** GET /api/registro/config */
export interface ConfigRegistro {
  /** Falso si el registro está cerrado (producción sin captcha configurado). */
  abierto: boolean
  captchaSitio: string | null

  /** Claves de prueba de Cloudflare: aprueban siempre. Solo en desarrollo. */
  captchaDePrueba: boolean
  longitudMinimaClave: number
  horasEnlace: number
}

/** GET /api/registro/alias */
export interface RevisionAlias {
  /** Ya normalizado: minúsculas, sin tildes ni símbolos. */
  alias: string
  disponible: boolean
  formatoValido: boolean
  problema: string | null
  sugerencias: string[]
}

export interface DatosRegistro {
  tipo: TipoCuenta
  titularTipo: TipoTitular
  titularDocumento: string
  titularNombre: string

  /** La persona que entra. Con persona natural puede ir vacío (es el titular). */
  nombre: string
  correo: string
  aceptaTerminos: boolean
  captcha: string
}

/** POST /api/registro */
export interface Registrado {
  correo: string

  /** Sale solo del correo (lo de antes de la @); con número si estaba tomado. */
  alias: string
  enviado: boolean
  horas: number

  /** Solo en desarrollo con el correo apagado: para probar sin buzón. */
  enlaceDePrueba: string | null
}

export const registroServicio = {
  config: () =>
    api.obtener<ConfigRegistro>('/api/registro/config'),

  revisarAlias: (valor: string, correo: string) =>
    api.obtener<RevisionAlias>(
      `/api/registro/alias?valor=${encodeURIComponent(valor)}&correo=${encodeURIComponent(correo)}`),

  registrar: (datos: DatosRegistro) =>
    api.crear<Registrado>('/api/registro', datos),

  /** Responde lo mismo exista o no el correo. */
  reenviar: (correo: string) =>
    api.crear<{ mensaje: string; enlaceDePrueba: string | null }>('/api/registro/reenviar', { correo }),
}