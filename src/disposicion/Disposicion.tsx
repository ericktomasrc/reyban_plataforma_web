import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { EVENTO_FICHA_INCOMPLETA } from '../nucleo/api/cliente'
import { fecha } from '../nucleo/formato/fechas'
import { useMensaje } from '../nucleo/mensajes/ProveedorMensajes'
import { DialogoMiFicha } from '../modulos/perfil/componentes/DialogoMiFicha'
import { Boton } from '../componentes/Boton'
import { Dialogo } from '../componentes/Dialogo'
import { useInstalar } from '../nucleo/pwa/pwa'
import { BarraSuplantacion } from './BarraSuplantacion'
import { SelectorEmpresa } from './SelectorEmpresa'
import { SelectorSucursal } from './SelectorSucursal'
import { NOMBRE_NIVEL } from '../modulos/cartera/servicios/carteraServicio'
import { Permisos } from '../nucleo/autorizacion/permisos'
import { useSesion, useYo } from '../nucleo/sesion/SesionContexto'
import { useConexionSunat } from '../nucleo/sunat/conexionSunat'
import { REPORTES } from '../modulos/reportes/vistas/Reportes'
import { REPORTES_CARTERA, REPORTES_PLATAFORMA } from '../modulos/reportes/vistas/ReportesPlataforma'
import { MenuDesplegable } from './MenuDesplegable'

/**
 * El marco: la cabecera arriba, UN SOLO MENÚ a la izquierda y el contenido.
 *
 * Decisión del 12 de octubre (lienzo «Fase 3», pantalla 6): antes había tres
 * niveles de menú —la cabecera, la fila de la empresa y las pestañas dentro de
 * Facturación— y un usuario común se perdía. Ahora:
 *
 *   ARRIBA      el logo, el selector «Trabajando en» (cartera) y quién soy.
 *   IZQUIERDA   en secciones: «Mi estudio» (la cartera), la empresa abierta
 *               con su nombre y RUC (Inicio, Comprobantes, Clientes, Productos,
 *               Usuarios, Auditoría, Configuración) y «Plataforma» (super
 *               administrador).
 *   CONTENIDO   con una línea arriba que dice dónde estás: «EMPRESA › Página».
 *
 * EL MENÚ SALE DE /api/yo, calculado en la base con el cruce de módulo
 * contratado, rol y permiso. El front no decide qué mostrar: lo pinta. Y es
 * comodidad, no seguridad: si alguien escribe la URL a mano, el back devuelve
 * 403 igual.
 *
 * En el teléfono el menú se esconde detrás de ☰ y se cierra al elegir.
 */
