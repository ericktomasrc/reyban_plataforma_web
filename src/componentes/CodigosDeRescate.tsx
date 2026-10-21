import { useState } from 'react'
import { Boton } from './Boton'

/**
 * Los ocho códigos de recuperación, que se ven una sola vez.
 *
 * NO SE PUEDEN VOLVER A CONSULTAR: de la base solo sale su hash. Por eso esta
 * pantalla no tiene forma de seguir sin marcar la casilla — es el único
 * momento en que existen, y quien los cierre sin guardarlos se queda sin
 * salida el día que pierda el teléfono.
 */
export function CodigosDeRescate({ codigos, onSeguir }: {
  codigos: string[]
  onSeguir: () => void
}) {
  const [guardados, setGuardados] = useState(false)
  const [copiado, setCopiado]     = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigos.join('\n'))
      setCopiado(true)
    } catch {
      setCopiado(false)
    }
  }

  function descargar() {
    // Un archivo de texto es lo más fácil de guardar para quien no usa gestor
    // de contraseñas: acaba en Descargas y de ahí a donde quiera.
    const blob = new Blob(
      [
        'Códigos de recuperación — Reyban Plataforma\n',
        'Cada uno sirve UNA vez, si pierdes el teléfono.\n\n',
        codigos.join('\n'),
        '\n',
      ],
      { type: 'text/plain;charset=utf-8' },
    )

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'codigos-de-recuperacion.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="aviso ojo" role="alert">
        Guarda estos códigos ahora. Son tu única salida si pierdes el teléfono,
        y <strong>no se pueden volver a consultar</strong>.
      </div>

      {/* 039: si roban el teléfono y la laptop juntos, los códigos tienen que
          estar en otro sitio. */}
      <p className="nota">
        Guárdalos <strong>lejos del teléfono y de tu laptop</strong>: impresos en casa, o en un gestor de
        contraseñas. Si un día pierdes las dos cosas, sin ellos tendrás que esperar entre 1 y 7 días.
      </p>

      <ul className="codigos-rescate">
        {codigos.map(c => <li key={c}>{c}</li>)}
      </ul>

      <div className="botonera">
        <Boton estilo="secundario" onClick={() => void copiar()}>
          {copiado ? 'Copiados' : 'Copiar'}
        </Boton>
        <Boton estilo="secundario" onClick={descargar}>Descargar</Boton>
      </div>

      <label className="casilla confirmar">
        <input
          type="checkbox"
          checked={guardados}
          onChange={e => setGuardados(e.target.checked)}
        />
        <span>Ya los guardé en un sitio seguro</span>
      </label>

      <Boton ancho disabled={!guardados} onClick={onSeguir}>
        Continuar
      </Boton>
    </>
  )
}
