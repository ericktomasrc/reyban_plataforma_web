import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useSesion, useYo } from '../sesion/SesionContexto'
import { planQueLaTrae, rutaPermitida } from '../planes/planes'
import { PantallaPlan } from '../../modulos/planes/componentes/PantallaPlan'

interface Props {
  /** El permiso que hace falta. */
  permiso?: string

  /** El módulo que la empresa tiene que tener contratado. */
  modulo?: string

  /** Solo el super administrador. */
  soloSuperAdmin?: boolean

  /** e228: solo quien es de una cuenta (Mi plan, Mis pagos). El super administrador va al inicio. */
  deCuenta?: boolean

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
export function Protegido({ permiso, modulo, soloSuperAdmin, deCuenta, children }: Props) {
  const { puede } = useSesion()
  const yo = useYo()
  const ubicacion = useLocation()

  if (soloSuperAdmin && !yo.usuario.esSuperAdmin) {
    return <Navigate to="/" replace />
  }

  // e228: «Mi plan» y «Mis pagos» son de la cuenta. Sin cuenta (el super
  // administrador) no hay nada que mostrar: al inicio, sin mensaje rojo.
  if (deCuenta && !yo.cuenta) {
    return <Navigate to="/" replace />
  }

  if (permiso && !puede(permiso)) {
    return <Navigate to="/" replace />
  }

  // e163: EL SUPER ADMINISTRADOR SIN EMPRESA NO ENTRA A LAS PANTALLAS DE UNA
  // EMPRESA. Pasaba al entrar después de otro usuario: el navegador seguía en
  // la última dirección (un comprobante de esa empresa) y se le enseñaba. Para
  // dar soporte está «Ver como», que sí le pone la empresa.
  // 069: lo que el plan de la empresa no trae (antes que el módulo: sin
  // módulo contratado también sale «Esto viene en el plan…», no el inicio). Dentro del marco ya lo para
  // Disposicion; esto cubre las pantallas sin marco (el punto de venta).
  if (yo.empresa && !rutaPermitida(yo.plan, ubicacion.pathname)) {
    return (
      <div className="marco-solo">
        <PantallaPlan minimo={planQueLaTrae(yo.plan, ubicacion.pathname) ?? 'sin'}
                      puedeCambiar={yo.cuenta?.nivel === 'dueno' || yo.cuenta?.nivel === 'colaborador_admin'} />
      </div>
    )
  }

  if (modulo && yo.usuario.esSuperAdmin && !yo.empresa) {
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