export function Disposicion() {
  const { salir, puede } = useSesion()
  const { usuario, empresa, cuenta, menu, roles, alcance, ficha } = useYo()
  const ruta = useLocation()
  const navegar = useNavigate()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const mensaje = useMensaje()

  // 048: EL MENÚ DEL NOMBRE (Mi cuenta · Seguridad · Salir).
  const [menuNombre, setMenuNombre] = useState(false)
  // e171: «Instalar la app» y, en iPhone, los pasos.
  const instalarApp = useInstalar()
  const [pasosIos, setPasosIos] = useState(false)
  const nombreRef = useRef<HTMLDivElement>(null)
  useEffect(() => { setMenuNombre(false) }, [ruta.pathname, ruta.search])
  useEffect(() => {
    if (!menuNombre) return
    const fuera = (e: MouseEvent) => { if (!nombreRef.current?.contains(e.target as Node)) setMenuNombre(false) }
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuNombre(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla) }
  }, [menuNombre])

  // 048: «COMPLETA TUS DATOS». Desde la franja, o solo cuando la API dice
  // «ficha_incompleta» al emitir, anular, hacer una nota o agregar empresa.
  const [pidiendoFicha, setPidiendoFicha] = useState(false)
  useEffect(() => {
    const abrir = () => setPidiendoFicha(true)
    window.addEventListener(EVENTO_FICHA_INCOMPLETA, abrir)
    return () => window.removeEventListener(EVENTO_FICHA_INCOMPLETA, abrir)
  }, [])
  // 030: modo prueba / real. La franja la ven todos; nadie la cambia desde aquí.
  const conexion = useConexionSunat()

  // Al cambiar de pantalla, el menú del teléfono se cierra solo.
  useEffect(() => { setMenuAbierto(false) }, [ruta.pathname])

  const activo = ({ isActive }: { isActive: boolean }) => isActive ? 'activo' : undefined

  // LA CARTERA (fase 3): la gente de una Cuenta Profesional.
  const cartera = !usuario.esSuperAdmin && cuenta?.tipo === 'profesional' && !!cuenta.nivel

  // Configuración de la empresa (el asistente): quien la puede configurar,
  // sea de registro o dada de alta por el super administrador (17 oct).
  const configura = !usuario.esSuperAdmin && !!empresa
    && puede('facturacion.credenciales_gestionar')

  const facturacion = menu.some(m => m.codigo === 'facturacion')

  // 032: REPORTES. Sale si puede ver al menos uno; sus submenús, al entrar.
  // e147: «Ventas por sucursal», solo con más de un local.
  const reportes = REPORTES.filter(r => puede(r.permiso) && (!r.conSucursales || (alcance?.total ?? 0) > 1))
  // 036: «Reportes» lo abre y lo cierra MenuDesplegable.
  // 053: el inventario se contrata aparte y tiene su propio menú desplegable.
  const inventario = menu.some(m => m.codigo === 'inventario')
  // e173: el punto de venta, también con su propio menú.
  const pos = menu.some(m => m.codigo === 'pos')
  const otrosModulos = menu.filter(m => m.codigo !== 'facturacion' && m.codigo !== 'inventario' && m.codigo !== 'pos')

  const pagina = nombreDePagina(ruta.pathname)
  const deEmpresa = !!empresa && !['/empresas', '/colaboradores', '/colaboradores/cargos', '/perfil'].includes(ruta.pathname)
    && !ruta.pathname.startsWith('/admin')

  return (
    <div className={'marco' + (menuAbierto ? ' menu-abierto' : '')}>
      {/* ANTES DE LA CABECERA Y FUERA DE ELLA, empujando la página hacia abajo.
          Una barra que flota encima se lee como un aviso que se va a ir solo, y
          esto no se va hasta que se pulsa. */}
      <BarraSuplantacion />

      {/* 030: MODO PRUEBA / REAL. En producción (fija) no hay franja. */}
      {conexion && !conexion.fija && (
        conexion.modo === 'real'
          ? <div className="franja-sunat real" role="status">● QA · SUNAT REAL — solo emiten las empresas marcadas. Lo emitido vale ante SUNAT.</div>
          : <div className="franja-sunat beta" role="status">⚠ MODO PRUEBA · SUNAT beta — los comprobantes no tienen valor ante SUNAT.</div>
      )}

      <header className="cabecera">
        <button type="button" className="boton-menu" aria-label="Abrir el menú"
                aria-expanded={menuAbierto} onClick={() => setMenuAbierto(a => !a)}>☰</button>

        <span className="logo">Reyban · Facturación</span>

        {cartera && <SelectorEmpresa />}

        {/* 046: la sucursal elegida (si la empresa tiene más de una). */}
        {empresa && <SelectorSucursal />}

        <span className="hueco" />

        {/* EL NOMBRE ES EL ENLACE A «MI CUENTA», que es donde la gente lo
            busca: en toda aplicación con cabecera, pulsar tu propio nombre
            lleva a tus datos. */}
        <div className="quien-envoltura" ref={nombreRef}>
        <button type="button" className="quien" aria-haspopup="menu" aria-expanded={menuNombre}
                onClick={() => setMenuNombre(a => !a)}>
          <div className="nombre">
            {usuario.nombre}

            {/* La cuenta de quien se registró (016) va siempre; al lado, en la
                cartera su nivel (Dueño, Colaborador…), fuera de ella su rol. */}
            {!usuario.esSuperAdmin && cuenta?.titularNombre && (
              <span className="rol cuenta">
                {cuenta.tipo === 'profesional' ? 'Cuenta Profesional' : 'Cuenta Negocio'}
              </span>
            )}
            {cartera && cuenta?.nivel && <span className="rol">{NOMBRE_NIVEL[cuenta.nivel]}</span>}
            {!cartera && (usuario.esSuperAdmin || roles.length > 0 || !cuenta?.titularNombre) && (
              <span className="rol">
                {usuario.esSuperAdmin ? 'Super administrador' : roles.length > 0 ? roles.join(' · ') : 'Sin rol'}
              </span>
            )}
          </div>

          <div className="empresa">
            {!cartera && empresa
              ? <>{empresa.nombre} · </>
              : usuario.esSuperAdmin ? <>Administración de la plataforma · </> : null}
            <span className="alias">@{usuario.alias}</span>
            <span className="flecha-quien" aria-hidden="true"> ▾</span>
          </div>
        </button>
        {menuNombre && (
          <div className="menu-quien" role="menu">
            <Link to="/perfil" role="menuitem">Mi cuenta</Link>
            <Link to="/perfil?pestana=seguridad" role="menuitem">Seguridad</Link>
            {/* e171: la app instalable. Solo si el navegador lo permite (o en iPhone, con los pasos). */}
            {(instalarApp.puede || instalarApp.soloPasos) && (
              <button type="button" role="menuitem" onClick={() => {
                setMenuNombre(false)
                if (instalarApp.puede) void instalarApp.instalar().then(ok => { if (ok) mensaje.bien('Listo: Reyban quedó instalada. Ábrela desde su ícono.') })
                else setPasosIos(true)
              }}>Instalar la app</button>
            )}
            <hr />
            <button type="button" role="menuitem" onClick={() => {
              // e163: se vuelve al inicio ANTES de salir, para que quien entre
              // después no aparezca en la última pantalla del anterior.
              navegar('/', { replace: true })
              void salir()
            }}>Salir</button>
          </div>
        )}
        </div>
      </header>

      {/* 048: LA FICHA. Mientras corre el plazo, un aviso; vencido, lo que pide. */}
      {ficha?.incompleta && (
        <div className={'franja-ficha' + (ficha.exigida ? ' exigida' : '')} role="status">
          <span>
            {ficha.exigida
              ? 'Completa tus datos para emitir, anular o hacer notas. Mientras tanto puedes mirar todo.'
              : ficha.plazo
                ? <>Completa tus datos antes del <strong>{fecha(ficha.plazo)}</strong>: después no podrás emitir ni anular sin ellos.</>
                : 'Completa tus datos: documento, nombres y apellidos.'}
          </span>
          <Boton estilo="secundario" onClick={() => setPidiendoFicha(true)}>Completar ahora</Boton>
        </div>
      )}
      {pidiendoFicha && (
        <DialogoMiFicha
          ficha={ficha}
          onCerrar={() => setPidiendoFicha(false)}
          onGuardado={m => { setPidiendoFicha(false); mensaje.bien(m + ' Ya puedes seguir.') }}
        />
      )}

      {/* e171: en iPhone y iPad no hay botón de instalar: se agrega desde Safari. */}
      <Dialogo titulo="Instalar Reyban en tu iPhone" abierto={pasosIos} onCerrar={() => setPasosIos(false)}
               acciones={<Boton onClick={() => setPasosIos(false)}>Entendido</Boton>}>
        <ol className="pasos-instalar">
          <li>Abre esta página en <strong>Safari</strong>.</li>
          <li>Toca <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba).</li>
          <li>Elige <strong>«Agregar a inicio»</strong> y luego <strong>Agregar</strong>.</li>
        </ol>
        <p className="nota">Queda el ícono de Reyban en tu pantalla de inicio y se abre a pantalla completa, como una app.
          Para emitir sigue haciendo falta internet.</p>
      </Dialogo>

      <div className="cuerpo">
        <aside className="lateral" aria-label="Menú">
          {/* MI ESTUDIO: lo de la cuenta, por encima de las empresas. */}
          {cartera && (
            <nav className="seccion-lateral">
              <span className="titulo-seccion">Mi estudio</span>
              <NavLink to="/empresas" className={activo}><Icono>▦</Icono>Mis empresas</NavLink>
              {/* 047: Mi equipo se despliega: el equipo y los cargos del estudio. */}
              {cuenta?.nivel !== 'colaborador' && (
                <MenuDesplegable icono="◎" titulo="Mi equipo" inicio="/colaboradores" prefijos={['/colaboradores']}
                  grupos={[{ titulo: '', items: [
                    { ruta: '/colaboradores', nombre: 'Mi equipo' },
                    { ruta: '/colaboradores/cargos', nombre: 'Cargos del estudio' },
                  ] }]} />
              )}
              {/* 036: los reportes de toda la cartera. */}
              <MenuDesplegable icono="▥" titulo="Reportes de la cartera" inicio="/mi-cartera/reportes"
                               prefijos={['/mi-cartera']} grupos={[{ titulo: 'Mi cartera', items: REPORTES_CARTERA }]} />
            </nav>
          )}

          {/* LA EMPRESA ABIERTA, con su nombre y RUC a la vista: así nunca hay
              duda de en cuál se está emitiendo. */}
          {empresa && (
            <nav className="seccion-lateral">
              <div className="empresa-lateral">
                <span className="titulo-seccion">{cartera ? 'Empresa abierta' : 'Mi empresa'}</span>
                <strong>{empresa.nombre}</strong>
                {empresa.ruc && <span className="mono">RUC {empresa.ruc}</span>}
              </div>

              <NavLink to="/" end className={activo}><Icono>⌂</Icono>Inicio</NavLink>

              {/* Facturación son tres pantallas: van sueltas en el menú, sin
                  pestañas dentro. */}
              {facturacion && (
                <>
                  {/* 24 oct: «Comprobantes» se despliega, con las notas sueltas como en SOL. */}
                  {puede(Permisos.Facturacion.NotasCredito) ? (
                    <MenuDesplegable icono="▤" titulo="Comprobantes" inicio="/facturacion/comprobantes"
                      prefijos={['/facturacion/comprobantes', '/facturacion/notas']}
                      grupos={[{ titulo: '', items: [
                        { ruta: '/facturacion/comprobantes', nombre: 'Comprobantes emitidos' },
                        { ruta: '/facturacion/notas/nueva-credito', nombre: 'Nueva nota de crédito' },
                        { ruta: '/facturacion/notas/nueva-debito', nombre: 'Nueva nota de débito' },
                      ] }]} />
                  ) : (
                    <NavLink to="/facturacion/comprobantes" className={activo}><Icono>▤</Icono>Comprobantes</NavLink>
                  )}
                  <NavLink to="/facturacion/clientes" className={activo}><Icono>☺</Icono>Clientes</NavLink>
                  <NavLink to="/facturacion/productos" className={activo}><Icono>◫</Icono>Productos</NavLink>
                  {/* 044: los locales del mismo RUC. */}
                  {puede(Permisos.Facturacion.SucursalesGestionar) && (
                    <NavLink to="/facturacion/sucursales" className={activo}><Icono>⌖</Icono>Sucursales</NavLink>
                  )}
                </>
              )}

              {/* 050: guías de remisión, con su transporte guardado y su configuración. */}
              {facturacion && puede(Permisos.Guias.Ver) && (
                <MenuDesplegable icono="⛟" titulo="Guías de remisión" inicio="/guias" prefijos={['/guias']}
                  grupos={[{ titulo: '', items: [
                    { ruta: '/guias', nombre: 'Guías emitidas' },
                    { ruta: '/guias/transporte', nombre: 'Transporte guardado' },
                    { ruta: '/guias/configuracion', nombre: 'Configuración de guías' },
                  ] }]} />
              )}

              {/* e173: punto de venta (a pantalla completa) y las cajas. */}
              {facturacion && pos && puede(Permisos.Pos.Vender) && (
                <MenuDesplegable icono="▣" titulo="Punto de venta" inicio="/pos" prefijos={['/pos']}
                  grupos={[{ titulo: '', items: [
                    { ruta: '/pos', nombre: 'Vender', exacto: true },
                    { ruta: '/pos/cajas', nombre: puede(Permisos.Pos.CajasVer) ? 'Cajas y arqueos' : 'Mis cajas' },
                  ] }]} />
              )}

              {/* 052: inventario por sucursal. 053: solo si la empresa lo contrató. */}
              {facturacion && inventario && puede(Permisos.Inventario.Ver) && (
                <MenuDesplegable icono="▦" titulo="Inventario" inicio="/inventario" prefijos={['/inventario']}
                  grupos={[{ titulo: '', items: [
                    { ruta: '/inventario', nombre: 'Stock', exacto: true },
                    { ruta: '/inventario/ingresos', nombre: 'Ingresos por compra' },
                    { ruta: '/inventario/traslados', nombre: 'Traslados' },
                    { ruta: '/inventario/ajustes', nombre: 'Ajustes y conteos' },
                    { ruta: '/inventario/proveedores', nombre: 'Proveedores y categorías' },
                    { ruta: '/inventario/configuracion', nombre: 'Configuración' },
                  ] }]} />
              )}

              {/* 036: Reportes se abre y se cierra (la flecha). */}
              {facturacion && reportes.length > 0 && (
                <MenuDesplegable icono="▥" titulo="Reportes" inicio="/reportes" prefijos={['/reportes']}
                  grupos={[...new Set(reportes.map(r => r.grupo))].map(g => ({
                    titulo: g, items: reportes.filter(r => r.grupo === g),
                  }))} />
              )}

              {otrosModulos.map(m => (
                <NavLink key={m.codigo} to={m.ruta} className={activo}><Icono>•</Icono>{m.nombre}</NavLink>
              ))}

              {/* 047: Personal se despliega: la gente, los roles y los cargos. */}
              {puede(Permisos.Usuarios.Ver) && (
                <MenuDesplegable icono="◍" titulo="Personal" inicio="/usuarios" prefijos={['/usuarios']}
                  grupos={[{ titulo: '', items: [
                    { ruta: '/usuarios', nombre: 'Personal de la empresa' },
                    ...(puede(Permisos.Usuarios.RolesGestionar) ? [{ ruta: '/usuarios/roles', nombre: 'Roles y permisos' }] : []),
                    { ruta: '/usuarios/cargos', nombre: 'Cargos' },
                  ] }]} />
              )}
              {puede(Permisos.Usuarios.BitacoraVer) && (
                <NavLink to="/auditoria" className={activo}><Icono>◷</Icono>Auditoría</NavLink>
              )}
              {configura && (
                <NavLink to="/configurar" className={activo}><Icono>⚙</Icono>Configuración</NavLink>
              )}
            </nav>
          )}

          {/* EL SUPER ADMINISTRADOR vive fuera de las empresas. */}
          {usuario.esSuperAdmin && (
            <nav className="seccion-lateral">
              <span className="titulo-seccion">Plataforma</span>
              <NavLink to="/" end className={activo}><Icono>⌂</Icono>Inicio</NavLink>
              <NavLink to="/admin/empresas" className={activo}><Icono>▦</Icono>Empresas</NavLink>
              <NavLink to="/admin/cuentas" className={activo}><Icono>◎</Icono>Cuentas</NavLink>
              <NavLink to="/admin/traspasos" className={activo}><Icono>⇄</Icono>Solicitudes de traspaso</NavLink>
              {/* 036: reportes de la plataforma. */}
              <MenuDesplegable icono="▥" titulo="Reportes" inicio="/admin/reportes/plataforma"
                               prefijos={['/admin/reportes']} grupos={[{ titulo: 'Plataforma', items: REPORTES_PLATAFORMA }]} />
              {/* Solo en QA: en producción (PLATAFORMA_SUNAT=real) no hay nada que cambiar. */}
              {conexion && !conexion.fija && (
                <NavLink to="/admin/conexion-sunat" className={activo}><Icono>⇆</Icono>Conexión con SUNAT</NavLink>
              )}
              {/* 038: los correos de acceso que no salieron. */}
              <NavLink to="/admin/correos" className={activo}><Icono>✉</Icono>Correos</NavLink>
              {/* 039: recuperaciones del segundo factor en curso. */}
              <NavLink to="/admin/recuperaciones" className={activo}><Icono>⚿</Icono>Recuperaciones</NavLink>
              {/* 042: de dónde salen RUC, DNI y tipo de cambio; padrón de SUNAT. */}
              <NavLink to="/admin/consultas-sunat" className={activo}><Icono>⌕</Icono>Consultas SUNAT</NavLink>
              {puede(Permisos.Usuarios.BitacoraVer) && (
                <NavLink to="/auditoria" className={activo}><Icono>◷</Icono>Auditoría</NavLink>
              )}
            </nav>
          )}

          {/* Recién registrado, sin empresa y sin cartera: solo su inicio. */}
          {!usuario.esSuperAdmin && !empresa && !cartera && (
            <nav className="seccion-lateral">
              <NavLink to="/" end className={activo}><Icono>⌂</Icono>Inicio</NavLink>
            </nav>
          )}
        </aside>

        {/* Un clic fuera del menú (teléfono) lo cierra. */}
        <div className="velo-lateral" onClick={() => setMenuAbierto(false)} aria-hidden="true" />

        <main className="contenido">
          {pagina && (
            <div className="migas">
              {deEmpresa && <><span>{empresa!.nombre}</span><span aria-hidden="true"> › </span></>}
              <span>{pagina}</span>
            </div>
          )}
          {/* 046: al cambiar de sucursal arriba, la pantalla se vuelve a cargar. */}
          <Outlet key={alcance?.vista ?? 'todas'} />
        </main>
      </div>
    </div>
  )
}

