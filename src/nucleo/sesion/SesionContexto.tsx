import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ErrorApi } from '../api/errores'
import { EVENTO_PLAN_CAMBIO, fijarSucursalVista } from '../api/cliente'
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
      const yo = await accesoServicio.yo()
      // 046: la sucursal que de verdad quedó (la base corrige una que no le toca).
      fijarSucursalVista(yo.alcance?.vista ?? null)
      setEstado({ fase: 'dentro', yo })
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
    fijarSucursalVista(null)
    // 048: «Tus datos — Ahora no» vale hasta salir; al volver a entrar se pregunta otra vez.
    try { sessionStorage.removeItem('reyban.tusDatosLuego') } catch { /* nada */ }
    setEstado({ fase: 'fuera' })
  }, [])

  useEffect(() => { void refrescar() }, [refrescar])

  // 1 nov: EL PLAN AL DÍA SIN RECARGAR LA PÁGINA. Cuando termina el mes gratis
  // (o una cortesía, o el super administrador cambia el plan), el menú cambia
  // solo: a la hora exacta en que vence, cada 2 minutos, al volver a la
  // pestaña y en cuanto la API responde «no viene en tu plan». En silencio: un
  // corte de internet no saca a nadie de su sesión.
  const dentro = estado.fase === 'dentro'
  const pruebaHasta = estado.fase === 'dentro' ? estado.yo.plan?.pruebaHasta ?? null : null
  useEffect(() => {
    if (!dentro) return
    let ultimo = Date.now()
    const callado = async () => {
      ultimo = Date.now()
      try {
        const yo = await accesoServicio.yo()
        setEstado(e => e.fase === 'dentro' ? { fase: 'dentro', yo } : e)
      } catch (e) {
        if (e instanceof ErrorApi && e.esNoAutenticado) setEstado({ fase: 'fuera' })
      }
    }
    const alVolver = () => { if (document.visibilityState === 'visible' && Date.now() - ultimo > 30_000) void callado() }
    const cada = window.setInterval(() => { if (document.visibilityState === 'visible') void callado() }, 120_000)
    window.addEventListener(EVENTO_PLAN_CAMBIO, callado)
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    // A la hora exacta en que termina el mes gratis (si es dentro de un día).
    const falta = pruebaHasta ? new Date(pruebaHasta).getTime() - Date.now() : -1
    const alVencer = falta > 0 && falta < 86_400_000 ? window.setTimeout(() => void callado(), falta + 2_000) : undefined
    return () => {
      window.clearInterval(cada)
      if (alVencer) window.clearTimeout(alVencer)
      window.removeEventListener(EVENTO_PLAN_CAMBIO, callado)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', alVolver)
    }
  }, [dentro, pruebaHasta])

  const puede = useCallback((permiso: string) => {
    if (estado.fase !== 'dentro') return false
    // 067: del equipo de la plataforma con permisos parciales: de los
    // «plataforma.*», solo los suyos. El dueño (sin lista) los tiene todos.
    if (estado.yo.usuario.esSuperAdmin)
      return !estado.yo.plataformaPermisos || !permiso.startsWith('plataforma.') || estado.yo.plataformaPermisos.includes(permiso)
    return estado.yo.permisos.includes(permiso)
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
