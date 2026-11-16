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
const miles = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const simbolo = (m: string) => m === 'PEN' ? 'S/' : m === 'USD' ? 'US$' : m
const ESTADO: Record<string, [string, string]> = {
  aceptado: ['Aceptado', 'bueno'], observado: ['Con observaciones', 'aviso'], encolado: ['En camino', 'aviso'],
  rechazado: ['Rechazado', 'malo'], anulado: ['Anulado', 'malo'],
}

/**
 * Diseño 15 nov: con `accion` (lo usan las notas) va en dos columnas y los
 * resultados en tabla con un botón por fila. Sin `accion` (Nueva guía) se ve
 * como antes. La búsqueda es la misma en los dos casos.
 */
export function BuscadorComprobante({ buscar, series, onElegir, accion }: {
  buscar: (q: string) => Promise<ComprobanteParaNota[]>
  series: () => Promise<SerieEmitida[]>
  onElegir: (id: string) => void
  accion?: string
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

  if (accion) return (
    <div className="buscador-comprobante bc-nuevo">
      <div className="bc-dos">
        <div className="campo">
          <span className="etiqueta">Si tienes el número</span>
          <div className="bc-fila">
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
            <Boton onClick={() => void ir(`${serie}-${numero}`, true)} ocupado={buscando} disabled={!serie || !numero}>Ver</Boton>
          </div>
          <span className="pista">Un número exacto te lleva directo a la nota.</span>
        </div>
        <span className="bc-o">o</span>
        <div className="campo">
          <span className="etiqueta">Si no, búscalo por el cliente</span>
          <div className="bc-fila">
            <input value={cliente} placeholder="RUC, DNI o nombre" aria-label="Cliente"
                   autoComplete="off" maxLength={100} onChange={e => setCliente(e.target.value)}
                   onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void ir(cliente, false) } }} />
            <Boton estilo="secundario" onClick={() => void ir(cliente, false)} disabled={!cliente.trim()}>Buscar</Boton>
          </div>
          <span className="pista">Solo facturas y boletas emitidas.</span>
        </div>
      </div>

      {fallo && <span className="pista mal">{fallo}</span>}
      {filas && (filas.length === 0
        ? <p className="bc-vacio">No se encontró ningún comprobante con «{buscado}».</p>
        : (
          <div className="bc-resultados">
            <p className="bc-cuantos"><strong>{filas.length} {filas.length === 1 ? 'comprobante' : 'comprobantes'}</strong> de «{buscado}»</p>
            <div className="bc-tabla">
              <table className="tabla lista-comprobantes">
                <thead>
                  <tr><th>Comprobante</th><th>Cliente</th><th>Fecha</th><th>Estado</th><th className="derecha">Importe</th><th aria-label="Acción" /></tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => {
                    const [texto, clase] = ESTADO[f.estado] ?? [f.estado, '']
                    return (
                      <tr key={f.id}>
                        <td>
                          <div className="cmp-doc">
                            <span className={`cmp-sigla t${f.tipo}`} aria-hidden="true">{f.tipo === '01' ? 'F' : 'B'}</span>
                            <div><div className="principal mono">{f.numero}</div><div className="secundario">{f.tipo === '01' ? 'Factura' : 'Boleta'}</div></div>
                          </div>
                        </td>
                        <td><div className="principal">{f.cliente}</div><div className="secundario mono">{f.documentoCliente}</div></td>
                        <td className="secundario">{fecha(f.fechaEmision)}</td>
                        <td><span className={`estado ${clase}`}>{texto}</span></td>
                        <td className="derecha"><span className="principal cmp-importe">{simbolo(f.moneda)} {miles.format(f.importeTotal)}</span></td>
                        <td className="derecha">
                          <Boton estilo={i === 0 ? undefined : 'secundario'} onClick={() => onElegir(f.id)}>{accion}</Boton>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
    </div>
  )

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
        ? <span className="bc-noesta" role="status">No se encontró ningún comprobante con «{buscado}». Revisa la serie y el número.</span>
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