import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Boton } from '../../componentes/Boton'
import { Dialogo } from '../../componentes/Dialogo'

export type TonoMensaje = 'error' | 'bien' | 'ojo'

export interface Mensaje {
  /** `error` rojo, `bien` verde, `ojo` ámbar. Por defecto `error`. */
  tono?: TonoMensaje

  /** El encabezado. Si no se pone, sale el que corresponde al tono. */
  titulo?: string

  /** El cuerpo. Admite JSX para poder destacar lo que importa. */
  texto: ReactNode

  /**
   * Segunda línea, más pequeña y apagada.
   *
   * Para lo que ayuda a arreglarlo pero no es el mensaje: el código que
   * devolvió SUNAT, el número de línea que falla. Nunca para una traza.
   */
  detalle?: ReactNode

  /** El texto del botón. Por defecto «Entendido». */
  cerrar?: string
}

/** El encabezado por defecto de cada tono. */
const TITULOS: Record<TonoMensaje, string> = {
  error: 'No se pudo',
  bien: 'Listo',
  ojo: 'Atención',
}

/** El símbolo del círculo de color. No lleva texto: lo dice el título. */
const SIMBOLOS: Record<TonoMensaje, string> = { error: '!', bien: '✓', ojo: 'i' }

export interface Mensajero {
  /** Algo salió mal. Rojo. */
  error: (texto: ReactNode, detalle?: ReactNode) => void

  /** Salió bien. Verde. */
  bien: (texto: ReactNode) => void

  /** Salió, pero hay que leer algo. Ámbar. */
  ojo: (texto: ReactNode) => void

  /** Con todas las opciones: título propio, otro botón. */
  mostrar: (mensaje: Mensaje) => void
}

const Contexto = createContext<Mensajero | null>(null)

/**
 * Los mensajes de la aplicación, en una ventana y no en una banda.
 *
 * POR QUÉ UNA VENTANA Y NO LA BANDA DE COLOR QUE HABÍA ANTES:
 *
 *   1. LA BANDA SE PIERDE. Aparece arriba del todo, y si el formulario está
 *      desplazado —un diálogo largo, una tabla larga— el mensaje sale fuera de
 *      la vista. Quien pulsó «Guardar» ve que no pasa nada y vuelve a pulsar.
 *   2. NO INTERRUMPE. Un error de guardado tiene que parar a la persona; una
 *      banda se queda de adorno mientras sigue escribiendo sobre datos que no
 *      se han guardado.
 *   3. SE ACUMULAN. Dos acciones seguidas dejaban dos bandas, o peor, la
 *      segunda pisaba a la primera sin que nadie llegara a leerla.
 *
 * QUÉ NO PASA POR AQUÍ, a propósito:
 *
 *   - Lo que no se pudo CARGAR. Si la bitácora no baja, la pantalla se queda
 *     vacía: una ventana que hay que cerrar para ver la nada de detrás no
 *     ayuda. Eso sigue siendo una banda dentro de la pantalla.
 *   - Las NOTAS de una pantalla («esto no lleva stock»). No son un mensaje:
 *     son parte del texto, y están siempre.
 *
 * Dicho corto: si es la consecuencia de algo que la persona acaba de pulsar,
 * ventana. Si es el estado en el que está la pantalla, banda.
 *
 * VA EN LA RAÍZ Y NO EN CADA PANTALLA para que el <dialog> del mensaje se
 * monte por encima de cualquier otro diálogo abierto. El navegador apila la
 * capa superior por orden de `showModal()`, así que el mensaje que se abre
 * sobre «Nuevo cliente» queda delante y no detrás.
 */
export function ProveedorMensajes({ children }: { children: ReactNode }) {
  // UNA COLA Y NO UN SOLO MENSAJE: dos fallos seguidos —guardar y, de paso,
  // avisar al correo antiguo— tienen que leerse los dos. Con una sola casilla
  // el segundo borraba al primero antes de que nadie lo viera.
  const [cola, setCola] = useState<Mensaje[]>([])

  const mostrar = useCallback((mensaje: Mensaje) => {
    setCola(previa => [...previa, mensaje])
  }, [])

  const mensajero = useMemo<Mensajero>(() => ({
    mostrar,
    error: (texto, detalle) => mostrar({ tono: 'error', texto, detalle }),
    bien: texto => mostrar({ tono: 'bien', texto }),
    ojo: texto => mostrar({ tono: 'ojo', texto }),
  }), [mostrar])

  const actual = cola[0]
  const tono = actual?.tono ?? 'error'

  return (
    <Contexto.Provider value={mensajero}>
      {children}

      {actual && (
        <Dialogo
          titulo={actual.titulo ?? TITULOS[tono]}
          abierto
          onCerrar={() => setCola(previa => previa.slice(1))}
          acciones={
            /* `autoFocus` para que Enter cierre: es lo que la mano hace sola
               después de leer, y sin esto no haría nada. */
            <Boton onClick={() => setCola(previa => previa.slice(1))} autoFocus>
              {actual.cerrar ?? 'Entendido'}
            </Boton>
          }
        >
          <div className={`mensaje-modal ${tono}`}>
            <div className="marca" aria-hidden="true">{SIMBOLOS[tono]}</div>
            <div className="cuerpo">
              <p className="texto">{actual.texto}</p>
              {actual.detalle && <p className="detalle">{actual.detalle}</p>}
            </div>
          </div>
        </Dialogo>
      )}
    </Contexto.Provider>
  )
}

/**
 * Cómo se usa, dos líneas en quien llama:
 *
 *     const mensaje = useMensaje()
 *     …
 *     catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo guardar.') }
 *
 * No hace falta pintar nada: la ventana la pone el proveedor de la raíz.
 */
export function useMensaje(): Mensajero {
  const m = useContext(Contexto)

  // Revienta a propósito y en cuanto se monta la pantalla, no el día que
  // alguien pulse el botón que falla: un mensajero de mentira que se traga los
  // errores sería peor que no tener ninguno.
  if (!m) throw new Error('useMensaje se usó fuera de <ProveedorMensajes>.')

  return m
}