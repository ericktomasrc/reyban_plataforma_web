import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Boton } from '../../componentes/Boton'
import { Dialogo } from '../../componentes/Dialogo'

/**
 * Qué se le pregunta a la persona.
 */
export interface Confirmacion {
  titulo: string

  /** El cuerpo. Admite JSX para poder marcar en negrita lo que importa. */
  mensaje: ReactNode

  /** El texto del botón que confirma. Un verbo, no «Aceptar». */
  confirmar?: string

  /**
   * `peligro` pinta el botón en rojo. Para lo que no se puede deshacer o
   * molesta a otra persona: desactivar a alguien, cerrar sus sesiones.
   */
  tono?: 'normal' | 'peligro'
}

/**
 * Preguntar «¿seguro?» sin usar el `confirm()` del navegador.
 *
 * POR QUÉ NO EL DEL NAVEGADOR, que era lo que había antes:
 *
 *   1. SALE CON EL NOMBRE DEL SERVIDOR DELANTE — «localhost:5173 dice» —, que
 *      no significa nada para quien lo lee y hace que la aplicación parezca
 *      rota o, peor, que parezca una de esas ventanas de publicidad.
 *   2. NO SE PUEDE DAR FORMATO. Todo el texto es del mismo tamaño y del mismo
 *      color, así que no hay forma de destacar lo único que hay que leer.
 *   3. NO SE PARECE A NADA MÁS DE LA APLICACIÓN. Tipografía del sistema
 *      operativo, botones del sistema operativo, y un «Aceptar» genérico donde
 *      debería decir qué se va a hacer.
 *   4. BLOQUEA EL NAVEGADOR ENTERO mientras está abierto.
 *
 * CÓMO SE USA — dos líneas en quien llama:
 *
 *     const { pedir, dialogo } = useConfirmar()
 *
 *     async function desactivar(u) {
 *       if (!await pedir({ titulo: '…', mensaje: <>…</>, tono: 'peligro' })) return
 *       …
 *     }
 *
 *     return <>…{dialogo}</>
 *
 * DEVUELVE UNA PROMESA para que quien llama se lea igual que con `confirm()`:
 * una línea al principio y seguir. La alternativa —estados, callbacks y el
 * trabajo pendiente guardado en algún sitio— parte en tres una función que
 * debería leerse de arriba abajo.
 */
export function useConfirmar() {
  const [peticion, setPeticion] = useState<Confirmacion>()

  // La función que desbloquea la promesa. En una ref y no en estado: cambiarla
  // no tiene que repintar nada, y tiene que sobrevivir al repintado que sí
  // provoca `setPeticion`.
  const responder = useRef<(ok: boolean) => void>(null)

  const pedir = useCallback((opciones: Confirmacion) =>
    new Promise<boolean>(resolver => {
      // Si ya había una pregunta abierta —dos clics rápidos—, la anterior se
      // responde que no en vez de quedarse colgada para siempre.
      responder.current?.(false)
      responder.current = resolver
      setPeticion(opciones)
    }), [])

  const cerrar = useCallback((ok: boolean) => {
    setPeticion(undefined)
    responder.current?.(ok)
    responder.current = null
  }, [])

  const dialogo = peticion ? (
    <Dialogo
      titulo={peticion.titulo}
      abierto
      onCerrar={() => cerrar(false)}
      acciones={
        <>
          <Boton estilo="secundario" onClick={() => cerrar(false)}>
            Cancelar
          </Boton>
          <Boton
            estilo={peticion.tono === 'peligro' ? 'peligro' : 'principal'}
            onClick={() => cerrar(true)}
          >
            {peticion.confirmar ?? 'Continuar'}
          </Boton>
        </>
      }
    >
      <div className="confirmacion">{peticion.mensaje}</div>
    </Dialogo>
  ) : null

  return { pedir, dialogo }
}
