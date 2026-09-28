import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

interface Props {
  titulo: string
  abierto: boolean
  onCerrar: () => void
  children: ReactNode

  /** Los botones del pie. Se ponen a la derecha, el principal el último. */
  acciones?: ReactNode

  /**
   * Quita el aspa y desactiva la tecla Escape.
   *
   * Para lo que no se puede cerrar por accidente: una contraseña que solo se
   * enseña una vez y no se puede volver a consultar. Un aspa que no hace nada
   * es peor que no tener aspa.
   */
  obligatorio?: boolean
}

/**
 * Una ventana modal, sobre el <dialog> del navegador.
 *
 * POR QUÉ EL ELEMENTO NATIVO Y NO UN DIV CON POSICIÓN FIJA: `showModal()` trae
 * gratis tres cosas que a mano se olvidan siempre —
 *
 *   1. El foco se queda atrapado dentro. Con el tabulador no te escapas a los
 *      botones de detrás, que es lo que hace que un modal casero sea
 *      inutilizable sin ratón.
 *   2. La tecla Escape cierra.
 *   3. Lo de debajo queda inerte: ni clics ni lectores de pantalla.
 *
 * El `onCancel` es lo que hace el navegador al pulsar Escape. Sin
 * interceptarlo, el <dialog> se cerraría solo y React seguiría creyendo que
 * está abierto — y la segunda vez ya no abriría.
 */
export function Dialogo({ titulo, abierto, onCerrar, children, acciones, obligatorio }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return

    if (abierto && !d.open) d.showModal()
    if (!abierto && d.open) d.close()
  }, [abierto])

  return (
    <dialog
      ref={ref}
      className="dialogo"
      onCancel={e => { e.preventDefault(); if (!obligatorio) onCerrar() }}
    >
      <header className="dialogo-cabecera">
        <h2>{titulo}</h2>
        {!obligatorio && (
          <button type="button" className="cerrar" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        )}
      </header>

      <div className="dialogo-cuerpo">{children}</div>

      {acciones && <footer className="dialogo-pie">{acciones}</footer>}
    </dialog>
  )
}
