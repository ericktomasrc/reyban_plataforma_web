import { api } from '../../../nucleo/api/cliente'
import type {
  Cambio, CambioDetalle, Evento, FiltroCambios, FiltroEventos, Pagina,
} from '../tipos'

// =============================================================================
// LA CAPA DE SERVICIO DEL MÓDULO DE AUDITORÍA
//
// TODO ES DE SOLO LECTURA. No hay ningún método que escriba: la bitácora la
// escribe un disparador de la base, y otro impide tocarla después.
//
// NINGUNA LLAMADA MANDA UN IDENTIFICADOR DE EMPRESA. El aislamiento lo hace la
// política de la base: la misma llamada devuelve lo de su empresa a un
// administrador de cliente, y todo al super administrador.
// =============================================================================

/** Arma la cadena `?a=1&b=2` saltándose lo que venga vacío. */
function consulta(filtros: Record<string, unknown>): string {
  const partes = Object.entries(filtros)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)

  return partes.length > 0 ? `?${partes.join('&')}` : ''
}

export const auditoriaServicio = {
  /** GET /api/auditoria/cambios — qué cambió, paginado. */
  cambios: (f: FiltroCambios) =>
    api.obtener<Pagina<Cambio>>(`/api/auditoria/cambios${consulta({ ...f })}`),

  /** GET /api/auditoria/cambios/{id} — el antes y el después de uno. */
  detalle: (id: number) =>
    api.obtener<CambioDetalle>(`/api/auditoria/cambios/${id}`),

  /**
   * GET /api/auditoria/cambios/{tabla}/{filaId} — todo lo que le pasó a una
   * fila. Es la pregunta que se hace de verdad cuando algo no cuadra.
   */
  historialDeFila: (tabla: string, filaId: string) =>
    api.obtener<Cambio[]>(
      `/api/auditoria/cambios/${encodeURIComponent(tabla)}/${encodeURIComponent(filaId)}`),

  /** GET /api/auditoria/tablas — para llenar el desplegable del filtro. */
  tablas: () =>
    api.obtener<string[]>('/api/auditoria/tablas'),

  /** GET /api/auditoria/eventos — lo que no cambió ninguna fila. */
  eventos: (f: FiltroEventos) =>
    api.obtener<Pagina<Evento>>(`/api/auditoria/eventos${consulta({ ...f })}`),
}
