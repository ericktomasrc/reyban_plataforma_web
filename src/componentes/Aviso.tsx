import type { ReactNode } from 'react'

type Tono = 'error' | 'ojo' | 'bien'

/**
 * Un mensaje con tono.
 *
 * `role="alert"` en los errores hace que un lector de pantalla lo anuncie en
 * cuanto aparece. Sin eso, alguien que no ve la pantalla pulsa «Entrar», no
 * pasa nada aparente, y no tiene forma de enterarse de que hubo un fallo.
 */
export function Aviso({ tono = 'error', children }: { tono?: Tono; children: ReactNode }) {
  return (
    <div className={`aviso ${tono}`} role={tono === 'error' ? 'alert' : undefined}>
      {children}
    </div>
  )
}
