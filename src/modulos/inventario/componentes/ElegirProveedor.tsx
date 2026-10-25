import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { consultasServicio } from '../../facturacion/servicios/facturacionServicio'
import { inventarioServicio, type Proveedor, type ProveedorNuevo } from '../servicios/inventarioServicio'

export type ProveedorElegido = { guardado: Proveedor } | { nuevo: ProveedorNuevo } | null

const esRuc = (s: string) => /^(10|15|17|20)\d{9}$/.test(s)

/**
 * 052 — Elegir el proveedor del ingreso: uno guardado (por RUC o nombre), o
 * escribir un RUC nuevo: se consulta en SUNAT y se guarda solo al registrar.
 */
export function ElegirProveedor({ valor, onCambio }: { valor: ProveedorElegido; onCambio: (p: ProveedorElegido) => void }) {
  const [q, setQ] = useState('')
  const [lista, setLista] = useState<Proveedor[]>([])
  const [abierto, setAbierto] = useState(false)
  const [consultando, setConsultando] = useState(false)
  const [nuevo, setNuevo] = useState<ProveedorNuevo>()
  const [nombreAMano, setNombreAMano] = useState('')
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function cerrar(e: MouseEvent) { if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false) }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [])

  useEffect(() => {
    const t0 = q.trim()
    if (t0.length < 2) return
    let vivo = true
    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await inventarioServicio.buscarProveedores(t0)
          if (!vivo) return
          setLista(r); setAbierto(true)
          if (esRuc(t0) && !r.some(p => p.numeroDocumento === t0)) {
            setConsultando(true)
            try {
              const f = await consultasServicio.ruc(t0)
              if (vivo) setNuevo({ tipoDocumento: '6', numeroDocumento: t0, razonSocial: f.razonSocial ?? '', direccion: f.direccion })
            } catch {
              if (vivo) setNuevo({ tipoDocumento: '6', numeroDocumento: t0, razonSocial: '' })
            } finally {
              if (vivo) setConsultando(false)
            }
          } else setNuevo(undefined)
        } catch {
          if (vivo) setLista([])
        }
      })()
    }, 300)
    return () => { vivo = false; clearTimeout(t) }
  }, [q])

  if (valor) {
    const p = 'guardado' in valor ? valor.guardado : valor.nuevo
    return (
      <div className="campo">
        <span className="etiqueta">Proveedor</span>
        <div className="inv-resumen">
          <span><strong>{p.razonSocial || '(sin razón social)'}</strong> · <span className="mono">{p.numeroDocumento}</span></span>
          {'nuevo' in valor && <span className="secundario">nuevo: se guarda en Proveedores al registrar</span>}
          <button type="button" className="enlace" onClick={() => { onCambio(null); setQ('') }}>Cambiar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="campo" ref={caja}>
      <label className="etiqueta" htmlFor="inv-proveedor">Proveedor</label>
      <div className="buscador en-linea">
        <input id="inv-proveedor" value={q} autoComplete="off" placeholder="RUC o razón social (opcional)"
               onChange={e => { setQ(e.target.value); if (e.target.value.trim().length < 2) { setLista([]); setNuevo(undefined) } }}
               onFocus={() => lista.length > 0 && setAbierto(true)} />
        {abierto && (lista.length > 0 || nuevo || consultando) && (
          <ul className="sugerencias">
            {lista.map(p => (
              <li key={p.id}>
                <button type="button" onClick={() => { onCambio({ guardado: p }); setAbierto(false) }}>
                  <span className="principal">{p.razonSocial}</span>
                  <span className="secundario mono">{p.numeroDocumento}</span>
                </button>
              </li>
            ))}
            {consultando && <li><span className="secundario">Consultando el RUC en SUNAT…</span></li>}
            {nuevo && (
              <li>
                {nuevo.razonSocial ? (
                  <button type="button" onClick={() => { onCambio({ nuevo }); setAbierto(false) }}>
                    <span className="principal">Nuevo: {nuevo.razonSocial}</span>
                    <span className="secundario mono">{nuevo.numeroDocumento} · consultado en SUNAT</span>
                  </button>
                ) : (
                  <div className="relleno">
                    <span className="secundario">No se pudo consultar el RUC. Escribe la razón social:</span>
                    <input value={nombreAMano} onChange={e => setNombreAMano(e.target.value)} maxLength={200} />
                    <button type="button" className="enlace" disabled={!nombreAMano.trim()}
                            onClick={() => { onCambio({ nuevo: { ...nuevo, razonSocial: nombreAMano.trim() } }); setAbierto(false) }}>Usar</button>
                  </div>
                )}
              </li>
            )}
          </ul>
        )}
      </div>
      <span className="pista">Elige uno guardado o escribe un RUC nuevo (se consulta y se guarda en <Link to="/inventario/proveedores">Proveedores</Link>).</span>
    </div>
  )
}