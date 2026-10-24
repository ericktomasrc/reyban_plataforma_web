import { api } from '../../../nucleo/api/cliente'
import type { FichaParaEnviar } from '../../usuarios/componentes/CamposFicha'
import type { TipoAlcance } from '../../usuarios/tipos'

// =============================================================================
// LA CARTERA (fase 3, migración 018)
//
// Quién puede qué lo decide la base: aquí solo se llama y se pinta.
// =============================================================================

export type Nivel = 'dueno' | 'colaborador_admin' | 'colaborador'

/** GET /api/cartera/empresas — una fila de «Mis empresas». */
export interface EmpresaCartera {
  id: string
  nombre: string
  ruc: string | null
  razonSocial: string | null
  ambiente: 'beta' | 'produccion' | null
  abierta: boolean
  pausadaEn: string | null
  motivoPausa: string | null
  facturacionActiva: boolean
  listaParaEmitir: boolean | null
  certificadoHasta: string | null
  rechazos: number
  ultimoDocumento: string | null

  /** Los colaboradores que la ven (sin el dueño). */
  laVen: string[]

  /** El correo del dueño de la empresa (019). */
  correoTitular: string | null
}

/** GET /api/cartera/colaboradores */
export interface Colaborador {
  id: string
  nombre: string
  correo: string
  alias: string
  nivel: Nivel
  veTodas: boolean
  empresas: string[]
  activo: boolean

  /** Todavía no entró nunca (invitación sin usar). */
  pendiente: boolean
}

export interface DatosColaborador {
  correo: string
  nombre: string
  nivel: Nivel
  veTodas: boolean
  empresas: string[]
  /** 046: la ficha (con ella, el nombre sale de nombres y apellidos). */
  ficha?: FichaParaEnviar
  /** 047: el acceso de cada empresa, configurado antes de enviar. */
  accesos?: { empresaId: string; acceso: DatosAccesoEquipo }[]
}

// --- 046: MI EQUIPO ----------------------------------------------------------

/** Lo que tiene una persona del equipo en UNA empresa de la cartera. */
export interface AccesoEquipo {
  empresaId: string
  empresa: string
  rolId: string
  rol: string
  notas: boolean
  alcance: TipoAlcance
  defecto: string | null
  sucursales: string[]
}

/** GET /api/cartera/equipo — una persona del estudio con su ficha y sus accesos. */
export interface PersonaEquipo {
  id: string
  nombre: string
  correo: string
  alias: string | null
  nivel: Nivel
  veTodas: boolean
  activo: boolean
  pendiente: boolean
  /** 048: nunca entró y su enlace ya venció. */
  invitacionVencida?: boolean
  fichaIncompleta: boolean
  tipoDocumento: '1' | '4' | '7' | null
  numeroDocumento: string | null
  nombres: string | null
  apellidoPaterno: string | null
  apellidoMaterno: string | null
  celular: string | null
  fechaNacimiento: string | null
  direccion: string | null
  ubigeo: string | null
  cargo: string | null
  fechaIngreso: string | null
  accesos: AccesoEquipo[]
}

/** GET /api/cartera/equipo/empresas — para el diálogo de acceso. */
export interface EmpresaEquipo {
  id: string
  nombre: string
  sucursales: { id: string; codigo: string; nombre: string }[]
  roles: { id: string; nombre: string; descripcion: string | null; deSistema: boolean }[]
}

export interface DatosAccesoEquipo {
  rol: string
  alcance: TipoAlcance
  sucursales: string[]
  sucursalDefecto: string | null
  notas: boolean
}

