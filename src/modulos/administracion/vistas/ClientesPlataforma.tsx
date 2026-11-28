import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Permisos } from '../../../nucleo/autorizacion/permisos'
import { useSesion } from '../../../nucleo/sesion/SesionContexto'
import './cuentas.css'

/**
 * e292 — «CLIENTES» del super administrador: Cuentas y Empresas en un solo
 * menú, con dos pestañas.
 *
 *   · Por cuenta  (/admin/cuentas):  quién te paga y cómo va cada uno.
 *   · Por empresa (/admin/empresas): cada RUC, para el trabajo del día a día.
 *
 * Las rutas de antes siguen iguales: los enlaces viejos llegan a su pestaña.
 */
export function ClientesPlataforma({ pestana, children }: { pestana: 'cuenta' | 'empresa'; children: ReactNode }) {
  const { puede } = useSesion()
  const pestanaClase = ({ isActive }: { isActive: boolean }) => isActive ? 'on' : undefined
  return (
    <div className="cli-pagina">
      <div className="cli-cabecera">
        <h1 className="titulo-pagina">Clientes</h1>
        <p className="bajada-pagina">
          {pestana === 'cuenta'
            ? 'Quién te paga y cómo va cada uno. Toca una tarjeta para filtrar y una fila para ver sus empresas. Suspender una cuenta corta sus sesiones al instante; no borra nada.'
            : 'Cada RUC por separado: alta, certificado, módulos y facturación.'}
        </p>
      </div>
      <nav className="cli-pestanas" aria-label="Ver clientes">
        {puede(Permisos.Plataforma.CuentasGestionar) && <NavLink to="/admin/cuentas" className={pestanaClase}>Por cuenta</NavLink>}
        <NavLink to="/admin/empresas" className={pestanaClase}>Por empresa</NavLink>
      </nav>
      {children}
    </div>
  )
}