function Icono({ children }: { children: string }) {
  return <span className="icono-lateral" aria-hidden="true">{children}</span>
}

/** «Dónde estás», para la línea de arriba del contenido. */
function nombreDePagina(ruta: string): string | null {
  if (ruta === '/') return 'Inicio'
  if (ruta.startsWith('/facturacion/comprobantes/nuevo')) return 'Nuevo comprobante'
  if (ruta.startsWith('/facturacion/comprobantes/')) return 'Comprobante'
  if (ruta.startsWith('/facturacion/comprobantes')) return 'Comprobantes'
  if (ruta.startsWith('/facturacion/notas/nueva-credito')) return 'Nueva nota de crédito'
  if (ruta.startsWith('/facturacion/notas/nueva-debito')) return 'Nueva nota de débito'
  if (ruta.startsWith('/facturacion/clientes')) return 'Clientes'
  if (ruta.startsWith('/facturacion/productos')) return 'Productos'
  if (ruta.startsWith('/facturacion/sucursales')) return 'Sucursales'
  if (ruta.startsWith('/guias/nueva')) return 'Nueva guía'
  if (ruta.startsWith('/guias/transportista')) return 'Guía del transportista'
  if (ruta.startsWith('/guias/transporte')) return 'Transporte guardado'
  if (ruta.startsWith('/guias/configuracion')) return 'Configuración de guías'
  if (ruta.startsWith('/guias')) return 'Guías de remisión'
  if (ruta.startsWith('/inventario/kardex')) return 'Kardex'
  if (ruta.startsWith('/inventario/ingresos/nuevo')) return 'Ingreso por compra'
  if (ruta.startsWith('/inventario/ingresos')) return 'Ingresos por compra'
  if (ruta.startsWith('/inventario/operaciones')) return 'Inventario'
  if (ruta.startsWith('/inventario/ajustes')) return 'Ajustes y conteos'
  if (ruta.startsWith('/inventario/traslados')) return 'Traslados'
  if (ruta.startsWith('/inventario/proveedores')) return 'Proveedores y categorías'
  if (ruta.startsWith('/inventario/configuracion')) return 'Configuración del inventario'
  if (ruta.startsWith('/inventario')) return 'Stock'
  if (ruta.startsWith('/reportes')) return 'Reportes'
  if (ruta.startsWith('/mi-cartera')) return 'Reportes de la cartera'
  if (ruta.startsWith('/admin/reportes')) return 'Reportes de la plataforma'
  if (ruta.startsWith('/usuarios/roles')) return 'Roles y permisos'
  if (ruta.startsWith('/usuarios/cargos')) return 'Cargos'
  if (ruta.startsWith('/colaboradores/cargos')) return 'Cargos del estudio'
  if (ruta.startsWith('/usuarios')) return 'Personal de la empresa'
  if (ruta.startsWith('/auditoria')) return 'Auditoría'
  if (ruta.startsWith('/configurar')) return 'Configuración'
  if (ruta.startsWith('/empresas')) return 'Mis empresas'
  if (ruta.startsWith('/colaboradores')) return 'Mi equipo'
  if (ruta.startsWith('/perfil')) return 'Mi cuenta'
  if (ruta.startsWith('/admin/empresas')) return 'Empresas'
  if (ruta.startsWith('/admin/cuentas')) return 'Cuentas'
  if (ruta.startsWith('/admin/traspasos')) return 'Solicitudes de traspaso'
  if (ruta.startsWith('/admin/conexion-sunat')) return 'Conexión con SUNAT'
  if (ruta.startsWith('/admin/correos')) return 'Correos'
  if (ruta.startsWith('/admin/recuperaciones')) return 'Recuperaciones'
  if (ruta.startsWith('/admin/consultas-sunat')) return 'Consultas SUNAT'
  return null
}