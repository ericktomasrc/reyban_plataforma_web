import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { credencialesServicio } from '../../facturacion/servicios/facturacionServicio'
import { empresasServicio } from '../servicios/empresasServicio'
import { NOMBRE_PLAN } from '../../../nucleo/planes/planes'
import type { EmpresaEnLista, ModuloDelCatalogo, PlanesDeEmpresas } from '../tipos'

interface Props {
  empresa: EmpresaEnLista
  modulos: ModuloDelCatalogo[]
  /** e215: con los planes encendidos, los módulos (menos facturación) los da el plan. */
  planes?: PlanesDeEmpresas
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

const ORDEN: Record<string, number> = { basico: 1, pro: 2, max: 3 }

export function DialogoModulos({ empresa, modulos, planes, onCerrar, onCambiado }: Props) {
  const navegar = useNavigate()
  // e215: ¿manda el plan? (encendidos). Entonces solo se mira, menos facturación.
  const info = planes?.encendidos ? planes.empresas[empresa.id] : undefined
  const mandaPlan = !!planes?.encendidos
  const efectivo = info ? (info.accesoTotal ? 'todo' : info.prueba ? 'max' : info.efectivo) : 'todo'
  const nombrePlan = info?.accesoTotal ? 'Acceso total' : info?.prueba ? 'Max (mes gratis)' : NOMBRE_PLAN[efectivo] ?? efectivo
  const loDa = (codigo: string) => {
    const min = planes?.minimos[codigo]
    return efectivo === 'todo' || (!!min && (ORDEN[min] ?? 9) <= (ORDEN[efectivo] ?? 0))
  }
  const ajustar = info?.cuenta ? () => navegar(`/admin/planes?ajustar=${info.cuenta}`) : undefined

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
      acciones={<>
        {mandaPlan && ajustar && <Boton estilo="secundario" onClick={ajustar}>Ajustar su cuenta</Boton>}
        <Boton onClick={onCerrar}>Cerrar</Boton>
      </>}
    >
      {mandaPlan
        ? <div className="etiqueta-plan encendidos">Sus módulos los da su plan: <strong>{nombrePlan}</strong>. Aquí solo se mira (menos la facturación, que sigue a mano).</div>
        : planes && <div className="etiqueta-plan">⚙ Planes <strong>apagados</strong>: los módulos los das tú, a mano.</div>}

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
          {modulos.map(m => {
            // 077: la facturación activa no se quita aquí (es automática; para parar, Suspender).
            const factActiva = m.codigo === FACTURACION && activos.includes(FACTURACION)
            const bloqueada = (mandaPlan && m.codigo !== FACTURACION) || factActiva
            const daPlan = bloqueada && !factActiva && loDa(m.codigo)
            const tiene = activos.includes(m.codigo)
            return (
            <label key={m.codigo} className={'casilla' + (bloqueada ? ' bloqueada' : '')}>
              <input
                type="checkbox"
                checked={factActiva || (bloqueada ? daPlan : tiene)}
                disabled={bloqueada || trabajando === m.codigo}
                onChange={e => void alternar(m.codigo, e.target.checked)}
              />
              <span>
                <strong>{m.nombre}
                  {bloqueada && !factActiva && (daPlan
                    ? <span className="tag-plan si">Lo da {efectivo === 'todo' ? 'el acceso total' : `el ${NOMBRE_PLAN[efectivo]}`}</span>
                    : <span className={'tag-plan ' + (tiene ? 'guardado' : 'no')}>
                        {tiene ? 'Guardado · ' : ''}viene en el {NOMBRE_PLAN[planes?.minimos[m.codigo] ?? ''] ?? 'otro plan'}</span>)}
                </strong>
                {m.descripcion && <em>{m.descripcion}</em>}
                {m.codigo === FACTURACION && !activos.includes(FACTURACION) && (
                  <em>
                    {empresa.facturacion?.listoParaEmitir === true
                      ? 'El emisor está listo: se activa sola cuando la empresa termina «Configurar facturación», o márcala tú.'
                      : 'Se activa sola cuando la empresa termina «Configurar facturación» (certificado, usuario SOL, una serie y la dirección). Si le falta algo, el asistente le dice qué.'}
                  </em>
                )}
                {factActiva && <em>Activa. Se activa y se mantiene sola; para que deje de emitir, usa «Suspender» (le muestra el motivo).</em>}
                {bloqueada && !factActiva && !daPlan && tiene && <em>Sus datos siguen guardados: vuelven a verse si sube de plan.</em>}
              </span>
            </label>
          )})}
        </div>
      )}

      <p className="nota">
        {mandaPlan
          ? <>Para darle algo que su plan no trae, usa <strong>Ajustar su cuenta</strong> (cortesía, meses gratis, precio especial o acceso total, con fecha de fin). Bajar de plan no borra nada.</>
          : <>Quitar un módulo no borra nada: su configuración se guarda por si vuelve a contratarse. Al encender los planes, cada empresa recibe lo que trae su plan.</>}
      </p>
    </Dialogo>
  )
}