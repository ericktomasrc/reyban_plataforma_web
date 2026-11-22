import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { leerActividad, suscribirActividad } from '../nucleo/api/actividad'

/**
 * EL VELO DE ESPERA DE TODA LA APP (e273).
 *
 * Sale cuando un guardado, cambio, baja, carga o descarga tarda más de medio
 * segundo (lo rápido no parpadea) y queda al menos un tercio de segundo.
 *
 * Es un <dialog> abierto con showModal(): así queda por ENCIMA de cualquier
 * ventana abierta (las ventanas también son <dialog>) y no deja hacer clic
 * dos veces. Escape no lo cierra.
 *
 * Si la pantalla ya muestra su propio velo con un texto más preciso
 * («Emitiendo la guía…», «Procesando tu pago…»), este no sale.
 */
const ESPERA_MS = 500
const MINIMO_MS = 350

export function VeloGlobal() {
  const act = useSyncExternalStore(suscribirActividad, leerActividad, leerActividad)
  const enCurso = act.cambio + act.archivo > 0
  const [visible, setVisible] = useState(false)
  const desde = useRef(0)
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (enCurso) {
      if (visible) return
      const t = window.setTimeout(() => {
        if (document.querySelector('.capa-ocupado')) return   // ya hay un velo propio
        desde.current = Date.now()
        setVisible(true)
      }, ESPERA_MS)
      return () => window.clearTimeout(t)
    }
    if (!visible) return
    const falta = Math.max(0, MINIMO_MS - (Date.now() - desde.current))
    const t = window.setTimeout(() => setVisible(false), falta)
    return () => window.clearTimeout(t)
  }, [enCurso, visible])

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (visible && !d.open) { try { d.showModal() } catch { /* sin soporte: queda oculto */ } }
    if (!visible && d.open) d.close()
  }, [visible])

  const archivo = act.archivo > 0 && act.cambio === 0
  return (
    <dialog ref={ref} className="velo-global" aria-busy="true" aria-live="assertive"
            onCancel={e => e.preventDefault()}>
      <div className="capa-ocupado-caja">
        <div className="girador" aria-hidden="true" />
        <p className="texto">{archivo ? 'Preparando tu archivo…' : 'Un momento…'}</p>
        <p className="detalle">{archivo ? 'En unos segundos empieza la descarga.' : 'Estamos guardando. No cierres ni recargues esta ventana.'}</p>
      </div>
    </dialog>
  )
}