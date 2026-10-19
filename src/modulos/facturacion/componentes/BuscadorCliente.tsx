import { useEffect, useRef, useState } from 'react'
import { clientesServicio } from '../servicios/facturacionServicio'
import type { ClienteEnLista } from '../tipos'
import { DialogoClienteRapido } from './DialogoClienteRapido'

interface Props {
  elegido?: ClienteEnLista
  onElegir: (c: ClienteEnLista) => void
}

const TIPOS: Record<string, string> = {
  '0': 'Sin doc.', '1': 'DNI', '4': 'C.E.', '6': 'RUC', '7': 'Pasaporte',
}

/**
 * Buscar un cliente escribiendo, sin abrir otra pantalla.
 *
 * POR QUÉ NO UN DESPLEGABLE: una empresa con seiscientos clientes tiene un
 * `<select>` de seiscientas opciones. Nadie lo recorre; se escribe.
 *
 * POR QUÉ NO UN DIÁLOGO APARTE: elegir el cliente es el primer paso de armar
 * una factura y pasa una vez por comprobante. Abrir y cerrar una ventana para
 * eso son dos clics de más en la operación más repetida del día.
 *
 * LA BÚSQUEDA VA AL SERVIDOR y espera 300 ms desde la última tecla. Traerse los
 * seiscientos al navegador para filtrar tres funciona con veinte clientes y se
 * cae con dos mil.
 */
export function BuscadorCliente({ elegido, onElegir }: Props) {
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<ClienteEnLista[]>([])
  const [abierto, setAbierto] = useState(false)
  const [buscando, setBuscando] = useState(false)
  // 17 oct: «+ Crear cliente…» al final de la lista abre esto.
  const [creando, setCreando] = useState<string>()

  const caja = useRef<HTMLDivElement>(null)

  // Cerrar al pulsar fuera. Sin esto, la lista se queda abierta encima del
  // resto del formulario y tapa lo que viene después.
  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [])

  useEffect(() => {
    if (q.trim().length < 2) { setResultados([]); return }

    let vivo = true
    setBuscando(true)

    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await clientesServicio.listar(q)
          if (vivo) { setResultados(r.slice(0, 8)); setAbierto(true) }
        } catch {
          if (vivo) setResultados([])
        } finally {
          if (vivo) setBuscando(false)
        }
      })()
    }, 300)

    return () => { vivo = false; clearTimeout(t) }
  }, [q])

  function elegir(c: ClienteEnLista) {
    onElegir(c)
    setQ('')
    setAbierto(false)
    setResultados([])
  }

  return (
    <div className="campo buscador" ref={caja}>
      <span className="etiqueta">Cliente</span>

      {elegido ? (
        <div className="elegido">
          <div>
            <div className="principal">{elegido.razonSocial}</div>
            <div className="secundario">
              {TIPOS[elegido.tipoDocumento] ?? elegido.tipoDocumento}{' '}
              <span className="mono">{elegido.numeroDocumento}</span>
            </div>
          </div>
          <button type="button" className="enlace" onClick={() => onElegir(undefined as never)}>
            Cambiar
          </button>
        </div>
      ) : (
        <>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onFocus={() => resultados.length > 0 && setAbierto(true)}
            placeholder="DNI, RUC o nombre"
            autoComplete="off"
          />

          {abierto && (
            <ul className="sugerencias">
              {resultados.length === 0 ? (
                <li className="vacia">
                  {buscando ? 'Buscando…' : `Ningún cliente con «${q.trim()}».`}
                </li>
              ) : resultados.map(c => (
                <li key={c.id}>
                  <button type="button" onClick={() => elegir(c)}>
                    <span className="principal">{c.razonSocial}</span>
                    <span className="secundario mono">{c.numeroDocumento}</span>
                  </button>
                </li>
              ))}
              {/* SOLO SI NO LO ENCONTRÓ (18 oct). Si la búsqueda trajo clientes,
                  no se ofrece crear: así no se duplica uno que ya existe. Para
                  uno nuevo cuyo nombre se parece a otro, se escribe su DNI o RUC. */}
              {!buscando && q.trim().length >= 2 && resultados.length === 0 && (
                <li>
                  <button type="button" className="crear" onClick={() => { setCreando(q.trim()); setAbierto(false) }}>
                    <span className="principal">+ Crear cliente con «{q.trim()}»…</span>
                  </button>
                </li>
              )}
            </ul>
          )}

          <span className="pista">
            Busca en tus clientes por DNI, RUC o nombre. Si no está, podrás crearlo ahí mismo.
          </span>

          {creando !== undefined && (
            <DialogoClienteRapido
              inicial={creando}
              onCerrar={() => setCreando(undefined)}
              onCreado={c => { setCreando(undefined); elegir(c) }}
            />
          )}
        </>
      )}
    </div>
  )
}
