import { useState, type ReactNode } from 'react'

/**
 * 032 — GRÁFICOS DE LOS REPORTES, sin librerías: SVG y HTML.
 *
 * Reglas: un solo eje; los colores salen de --serie-1..3 (componentes.css) y
 * siempre van con su nombre al lado (nunca solo el color); al pasar el mouse
 * sale el valor exacto; y cada gráfico tiene «Ver como tabla».
 */

export function dinero(n: number | null | undefined) {
  return (n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function corto(n: number) {
  const a = Math.abs(n)
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (a >= 1_000) return `${(n / 1_000).toFixed(a >= 10_000 ? 0 : 1)}k`
  return n.toFixed(0)
}

function techo(max: number) {
  if (max <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(max)))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= max) return m * p
  return 10 * p
}

/** «Ver como tabla», debajo de cada gráfico. */
function ComoTabla({ cabeceras, filas }: { cabeceras: string[]; filas: ReactNode[][] }) {
  const [abierta, setAbierta] = useState(false)
  return (
    <div className="como-tabla">
      <button type="button" className="enlace-tabla" onClick={() => setAbierta(a => !a)}>
        {abierta ? 'Ocultar tabla' : 'Ver como tabla'}
      </button>
      {abierta && (
        <table className="tabla">
          <thead><tr>{cabeceras.map((c, i) => <th key={c} className={i > 0 ? 'derecha' : undefined}>{c}</th>)}</tr></thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>{f.map((c, j) => <td key={j} className={j > 0 ? 'derecha mono' : undefined}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/** Una cifra grande con su nota. */
export function Cifra({ titulo, valor, nota }: { titulo: string; valor: ReactNode; nota?: ReactNode }) {
  return (
    <div className="cifra-reporte">
      <span>{titulo}</span>
      <strong className="mono">{valor}</strong>
      {nota && <small>{nota}</small>}
    </div>
  )
}

/** Línea de una serie en el tiempo (ventas por día). */
export function GraficoLinea({ puntos, etiquetaValor }: {
  puntos: { etiqueta: string; valor: number }[]
  etiquetaValor: string
}) {
  const ancho = 640, alto = 210, izq = 44, der = 12, arriba = 16, abajo = 26
  const max = techo(Math.max(0, ...puntos.map(p => p.valor)))
  const min = Math.min(0, ...puntos.map(p => p.valor))
  const rango = max - min || 1
  const x = (i: number) => izq + (puntos.length <= 1 ? 0 : (i * (ancho - izq - der)) / (puntos.length - 1))
  const y = (v: number) => arriba + ((max - v) * (alto - arriba - abajo)) / rango
  // Las marcas: 0, la mitad y el máximo (un negativo, si lo hay, queda bajo el 0 sin rótulo).
  const marcas = [0, max / 2, max]
  const ultimo = puntos[puntos.length - 1]

  if (puntos.length === 0) return <p className="nota">Sin datos en este periodo.</p>

  return (
    <>
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="grafico" role="img" aria-label={etiquetaValor}>
        {marcas.map(m => (
          <g key={m}>
            <line x1={izq} x2={ancho - der} y1={y(m)} y2={y(m)} className={m === 0 ? 'eje' : 'rejilla'} />
            <text x={izq - 6} y={y(m) + 4} textAnchor="end" className="texto-eje">{corto(m)}</text>
          </g>
        ))}
        {[0, Math.floor((puntos.length - 1) / 2), puntos.length - 1]
          .filter((v, i, a) => a.indexOf(v) === i)
          .map(i => <text key={i} x={x(i)} y={alto - 6} textAnchor={i === 0 ? 'start' : i === puntos.length - 1 ? 'end' : 'middle'} className="texto-eje">{puntos[i].etiqueta}</text>)}
        <polyline fill="none" className="serie-1-linea"
                  points={puntos.map((p, i) => `${x(i)},${y(p.valor)}`).join(' ')} />
        {puntos.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.valor)} r={10} className="zona-punto">
            <title>{`${p.etiqueta}: ${dinero(p.valor)}`}</title>
          </circle>
        ))}
        {ultimo && <circle cx={x(puntos.length - 1)} cy={y(ultimo.valor)} r={4} className="serie-1-punto" />}
      </svg>
      <ComoTabla cabeceras={['Día', etiquetaValor]} filas={puntos.map(p => [p.etiqueta, dinero(p.valor)])} />
    </>
  )
}

/** Barras horizontales con su nombre y su valor (los mejores N). */
export function Barras({ filas, cabeceras, formato = dinero }: {
  filas: { etiqueta: string; valor: number; nota?: string }[]
  cabeceras: [string, string]
  formato?: (n: number) => string
}) {
  if (filas.length === 0) return <p className="nota">Sin datos en este periodo.</p>
  const max = Math.max(...filas.map(f => Math.abs(f.valor)), 1)
  return (
    <>
      <div className="barras-reporte">
        {filas.map((f, i) => (
          <div key={i} className="barra-fila" title={`${f.etiqueta}: ${formato(f.valor)}`}>
            <span className="barra-nombre">{f.etiqueta}{f.nota && <small> · {f.nota}</small>}</span>
            <span className="barra-pista">
              <span className={f.valor < 0 ? 'barra negativa' : 'barra'} style={{ width: `${(Math.abs(f.valor) / max) * 100}%` }} />
            </span>
            <span className="barra-valor mono">{formato(f.valor)}</span>
          </div>
        ))}
      </div>
      <ComoTabla cabeceras={cabeceras} filas={filas.map(f => [f.etiqueta, formato(f.valor)])} />
    </>
  )
}

/** Dona de hasta 3 partes, cada una con su nombre y su porcentaje al lado. */
export function Dona({ partes }: { partes: { etiqueta: string; valor: number; detalle?: string }[] }) {
  const total = partes.reduce((s, p) => s + Math.max(0, p.valor), 0)
  if (total <= 0) return <p className="nota">Sin datos en este periodo.</p>

  const r = 60, grosor = 26, c = 2 * Math.PI * r
  let acumulado = 0

  return (
    <>
      <div className="dona-reporte">
        <svg viewBox="0 0 160 160" className="grafico-dona" role="img" aria-label="Por tipo de comprobante">
          <g transform="rotate(-90 80 80)">
            {partes.map((p, i) => {
              const parte = Math.max(0, p.valor) / total
              const trazo = (
                <circle key={i} cx={80} cy={80} r={r} fill="none" strokeWidth={grosor}
                        className={`serie-${i + 1}-trazo`}
                        strokeDasharray={`${Math.max(0, parte * c - 2)} ${c}`}
                        strokeDashoffset={-acumulado * c}>
                  <title>{`${p.etiqueta}: ${(parte * 100).toFixed(0)} %`}</title>
                </circle>
              )
              acumulado += parte
              return trazo
            })}
          </g>
        </svg>
        <ul className="leyenda-dona">
          {partes.map((p, i) => (
            <li key={i}>
              <span className={`muestra serie-${i + 1}-fondo`} aria-hidden="true" />
              {p.etiqueta} <strong>{((Math.max(0, p.valor) / total) * 100).toFixed(0)} %</strong>
              {p.detalle && <small> · {p.detalle}</small>}
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}