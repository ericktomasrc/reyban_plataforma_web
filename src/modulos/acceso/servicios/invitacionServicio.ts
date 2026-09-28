import { api } from '../../../nucleo/api/cliente'

/** GET /api/invitacion/{token} */
export interface EnlaceValido {
  correo: string
  nombre: string

  /** Nulo si quien recibe el enlace es un super administrador. */
  empresa: string | null

  expiraEn: string

  /** Para titular «Elige tu contraseña» o «Restablece tu contraseña». */
  primeraVez: boolean

  // --- El segundo factor, que se configura en la misma pantalla -----------

  /**
   * El secreto, en Base64, que hay que devolver al enviar el formulario.
   *
   * VIAJA AL NAVEGADOR Y VUELVE, en vez de quedarse a medias guardado en el
   * servidor. Guardarlo antes de confirmarlo obligaría a poder leerlo después
   * sin sesión — una función capaz de devolver el secreto de alguien a quien
   * solo se conoce por su token — y es mejor que esa función no exista.
   *
   * No se pierde seguridad: quien tiene el token va a ser el dueño del factor,
   * así que podría elegir el secreto que quisiera igualmente. Lo que importa
   * es que demuestre, con un código, que ese secreto llegó a su teléfono.
   */
  secreto: string

  /** La dirección otpauth:// que se convierte en código de barras. */
  direccionQr: string

  /** El mismo secreto en texto, por si el teléfono no puede leer el QR. */
  secretoLegible: string
}

/** Lo que devuelve terminar el proceso. */
export interface CuentaLista {
  mensaje: string

  /** Los ocho códigos. Se ven una sola vez. */
  codigosRecuperacion: string[]
  aviso: string
}

// =============================================================================
// EL ÚNICO SERVICIO QUE SE LLAMA SIN SESIÓN
//
// Quien abre una invitación todavía no tiene contraseña, así que no puede
// tener sesión. Lo único que lo identifica es el token del enlace.
//
// POR ESO EL TOKEN NUNCA SE GUARDA en ningún sitio del navegador: vive en la
// dirección mientras dura la pantalla y desaparece con ella.
// =============================================================================

export const invitacionServicio = {
  /** Comprueba el enlace, dice de quién es y trae el QR. Un enlace muerto da 404. */
  comprobar: (token: string) =>
    api.obtener<EnlaceValido>(`/api/invitacion/${encodeURIComponent(token)}`),

  /**
   * Establece contraseña y segundo factor de una vez, y quema el enlace.
   *
   * Las dos cosas juntas a propósito: si se guardara la contraseña primero y
   * el factor después, una ventana cerrada en medio dejaría una cuenta con
   * contraseña, sin factor y con el enlace ya gastado — es decir, una cuenta
   * que no puede entrar.
   */
  establecer: (token: string, clave: string, secreto: string, codigo: string) =>
    api.crear<CuentaLista>(
      `/api/invitacion/${encodeURIComponent(token)}`, { clave, secreto, codigo }),
}
