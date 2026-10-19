import { useEffect, useState } from 'react'
import { api } from '../api/cliente'

/** Lo que SUNAT dice de un RUC (por Decolecta, desde el back). */
export interface FichaRuc {
  numero: string
  razonSocial: string | null
  estado: string | null
  condicion: string | null
  direccion: string | null
  ubigeo: string | null
  distrito: string | null
  provincia: string | null
  departamento: string | null
}

/**
 * LA FICHA RUC DE UNA EMPRESA QUE SE DA DE ALTA (18 oct).
 *
 * Para el asistente «Agrega tu empresa» y el alta del super administrador:
 * una empresa siempre tiene RUC, así que aquí solo se busca por RUC.
 *
 * Solo consulta cuando `activo` (RUC completo y válido): cada consulta gasta
 * una del mes. Si falla (sin token, se acabaron, SUNAT caído), no pasa nada:
 * los datos se escriben a mano como antes.
 */
export function useFichaRuc(ruc: string, activo: boolean) {
  const [ficha, setFicha] = useState<FichaRuc | null>(null)
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    if (!activo) { setFicha(null); setBuscando(false); return }
    let vigente = true
    setBuscando(true)
    api.obtener<FichaRuc>(`/api/consultas/ruc/${encodeURIComponent(ruc)}`)
      .then(f => { if (vigente) setFicha(f) })
      .catch(() => { if (vigente) setFicha(null) })
      .finally(() => { if (vigente) setBuscando(false) })
    return () => { vigente = false }
  }, [ruc, activo])

  return { ficha, buscando }
}

/** De baja, suspendida…: todo lo que no sea ACTIVO. Una empresa así no puede emitir. */
export const noActiva = (f: FichaRuc | null) => !!f && !!f.estado && f.estado.toUpperCase() !== 'ACTIVO'

/** No habido, pendiente…: puede darse de alta, pero SUNAT le rechaza los comprobantes. */
export const noHabida = (f: FichaRuc | null) => !!f && !!f.condicion && f.condicion.toUpperCase() !== 'HABIDO'