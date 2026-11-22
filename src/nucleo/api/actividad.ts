/**
 * LO QUE ESTÁ EN CURSO (e273).
 *
 * Cada guardado, cambio, baja o carga (todo lo que no es GET) y cada descarga
 * de archivo se anota aquí mientras dura. El velo global (VeloGlobal) lo lee y
 * se muestra si tarda más de medio segundo. Lo que corre solo, sin que la
 * persona haya pulsado nada, va en SIN_VELO.
 */
type Tipo = 'cambio' | 'archivo'

const pendientes: Record<Tipo, number> = { cambio: 0, archivo: 0 }
let foto = { cambio: 0, archivo: 0 }
const oyentes = new Set<() => void>()

function avisar() {
  foto = { ...pendientes }
  oyentes.forEach(f => f())
}

/** Anota una operación; devuelve con qué terminarla (se puede llamar dos veces sin daño). */
export function empezar(tipo: Tipo): () => void {
  pendientes[tipo]++
  avisar()
  let terminado = false
  return () => {
    if (terminado) return
    terminado = true
    pendientes[tipo] = Math.max(0, pendientes[tipo] - 1)
    avisar()
  }
}

export const leerActividad = () => foto
export function suscribirActividad(f: () => void) { oyentes.add(f); return () => { oyentes.delete(f) } }

/** Corren solos (marcar avisos leídos, esperar la app del segundo factor, etc.): sin velo. */
export const SIN_VELO: RegExp[] = [
  /^\/api\/avisos\/leidos/,
  /^\/api\/2fa\/espera(\?|$)/,
  /\/whatsapp\/resultado$/,
  /^\/api\/inicio\/revision-hecha/,
]