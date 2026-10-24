import { useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { SelectorUbigeo } from '../../../nucleo/ubigeo/SelectorUbigeo'
import { guiasServicio, type TipoEventoGuia } from '../servicios/guiasServicio'

/**
 * 051 — «Registrar evento hecho en SOL».
 *
 * La GRE POR EVENTO (no se pudo llegar, o la carga pasó a otro vehículo) SOLO
 * SE EMITE EN SOL: SUNAT no la recibe desde sistemas propios. Aquí se anota la
 * que se hizo allá, para que la guía cuente lo que pasó; el vehículo y el
 * conductor nuevos quedan en el transporte guardado.
 */
export function RegistrarEvento({ guiaId, numero, abierto, onCerrar, onHecho }: {
  guiaId: string
  numero: string | null
  abierto: boolean
  onCerrar: () => void
  onHecho: (mensaje: string) => void
}) {
  const [tipo, setTipo] = useState<TipoEventoGuia>('transbordo')
  const [numeroSol, setNumeroSol] = useState('')
  const [fecha, setFecha] = useState('')
  const [reinicioDir, setReinicioDir] = useState('')
  const [reinicioUbigeo, setReinicioUbigeo] = useState('')
  const [llegadaDir, setLlegadaDir] = useState('')
  const [llegadaUbigeo, setLlegadaUbigeo] = useState('')
  const [placa, setPlaca] = useState('')
  const [docConductor, setDocConductor] = useState('')
  const [nombres, setNombres] = useState('')
  const [apellidos, setApellidos] = useState('')
  const [licencia, setLicencia] = useState('')
  const [observacion, setObservacion] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string>()

  const conVehiculo = tipo !== 'arribo'
  const conLlegada = tipo !== 'transbordo'

  async function registrar() {
    setOcupado(true); setFallo(undefined)
    try {
      const r = await guiasServicio.registrarEvento(guiaId, {
        tipo, numeroSol, fecha: fecha || null,
        reinicio: { direccion: reinicioDir, ubigeo: reinicioUbigeo },
        llegada: conLlegada ? { direccion: llegadaDir, ubigeo: llegadaUbigeo } : null,
        placa: conVehiculo ? placa : null,
        conductor: conVehiculo
          ? { tipoDocumento: '1', numeroDocumento: docConductor.trim(), nombres, apellidos, licencia: licencia.toUpperCase() }
          : null,
        observacion: observacion.trim() || null,
      })
      onHecho(r.mensaje)
    } catch (e) {
      setFallo(e instanceof ErrorApi ? e.message : 'No se pudo registrar el evento.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Dialogo titulo="Registrar evento hecho en SOL" abierto={abierto} onCerrar={onCerrar}
      acciones={<>
        <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={() => void registrar()} ocupado={ocupado} disabled={!numeroSol.trim()}>Registrar evento</Boton>
      </>}>
      <p>
        Primero emite la <strong>GRE por evento</strong> en SOL (Clave SOL › Guía de remisión electrónica › Emisión de GRE por evento),
        relacionada con la guía <span className="mono">{numero ?? ''}</span>, antes de reiniciar el traslado. Aquí solo queda anotada.
      </p>
      <p className="nota se-aplica">Se aplica: SUNAT recibe la GRE por evento solo en SOL; los sistemas propios emiten la del remitente y la del transportista.</p>

      <div className="campo">
        <label htmlFor="ev-tipo">¿Qué pasó?</label>
        <select id="ev-tipo" value={tipo} onChange={e => setTipo(e.target.value as TipoEventoGuia)}>
          <option value="transbordo">Transbordo: la carga pasó a otro vehículo</option>
          <option value="arribo">No se pudo llegar o entregar: va a otro punto</option>
          <option value="ambos">Las dos cosas</option>
        </select>
      </div>
      <div className="pareja">
        <div className="campo">
          <label htmlFor="ev-numero">Número de la GRE por evento (SOL)</label>
          <input id="ev-numero" className="mono" value={numeroSol} maxLength={14} placeholder="EG01-12"
                 onChange={e => setNumeroSol(e.target.value.toUpperCase())} />
        </div>
        <div className="campo">
          <label htmlFor="ev-fecha">Fecha</label>
          <input id="ev-fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          <span className="pista">Si la dejas vacía, hoy.</span>
        </div>
      </div>

      <h3 className="rotulo">Dónde se reinicia el traslado</h3>
      <div className="campo">
        <label htmlFor="ev-reinicio">Dirección</label>
        <input id="ev-reinicio" value={reinicioDir} maxLength={200} onChange={e => setReinicioDir(e.target.value)} placeholder="Ej.: Km 40 Panamericana Norte" />
      </div>
      <SelectorUbigeo ubigeo={reinicioUbigeo} onCambio={u => setReinicioUbigeo(u.ubigeo)} />

      {conLlegada && (
        <>
          <h3 className="rotulo">Nueva llegada (mismo destinatario)</h3>
          <div className="campo">
            <label htmlFor="ev-llegada">Dirección</label>
            <input id="ev-llegada" value={llegadaDir} maxLength={200} onChange={e => setLlegadaDir(e.target.value)} />
          </div>
          <SelectorUbigeo ubigeo={llegadaUbigeo} onCambio={u => setLlegadaUbigeo(u.ubigeo)} />
        </>
      )}

      {conVehiculo && (
        <>
          <h3 className="rotulo">Vehículo y conductor nuevos</h3>
          <div className="pareja">
            <div className="campo">
              <label htmlFor="ev-placa">Placa</label>
              <input id="ev-placa" className="mono" value={placa} maxLength={8}
                     onChange={e => setPlaca(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
            </div>
            <div className="campo">
              <label htmlFor="ev-dni">DNI del conductor</label>
              <input id="ev-dni" className="mono" value={docConductor} inputMode="numeric" maxLength={8}
                     onChange={e => setDocConductor(e.target.value.replace(/\D/g, ''))} />
            </div>
          </div>
          <div className="pareja">
            <div className="campo">
              <label htmlFor="ev-nombres">Nombres</label>
              <input id="ev-nombres" value={nombres} onChange={e => setNombres(e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor="ev-apellidos">Apellidos</label>
              <input id="ev-apellidos" value={apellidos} onChange={e => setApellidos(e.target.value)} />
            </div>
          </div>
          <div className="campo">
            <label htmlFor="ev-licencia">Licencia</label>
            <input id="ev-licencia" className="mono" value={licencia} maxLength={10} onChange={e => setLicencia(e.target.value.toUpperCase())} />
          </div>
        </>
      )}

      <div className="campo">
        <label htmlFor="ev-obs">Observación (opcional)</label>
        <input id="ev-obs" value={observacion} maxLength={250} onChange={e => setObservacion(e.target.value)} placeholder="Ej.: falla mecánica en Huacho" />
      </div>
      {fallo && <Aviso>{fallo}</Aviso>}
    </Dialogo>
  )
}