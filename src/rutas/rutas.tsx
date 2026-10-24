import { Navigate, Route, Routes } from 'react-router-dom'
import { Disposicion } from '../disposicion/Disposicion'
import { Protegido } from '../nucleo/autorizacion/Protegido'
import { Modulos, Permisos } from '../nucleo/autorizacion/permisos'
import { ListaEmpresas } from '../modulos/administracion/vistas/ListaEmpresas'
import { ListaCuentas } from '../modulos/administracion/vistas/ListaCuentas'
import { SolicitudesTraspaso } from '../modulos/administracion/vistas/SolicitudesTraspaso'
import { ConexionSunatPagina } from '../modulos/administracion/vistas/ConexionSunat'
import { CorreosPagina } from '../modulos/administracion/vistas/Correos'
import { RecuperacionesPagina } from '../modulos/administracion/vistas/Recuperaciones'
import { ConsultasSunatPagina } from '../modulos/administracion/vistas/ConsultasSunat'
import { Cambios } from '../modulos/auditoria/vistas/Cambios'
import { Eventos } from '../modulos/auditoria/vistas/Eventos'
import { Clientes } from '../modulos/facturacion/vistas/Clientes'
import { Comprobantes } from '../modulos/facturacion/vistas/Comprobantes'
import { NuevoComprobante } from '../modulos/facturacion/vistas/NuevoComprobante'
import { NotaCredito } from '../modulos/facturacion/vistas/NotaCredito'
import { ImportarProductos } from '../modulos/facturacion/vistas/ImportarProductos'
import { Sucursales } from '../modulos/facturacion/vistas/Sucursales'
import { NotaDebito } from '../modulos/facturacion/vistas/NotaDebito'
import { NuevaNota } from '../modulos/facturacion/vistas/NuevaNota'
import { Guias } from '../modulos/guias/vistas/Guias'
import { NuevaGuia } from '../modulos/guias/vistas/NuevaGuia'
import { VerGuia } from '../modulos/guias/vistas/VerGuia'
import { TransporteGuardado } from '../modulos/guias/vistas/TransporteGuardado'
import { ConfiguracionGuias } from '../modulos/guias/vistas/ConfiguracionGuias'
import {
  InicioReportes, ReporteClientesPagina, ReporteMiDiaPagina, ReporteProductosPagina,
  ReporteSucursalesPagina, ReporteVendedoresPagina, ReporteVentasPagina,
} from '../modulos/reportes/vistas/Reportes'
import {
  ReporteAnuladosPagina, ReporteDescargaPagina, ReporteIgvPagina, ReportePersonasNotasPagina, ReporteProblemasPagina,
  ReporteRegistroPagina,
} from '../modulos/reportes/vistas/ReportesSunat'
import {
  ReporteActivacionPagina, ReporteConsumoPagina, ReporteRiesgoPagina,
  ReporteCarteraPagina, ReporteCertificadosPagina, ReporteCuentasPagina, ReporteEmpresasPagina,
  ReportePlataformaPagina, ReporteRechazosPagina,
} from '../modulos/reportes/vistas/ReportesPlataforma'
import { VerComprobante } from '../modulos/facturacion/vistas/VerComprobante'
import { Productos } from '../modulos/facturacion/vistas/Productos'
import { Inicio } from '../modulos/inicio/vistas/Inicio'
import { Asistente } from '../modulos/configuracion/vistas/Asistente'
import { MisEmpresas } from '../modulos/cartera/vistas/MisEmpresas'
import { Colaboradores } from '../modulos/cartera/vistas/Colaboradores'
import { MiPerfil } from '../modulos/perfil/vistas/MiPerfil'
import { ListaUsuarios } from '../modulos/usuarios/vistas/ListaUsuarios'
import { RolesPropios } from '../modulos/usuarios/vistas/RolesPropios'
import { Cargos } from '../modulos/usuarios/vistas/Cargos'

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

        {/* EL ASISTENTE «AGREGA TU EMPRESA» (fase 2). Sin `Protegido`: quien
            se acaba de registrar todavía no tiene ningún permiso, y el paso 1
            es justo el que se los da. Cada llamada la comprueba el back:
            sin empresa solo puede crear la suya; con empresa, hace falta
            facturacion.credenciales_gestionar. */}
        <Route path="/configurar" element={<Asistente />} />

        {/* LA CARTERA (fase 3). Sin `Protegido`: los permisos son de la
            empresa abierta y la cartera está por encima. Lo que cada uno
            puede ver y hacer lo decide la base (funciones de la 018). */}
        <Route path="/empresas" element={<MisEmpresas />} />
        <Route path="/colaboradores" element={<Colaboradores />} />
        {/* 047: los cargos del estudio (Mi equipo). */}
        <Route path="/colaboradores/cargos" element={<Cargos deEstudio />} />

        {/* 047: los cargos de la empresa. */}
        <Route
          path="/usuarios/cargos"
          element={
            <Protegido permiso={Permisos.Usuarios.Ver}>
              <Cargos />
            </Protegido>
          }
        />

        {/* 035: roles propios de la empresa. */}
        <Route
          path="/usuarios/roles"
          element={
            <Protegido permiso={Permisos.Usuarios.RolesGestionar}>
              <RolesPropios />
            </Protegido>
          }
        />

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
        <Route
          path="/admin/cuentas"
          element={
            <Protegido soloSuperAdmin>
              <ListaCuentas />
            </Protegido>
          }
        />
        {/* FASE 4b: los reclamos con documentos. */}
        <Route
          path="/admin/traspasos"
          element={
            <Protegido soloSuperAdmin>
              <SolicitudesTraspaso />
            </Protegido>
          }
        />
        {/* 030: el interruptor modo prueba / real (solo QA). */}
        <Route
          path="/admin/conexion-sunat"
          element={
            <Protegido soloSuperAdmin>
              <ConexionSunatPagina />
            </Protegido>
          }
        />
        {/* 038: los correos de acceso que no salieron. */}
        <Route
          path="/admin/correos"
          element={
            <Protegido soloSuperAdmin>
              <CorreosPagina />
            </Protegido>
          }
        />
        {/* 039: recuperaciones del segundo factor en curso. */}
        <Route
          path="/admin/recuperaciones"
          element={
            <Protegido soloSuperAdmin>
              <RecuperacionesPagina />
            </Protegido>
          }
        />
        {/* 042: modo de consultas (SUNAT / Decolecta) y padrón de SUNAT. */}
        <Route
          path="/admin/consultas-sunat"
          element={
            <Protegido permiso={Permisos.Plataforma.ConsultasGestionar}>
              <ConsultasSunatPagina />
            </Protegido>
          }
        />

        {/* ── EL MÓDULO DE FACTURACIÓN ─────────────────────────────────
            `modulo` además del permiso, y no es redundante: el permiso dice
            qué puede hacer esta persona, el módulo dice qué compró su
            empresa. Un administrador con todos los permisos del mundo no
            factura si su empresa no lo contrató. */}
        {/* El menú apunta a `/facturacion` —así está en la tabla `modulos`, y
            ahí debe seguir: es la dirección del módulo, no la de una de sus
            pantallas—. Aquí se decide cuál se abre primero. Sin esta línea, el
            clic en el menú caería en la ruta comodín y volvería al inicio. */}
        <Route path="/facturacion" element={<Navigate to="/facturacion/comprobantes" replace />} />

        {/* EL ORDEN IMPORTA: `nuevo` va ANTES que `:id`. Al revés, React
            Router tomaría «nuevo» como un identificador y abriría la pantalla
            de ver un comprobante que no existe. */}
        <Route
          path="/facturacion/comprobantes"
          element={
            <Protegido permiso={Permisos.Facturacion.Ver} modulo={Modulos.Facturacion}>
              <Comprobantes />
            </Protegido>
          }
        />
        <Route
          path="/facturacion/comprobantes/nuevo"
          element={
            <Protegido permiso={Permisos.Facturacion.Emitir} modulo={Modulos.Facturacion}>
              <NuevoComprobante />
            </Protegido>
          }
        />
        <Route
          path="/facturacion/comprobantes/:id/editar"
          element={
            <Protegido permiso={Permisos.Facturacion.Emitir} modulo={Modulos.Facturacion}>
              <NuevoComprobante />
            </Protegido>
          }
        />
        <Route
          path="/facturacion/comprobantes/:id/nota-credito"
          element={
            <Protegido permiso={Permisos.Facturacion.NotasCredito} modulo={Modulos.Facturacion}>
              <NotaCredito />
            </Protegido>
          }
        />
        {/* 24 oct: «Nueva nota» desde el menú (como en SOL): buscar el comprobante. */}
        <Route
          path="/facturacion/notas/nueva-credito"
          element={
            <Protegido permiso={Permisos.Facturacion.NotasCredito} modulo={Modulos.Facturacion}>
              <NuevaNota key="credito" tipo="credito" />
            </Protegido>
          }
        />
        <Route
          path="/facturacion/notas/nueva-debito"
          element={
            <Protegido permiso={Permisos.Facturacion.NotasCredito} modulo={Modulos.Facturacion}>
              <NuevaNota key="debito" tipo="debito" />
            </Protegido>
          }
        />
        {/* 22 oct: nota de débito, desde el comprobante original. */}
        <Route
          path="/facturacion/comprobantes/:id/nota-debito"
          element={
            <Protegido permiso={Permisos.Facturacion.NotasCredito} modulo={Modulos.Facturacion}>
              <NotaDebito />
            </Protegido>
          }
        />
        <Route
          path="/facturacion/comprobantes/:id"
          element={
            <Protegido permiso={Permisos.Facturacion.Ver} modulo={Modulos.Facturacion}>
              <VerComprobante />
            </Protegido>
          }
        />

        <Route
          path="/facturacion/clientes"
          element={
            <Protegido permiso={Permisos.Facturacion.Ver} modulo={Modulos.Facturacion}>
              <Clientes />
            </Protegido>
          }
        />
        <Route
          path="/facturacion/productos"
          element={
            <Protegido permiso={Permisos.Facturacion.Ver} modulo={Modulos.Facturacion}>
              <Productos />
            </Protegido>
          }
        />
        {/* 22 oct: importar productos desde Excel. */}
        <Route
          path="/facturacion/productos/importar"
          element={
            <Protegido permiso={Permisos.Facturacion.ProductosGestionar} modulo={Modulos.Facturacion}>
              <ImportarProductos />
            </Protegido>
          }
        />

        {/* 050: guías de remisión (09 remitente, 31 transportista) y el transporte guardado. */}
        <Route path="/guias" element={<Protegido permiso={Permisos.Guias.Ver} modulo={Modulos.Facturacion}><Guias /></Protegido>} />
        <Route path="/guias/nueva" element={<Protegido permiso={Permisos.Guias.Emitir} modulo={Modulos.Facturacion}><NuevaGuia key="09" tipo="09" /></Protegido>} />
        <Route path="/guias/transportista" element={<Protegido permiso={Permisos.Guias.Emitir} modulo={Modulos.Facturacion}><NuevaGuia key="31" tipo="31" /></Protegido>} />
        <Route path="/guias/transporte" element={<Protegido permiso={Permisos.Guias.Ver} modulo={Modulos.Facturacion}><TransporteGuardado /></Protegido>} />
        <Route path="/guias/configuracion" element={<Protegido permiso={Permisos.Guias.Ver} modulo={Modulos.Facturacion}><ConfiguracionGuias /></Protegido>} />
        <Route path="/guias/:id" element={<Protegido permiso={Permisos.Guias.Ver} modulo={Modulos.Facturacion}><VerGuia /></Protegido>} />

        {/* 044: sucursales (locales del mismo RUC), sus series y sus usuarios. */}
        <Route
          path="/facturacion/sucursales"
          element={
            <Protegido permiso={Permisos.Facturacion.Ver} modulo={Modulos.Facturacion}>
              <Sucursales />
            </Protegido>
          }
        />

        {/* 032: REPORTES › Mi negocio. Un permiso por reporte. */}
        <Route path="/reportes" element={<InicioReportes />} />
        <Route path="/reportes/mi-dia" element={
          <Protegido permiso={Permisos.Reportes.MiDia} modulo={Modulos.Facturacion}><ReporteMiDiaPagina /></Protegido>} />
        <Route path="/reportes/ventas" element={
          <Protegido permiso={Permisos.Reportes.TableroVentas} modulo={Modulos.Facturacion}><ReporteVentasPagina /></Protegido>} />
        <Route path="/reportes/clientes" element={
          <Protegido permiso={Permisos.Reportes.VentasCliente} modulo={Modulos.Facturacion}><ReporteClientesPagina /></Protegido>} />
        <Route path="/reportes/productos" element={
          <Protegido permiso={Permisos.Reportes.VentasProducto} modulo={Modulos.Facturacion}><ReporteProductosPagina /></Protegido>} />
        <Route path="/reportes/vendedores" element={
          <Protegido permiso={Permisos.Reportes.VentasVendedor} modulo={Modulos.Facturacion}><ReporteVendedoresPagina /></Protegido>} />
        {/* e147 */}
        <Route path="/reportes/sucursales" element={
          <Protegido permiso={Permisos.Reportes.TableroVentas} modulo={Modulos.Facturacion}><ReporteSucursalesPagina /></Protegido>} />

        {/* 036: REPORTES de la cartera (quien tiene cartera; el back no le da nada a los demás). */}
        <Route path="/mi-cartera/reportes" element={<ReporteCarteraPagina />} />
        <Route path="/mi-cartera/certificados" element={<ReporteCertificadosPagina />} />

        {/* 036: REPORTES de la plataforma (super administrador). */}
        <Route path="/admin/reportes/plataforma" element={<Protegido soloSuperAdmin><ReportePlataformaPagina /></Protegido>} />
        <Route path="/admin/reportes/empresas" element={<Protegido soloSuperAdmin><ReporteEmpresasPagina /></Protegido>} />
        <Route path="/admin/reportes/rechazos" element={<Protegido soloSuperAdmin><ReporteRechazosPagina /></Protegido>} />
        <Route path="/admin/reportes/cuentas" element={<Protegido soloSuperAdmin><ReporteCuentasPagina /></Protegido>} />
        {/* e148 */}
        <Route path="/admin/reportes/activacion" element={<Protegido soloSuperAdmin><ReporteActivacionPagina /></Protegido>} />
        <Route path="/admin/reportes/riesgo" element={<Protegido soloSuperAdmin><ReporteRiesgoPagina /></Protegido>} />
        <Route path="/admin/reportes/consumo" element={<Protegido soloSuperAdmin><ReporteConsumoPagina /></Protegido>} />

        {/* 034: REPORTES › SUNAT y contabilidad */}
        <Route path="/reportes/igv" element={
          <Protegido permiso={Permisos.Reportes.ResumenIgv} modulo={Modulos.Facturacion}><ReporteIgvPagina /></Protegido>} />
        <Route path="/reportes/registro" element={
          <Protegido permiso={Permisos.Reportes.RegistroVentas} modulo={Modulos.Facturacion}><ReporteRegistroPagina /></Protegido>} />
        <Route path="/reportes/problemas" element={
          <Protegido permiso={Permisos.Reportes.ConProblema} modulo={Modulos.Facturacion}><ReporteProblemasPagina /></Protegido>} />
        <Route path="/reportes/anulados" element={
          <Protegido permiso={Permisos.Reportes.AnuladosNotas} modulo={Modulos.Facturacion}><ReporteAnuladosPagina /></Protegido>} />
        <Route path="/reportes/personas-notas" element={
          <Protegido permiso={Permisos.Reportes.AnuladosNotas} modulo={Modulos.Facturacion}><ReportePersonasNotasPagina /></Protegido>} />
        <Route path="/reportes/descarga" element={
          <Protegido permiso={Permisos.Reportes.DescargaMasiva} modulo={Modulos.Facturacion}><ReporteDescargaPagina /></Protegido>} />

        {/* Las pantallas de los módulos entran aquí a medida que existan. */}

        {/* Una ruta que no existe devuelve al inicio, en vez de dejar la
            página en blanco sin explicación. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}