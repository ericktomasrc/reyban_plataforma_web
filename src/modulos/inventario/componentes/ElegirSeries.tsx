import { useEffect, useState } from 'react'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { inventarioServicio, type FilaSerie } from '../servicios/inventarioServicio'
import '../inventario.css'

/**
 * 065 — ELEGIR QUÉ NÚMEROS DE SERIE SE VENDEN (de los que están en stock en la
 * sucursal). La cantidad de la línea pasa a ser cuántos se eligieron. Se
 * puede escribir uno que no aparece (lo revisa la base al emitir).
 */
export function ElegirSeries({ productoId, sucursalId, descripcion, elegidas, onCerrar, onElegir }: {
  productoId: string
  sucursalId?: string
  descripcion: string
  elegidas: string[]
  onCerrar: () => void
  onElegir: (series: string[]) => void
}) {
  const [lista, setLista] = useState<FilaSerie[]>()
  const [error, setError] = useState<string>()
  const [marcadas, setMarcadas] = useState<string[]>(elegidas)
  const [q, setQ] = useState('')

  useEffect(() => {
    let vivo = true
    inventarioServicio.series({ productoId, sucursalId, disponibles: true })
      .then(r => { if (vivo) setLista(r) })
      .catch(e => { if (vivo) setError(e instanceof ErrorApi ? e.message : 'No se pudieron leer los números de serie.') })
    return () => { vivo = false }
  }, [productoId, sucursalId])

  const texto = q.trim().toUpperCase()
  const visibles = (lista ?? []).filter(s => !texto || s.serie.includes(texto))
  const alternar = (s: string) => setMarcadas(m => m.includes(s) ? m.filter(x => x !== s) : [...m, s])
  // Lo elegido antes que ya no está en la lista (otro lo vendió, o se escribió a mano).
  const fuera = marcadas.filter(m => !(lista ?? []).some(s => s.serie === m))

  return (
    <Dialogo titulo={`Números de serie · ${descripcion}`} abierto onCerrar={onCerrar}
             acciones={<>
               <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
               <Boton onClick={() => onElegir(marcadas)}>Usar {marcadas.length} número{marcadas.length === 1 ? '' : 's'}</Boton>
             </>}>
      {error && <p className="nota">{error}</p>}
      <label className="campo">
        <span className="etiqueta">Buscar o escribir un número (Enter lo agrega)</span>
        <input className="mono" value={q} autoFocus onChange={e => setQ(e.target.value)}
               onKeyDown={e => {
                 if (e.key !== 'Enter' || !texto) return
                 e.preventDefault()
                 if (!marcadas.includes(texto)) setMarcadas(m => [...m, texto])
                 setQ('')
               }} />
      </label>
      {!lista ? <Cargando /> : (
        <div className="series-lista">
          {visibles.length === 0 && <p className="secundario">{lista.length === 0 ? 'No hay números de serie en stock de este producto en esta sucursal.' : 'Ninguno con ese número.'}</p>}
          {visibles.map(s => (
            <label key={s.id} className="series-fila">
              <input type="checkbox" checked={marcadas.includes(s.serie)} onChange={() => alternar(s.serie)} />
              <span className="mono">{s.serie}</span>
              <span className="secundario">{s.sucursal}</span>
            </label>
          ))}
          {fuera.map(s => (
            <label key={s} className="series-fila">
              <input type="checkbox" checked onChange={() => alternar(s)} />
              <span className="mono">{s}</span>
              <span className="secundario">escrito a mano</span>
            </label>
          ))}
        </div>
      )}
    </Dialogo>
  )
}