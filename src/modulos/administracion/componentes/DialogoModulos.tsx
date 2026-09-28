import { useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { empresasServicio } from '../servicios/empresasServicio'
import type { EmpresaEnLista, ModuloDelCatalogo } from '../tipos'

interface Props {
  empresa: EmpresaEnLista
  modulos: ModuloDelCatalogo[]
  onCerrar: () => void

  /** Para que la lista de atrás se entere del cambio. */
  onCambiado: () => void
}

/**
 * Activar y quitar módulos de una empresa.
 *
 * CADA CASILLA ES UNA LLAMADA, no hay botón de «guardar». Es deliberado: son
 * operaciones independientes, y así una que falle no se lleva por delante a
 * las demás ni deja la pantalla diciendo algo distinto de lo que hay en la
 * base.
 *
 * Quitar un módulo NO borra su fila: la deja inactiva. El día que lo vuelvan a
 * contratar, su configuración sigue ahí — y en la bitácora queda escrito quién
 * lo quitó y cuándo.
 */
export function DialogoModulos({ empresa, modulos, onCerrar, onCambiado }: Props) {
  const [activos, setActivos] = useState<string[]>(empresa.modulos)
  const [trabajando, setTrabajando] = useState<string>()
  const [error, setError] = useState<string>()

  async function alternar(codigo: string, activar: boolean) {
    setError(undefined)
    setTrabajando(codigo)

    // Se pinta primero y se corrige si falla. La alternativa —esperar a la
    // respuesta— hace que la casilla tarde medio segundo en moverse, y la
    // gente la pulsa dos veces.
    setActivos(v => activar ? [...v, codigo] : v.filter(c => c !== codigo))

    try {
      if (activar) await empresasServicio.activarModulo(empresa.id, codigo)
      else         await empresasServicio.quitarModulo(empresa.id, codigo)
      onCambiado()
    } catch (e) {
      setActivos(v => activar ? v.filter(c => c !== codigo) : [...v, codigo])
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cambiar el módulo.')
    } finally {
      setTrabajando(undefined)
    }
  }

  return (
    <Dialogo
      titulo={`Módulos de ${empresa.razonSocial}`}
      abierto
      onCerrar={onCerrar}
      acciones={<Boton onClick={onCerrar}>Cerrar</Boton>}
    >
      {error && <Aviso>{error}</Aviso>}

      {modulos.length === 0 ? (
        <p className="vacio">No hay módulos en el catálogo.</p>
      ) : (
        <div className="casillas">
          {modulos.map(m => (
            <label key={m.codigo} className="casilla">
              <input
                type="checkbox"
                checked={activos.includes(m.codigo)}
                disabled={trabajando === m.codigo}
                onChange={e => void alternar(m.codigo, e.target.checked)}
              />
              <span>
                <strong>{m.nombre}</strong>
                {m.descripcion && <em>{m.descripcion}</em>}
              </span>
            </label>
          ))}
        </div>
      )}

      <p className="nota">
        Quitar un módulo no borra nada: su configuración se guarda por si vuelve
        a contratarse.
      </p>
    </Dialogo>
  )
}
