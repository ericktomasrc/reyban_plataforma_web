import { ErrorApi } from './errores'

// =============================================================================
// EL ÚNICO SITIO DEL FRONT QUE LLAMA A LA API
//
// Ninguna vista usa `fetch`. Llaman a un servicio de su módulo, y el servicio
// llama aquí.
//
// POR QUÉ UN SOLO SITIO: el envío de la cookie, la forma de los errores y el
// manejo del 401 tienen que ser iguales en todas las llamadas. Repartidos por
// veinte componentes, uno se olvida — y aparece una pantalla en blanco que no
// dice por qué.
//
// LO QUE NO HAY AQUÍ, Y ES DELIBERADO: ningún token.
//
// La sesión viaja en una cookie HttpOnly que este código NO PUEDE LEER, y eso
// es justamente lo que impide que un XSS se la lleve. El navegador la manda
// porque `credentials: 'include'` se lo pide.
// =============================================================================

type Metodo = 'GET' | 'POST' | 'PUT' | 'DELETE'

async function llamar<T>(metodo: Metodo, ruta: string, cuerpo?: unknown): Promise<T> {
  let respuesta: Response

  // UN FORMULARIO (subir un archivo) VA TAL CUAL y sin Content-Type: lo pone
  // el navegador con su separador. Todo lo demás, como JSON.
  const formulario = cuerpo instanceof FormData

  try {
    respuesta = await fetch(ruta, {
      method: metodo,
      credentials: 'include',
      headers: cuerpo !== undefined && !formulario ? { 'Content-Type': 'application/json' } : undefined,
      body: formulario ? cuerpo : cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    })
  } catch {
    // La red, no la API. Mensaje distinto porque la solución es distinta: aquí
    // no hay nada que corregir en los datos, es que no se llegó al servidor.
    throw new ErrorApi(0, 'No se pudo conectar con el servidor. ¿Está corriendo la API?')
  }

  // 204 sin cuerpo: cerrar sesión, por ejemplo.
  if (respuesta.status === 204) return undefined as T

  const texto = await respuesta.text()
  const datos = texto ? intentarJson(texto) : null

  if (!respuesta.ok) {
    throw new ErrorApi(
      respuesta.status,
      datos?.error ?? `Error ${respuesta.status}`,
      datos?.codigo,
    )
  }

  return datos as T
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function intentarJson(texto: string): any {
  try {
    return JSON.parse(texto)
  } catch {
    // Un 500 sin manejar puede devolver HTML. Que no reviente el parseo:
    // el texto crudo es más útil que «Unexpected token <».
    return { error: texto.slice(0, 300) }
  }
}

/**
 * Baja un archivo y se lo da al navegador para que lo guarde.
 *
 * POR QUÉ NO UN `<a href>` A SECAS, que sería una línea: si la respuesta es un
 * error, el navegador se baja igual un «F001-00000086.pdf» que por dentro es
 * un JSON de error, y quien lo abre ve un PDF roto sin saber por qué. Así, un
 * error lanza `ErrorApi` como cualquier otra llamada y sale en ventana.
 *
 * EL MENSAJE JUNTA `error` Y `detalle`. En las descargas el detalle es lo que
 * explica —«El CDR solo existe cuando SUNAT ya respondió»— y lo escribe el
 * servicio para que lo lea el usuario: se enseña tal cual.
 *
 * EL NOMBRE SALE DE `Content-Disposition`, que la API copia del servicio. Sin
 * él, el archivo se llamaría como el último trozo de la ruta: «pdf».
 */
async function descargar(ruta: string): Promise<void> {
  let respuesta: Response

  try {
    respuesta = await fetch(ruta, { method: 'GET', credentials: 'include' })
  } catch {
    throw new ErrorApi(0, 'No se pudo conectar con el servidor. ¿Está corriendo la API?')
  }

  if (!respuesta.ok) {
    const texto = await respuesta.text()
    const datos = texto ? intentarJson(texto) : null
    const mensaje = [datos?.error, datos?.detalle].filter(Boolean).join(' ')

    throw new ErrorApi(respuesta.status, mensaje || `Error ${respuesta.status}`, datos?.codigo)
  }

  const contenido = await respuesta.blob()
  const nombre = nombreDeArchivo(respuesta.headers.get('Content-Disposition'))
    ?? ruta.split('/').pop() ?? 'archivo'

  const url = URL.createObjectURL(contenido)
  try {
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = nombre
    document.body.appendChild(enlace)
    enlace.click()
    enlace.remove()
  } finally {
    // Un momento después, no en el acto: algunos navegadores todavía no han
    // empezado a leer la URL cuando vuelve `click()`.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

/**
 * El nombre de `Content-Disposition`. Gana `filename*=UTF-8''...` —el que
 * admite tildes— y si no está, el `filename=` normal, con o sin comillas.
 */
function nombreDeArchivo(cabecera: string | null): string | null {
  if (!cabecera) return null

  const extendido = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(cabecera)
  if (extendido) {
    try { return decodeURIComponent(extendido[1].trim()) } catch { /* sigue con el normal */ }
  }

  const normal = /filename\s*=\s*"?([^";]+)"?/i.exec(cabecera)
  return normal ? normal[1].trim() : null
}

export const api = {
  obtener: <T>(ruta: string) => llamar<T>('GET', ruta),
  crear:   <T>(ruta: string, cuerpo?: unknown) => llamar<T>('POST', ruta, cuerpo),
  cambiar: <T>(ruta: string, cuerpo?: unknown) => llamar<T>('PUT', ruta, cuerpo),
  borrar:  <T>(ruta: string) => llamar<T>('DELETE', ruta),

  /** Un archivo y sus campos, como formulario (multipart). Para el certificado y el logo. */
  subir:   <T>(ruta: string, formulario: FormData) => llamar<T>('POST', ruta, formulario),

  /** Un archivo, no JSON. Ver `descargar`. */
  descargar,
}

export { ErrorApi }