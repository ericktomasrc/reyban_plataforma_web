/**
 * El error que lanza el cliente de la API.
 *
 * Lleva el código HTTP y, cuando la API lo manda, un código propio como
 * `2fa_pendiente` o `cambio_de_clave_pendiente`. Ese código es lo que permite
 * que el front reaccione sin leer el texto del mensaje — que puede cambiar.
 */
export class ErrorApi extends Error {
  constructor(
    public readonly codigoHttp: number,
    mensaje: string,
    public readonly codigo?: string,
  ) {
    super(mensaje)
    this.name = 'ErrorApi'
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
