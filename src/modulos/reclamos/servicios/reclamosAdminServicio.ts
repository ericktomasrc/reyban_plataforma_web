import { api } from '../../../nucleo/api/cliente'

/** 078: una hoja del Libro de Reclamaciones, como la ve la plataforma. */
export interface HojaAdmin {
  id: string; hoja: string; fecha: string; tipo: 'reclamo' | 'queja'; bien: 'servicio' | 'producto'
  nombre: string; docTipo: string; docNumero: string; domicilio: string; telefono: string; correo: string
  apoderado: string | null; monto: number | null; descripcion: string; detalle: string; pedido: string
  vence: string; estado: 'pendiente' | 'respondido'; respuesta: string | null; respondidoEn: string | null
  diasQuedan: number | null
}

export const reclamosAdminServicio = {
  lista: () => api.obtener<HojaAdmin[]>('/api/admin/reclamos'),
  responder: (id: string, respuesta: string) => api.crear<{ mensaje: string }>(`/api/admin/reclamos/${id}/responder`, { respuesta }),
}