import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fechaYHora } from '../../nucleo/formato/fechas'
import type { Aviso, Avisos } from './avisosServicio'

/**
 * e177 (058) — LA CAMPANITA 🔔, en la cabecera.
 *
 * El número son los avisos sin leer, del color del peor (rojo, naranja o
 * azul). Al abrir la lista se ve todo: lo leído, más apagado. Tocar un aviso
 * lo marca leído y lleva a donde se arregla.
 *
 * Los avisos son lo que pasa AHORA (los calcula la API): cuando se arregla la
 * causa, desaparecen solos.
 */
export function Campanita({ datos, onMarcar }: { datos?: Avisos; onMarcar: (claves: string[]) => Promise<void> }) {
  const [abierta, setAbierta] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navegar = useNavigate()

  useEffect(() => {
    if (!abierta) return
    const fuera = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierta(false) }
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierta(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla) }
  }, [abierta])

  const n = datos?.sinLeer ?? 0
  const lista = datos?.avisos ?? []

  function ir(a: Aviso) {
    setAbierta(false)
    if (!a.leido) void onMarcar([a.clave])
    if (a.enlace) navegar(a.enlace)
  }

  return (
    <div className="campanita" ref={ref}>
      <button type="button" className="campanita-boton" aria-haspopup="dialog" aria-expanded={abierta}
              aria-label={n ? `Avisos: ${n} sin leer` : 'Avisos'} onClick={() => setAbierta(a => !a)}>
        <span aria-hidden="true">🔔</span>
        {n > 0 && <span className={`campanita-cuenta ${datos?.nivel ?? 'info'}`}>{n > 99 ? '99+' : n}</span>}
      </button>

      {abierta && (
        <div className="campanita-panel" role="dialog" aria-label="Avisos">
          <div className="campanita-cabeza">
            <strong>Avisos</strong>
            {n > 0 && (
              <button type="button" className="enlace" onClick={() => void onMarcar(lista.filter(a => !a.leido).map(a => a.clave))}>
                Marcar todo como leído
              </button>
            )}
          </div>
          {lista.length === 0 ? (
            <p className="campanita-vacia">Todo en orden. Aquí te avisamos si algo necesita tu atención.</p>
          ) : (
            <ul className="campanita-lista">
              {lista.map(a => (
                <li key={a.clave} className={a.leido ? 'leido' : undefined}>
                  <button type="button" onClick={() => ir(a)}>
                    <span className={`campanita-punto ${a.nivel}`} aria-hidden="true" />
                    <span className="campanita-texto">
                      <strong>{a.titulo}</strong>
                      {a.detalle && <span>{a.detalle}</span>}
                      {a.fecha && <small>{fechaYHora(a.fecha)}</small>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * El certificado en el menú: en la Cuenta Profesional, un número de color al
 * lado de «Mis empresas» (cuántas por vencer); en la Cuenta Negocio, una
 * bolita al lado del nombre de la empresa (verde, naranja o rojo).
 */
export function IndicadorCertificado({ datos, numero }: { datos?: Avisos; numero: boolean }) {
  const c = datos?.certificado
  if (!c?.nivel) return null
  const texto = c.dias === null ? '' : c.dias < 0 ? `El certificado venció hace ${-c.dias} día(s)`
    : c.dias === 0 ? 'El certificado vence hoy' : `El certificado vence en ${c.dias} día(s)`
  if (numero) {
    if (c.empresas === 0) return null
    return <span className={`cert-numero ${c.nivel}`} title={`${c.empresas} empresa(s) con el certificado por vencer o vencido. ${texto}.`}>{c.empresas}</span>
  }
  return <span className={`cert-bolita ${c.nivel}`} title={texto} role="img" aria-label={texto} />
}