export const carteraServicio = {
  empresas: () => api.obtener<EmpresaCartera[]>('/api/cartera/empresas'),

  abrir: (id: string) => api.crear<{ mensaje: string }>(`/api/cartera/empresas/${id}/abrir`),

  pausar: (id: string, motivo: string, ruc: string) =>
    api.crear<{ mensaje: string; avisado: boolean }>(`/api/cartera/empresas/${id}/pausar`, { motivo, ruc }),

  reanudar: (id: string) => api.crear<{ mensaje: string }>(`/api/cartera/empresas/${id}/reanudar`),

  colaboradores: () => api.obtener<Colaborador[]>('/api/cartera/colaboradores'),

  invitar: (d: DatosColaborador) =>
    api.crear<{ mensaje: string; enviado: boolean; enlaceDePrueba: string | null }>('/api/cartera/colaboradores', d),

  editar: (id: string, d: Omit<DatosColaborador, 'correo' | 'nombre'>) =>
    api.cambiar<{ mensaje: string }>(`/api/cartera/colaboradores/${id}`, d),

  quitar: (id: string) => api.borrar<{ mensaje: string }>(`/api/cartera/colaboradores/${id}`),

  convertir: () => api.crear<{ mensaje: string }>('/api/cartera/convertir'),

  // --- 046: Mi equipo ---------------------------------------------------------
  equipo: () => api.obtener<PersonaEquipo[]>('/api/cartera/equipo'),
  /** 048: un enlace nuevo de invitación (los anteriores dejan de valer). */
  reinvitar: (id: string) =>
    api.crear<{ mensaje: string; enviado: boolean; enlaceDePrueba: string | null }>(`/api/cartera/equipo/${id}/invitacion`),

  equipoEmpresas: () => api.obtener<EmpresaEquipo[]>('/api/cartera/equipo/empresas'),

  guardarFicha: (id: string, ficha: FichaParaEnviar) =>
    api.cambiar<{ mensaje: string }>(`/api/cartera/equipo/${id}/ficha`, ficha),

  guardarAcceso: (id: string, empresaId: string, d: DatosAccesoEquipo) =>
    api.cambiar<{ mensaje: string }>(`/api/cartera/equipo/${id}/accesos/${empresaId}`, d),

  quitarAcceso: (id: string, empresaId: string) =>
    api.borrar<{ mensaje: string }>(`/api/cartera/equipo/${id}/accesos/${empresaId}`),
}

export const NOMBRE_NIVEL: Record<Nivel, string> = {
  dueno: 'Dueño',
  colaborador_admin: 'Colaborador administrador',
  colaborador: 'Colaborador',
}

/** El estado de una empresa en una palabra, para la bandeja y el selector. */
export type Estado = 'pausa' | 'falta' | 'rechazos' | 'certificado' | 'lista'

export function estadoDe(e: EmpresaCartera): Estado {
  if (e.pausadaEn) return 'pausa'
  if (!e.facturacionActiva) return 'falta'
  if (e.rechazos > 0) return 'rechazos'
  if (e.certificadoHasta && diasHasta(e.certificadoHasta) <= 30) return 'certificado'
  return 'lista'
}

export function textoEstado(e: EmpresaCartera): string {
  switch (estadoDe(e)) {
    case 'pausa':       return 'En pausa'
    case 'falta':       return 'Le falta configurar'
    case 'rechazos':    return `${e.rechazos} rechazo${e.rechazos === 1 ? '' : 's'} de SUNAT`
    case 'certificado': {
      const d = diasHasta(e.certificadoHasta!)
      return d < 0 ? 'Certificado vencido' : `Certificado vence en ${d} día${d === 1 ? '' : 's'}`
    }
    default:            return 'Lista para emitir'
  }
}

export function diasHasta(fecha: string): number {
  return Math.ceil((new Date(fecha).getTime() - Date.now()) / 86_400_000)
}

/** «hace 2 h», «ayer», «hace 3 días», o la fecha. */
export function hace(fecha: string | null): string {
  if (!fecha) return '—'
  const min = Math.round((Date.now() - new Date(fecha).getTime()) / 60_000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  if (d === 1) return 'ayer'
  if (d < 30) return `hace ${d} días`
  const m = Math.round(d / 30)
  return m === 1 ? 'hace 1 mes' : `hace ${m} meses`
}