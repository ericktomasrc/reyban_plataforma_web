export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="cargando" role="status" aria-live="polite">
      {texto}
    </div>
  )
}

/** Un bloque vacío con una explicación, en vez de una tabla sin filas. */
export function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="vacio">{children}</p>
}
