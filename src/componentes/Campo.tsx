import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  etiqueta: string
  pista?: ReactNode

  /** Pone la pista en rojo y marca el campo como inválido para el lector de pantalla. */
  mal?: boolean
}

/**
 * Un campo con su etiqueta.
 *
 * `useId` genera un identificador único y estable para enlazar el `label` con
 * el `input`. No es decoración: sin ese enlace, pulsar en la etiqueta no
 * enfoca el campo, y un lector de pantalla lee «cuadro de texto» sin decir de
 * qué.
 */
export function Campo({ etiqueta, pista, mal, ...resto }: Props) {
  const id = useId()

  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <input id={id} aria-invalid={mal || undefined} {...resto} />
      {pista && <span className={mal ? 'pista mal' : 'pista'}>{pista}</span>}
    </div>
  )
}
