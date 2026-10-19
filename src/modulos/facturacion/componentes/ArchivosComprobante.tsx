import { useRef } from 'react'
import { Boton } from '../../../componentes/Boton'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { documentosServicio } from '../servicios/facturacionServicio'
import type { DocumentoCompleto } from '../tipos'

type Archivo = 'xml' | 'cdr' | 'pdf'

type Disponibles = { archivos: Archivo[]; nota?: string }

/**
 * Qué archivos de un comprobante se pueden bajar, y por qué no los otros.
 *
 * SE DECIDE CON LO QUE YA TIENE LA PLATAFORMA —estado y tipo—, sin preguntar al
 * servicio. Así el botón que se ve es el que funciona; el 404 del servicio
 * queda solo como red de seguridad.
 *
 * LA MISMA TABLA ESTÁ EN EL BACK, en `EndpointsDescargas.cs` (`Motivo`). Si se
 * cambia una, se cambia la otra.
 *
 *   sin comprobante_id     nada — nunca se entregó al servicio
 *   encolado               nada — todavía no hay respuesta de SUNAT
 *   boleta (03)            solo el PDF — viaja dentro del resumen diario, sin
 *                          XML ni CDR propios
 *   rechazado              XML y PDF — el CDR solo existe si SUNAT aceptó
 *   aceptado, observado,
 *   anulado                los tres
 */
export function archivosDisponibles(
  d: Pick<DocumentoCompleto, 'tipo' | 'estado' | 'comprobanteId'>,
): Disponibles {
  if (!d.comprobanteId) return { archivos: [] }

  if (d.estado === 'encolado')
    return { archivos: [], nota: 'Los archivos aparecen en cuanto SUNAT conteste.' }

  if (!['aceptado', 'observado', 'anulado', 'rechazado'].includes(d.estado))
    return { archivos: [] }

  if (d.tipo === '03')
    return {
      archivos: ['pdf'],
      nota: 'Una boleta no tiene XML ni CDR propios: viaja a SUNAT dentro del resumen diario.',
    }

  if (d.estado === 'rechazado')
    return { archivos: ['xml', 'pdf'], nota: 'Sin CDR: SUNAT rechazó este comprobante.' }

  return { archivos: ['xml', 'cdr', 'pdf'] }
}

const ETIQUETAS: Record<Archivo, string> = {
  xml: 'XML firmado',
  cdr: 'CDR de SUNAT (ZIP)',
  pdf: 'PDF',
}

/**
 * Los botones de descarga de un comprobante.
 *
 * Si no hay nada que bajar y nada que explicar —un borrador, un error de
 * envío—, no pinta nada: un bloque vacío con el título «Archivos» solo haría
 * buscar algo que no existe.
 *
 * Un error al bajar —el servicio no responde, o no tiene el archivo— sale en
 * ventana con el detalle que manda el servicio, tal cual.
 */
export function ArchivosComprobante({ d }: {
  d: Pick<DocumentoCompleto, 'id' | 'tipo' | 'estado' | 'comprobanteId'>
}) {
  const mensaje = useMensaje()

  // Un doble clic no baja dos copias. Ref y no estado: no hay nada que pintar
  // distinto mientras tanto, la descarga es inmediata.
  const bajando = useRef(false)

  const { archivos, nota } = archivosDisponibles(d)
  if (archivos.length === 0 && !nota) return null

  async function bajar(archivo: Archivo) {
    if (bajando.current) return
    bajando.current = true
    try {
      await documentosServicio.descargar(d.id, archivo)
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo bajar el archivo.')
    } finally {
      bajando.current = false
    }
  }

  return (
    <div className="bloque">
      <h2 className="subtitulo">Archivos</h2>

      {archivos.length > 0 && (
        <div className="acciones-linea">
          {archivos.map(a => (
            <Boton key={a} estilo="secundario" onClick={() => void bajar(a)}>
              {ETIQUETAS[a]}
            </Boton>
          ))}
        </div>
      )}

      {nota && <p className="nota">{nota}</p>}
    </div>
  )
}
