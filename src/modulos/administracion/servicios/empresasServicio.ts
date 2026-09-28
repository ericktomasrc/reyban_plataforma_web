import { api } from '../../../nucleo/api/cliente'
import type { AltaEmpresa, EmpresaCreada, EmpresaEnLista, ModuloDelCatalogo } from '../tipos'

// =============================================================================
// LA CAPA DE SERVICIO DEL MÓDULO DE ADMINISTRACIÓN
//
// Las rutas de la API viven aquí y en ningún otro sitio del módulo. Las vistas
// llaman a estos métodos y no saben qué URL hay detrás.
//
// TODO LO DE AQUÍ ES DEL SUPER ADMINISTRADOR. Cada endpoint lleva
// `SoloSuperAdmin` en el back: un administrador de empresa que llamara a esto
// recibiría 403 aunque el front le enseñara el botón.
// =============================================================================

export const empresasServicio = {
  /** GET /api/admin/empresas — incluye las suspendidas, que son las que se consultan. */
  listar: () =>
    api.obtener<EmpresaEnLista[]>('/api/admin/empresas'),

  /** GET /api/admin/modulos — el catálogo de lo que se puede activar. */
  modulos: () =>
    api.obtener<ModuloDelCatalogo[]>('/api/admin/modulos'),

  /**
   * POST /api/admin/empresas — empresa + módulos + administrador, todo junto.
   *
   * Va en una sola llamada porque una empresa sin administrador no sirve para
   * nada. El back lo hace dentro de una transacción: o sale entero, o no sale.
   */
  crear: (datos: AltaEmpresa) =>
    api.crear<EmpresaCreada>('/api/admin/empresas', datos),

  /** POST .../suspender — corta también las sesiones abiertas, al instante. */
  suspender: (id: string, motivo: string) =>
    api.crear<{ mensaje: string }>(`/api/admin/empresas/${id}/suspender`, { motivo }),

  /** POST .../reactivar */
  reactivar: (id: string) =>
    api.crear<{ mensaje: string }>(`/api/admin/empresas/${id}/reactivar`),

  /** PUT .../modulos/{codigo} — activa, o reactiva uno que ya estuvo. */
  activarModulo: (id: string, codigo: string) =>
    api.cambiar<{ mensaje: string }>(`/api/admin/empresas/${id}/modulos/${codigo}`),

  /** DELETE .../modulos/{codigo} — no borra la fila, la deja inactiva. */
  quitarModulo: (id: string, codigo: string) =>
    api.borrar<{ mensaje: string }>(`/api/admin/empresas/${id}/modulos/${codigo}`),

  /**
   * PUT .../invitacion — cuánto duran los enlaces de esta empresa.
   *
   * Los ya emitidos conservan su fecha: se calculó al crearlos. Cambiar el
   * plazo no alarga ni acorta lo que ya salió.
   */
  cambiarHorasInvitacion: (id: string, horas: number) =>
    api.cambiar<{ mensaje: string }>(`/api/admin/empresas/${id}/invitacion`, { horas }),
}
