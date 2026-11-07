import { api } from '../../../nucleo/api/cliente'
import type { CertificadoGuardado, EmisorServicio, SerieServicio } from '../../configuracion/servicios/configuracionServicio'

/** 075: Mi empresa (la de Reyban, que cobra los planes). */
export interface MiEmpresa {
  empresa: {
    id: string; nombre: string; ruc: string; razonSocial: string; nombreComercial: string | null
    ambiente: 'beta' | 'produccion' | null; creadaEn: string; tipo: 'ruc20' | 'ruc10'
  } | null
  credencial?: { pista: string; altaConfirmadaEn: string | null; certificadoValidoHasta: string | null } | null
  cobros?: { serieFactura: string | null; serieBoleta: string | null; enviarCorreo: boolean; descripcion: string }
  servicio?: { alcanzado: boolean; error: string | null }
  emisor?: EmisorServicio | null
  series?: SerieServicio[] | null
  pasos?: { empresa: boolean; certificado: boolean; sol: boolean; series: boolean; direccion: boolean; listo: boolean }
}

export interface DatosMiEmpresa {
  tipo: 'ruc20' | 'ruc10'
  ruc: string; razonSocial: string; nombreComercial: string
  direccion: string; ubigeo: string; distrito: string; provincia: string; departamento: string
}

/** 076: el comprobante de un pago (lo emite el sistema solo). */
export interface ComprobanteCobro {
  id: string; numero: string | null; fecha: string | null; monto: number; concepto: string
  modo: 'real' | 'prueba' | 'simulado' | 'manual'; comprador: string | null; documento: string | null
  estado: 'pendiente' | 'emitido' | 'error' | 'rechazado' | 'no_aplica'
  sunat: string | null; comprobante: string | null; error: string | null; intentos: number
}

type Mensaje = { mensaje: string }
const B = '/api/admin/mi-empresa'

export const miEmpresaServicio = {
  leer: () => api.obtener<MiEmpresa>(B),
  registrar: (d: DatosMiEmpresa) => api.crear<Mensaje & { id: string }>(B, d),
  confirmar: () => api.crear<{ alta: string | null }>(`${B}/confirmar`),
  certificado: (archivo: File, clave: string, confirmado: boolean) => {
    const f = new FormData()
    f.append('archivo', archivo)
    f.append('clave', clave)
    if (confirmado) f.append('confirmado', 'true')
    return api.subir<CertificadoGuardado>(`${B}/certificado`, f)
  },
  certificadoPrueba: () => api.crear<CertificadoGuardado>(`${B}/certificado/prueba`),
  sol: (usuario: string, clave: string) => api.cambiar<Mensaje>(`${B}/sol`, { usuario, clave }),
  marca: (d: { identificador: string | null; colorMarca: string | null; correoRespuesta: string | null; copiaAlEmisor: boolean }) =>
    api.cambiar<Mensaje>(`${B}/marca`, d),
  logo: (archivo: File) => { const f = new FormData(); f.append('archivo', archivo); return api.subir<Mensaje>(`${B}/logo`, f) },
  serie: (tipoComprobante: string, serie: string, ultimoCorrelativo: number, confirmado: boolean) =>
    api.crear<Mensaje>(`${B}/series`, { tipoComprobante, serie, ultimoCorrelativo, confirmado }),
  quitarSerie: (id: string) => api.borrar<Mensaje>(`${B}/series/${id}`),
  comprobante: (d: { serieFactura: string | null; serieBoleta: string | null; enviarCorreo: boolean; descripcion: string }) =>
    api.cambiar<Mensaje>(`${B}/comprobante`, d),
  comprobantes: () => api.obtener<ComprobanteCobro[]>(`${B}/comprobantes`),
  reintentar: (id: string) => api.crear<Mensaje>(`${B}/comprobantes/${id}/reintentar`),
}

export const NOMBRE_TIPO: Record<string, string> = {
  '01': 'Factura', '03': 'Boleta', '07': 'Nota de crédito', '08': 'Nota de débito', '09': 'Guía de remisión',
}