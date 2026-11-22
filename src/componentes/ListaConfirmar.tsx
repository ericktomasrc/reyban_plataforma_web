/**
 * LO QUE SE VA A GUARDAR, EN LA VENTANA DE CONFIRMACIÓN (e276).
 *
 * Una lista corta «nombre … valor» para que la persona lea lo que va a pasar
 * antes de decir que sí: «MASA DE PAN … 150», «Fondo … S/ 100.00». Si son
 * muchos, se muestran los primeros y «y N más».
 */
export function ListaConfirmar({ filas, max = 8 }: { filas: { nombre: string; valor: string; fuerte?: boolean }[]; max?: number }) {
  const vistas = filas.slice(0, max)
  return (
    <ul className="conf-lista">
      {vistas.map((f, i) => (
        <li key={i} className={f.fuerte ? 'fuerte' : undefined}><span>{f.nombre}</span><strong>{f.valor}</strong></li>
      ))}
      {filas.length > max && <li className="mas"><span>y {filas.length - max} más</span></li>}
    </ul>
  )
}