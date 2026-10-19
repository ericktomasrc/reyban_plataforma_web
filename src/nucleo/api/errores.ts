/**
 * El error que lanza el cliente de la API.
 *
 * Lleva el código HTTP y, cuando la API lo manda, un código propio como
 * `2fa_pendiente` o `cambio_de_clave_pendiente`. Ese código es lo que permite
 * que el front reaccione sin leer el texto del mensaje — que puede cambiar.
 */
export class ErrorApi extends Error {
  // Propiedades declaradas aparte y no en el constructor («public readonly
  // codigoHttp» dentro de los paréntesis): con `erasableSyntaxOnly` (tsconfig)
  // esa forma no compila en `npm run build`, aunque `npm run dev` no se queje.
  readonly codigoHttp: number
  readonly codigo?: string

  constructor(codigoHttp: number, mensaje: string, codigo?: string) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.codigoHttp = codigoHttp
    this.codigo = codigo
  }

  /** No hay sesión, o dejó de valer. */
  get esNoAutenticado() { return this.codigoHttp === 401 }

  /** Hay sesión, pero no llega: falta un permiso, un módulo, o cambiar la clave. */
  get esSinPermiso() { return this.codigoHttp === 403 }

  /** Choque: un correo repetido, un RUC ya usado, otra persona editando. */
  get esConflicto() { return this.codigoHttp === 409 }

  /** Ni siquiera se llegó al servidor. */
  get esDeRed() { return this.codigoHttp === 0 }
}
