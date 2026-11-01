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