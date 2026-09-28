import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Estilo = 'principal' | 'secundario' | 'plano' | 'peligro'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  estilo?: Estilo
  ancho?: boolean

  /** Deshabilita y cambia el texto mientras dura la llamada. */
  ocupado?: boolean
  textoOcupado?: string

  children: ReactNode
}

/**
 * `type="button"` por defecto, y no es un detalle menor.
 *
 * El valor por defecto de HTML es `submit`: un botón dentro de un formulario
 * que solo abre un diálogo acaba enviando el formulario sin que nadie entienda
 * por qué. Quien quiera enviar, lo pide.
 */
export function Boton({
  estilo = 'principal',
  ancho,
  ocupado,
  textoOcupado,
  children,
  type = 'button',
  disabled,
  className,
  ...resto
}: Props) {
  const clases = [
    'boton',
    estilo !== 'principal' ? estilo : '',
    ancho ? 'ancho' : '',
    className ?? '',
  ].filter(Boolean).join(' ')

  return (
    <button type={type} className={clases} disabled={disabled || ocupado} {...resto}>
      {ocupado && textoOcupado ? textoOcupado : children}
    </button>
  )
}
