import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Boton } from '../../../componentes/Boton'
import { Permisos } from '../../../nucleo/autorizacion/permisos'
import { fecha } from '../../../nucleo/formato/fechas'
import { useSesion } from '../../../nucleo/sesion/SesionContexto'
import { guiasServicio, nombreUnidad, type Despacho } from '../servicios/guiasServicio'
import { EstadoGuia } from './EstadoGuia'

/**
 * 050 — En una factura o boleta: «Hacer guía de remisión» y sus guías, con lo
 * que queda por despachar (despacho en partes). Se puede hacer guía de una
 * aceptada o en camino; de una rechazada o anulada, no.
 */
export function GuiasDelComprobante({ documentoId, tipo, estado }: { documentoId: string; tipo: string; estado: string }) {
  const navegar = useNavigate()
  const { puede } = useSesion()
  const [d, setD] = useState<Despacho>()
  const aplica = (tipo === '01' || tipo === '03') && ['encolado', 'aceptado', 'observado', 'anulado'].includes(estado) && puede(Permisos.Guias.Ver)

  useEffect(() => {
    if (!aplica) return
    let vivo = true
    guiasServicio.desde(documentoId).then(x => { if (vivo) setD(x) }).catch(() => { /* sin guías: no se enseña */ })
    return () => { vivo = false }
  }, [documentoId, aplica, estado])

  if (!aplica || !d) return null
  const puedeHacer = d.puede && puede(Permisos.Guias.Emitir)
  if (d.guias.length === 0 && !puedeHacer) return null

  const faltan = d.lineas.filter(l => !l.esServicio && l.pendiente > 0)

  return (
    <div className="bloque">
      <div className="cabecera-bloque">
        <h2 className="subtitulo">Guías de {tipo === '03' ? 'esta boleta' : 'esta factura'}</h2>
        {puedeHacer && <Boton onClick={() => navegar(`/guias/nueva?desde=${documentoId}`)}>Hacer guía de remisión</Boton>}
      </div>
      {d.guias.length === 0 ? (
        <p className="secundario">Todavía no tiene guía. Si los bienes se trasladan, la guía se emite antes de que salga el vehículo.</p>
      ) : (
        <ul className="lista-guias">
          {d.guias.map(g => (
            <li key={g.id}>
              <span>
                <Link className="mono" to={`/guias/${g.id}`}>{g.numero}</Link>
                {' · '}{fecha(g.fechaTraslado)}
                {g.bienes.length > 0 && <> · {g.bienes.map(b => `${b.cantidad} ${nombreUnidad(b.unidad).toLowerCase()}`).join(', ')}</>}
                {g.placa && <> · <span className="mono">{g.placa}</span></>}
              </span>
              <EstadoGuia estado={g.estado} />
            </li>
          ))}
        </ul>
      )}
      {d.guias.length > 0 && (
        <p className="secundario">
          {d.todoDespachado
            ? 'Ya se despachó todo.'
            : <>Quedan por despachar: {faltan.map(l => `${l.pendiente} de «${l.descripcion}»`).join(', ')}.{puedeHacer && ' «Hacer guía de remisión» trae solo lo que falta.'}</>}
        </p>
      )}
    </div>
  )
}