import { api } from '../../../nucleo/api/cliente'

// =============================================================================
// FASE 4d (migración 024)
//
//   · CAMINO B: una cuenta pide al titular llevar una empresa que ya está en
//     Reyban. El titular aprueba en una página sin sesión (/pedido/:token).
//   · «TRASPASO EN REVISIÓN»: la cuenta que tiene una empresa reclamada con
//     documentos (camino C) lo ve y responde una vez.
//
// Quién puede qué lo decide la base: aquí solo se llama.
// =============================================================================

export type ResultadoRevision =
  | 'libre' | 'ok' | 'ya_es_tuya' | 'ya_pediste' | 'ya_pedida' | 'reclamo_abierto'
  | 'sin_correo' | 'sin_permiso' | 'convertir' | 'cuenta_no_activa' | 'tope'

/** GET /api/pedidos/revisar?ruc= */
export interface RevisionPedido {
  resultado: ResultadoRevision
  empresa: string | null
  /** El correo del titular, TAPADO (j•••@dominio). */
  correo: string | null
  mensaje: string | null
}

export type EstadoPedido = 'abierto' | 'rechazado' | 'cancelado' | 'vencido'

/** GET /api/pedidos — los de mi cuenta que no se aprobaron (esos ya están en la lista). */
export interface Pedido {
  id: string
  empresa: string
  ruc: string
  estado: EstadoPedido
  creadoEn: string
  expiraEn: string
  respondidoEn: string | null
}

/** GET /api/traspasos/mios — un reclamo abierto sobre una empresa que veo. */
export interface ReclamoSobreMia {
  id: string
  numero: number
  empresaId: string
  empresa: string
  ruc: string
  pide: string
  relacion: 'titular' | 'representante' | 'apoderado'
  plazoHasta: string
  respuesta: 'de_acuerdo' | 'se_opone' | null
  puedoResponder: boolean
}

/** GET /api/pedido/{token} — lo que ve el titular. */
export interface InfoPedido {
  estado: 'ok' | 'vencido' | 'usado' | 'cancelado' | 'no_existe'
  empresa: string | null
  ruc: string | null
  quien: string | null
  cuenta: string | null
  mensaje: string | null
  hoyLaTiene: string | null
  pausada: boolean
  comprobantes: number
  clientes: number
  series: string[] | null
  expiraEn: string | null
  /** Qué pasa con el titular si quiere seguir entrando. */
  titular: 'crear' | 'mover' | 'ya_entra' | 'otra_cuenta' | null
}

export const NOMBRE_RELACION_RECLAMO: Record<ReclamoSobreMia['relacion'], string> = {
  titular: 'titular',
  representante: 'gerente general / representante legal',
  apoderado: 'apoderado',
}

export const pedidosServicio = {
  revisar: (ruc: string) =>
    api.obtener<RevisionPedido>(`/api/pedidos/revisar?ruc=${encodeURIComponent(ruc)}`),

  pedir: (ruc: string, mensaje: string) =>
    api.crear<{ mensaje: string; enlaceDePrueba: string | null }>('/api/pedidos', { ruc, mensaje }),

  mios: () => api.obtener<Pedido[]>('/api/pedidos'),

  cancelar: (id: string) => api.crear<{ mensaje: string }>(`/api/pedidos/${id}/cancelar`),

  ocultar: (id: string) => api.crear<{ mensaje: string }>(`/api/pedidos/${id}/ocultar`),

  // --- El titular (sin sesión) ---------------------------------------------
  ver: (token: string) => api.obtener<InfoPedido>(`/api/pedido/${encodeURIComponent(token)}`),

  responder: (token: string, aprobar: boolean, seguir: boolean, nombre: string) =>
    api.crear<{ mensaje: string; invitacion: string | null }>(
      `/api/pedido/${encodeURIComponent(token)}/responder`, { aprobar, seguir, nombre }),

  // --- Camino C: la cuenta responde ------------------------------------------
  reclamos: () => api.obtener<ReclamoSobreMia[]>('/api/traspasos/mios'),

  responderReclamo: (id: string, formulario: FormData) =>
    api.subir<{ mensaje: string }>(`/api/traspasos/${id}/responder`, formulario),
}