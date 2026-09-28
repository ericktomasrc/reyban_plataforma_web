import { Navigate, Route, Routes } from 'react-router-dom'
import { Disposicion } from '../disposicion/Disposicion'
import { Protegido } from '../nucleo/autorizacion/Protegido'
import { Permisos } from '../nucleo/autorizacion/permisos'
import { ListaEmpresas } from '../modulos/administracion/vistas/ListaEmpresas'
import { Cambios } from '../modulos/auditoria/vistas/Cambios'
import { Eventos } from '../modulos/auditoria/vistas/Eventos'
import { Inicio } from '../modulos/inicio/vistas/Inicio'
import { MiPerfil } from '../modulos/perfil/vistas/MiPerfil'
import { ListaUsuarios } from '../modulos/usuarios/vistas/ListaUsuarios'

/**
 * El mapa de rutas de la aplicación, en un solo sitio.
 *
 * CÓMO SE AÑADE UN MÓDULO:
 *
 *   <Route path="/facturacion" element={
 *     <Protegido permiso={Permisos.Facturacion.Ver} modulo={Modulos.Facturacion}>
 *       <ListaDocumentos />
 *     </Protegido>
 *   } />
 *
 * El menú no se toca: la entrada aparece sola cuando la empresa contrata el
 * módulo, porque sale de /api/yo.
 */
export function Rutas() {
  return (
    <Routes>
      <Route element={<Disposicion />}>
        <Route path="/" element={<Inicio />} />

        {/* MI PROPIA CUENTA — LA ÚNICA RUTA SIN `Protegido` DE TODA LA
            APLICACIÓN, y es lo correcto: un permiso decide qué puedes hacerle
            a OTRO. Nadie tiene que autorizarte a mirar tu propia cuenta. */}
        <Route path="/perfil" element={<MiPerfil />} />

        {/* La gente de la empresa. La usa el administrador del cliente. */}
        <Route
          path="/usuarios"
          element={
            <Protegido permiso={Permisos.Usuarios.Ver}>
              <ListaUsuarios />
            </Protegido>
          }
        />

        {/* La auditoría. La MISMA pantalla para los dos niveles: quien la
            abre ve lo suyo, y el super administrador lo ve todo, porque lo
            recorta la política de la base según quién pregunta. */}
        <Route
          path="/auditoria"
          element={
            <Protegido permiso={Permisos.Usuarios.BitacoraVer}>
              <Cambios />
            </Protegido>
          }
        />
        <Route
          path="/auditoria/eventos"
          element={
            <Protegido permiso={Permisos.Usuarios.BitacoraVer}>
              <Eventos />
            </Protegido>
          }
        />

        {/* La administración de la plataforma. `Protegido` solo evita enseñar
            una pantalla que respondería 403 en cada llamada; quien lo impide
            de verdad es el `SoloSuperAdmin` de cada endpoint. */}
        <Route
          path="/admin/empresas"
          element={
            <Protegido soloSuperAdmin>
              <ListaEmpresas />
            </Protegido>
          }
        />

        {/* Las pantallas de los módulos entran aquí a medida que existan. */}

        {/* Una ruta que no existe devuelve al inicio, en vez de dejar la
            página en blanco sin explicación. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
