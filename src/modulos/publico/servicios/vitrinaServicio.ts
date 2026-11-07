import { api } from '../../../nucleo/api/cliente'
import type { Catalogo, DatosPublicos } from '../../planes/servicios/planesServicio'

/** 074: lo que ve la página pública (sin sesión). */
export interface Vitrina {
  catalogo: Catalogo
  empresa: DatosPublicos
  medios: { tarjeta: boolean; transferencia: boolean; yape: boolean } | null
}

export const vitrinaServicio = {
  leer: () => api.obtener<Vitrina>('/api/publico/vitrina'),
}

/** ¿Se abrió por la dirección de la vitrina (facturacion.…)? Ahí la raíz es la página pública. */
export const esDominioVitrina = () => typeof window !== 'undefined' && window.location.hostname.startsWith('facturacion.')
/** 078: una hoja del Libro de Reclamaciones (sin sesión). */
export interface HojaReclamo {
  tipo: 'reclamo' | 'queja'; bien: 'servicio' | 'producto'
  nombre: string; docTipo: 'DNI' | 'CE' | 'RUC' | 'PASAPORTE'; docNumero: string
  domicilio: string; telefono: string; correo: string; apoderado: string
  monto: string; descripcion: string; detalle: string; pedido: string
  captcha: string
}

export const reclamosServicio = {
  registrar: (h: HojaReclamo) =>
    api.crear<{ hoja: string; vence: string; mensaje: string }>('/api/publico/reclamos', h),
}