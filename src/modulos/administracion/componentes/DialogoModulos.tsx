import { useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { credencialesServicio } from '../../facturacion/servicios/facturacionServicio'
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
 *
 * FACTURACIÓN SOLO SE ACTIVA SI EL EMISOR ESTÁ LISTO (parte C): el back le
 * pregunta al servicio en el momento —certificado, usuario SOL, una serie y la
 * dirección revisada— y, si falta algo, dice que no. Aquí se enseña qué falta,
 * leído de la ventana de Facturación. Se exige AL ACTIVAR: si ya estaba
 * activo, no se le quita por esto.
 */
const FACTURACION = 'facturacion'

export function DialogoModulos({ empresa, modulos, onCerrar, onCambiado }: Props) {
  const [activos, setActivos] = useState<string[]>(empresa.modulos)
  const [trabajando, setTrabajando] = useState<string>()
  const mensaje = useMensaje()

  // Por qué no se pudo activar Facturación, con la lista de lo que falta.
  const [noLista, setNoLista] = useState<{ error: string; faltan: string[] }>()

  async function alternar(codigo: string, activar: boolean) {
    setTrabajando(codigo)
    setNoLista(undefined)

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
      const texto = e instanceof ErrorApi ? e.message : 'No se pudo cambiar el módulo.'

      if (activar && codigo === FACTURACION) {
        // El back ya guardó lo que acaba de decir el servicio: se lee de ahí
        // la lista de lo que falta, para no dejar solo un «no».
        let faltan: string[] = []
        try {
          faltan = (await credencialesServicio.ver(empresa.id)).emisor?.listo?.faltan ?? []
        } catch { /* basta con el mensaje */ }
        setNoLista({ error: texto, faltan })
      } else {
        mensaje.error(texto)
      }
    } finally {
      setTrabajando(undefined)
    }
  }

  return (
    <Dialogo
      titulo={`Módulos de ${empresa.nombre}`}
      abierto
      onCerrar={onCerrar}
      acciones={<Boton onClick={onCerrar}>Cerrar</Boton>}
    >
      {noLista && (
        <Aviso tono="ojo">
          <strong>{noLista.error}</strong>
          {noLista.faltan.length > 0 && (
            <ul>{noLista.faltan.map(f => <li key={f}>{f}</li>)}</ul>
          )}
          <div>Se carga en el panel del servicio. Después vuelve a marcar la casilla.</div>
        </Aviso>
      )}

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
                {m.codigo === FACTURACION && !activos.includes(FACTURACION) && (
                  <em>
                    {empresa.facturacion?.listoParaEmitir === true
                      ? 'El emisor está listo: se puede activar.'
                      : 'Solo se activa si el emisor tiene certificado, usuario SOL, al menos una serie y la dirección revisada. Se comprueba con el servicio al marcarla.'}
                  </em>
                )}
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