import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  etiqueta: string
  pista?: ReactNode

  /** Pone la pista en rojo y marca el campo como inválido para el lector de pantalla. */
  mal?: boolean

  /**
   * Pinta el asterisco de «hace falta».
   *
   * NO ES LO MISMO QUE `required` DE HTML, y por eso son dos cosas: `required`
   * lo comprueba el navegador al enviar, y hay formularios donde la
   * comprobación la hace el back o una función propia porque depende de otro
   * campo. El asterisco tiene que salir igual en los dos casos — si solo
   * apareciera con `required`, la mitad de los campos obligatorios de la
   * aplicación no lo llevarían.
   *
   * El asterisco es decorativo para quien no ve la pantalla: lo que anuncia un
   * lector es el `aria-required`, que se pone aquí mismo.
   */
  obligatorio?: boolean
}

/**
 * Un campo con su etiqueta.
 *
 * `useId` genera un identificador único y estable para enlazar el `label` con
 * el `input`. No es decoración: sin ese enlace, pulsar en la etiqueta no
 * enfoca el campo, y un lector de pantalla lee «cuadro de texto» sin decir de
 * qué.
 */
export function Campo({ etiqueta, pista, mal, obligatorio, ...resto }: Props) {
  const id = useId()

  return (
    <div className="campo">
      <label htmlFor={id}>
        {etiqueta}
        {obligatorio && <Asterisco />}
      </label>
      <input
        id={id}
        aria-invalid={mal || undefined}
        aria-required={obligatorio || undefined}
        {...resto}
      />
      {pista && <span className={mal ? 'pista mal' : 'pista'}>{pista}</span>}
    </div>
  )
}


/**
 * El asterisco de los campos que hacen falta.
 *
 * SUELTO Y EXPORTADO porque la mitad de los campos de la aplicación no son un
 * <Campo>: los desplegables se escriben a mano con su propio <label>, y sin
 * esto llevarían un asterisco escrito a pelo que el día que cambie el color se
 * queda distinto del resto.
 *
 * `aria-hidden` porque para quien no ve la pantalla lo dice el
 * `aria-required` del control, y oír «asterisco» después de cada etiqueta es
 * ruido.
 */
export function Asterisco() {
  return <span className="obligatorio" aria-hidden="true" title="Hace falta"> *</span>
}