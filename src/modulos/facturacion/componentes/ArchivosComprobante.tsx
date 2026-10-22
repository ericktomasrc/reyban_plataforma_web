import { useEffect, useRef, useState } from 'react'
import { Boton } from '../../../componentes/Boton'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { documentosServicio } from '../servicios/facturacionServicio'
import type { FormatoPdf } from '../servicios/facturacionServicio'
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
 *   encolado               solo el PDF (22 oct) — se imprime al momento; el
 *                          XML y el CDR, cuando SUNAT conteste
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
    return {
      archivos: ['pdf'],
      nota: d.tipo === '03'
        ? 'La boleta viaja a SUNAT en el resumen diario: el PDF dice «pendiente de envío» hasta que SUNAT conteste.'
        : 'El XML y el CDR aparecen en cuanto SUNAT conteste.',
    }

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
  pdf: 'PDF A4',
}

const NOMBRE_FORMATO: Record<FormatoPdf, string> = {
  a4: 'A4',
  ticket80: 'Ticket 80 mm',
  ticket58: 'Ticket 58 mm',
}

// 22 OCT: EL FORMATO AL IMPRIMIR ES DE CADA EQUIPO, no de la empresa: la caja
// tiene la térmica de 80 mm y la oficina imprime en A4. Se guarda en este
// navegador; si no se puede (modo privado), vale A4.
const CLAVE_FORMATO = 'reyban.impresion.formato'
const CLAVE_AL_EMITIR = 'reyban.impresion.alEmitir'

function leer(clave: string): string | null {
  try { return localStorage.getItem(clave) } catch { return null }
}
function guardar(clave: string, valor: string) {
  try { localStorage.setItem(clave, valor) } catch { /* sin almacenamiento: no se recuerda */ }
}

/**
 * Imprime un PDF sin salir de la pantalla: en un marco escondido, y se llama
 * a «imprimir». Si el navegador no deja (algunos no imprimen PDF en un marco),
 * se abre en una pestaña nueva para imprimirlo desde ahí.
 */
async function imprimirPdf(blob: Blob) {
  const url = URL.createObjectURL(blob)
  const marco = document.createElement('iframe')
  marco.style.position = 'fixed'
  marco.style.width = '0'
  marco.style.height = '0'
  marco.style.border = '0'
  marco.src = url
  document.body.appendChild(marco)
  marco.onload = () => {
    try {
      marco.contentWindow?.focus()
      marco.contentWindow?.print()
    } catch {
      window.open(url, '_blank')
    }
    // Se quita después: el diálogo de impresión todavía lo está leyendo.
    setTimeout(() => { marco.remove(); URL.revokeObjectURL(url) }, 60_000)
  }
}

/**
 * Los botones de descarga e impresión de un comprobante.
 *
 * Si no hay nada que bajar y nada que explicar —un borrador, un error de
 * envío—, no pinta nada.
 *
 * 22 OCT: «Imprimir» en el formato de ESTE EQUIPO (A4, ticket 80 o 58 mm), y
 * los tres PDF para bajar. `recienEmitido` + «imprimir al emitir» lo manda a
 * la impresora solo, una vez.
 */
export function ArchivosComprobante({ d, recienEmitido = false }: {
  d: Pick<DocumentoCompleto, 'id' | 'tipo' | 'estado' | 'comprobanteId'>
  recienEmitido?: boolean
}) {
  const mensaje = useMensaje()

  // Un doble clic no baja dos copias.
  const bajando = useRef(false)
  const [imprimiendo, setImprimiendo] = useState(false)
  const [formato, setFormato] = useState<FormatoPdf>(() => {
    const f = leer(CLAVE_FORMATO)
    return f === 'ticket80' || f === 'ticket58' ? f : 'a4'
  })
  const [alEmitir, setAlEmitir] = useState(() => leer(CLAVE_AL_EMITIR) === '1')
  const impreso = useRef(false)

  const { archivos, nota } = archivosDisponibles(d)
  const hayPdf = archivos.includes('pdf')

  async function imprimir() {
    setImprimiendo(true)
    try {
      await imprimirPdf(await documentosServicio.pdf(d.id, formato))
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo preparar la impresión.')
    } finally {
      setImprimiendo(false)
    }
  }

  // Recién emitido y con «imprimir al emitir»: a la impresora, una vez.
  useEffect(() => {
    if (!recienEmitido || !alEmitir || !hayPdf || impreso.current) return
    impreso.current = true
    void imprimir()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recienEmitido, hayPdf])

  if (archivos.length === 0 && !nota) return null

  async function bajar(archivo: Archivo, f?: FormatoPdf) {
    if (bajando.current) return
    bajando.current = true
    try {
      await documentosServicio.descargar(d.id, archivo, f)
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
          {hayPdf && (
            <Boton onClick={() => void imprimir()} ocupado={imprimiendo} textoOcupado="Preparando…">
              Imprimir ({NOMBRE_FORMATO[formato]})
            </Boton>
          )}
          {archivos.map(a => (
            <Boton key={a} estilo="secundario" onClick={() => void bajar(a)}>
              {ETIQUETAS[a]}
            </Boton>
          ))}
          {hayPdf && (
            <>
              <Boton estilo="secundario" onClick={() => void bajar('pdf', 'ticket80')}>Ticket 80 mm</Boton>
              <Boton estilo="secundario" onClick={() => void bajar('pdf', 'ticket58')}>Ticket 58 mm</Boton>
            </>
          )}
        </div>
      )}

      {hayPdf && (
        <div className="impresion-equipo">
          <label>
            <span>Formato al imprimir en este equipo</span>
            <select value={formato} onChange={e => {
              const f = e.target.value as FormatoPdf
              setFormato(f); guardar(CLAVE_FORMATO, f)
            }}>
              <option value="a4">A4 (hoja completa)</option>
              <option value="ticket80">Ticket 80 mm (térmica común)</option>
              <option value="ticket58">Ticket 58 mm (portátil)</option>
            </select>
          </label>
          <label className="casilla-wsp">
            <input type="checkbox" checked={alEmitir} onChange={e => {
              setAlEmitir(e.target.checked); guardar(CLAVE_AL_EMITIR, e.target.checked ? '1' : '0')
            }} />
            Imprimir solo al emitir
          </label>
        </div>
      )}

      {nota && <p className="nota">{nota}</p>}
    </div>
  )
}
