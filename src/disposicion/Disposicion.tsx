import { Link, NavLink, Outlet } from 'react-router-dom'
import { Boton } from '../componentes/Boton'
import { BarraSuplantacion } from './BarraSuplantacion'
import { Permisos } from '../nucleo/autorizacion/permisos'
import { useSesion, useYo } from '../nucleo/sesion/SesionContexto'

/**
 * La cabecera y el hueco donde se pinta cada pantalla.
 *
 * EL MENÚ SALE DE /api/yo, calculado en la base con el cruce de módulo
 * contratado, rol y permiso. El front no decide qué mostrar: lo pinta.
 *
 * Y esto es comodidad, no seguridad. Evita que la gente pulse cosas que le
 * darían error. Si alguien escribe la URL a mano, el back devuelve 403 igual.
 */
export function Disposicion() {
  const { salir, puede } = useSesion()
  const { usuario, empresa, menu, roles } = useYo()

  const activo = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'activo' : undefined

  return (
    <div className="marco">
      {/* ANTES DE LA CABECERA Y FUERA DE ELLA, empujando la página hacia abajo.
          Una barra que flota encima se lee como un aviso que se va a ir solo, y
          esto no se va hasta que se pulsa. */}
      <BarraSuplantacion />

      <header className="cabecera">
        <span className="logo">Plataforma</span>

        <nav>
          <NavLink to="/" end className={activo}>Inicio</NavLink>

          {menu.map(m => (
            <NavLink key={m.codigo} to={m.ruta} className={activo}>
              {m.nombre}
            </NavLink>
          ))}

          {/* Usuarios es de la empresa, no de la plataforma: el super
              administrador no pertenece a ninguna y allí no tendría nada que
              gestionar, aunque el permiso le sobre. */}
          {!usuario.esSuperAdmin && puede(Permisos.Usuarios.Ver) && (
            <NavLink to="/usuarios" className={activo}>Usuarios</NavLink>
          )}

          {puede(Permisos.Usuarios.BitacoraVer) && (
            <NavLink to="/auditoria" className={activo}>Auditoría</NavLink>
          )}

          {usuario.esSuperAdmin && (
            <NavLink to="/admin/empresas" className={activo}>Empresas</NavLink>
          )}
        </nav>

        {/* EL NOMBRE ES EL ENLACE A «MI CUENTA», que es donde la gente lo
            busca: en toda aplicación con cabecera, pulsar tu propio nombre
            lleva a tus datos. Un enlace «Mi perfil» aparte en el menú habría
            competido por sitio con los módulos, que son el trabajo de verdad. */}
        <Link to="/perfil" className="quien">
          <div className="nombre">
            {usuario.nombre}

            {/* El rol, a la vista. Quien administra varias cuentas necesita
                saber con cuál está entrando sin ir a mirar a otra pantalla.

                Es informativo: lo que decide qué puede hacer son los permisos.
                Un super administrador no tiene roles, y no le hacen falta. */}
            <span className="rol">
              {usuario.esSuperAdmin
                ? 'Super administrador'
                : roles.length > 0
                  ? roles.join(' · ')
                  : 'Sin rol'}
            </span>
          </div>

          <div className="empresa">
            {empresa ? empresa.razonSocial : 'Administración de la plataforma'}
          </div>
        </Link>

        <Boton estilo="plano" onClick={() => void salir()}>Salir</Boton>
      </header>

      <main className="contenido">
        <Outlet />
      </main>
    </div>
  )
}
