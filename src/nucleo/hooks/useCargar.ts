import { useCallback, useEffect, useRef, useState } from 'react'
import { ErrorApi } from '../api/errores'

// =============================================================================
// PEDIR ALGO A LA API Y SABER EN QUÉ ESTADO ESTÁ
//
// Las tres cosas que toda pantalla con datos necesita —cargando, error, datos—
// escritas una vez en vez de una por vista.
//
// POR QUÉ IMPORTA: sin esto, cada pantalla acaba con sus tres `useState` y, en
// la quinta, alguien se olvida de poner `cargando` en false dentro del `catch`
// y la pantalla se queda girando para siempre.
//
// LA TRAMPA QUE EVITA `montado`: si el usuario cambia de pantalla mientras la
// llamada está en el aire, la respuesta llega a un componente que ya no está
// y React avisa de una fuga. La bandera hace que esa respuesta tardía se
// ignore en silencio, que es lo correcto: ya no le interesa a nadie.
// =============================================================================

interface Estado<T> {
  datos: T | undefined
  cargando: boolean
  error: string | undefined

  /** Vuelve a pedirlo. Se llama después de crear, suspender o cambiar algo. */
  recargar: () => Promise<void>
}

export function useCargar<T>(pedir: () => Promise<T>): Estado<T> {
  const [datos, setDatos] = useState<T>()
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string>()

  const montado = useRef(true)

  // La función se guarda en una referencia para que el efecto no se dispare de
  // nuevo cada vez que la vista se repinta y crea una función distinta.
  const pedirRef = useRef(pedir)
  pedirRef.current = pedir

  const recargar = useCallback(async () => {
    setCargando(true)
    setError(undefined)
    try {
      const resultado = await pedirRef.current()
      if (montado.current) setDatos(resultado)
    } catch (e) {
      if (montado.current) {
        setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar la información.')
      }
    } finally {
      if (montado.current) setCargando(false)
    }
  }, [])

  useEffect(() => {
    montado.current = true
    void recargar()
    return () => { montado.current = false }
  }, [recargar])

  return { datos, cargando, error, recargar }
}
