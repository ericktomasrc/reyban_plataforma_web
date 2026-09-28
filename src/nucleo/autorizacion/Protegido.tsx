import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useSesion, useYo } from '../sesion/SesionContexto'

interface Props {
  /** El permiso que hace falta. */
  permiso?: string

  /** El módulo que la empresa tiene que tener contratado. */
  modulo?: string

  /** Solo el super administrador. */
  soloSuperAdmin?: boolean

  children: ReactNode
}

/**
 * Envuelve una ruta para que no se pinte si el usuario no llega.
 *
 * ESTO NO ES LA SEGURIDAD. Es comodidad: evita que alguien vea una pantalla
 * que va a responderle 403 en cada llamada, que es más confuso que no verla.
 *
 * La comprobación de verdad está en el endpoint. Si alguien quita esto del
 * código con las herramientas del navegador, lo único que consigue es ver una
 * pantalla vacía llena de errores.
 */
export function Protegido({ permiso, modulo, soloSuperAdmin, children }: Props) {
  const { puede } = useSesion()
  const yo = useYo()

  if (soloSuperAdmin && !yo.usuario.esSuperAdmin) {
    return <Navigate to="/" replace />
  }

  if (permiso && !puede(permiso)) {
    return <Navigate to="/" replace />
  }

  // El super administrador entra a todo: su trabajo es dar soporte a empresas
  // que sí lo contrataron.
  if (modulo && !yo.usuario.esSuperAdmin && !yo.menu.some(m => m.codigo === modulo)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

/**
 * Para esconder un botón o una fila, no una ruta entera.
 *
 *     <Si puede={Permisos.Usuarios.Crear}>
 *       <button>Crear usuario</button>
 *     </Si>
 */
export function Si({ puede: permiso, children }: { puede: string; children: ReactNode }) {
  const { puede } = useSesion()
  return puede(permiso) ? <>{children}</> : null
}
