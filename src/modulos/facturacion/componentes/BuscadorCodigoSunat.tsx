import { useEffect, useId, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Boton } from '../../../componentes/Boton'
import { productosServicio } from '../servicios/facturacionServicio'
import type { CodigoSunat } from '../tipos'
import './BuscadorCodigoSunat.css'

interface Props {
  /** El código elegido, o '' si no hay. */
  valor: string
  onCambiar: (codigo: string) => void

  /** La descripción del producto: su primera palabra sirve de atajo para buscar. */
  descripcion: string
}

/** La ficha del código elegido. `null` mientras se pide, `'no-esta'` si SUNAT no lo tiene. */
type Ficha = CodigoSunat | 'no-esta' | null

/**
 * El código de producto SUNAT (catálogo 25), buscado por lo que ES.
 *
 * NADIE SE SABE ESTOS CÓDIGOS, y por eso no se pide escribirlos: se busca
 * «azúcar» y se elige de la lista oficial. Quien ya tiene el código puede
 * escribir los 8 dígitos en la misma casilla y sale ese.
 *
 * Dos estados: buscando (casilla y resultados) o elegido (la ficha del código
 * con «Cambiar» y «Quitar»). Elegido, la casilla no se ve, para que no parezca
 * que falta escribir algo.
 *
 * LA BÚSQUEDA ES DEL BACK: el catálogo tiene 53 mil filas y no viaja entero.
 */
export function BuscadorCodigoSunat({ valor, onCambiar, descripcion }: Props) {
  const id = useId()
  const [q, setQ] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultados, setResultados] = useState<CodigoSunat[] | null>(null)
  const [ficha, setFicha] = useState<Ficha>(null)
  const [error, setError] = useState<string | null>(null)

  // AL EDITAR, el producto trae solo los 8 dígitos: se pide su ficha para
  // enseñar qué es. Si ya la tenemos (se acaba de elegir), no se pide.
  useEffect(() => {
    if (!valor) { setFicha(null); return }
    if (ficha && ficha !== 'no-esta' && ficha.codigo === valor) return

    let vigente = true
    productosServicio.codigosSunat(valor)
      .then(r => { if (vigente) setFicha(r.find(x => x.codigo === valor) ?? 'no-esta') })
      .catch(() => { if (vigente) setFicha({ codigo: valor, descripcion: '', clase: null, claseDescripcion: null }) })
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor])

  // Busca al dejar de escribir. Con menos de 3 letras saldría media lista.
  useEffect(() => {
    const t = q.trim()
    if (t.length < 3) { setResultados(null); setBuscando(false); return }

    let vigente = true
    setBuscando(true)
    const reloj = setTimeout(() => {
      productosServicio.codigosSunat(t)
        .then(r => { if (vigente) { setResultados(r); setError(null) } })
        .catch(() => { if (vigente) setError('No se pudo buscar. Prueba otra vez.') })
        .finally(() => { if (vigente) setBuscando(false) })
    }, 250)

    return () => { vigente = false; clearTimeout(reloj) }
  }, [q])

  function elegir(c: CodigoSunat) {
    setFicha(c)
    onCambiar(c.codigo)
    setQ('')
    setResultados(null)
  }

  // ENTER EN LA CASILLA NO GUARDA EL PRODUCTO. Está dentro del formulario del
  // diálogo, y sin esto un Enter para «buscar» lo enviaría a medio llenar.
  // Si hay resultados, elige el primero, que es lo que la gente espera.
  function tecla(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (resultados && resultados.length > 0) elegir(resultados[0])
  }

  const palabra = descripcion.trim().split(/\s+/)[0] ?? ''
  const atajo = palabra.length >= 3 ? palabra : ''

  // ------------------------------------------------------------ elegido
  if (valor) {
    const noEsta = ficha === 'no-esta'
    const datos = ficha && ficha !== 'no-esta' ? ficha : null

    return (
      <div className="campo codigo-sunat-campo">
        <span className="etiqueta">Código de SUNAT</span>

        <div className={noEsta ? 'codigo-sunat elegido no-esta' : 'codigo-sunat elegido'}>
          <div>
            <span className="mono codigo">{valor}</span>
            <span className="nombre">
              {noEsta ? 'No está en la lista de SUNAT' : datos?.descripcion || '…'}
            </span>
            {datos?.claseDescripcion && (
              <span className="clase">Clase {datos.clase} · {datos.claseDescripcion}</span>
            )}
          </div>

          <div className="botones">
            <Boton estilo="plano" type="button" onClick={() => { onCambiar(''); setQ(atajo) }}>
              Cambiar
            </Boton>
            <Boton estilo="plano" type="button" onClick={() => onCambiar('')}>
              Quitar
            </Boton>
          </div>
        </div>

        {noEsta && (
          <span className="pista mal">
            Este código no existe en la lista de SUNAT, y desde 2027 haría
            rechazar el comprobante. Búscalo de nuevo con «Cambiar».
          </span>
        )}
      </div>
    )
  }

  // ------------------------------------------------------------ buscando
  return (
    <div className="campo codigo-sunat-campo">
      <label htmlFor={id}>Código de SUNAT</label>
      <input
        id={id}
        type="search"
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={tecla}
        placeholder="Busca qué es: azúcar, cemento, flete…"
        autoComplete="off"
      />

      {resultados === null && !error && (
        <span className="pista">
          Opcional. Sale de una lista oficial de SUNAT: escribe qué es y elige.
          {atajo && !q && (
            <>
              {' '}
              <button type="button" className="enlace" onClick={() => setQ(atajo)}>
                Buscar «{atajo}»
              </button>
            </>
          )}
        </span>
      )}

      {error && <span className="pista mal">{error}</span>}

      {resultados !== null && resultados.length > 0 && (
        <>
          <ul className="codigo-sunat resultados" aria-busy={buscando}>
            {resultados.map(c => (
              <li key={c.codigo}>
                <button type="button" onClick={() => elegir(c)}>
                  <span className="mono codigo">{c.codigo}</span>
                  <span className="nombre">{c.descripcion}</span>
                  <span className="clase">
                    {c.clase ? c.claseDescripcion : 'Clase completa: vale para todo lo de este grupo'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <span className="pista">
            Elige el más parecido. Si ninguno encaja exacto, vale la clase
            completa (los que acaban en 00).
          </span>
        </>
      )}

      {resultados !== null && resultados.length === 0 && !buscando && (
        <span className="pista">
          Nada con «{q.trim()}». SUNAT usa nombres genéricos: prueba con otra
          palabra (para «gaseosa», <em>bebida</em>; para «laptop», <em>computador</em>).
        </span>
      )}
    </div>
  )
}