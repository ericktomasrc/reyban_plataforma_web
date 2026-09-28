import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ErrorApi } from '../api/errores'
import { accesoServicio } from '../../modulos/acceso/servicios/accesoServicio'
import type { Yo } from './tipos'

// =============================================================================
// QUIÉN ESTÁ DENTRO
//
// LA REGLA QUE ORDENA ESTE ARCHIVO: la fuente de verdad es /api/yo, no lo que
// el front recuerde.
//
// Podría guardarse el usuario al ingresar y darlo por bueno hasta salir. Pero
// entonces, si el administrador revoca la sesión o suspende la empresa, el
// front seguiría pintando el menú como si nada hasta la siguiente recarga. Al
// preguntar a la API, lo que se muestra es lo que la API reconoce.
//
// Y NO SE GUARDA NADA EN localStorage. La sesión vive en una cookie HttpOnly
// que este código no puede leer; una copia de los permisos en el navegador
// solo serviría para que alguien la editara — y para dar una falsa sensación
// de que eso protege algo.
// =============================================================================

type Estado =
  | { fase: 'cargando' }
  | { fase: 'fuera' }
  | { fase: 'dentro'; yo: Yo }

interface Contexto {
  estado: Estado

  /** Vuelve a preguntar a /api/yo. Tras ingresar o cambiar la contraseña. */
  refrescar: () => Promise<void>

  salir: () => Promise<void>

  /** El super administrador los tiene todos, aunque su lista salga vacía. */
  puede: (permiso: string) => boolean
}

const SesionCtx = createContext<Contexto | null>(null)

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' })

  const refrescar = useCallback(async () => {
    try {
      setEstado({ fase: 'dentro', yo: await accesoServicio.yo() })
    } catch (e) {
      // Un 401 aquí es lo normal al abrir la página sin haber entrado. No es
      // un fallo que haya que enseñar: simplemente no hay sesión.
      if (!(e instanceof ErrorApi && e.esNoAutenticado)) {
        console.error('No se pudo leer /api/yo', e)
      }
      setEstado({ fase: 'fuera' })
    }
  }, [])

  const salir = useCallback(async () => {
    try {
      await accesoServicio.salir()
    } catch {
      // Si la sesión ya no valía, el resultado es el mismo: fuera.
    }
    setEstado({ fase: 'fuera' })
  }, [])

  useEffect(() => { void refrescar() }, [refrescar])

  const puede = useCallback((permiso: string) => {
    if (estado.fase !== 'dentro') return false
    return estado.yo.usuario.esSuperAdmin || estado.yo.permisos.includes(permiso)
  }, [estado])

  return (
    <SesionCtx.Provider value={{ estado, refrescar, salir, puede }}>
      {children}
    </SesionCtx.Provider>
  )
}

export function useSesion() {
  const ctx = useContext(SesionCtx)
  if (!ctx) throw new Error('useSesion se usó fuera de <ProveedorSesion>')
  return ctx
}

/**
 * Para las vistas que ya están dentro del marco y saben que hay sesión.
 * Ahorra comprobar `fase !== 'dentro'` en cada pantalla.
 */
export function useYo(): Yo {
  const { estado } = useSesion()
  if (estado.fase !== 'dentro') {
    throw new Error('useYo se usó fuera de una pantalla con sesión')
  }
  return estado.yo
}
