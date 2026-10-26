// =============================================================================
// LOS CÓDIGOS DE PERMISO
//
// Copia exacta de `Plataforma.Core/Dominio/Permisos.cs`. Si se añade uno allí,
// se añade aquí.
//
// POR QUÉ CONSTANTES Y NO CADENAS SUELTAS: un `'facturacion.emitr'` mal
// escrito no falla en ningún sitio. Simplemente no coincide con ninguno, y el
// botón desaparece sin que nadie sepa por qué — o peor, según cómo esté
// escrita la comprobación, aparece cuando no debía.
//
// AQUÍ ESTO ES COMODIDAD, NO SEGURIDAD. Sirve para no enseñar botones que
// darían error. La comprobación de verdad está en cada endpoint del back, y si
// alguien escribe la URL a mano recibe un 403 igual.
// =============================================================================

export const Permisos = {
  Plataforma: {
    EmpresasGestionar: 'plataforma.empresas_gestionar',
    ModulosGestionar:  'plataforma.modulos_gestionar',
    BitacoraVer:       'plataforma.bitacora_ver',
    Suplantar:         'plataforma.suplantar',
    // 042: modo de consultas y padrón de SUNAT.
    ConsultasGestionar: 'plataforma.consultas_gestionar',
    // 067: el equipo de la plataforma con permisos parciales.
    CuentasGestionar:      'plataforma.cuentas_gestionar',
    CredencialesGestionar: 'plataforma.credenciales_gestionar',
    ReportesVer:           'plataforma.reportes_ver',
    AccesosGestionar:      'plataforma.accesos_gestionar',
    EquipoGestionar:       'plataforma.equipo_gestionar',
  },

  Usuarios: {
    Ver:             'usuarios.ver',
    Crear:           'usuarios.crear',
    Editar:          'usuarios.editar',
    Desactivar:      'usuarios.desactivar',
    RolesGestionar:  'usuarios.roles_gestionar',
    SesionesRevocar: 'usuarios.sesiones_revocar',
    BitacoraVer:     'usuarios.bitacora_ver',
  },

  Facturacion: {
    Ver:                   'facturacion.ver',
    Emitir:                'facturacion.emitir',
    Anular:                'facturacion.anular',
    NotasCredito:          'facturacion.notas_credito',   // 031
    Descargar:             'facturacion.descargar',
    ClientesGestionar:     'facturacion.clientes_gestionar',
    ProductosGestionar:    'facturacion.productos_gestionar',
    CredencialesGestionar: 'facturacion.credenciales_gestionar',
    SucursalesGestionar:   'facturacion.sucursales_gestionar',   // 044
  },

  // 050: guías de remisión.
  Guias: {
    Ver:        'guias.ver',
    Emitir:     'guias.emitir',
    Anular:     'guias.anular',
    Transporte: 'guias.transporte',
  },

  // e178 (059): compras y gastos.
  Compras: {
    Ver:       'compras.ver',
    Registrar: 'compras.registrar',
  },

  // 052: inventario por sucursal.
  Inventario: {
    Ver:        'inventario.ver',
    Ingresar:   'inventario.ingresar',
    Ajustar:    'inventario.ajustar',
    Trasladar:  'inventario.trasladar',
    Contar:     'inventario.contar',
    Configurar: 'inventario.configurar',
  },

  // e173 (055): punto de venta y caja.
  Pos: {
    Vender:      'pos.vender',
    Movimientos: 'pos.movimientos',
    Descuentos:  'pos.descuentos',
    CajasVer:    'pos.cajas_ver',
  },

  // 032: un permiso por reporte.
  Reportes: {
    MiDia:          'reportes.mi_dia',
    TableroVentas:  'reportes.tablero_ventas',
    VentasCliente:  'reportes.ventas_cliente',
    VentasProducto: 'reportes.ventas_producto',
    VentasVendedor: 'reportes.ventas_vendedor',
    // 034: SUNAT y contabilidad
    ResumenIgv:     'reportes.resumen_igv',
    RegistroVentas: 'reportes.registro_ventas',
    ConProblema:    'reportes.con_problema',
    AnuladosNotas:  'reportes.anulados_notas',
    DescargaMasiva: 'reportes.descarga_masiva',
    // e179 (060): valorizado, margen y estado de resultados.
    Ganancias:      'reportes.ganancias',
  },
} as const

export const Modulos = {
  Facturacion: 'facturacion',
  /** 053: se contrata aparte; sin él no sale nada de inventario. */
  Inventario: 'inventario',
  /** e173 (055): el punto de venta, también aparte. */
  Pos: 'pos',
} as const
