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

  try {
    respuesta = await fetch(ruta, {
      method: metodo,
      credentials: 'include',
      headers: cuerpo !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
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

export const api = {
  obtener: <T>(ruta: string) => llamar<T>('GET', ruta),
  crear:   <T>(ruta: string, cuerpo?: unknown) => llamar<T>('POST', ruta, cuerpo),
  cambiar: <T>(ruta: string, cuerpo?: unknown) => llamar<T>('PUT', ruta, cuerpo),
  borrar:  <T>(ruta: string) => llamar<T>('DELETE', ruta),
}

export { ErrorApi }
