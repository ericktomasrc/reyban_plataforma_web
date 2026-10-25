/**
 * e175 — LAS PESTAÑAS DE TODAS LAS PANTALLAS QUE TENÍAN TABLAS UNA SOBRE OTRA
 * (Personal, Mis empresas, la caja del POS, los reportes Resumen · Detalle).
 *
 * Cada pestaña puede llevar su número («Invitaciones 3»): así se ve que hay
 * algo sin tener que entrar. Una pestaña con 0 se puede esconder (`ocultarVacia`).
 */
export interface Pestana<V extends string> {
  valor: V
  texto: string
  cuenta?: number
  /** Si la cuenta es 0, no se muestra la pestaña. */
  ocultarVacia?: boolean
  /** El número en color de aviso (p. ej. invitaciones vencidas). */
  aviso?: boolean
}

export function Pestanas<V extends string>({ opciones, valor, onCambio, etiqueta }: {
  opciones: Pestana<V>[]
  valor: V
  onCambio: (v: V) => void
  /** Para lectores de pantalla: «Personal», «Caja»… */
  etiqueta: string
}) {
  const visibles = opciones.filter(o => !(o.ocultarVacia && !o.cuenta) || o.valor === valor)
  return (
    <div className="segmentado pestanas-tabla" role="tablist" aria-label={etiqueta}>
      {visibles.map(o => (
        <button key={o.valor} type="button" role="tab" aria-selected={valor === o.valor}
                className={valor === o.valor ? 'elegido' : undefined} onClick={() => onCambio(o.valor)}>
          {o.texto}
          {o.cuenta !== undefined && (
            <span className={`pestana-cuenta${o.aviso ? ' aviso' : ''}`}>{o.cuenta.toLocaleString('es-PE')}</span>
          )}
        </button>
      ))}
    </div>
  )
}