import { api } from '../../../nucleo/api/cliente'
import type { ConexionSunat } from '../../../nucleo/sunat/conexionSunat'

/** GET /api/admin/conexion-sunat/empresas — una fila por empresa con facturación. */
export interface EmpresaConexion {
  id: string
  nombre: string
  ruc: string | null
  razonSocial: string | null
  ambiente: 'beta' | 'produccion' | null
  /** Certificado real, usuario y clave SOL, series: lo que revisa el servicio. */
  puedeProduccion: boolean
  faltantes: string[]
  advertencias: string[]
}

export interface ResultadoEmpresa {
  empresaId: string
  ok: boolean
  error: string | null
  detalle: string | null
}

export const conexionServicio = {
  empresas: () => api.obtener<EmpresaConexion[]>('/api/admin/conexion-sunat/empresas'),

  /** Solo QA. `real` con las empresas marcadas; `beta` devuelve todas a pruebas. */
  cambiar: (modo: 'beta' | 'real', empresas: string[] = []) =>
    api.crear<ConexionSunat & { resultados: ResultadoEmpresa[]; mensaje: string }>(
      '/api/admin/conexion-sunat', { modo, empresas }),
}