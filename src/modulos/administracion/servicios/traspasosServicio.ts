import { api } from '../../../nucleo/api/cliente'

// =============================================================================
// SOLICITUDES DE TRASPASO (fase 4b, migración 022). Solo el super administrador.
// =============================================================================

export type EstadoSolicitud = 'por_revisar' | 'aprobada' | 'rechazada'

export interface DocumentoSolicitud {
  id: string
  tipo: 'ficha_ruc' | 'dni' | 'vigencia_poder' | 'certificado' | 'respuesta'
  nombre: string
  tamano: number
}

/** GET /api/admin/traspasos */
export interface SolicitudTraspaso {
  id: string
  numero: number
  estado: EstadoSolicitud
  empresaId: string
  empresa: string
  ruc: string
  nombre: string
  dni: string
  relacion: 'titular' | 'representante' | 'apoderado'
  correoNuevo: string
  telefono: string | null
  explicacion: string
  cuentaAnterior: string | null
  pausada: boolean
  plazoHasta: string
  creadoEn: string
  motivoRechazo: string | null
  revisadaEn: string | null
  documentos: DocumentoSolicitud[]

  /** La respuesta de la cuenta que tiene la empresa (fase 4d, 024). */
  respuesta: 'de_acuerdo' | 'se_opone' | null
  respuestaTexto: string | null
  respuestaEn: string | null
  respuestaQuien: string | null
}

export const NOMBRE_RELACION: Record<SolicitudTraspaso['relacion'], string> = {
  titular: 'Titular (persona natural con negocio)',
  representante: 'Gerente general / representante legal',
  apoderado: 'Apoderado',
}

export const NOMBRE_DOCUMENTO: Record<DocumentoSolicitud['tipo'], string> = {
  ficha_ruc: 'Ficha RUC',
  dni: 'DNI',
  vigencia_poder: 'Vigencia de poder',
  certificado: 'Certificado digital',
  respuesta: 'Documento de la cuenta',
}

export const traspasosServicio = {
  lista: () => api.obtener<SolicitudTraspaso[]>('/api/admin/traspasos'),

  /** Baja el documento con su nombre original. Un error sale en ventana, no en una pestaña rota. */
  descargarDocumento: (id: string) => api.descargar(`/api/admin/traspasos/documentos/${id}`),

  aprobar: (id: string) =>
    api.crear<{ mensaje: string; enlaceDePrueba: string | null }>(`/api/admin/traspasos/${id}/aprobar`),

  rechazar: (id: string, motivo: string) =>
    api.crear<{ mensaje: string }>(`/api/admin/traspasos/${id}/rechazar`, { motivo }),

  /** El reclamo (sin sesión), con sus archivos. */
  reclamar: (formulario: FormData) =>
    api.subir<{ numero: number; mensaje: string }>('/api/traspasos', formulario),
}