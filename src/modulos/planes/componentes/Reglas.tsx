import type { ReactNode } from 'react'

/** Un grupo de reglas con su título y explicación (Precios y reglas, Pagos). */
export function GrupoRegla({ titulo, texto, children }: { titulo: string; texto: ReactNode; children: ReactNode }) {
  return (
    <section className="grupo-regla">
      <div className="grupo-regla-cabeza"><h3>{titulo}</h3><p className="secundario">{texto}</p></div>
      <div className="grupo-regla-filas">{children}</div>
    </section>
  )
}

export function FilaRegla({ etiqueta, ayuda, children }: { etiqueta: string; ayuda: ReactNode; children: ReactNode }) {
  return (
    <div className="fila-regla">
      <div><strong>{etiqueta}</strong><span className="pista">{ayuda}</span></div>
      <div className="fila-regla-valor">{children}</div>
    </div>
  )
}