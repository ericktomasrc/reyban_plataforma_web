import { api } from '../../../nucleo/api/cliente'

// =============================================================================
// EL ASISTENTE DE CONFIGURACIÓN (fase 2, migración 017)
//
// De «tu cuenta está lista» a «lista para emitir». El paso 1 crea la empresa
// aquí y su emisor en el servicio; los demás van al servicio con la clave de
// la empresa, a través de la API de la plataforma. El front nunca habla con el
// servicio directamente.
// =============================================================================

export interface EmpresaConfigurada {
  id: string
  nombre: string
  ruc: string | null
  razonSocial: string | null
  ambiente: 'beta' | 'produccion' | null
  correoTitular: string | null
}

/** Lo que dice el servicio del emisor (GET /v1/emisor), tal cual. */
export interface EmisorServicio {
  ruc: string | null
  razonSocial: string | null
  nombreComercial: string | null
  ambiente: string | null
  certificadoValidoHasta: string | null
  alta: { estado: string | null } | null
  portal: {
    identificador: string | null
    correoRespuesta: string | null
    tieneLogo: boolean | null
    correosAlReceptor: boolean | null
  } | null
  direccion: {
    ubigeo: string | null
    direccion: string | null
    distrito: string | null
    provincia: string | null
    departamento: string | null
  } | null
  listo: {
    paraEmitir: boolean | null
    certificado: boolean | null
    sol: boolean | null
    series: string[] | null
    direccion: boolean | null
    faltan: string[] | null
  } | null
}

export interface SerieServicio {
  id: string
  tipoComprobante: string
  serie: string
  ultimoCorrelativo: number
  activo: boolean
  comprobantes: number
}

export interface Pasos {
  empresa: boolean
  certificado: boolean
  series: boolean
  correo: boolean
  sol: boolean
  listo: boolean
}

/** GET /api/configuracion */
export interface EstadoConfiguracion {
  empresa: EmpresaConfigurada | null

  /** Solo sin empresa: si puede agregar una, y si no, por qué. */
  puedeAgregar?: boolean
  motivo?: string | null

  /** Con empresa. */
  facturacionActiva?: boolean
  servicio?: { alcanzado: boolean; error: string | null }
  emisor?: EmisorServicio | null
  series?: SerieServicio[] | null
  pasos?: Pasos
}

export interface DatosEmpresa {
  ruc: string
  razonSocial: string
  nombreComercial: string
  direccion: string
  ubigeo: string
  distrito: string
  provincia: string
  departamento: string
  correoTitular: string
}

export interface CertificadoGuardado {
  titular: string
  coincideRuc: boolean
  validoHasta: string
  prueba: boolean
  mensaje: string
}

/** 23 oct: el formato A4 del PDF de la empresa. */
export type FormatoPdf = 'moderno' | 'clasico'

export interface DatosMarca {
  identificador: string | null
  colorMarca: string | null
  correoRespuesta: string | null
  copiaAlEmisor: boolean
}

export const configuracionServicio = {
  /** `nueva`: «Agregar empresa» desde la cartera (fase 3), con otra ya abierta. */
  estado: (nueva = false) =>
    api.obtener<EstadoConfiguracion>(nueva ? '/api/configuracion?nueva=true' : '/api/configuracion'),

  crearEmpresa: (d: DatosEmpresa) =>
    api.crear<{ mensaje: string }>('/api/configuracion/empresa', d),

  confirmar: () => api.crear<EstadoConfiguracion>('/api/configuracion/confirmar'),

  subirCertificado: (archivo: File, clave: string, confirmado: boolean) => {
    const f = new FormData()
    f.append('archivo', archivo)
    f.append('clave', clave)
    if (confirmado) f.append('confirmado', 'true')
    return api.subir<CertificadoGuardado>('/api/configuracion/certificado', f)
  },

  certificadoDePrueba: () =>
    api.crear<CertificadoGuardado>('/api/configuracion/certificado/prueba'),

  /** 22 oct: solo una serie que nunca se usó (último número 0, sin comprobantes). */
  quitarSerie: (id: string) =>
    api.borrar<{ mensaje: string }>(`/api/configuracion/series/${id}`),

  agregarSerie: (tipoComprobante: string, serie: string, ultimoCorrelativo: number, confirmado: boolean) =>
    api.crear<{ mensaje: string }>('/api/configuracion/series',
      { tipoComprobante, serie, ultimoCorrelativo, confirmado }),

  guardarMarca: (d: DatosMarca) =>
    api.cambiar<{ mensaje: string; identificador: string | null }>('/api/configuracion/marca', d),

  subirLogo: (archivo: File) => {
    const f = new FormData()
    f.append('archivo', archivo)
    return api.subir<{ mensaje: string }>('/api/configuracion/logo', f)
  },

  /** 23 oct: el formato del PDF (moderno / clásico estilo SUNAT). */
  formatoPdf: () =>
    api.obtener<{ formato: FormatoPdf }>('/api/configuracion/formato-pdf'),

  guardarFormatoPdf: (formato: FormatoPdf) =>
    api.cambiar<{ formato: FormatoPdf; mensaje: string }>('/api/configuracion/formato-pdf', { formato }),

  /** Un PDF de ejemplo con los datos y el logo de la empresa. */
  muestraPdf: (formato: FormatoPdf) =>
    api.archivo(`/api/configuracion/formato-pdf/muestra?formato=${formato}`),

  guardarSol: (usuario: string, clave: string) =>
    api.cambiar<{ mensaje: string; usuario: string }>('/api/configuracion/sol', { usuario, clave }),

  terminar: () =>
    api.crear<{ mensaje: string; estado: EstadoConfiguracion }>('/api/configuracion/terminar'),
}

// --- Ayudas del formulario ----------------------------------------------------

/**
 * El dígito verificador del RUC (módulo 11), para avisar antes de enviar. El
 * back lo vuelve a comprobar: esto es solo para no esperar un viaje.
 */
export function rucValido(ruc: string): boolean {
  if (!/^(10|15|16|17|20)\d{9}$/.test(ruc)) return false
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const suma = pesos.reduce((s, p, i) => s + p * Number(ruc[i]), 0)
  let digito = 11 - (suma % 11)
  if (digito === 10) digito = 0
  if (digito === 11) digito = 1
  return digito === Number(ruc[10])
}

/**
 * La dirección de la página de descargas, a partir del nombre: minúsculas, sin
 * tildes, con guiones. «Reyban Consulting S.A.C.» → «reyban-consulting».
 */
export function identificadorDesde(nombre: string): string {
  const base = nombre
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(s\.?\s?a\.?\s?c\.?|s\.?\s?a\.?|e\.?\s?i\.?\s?r\.?\s?l\.?|s\.?\s?r\.?\s?l\.?)\s*$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
  return base.slice(0, 40).replace(/-+$/, '')
}