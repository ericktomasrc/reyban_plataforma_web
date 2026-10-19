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
  },
} as const

export const Modulos = {
  Facturacion: 'facturacion',
} as const
