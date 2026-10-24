import { useEffect, useState } from 'react'
import { Boton } from '../../../componentes/Boton'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import type { ComprobanteParaNota, SerieEmitida } from '../tipos'

/**
 * 24 OCT — ELEGIR UNA FACTURA O BOLETA YA EMITIDA, como en SOL: la serie de
 * una lista (las que la empresa ya usó) y el número. O, si no lo sabes, por el
 * RUC o el nombre del cliente. Lo usan «Nueva nota» y «Nueva guía».
 *
 * Un número exacto que existe va directo (como «Ver factura» en SOL).
 */
export function BuscadorComprobante({ buscar, series, onElegir }: {
  buscar: (q: string) => Promise<ComprobanteParaNota[]>
  series: () => Promise<SerieEmitida[]>
  onElegir: (id: string) => void
}) {
  const [lista, setLista] = useState<SerieEmitida[]>([])
  const [serie, setSerie] = useState('')
  const [numero, setNumero] = useState('')
  const [cliente, setCliente] = useState('')
  const [filas, setFilas] = useState<ComprobanteParaNota[]>()
  const [buscado, setBuscado] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [fallo, setFallo] = useState<string>()

  useEffect(() => {
    let vivo = true
    series()
      .then(s => { if (vivo) { setLista(s); if (s.length > 0) setSerie(s[0].serie) } })
      .catch(() => { /* sin lista: se puede buscar por cliente */ })
    return () => { vivo = false }
  }, [series])

  async function ir(q: string, exacto: boolean) {
    if (!q.trim()) return
    setBuscando(true); setFallo(undefined); setBuscado(q.trim())
    try {
      const r = await buscar(q.trim())
      if (exacto && r.length === 1) { onElegir(r[0].id); return }
      setFilas(r)
    } catch (e) {
      setFallo(e instanceof ErrorApi ? e.message : 'No se pudo buscar.')
    } finally { setBuscando(false) }
  }

  const elegida = lista.find(s => s.serie === serie)

  return (
    <div className="buscador-comprobante">
      <div className="origen-guia">
        <select value={serie} onChange={e => setSerie(e.target.value)} aria-label="Serie">
          {lista.length === 0 && <option value="">Sin comprobantes emitidos</option>}
          {lista.map(s => (
            <option key={s.serie} value={s.serie}>{s.serie} · {s.tipo === '01' ? 'factura' : 'boleta'}</option>
          ))}
        </select>
        <input className="mono numero-comprobante" value={numero} inputMode="numeric" maxLength={8} aria-label="Número"
               placeholder={elegida?.ultimo ? `1 a ${elegida.ultimo}` : 'Número'}
               onChange={e => setNumero(e.target.value.replace(/\D/g, ''))}
               onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void ir(`${serie}-${numero}`, true) } }} />
        <Boton onClick={() => void ir(`${serie}-${numero}`, true)} ocupado={buscando} disabled={!serie || !numero}>Ver comprobante</Boton>
      </div>

      <div className="origen-guia">
        <input value={cliente} placeholder="O busca por RUC, DNI o nombre del cliente" aria-label="Cliente"
               autoComplete="off" maxLength={100} onChange={e => setCliente(e.target.value)}
               onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void ir(cliente, false) } }} />
        <Boton estilo="secundario" onClick={() => void ir(cliente, false)} disabled={!cliente.trim()}>Buscar</Boton>
      </div>

      {fallo && <span className="pista mal">{fallo}</span>}
      {filas && (filas.length === 0
        ? <span className="pista">No se encontró ningún comprobante con «{buscado}».</span>
        : (
          <div className="resultados-origen">
            {filas.map(f => (
              <Boton key={f.id} estilo="plano" onClick={() => onElegir(f.id)}>
                {f.numero} · {f.cliente} · {fecha(f.fechaEmision)} · {f.moneda} {f.importeTotal.toFixed(2)}
              </Boton>
            ))}
          </div>
        ))}
    </div>
  )
}