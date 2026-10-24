import type { EstadoGuia as Estado } from '../servicios/guiasServicio'

/**
 * 050 — El estado de una guía. Lo que importa de verdad: si el vehículo puede
 * salir. Por eso «En camino» dice «no salgas todavía» y «Aceptada», que sí.
 */
const ESTADOS: Record<Estado, { texto: string; clase: string; explica: string }> = {
  encolado:  { texto: 'En camino a SUNAT', clase: 'estado aviso', explica: 'No salgas todavía: en unos segundos SUNAT responde.' },
  aceptado:  { texto: 'Aceptada', clase: 'estado bueno', explica: 'El vehículo ya puede salir. Lleva el PDF (o el QR en el celular).' },
  observado: { texto: 'Aceptada con observaciones', clase: 'estado bueno', explica: 'Vale para el traslado. Conviene leer la observación.' },
  rechazado: { texto: 'Rechazada', clase: 'estado malo', explica: 'SUNAT la rechazó: no sustenta el traslado. Corrige y emite otra.' },
  error:     { texto: 'No se pudo enviar', clase: 'estado malo', explica: 'No llegó al servicio. Se puede reintentar.' },
  anulado:   { texto: 'Anulada en SOL', clase: 'estado', explica: 'Anulada en SUNAT y registrada aquí.' },
}

export function EstadoGuia({ estado, conAyuda }: { estado: Estado; conAyuda?: boolean }) {
  const e = ESTADOS[estado] ?? { texto: estado, clase: 'estado', explica: '' }
  return (
    <>
      <span className={e.clase} title={conAyuda ? undefined : e.explica}>{e.texto}</span>
      {conAyuda && e.explica && <div className="secundario">{e.explica}</div>}
    </>
  )
}

export const explicarEstadoGuia = (estado: Estado) => ESTADOS[estado]?.explica ?? ''