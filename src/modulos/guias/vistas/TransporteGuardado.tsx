import { useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { useCargar } from '../../../nucleo/hooks/useCargar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import {
  ENTIDADES, guiasServicio,
  type ClaseTransporte, type ConductorGuardado, type PersonaDelPersonal, type Transporte, type TransportistaGuardado, type VehiculoGuardado,
} from '../servicios/guiasServicio'
import '../guias.css'

/**
 * 050 — TRANSPORTE GUARDADO (maestras por empresa).
 *
 * Vehículos, conductores y empresas de transporte. SE GUARDAN SOLOS al emitir
 * una guía; aquí se agregan a mano, se corrigen o se desactivan. Nada se
 * borra: un desactivado deja de salir al emitir y las guías que lo usaron no
 * cambian.
 */
type Edicion =
  | { clase: 'vehiculos'; id?: string; placa: string; descripcion: string; tuc: string; autorizacion: string; entidad: string }
  | { clase: 'conductores'; id?: string; tipoDoc: string; numeroDoc: string; nombres: string; apellidos: string; licencia: string; usuarioId: string | null }
  | { clase: 'transportistas'; id?: string; ruc: string; razonSocial: string; mtc: string }

const NUEVO: Record<ClaseTransporte, Edicion> = {
  vehiculos: { clase: 'vehiculos', placa: '', descripcion: '', tuc: '', autorizacion: '', entidad: '' },
  conductores: { clase: 'conductores', tipoDoc: '1', numeroDoc: '', nombres: '', apellidos: '', licencia: '', usuarioId: null },
  transportistas: { clase: 'transportistas', ruc: '', razonSocial: '', mtc: '' },
}

const TITULOS: Record<ClaseTransporte, string> = { vehiculos: 'vehículo', conductores: 'conductor', transportistas: 'empresa de transporte' }

export function TransporteGuardado() {
  const mensaje = useMensaje()
  const datos = useCargar<Transporte>(() => guiasServicio.transporte())
  const [pestana, setPestana] = useState<ClaseTransporte>('vehiculos')
  const [ver, setVer] = useState<'activos' | 'todos'>('activos')
  const [edicion, setEdicion] = useState<Edicion>()
  const [personal, setPersonal] = useState<PersonaDelPersonal[]>()
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState<string>()

  if (datos.error) return <Aviso>{datos.error}</Aviso>
  if (!datos.datos) return <Cargando />
  const t = datos.datos
  const gestiona = t.puedeGestionar

  function abrir(e: Edicion) {
    setEdicion(e); setFallo(undefined)
    if (e.clase === 'conductores' && !personal)
      guiasServicio.personal().then(setPersonal).catch(() => setPersonal([]))
  }

  async function guardar() {
    if (!edicion) return
    setGuardando(true); setFallo(undefined)
    const { clase, id, ...resto } = edicion
    try {
      const r = await guiasServicio.guardar(clase, resto, id)
      mensaje.bien(r.mensaje); setEdicion(undefined); datos.recargar()
    } catch (e) {
      setFallo(e instanceof ErrorApi ? e.message : 'No se pudo guardar.')
    } finally { setGuardando(false) }
  }

  async function activar(clase: ClaseTransporte, id: string, activo: boolean) {
    try { const r = await guiasServicio.activar(clase, id, activo); mensaje.bien(r.mensaje); datos.recargar() }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo cambiar.') }
  }

  const filtrar = <T extends { activo: boolean }>(xs: T[]) => ver === 'todos' ? xs : xs.filter(x => x.activo)
  const n = (xs: { activo: boolean }[]) => xs.filter(x => x.activo).length

  const acciones = (clase: ClaseTransporte, id: string, activo: boolean, editar: () => void) => gestiona && (
    <td className="acciones">
      {activo && <Boton estilo="plano" onClick={editar}>Corregir</Boton>}
      <Boton estilo="plano" onClick={() => void activar(clase, id, !activo)}>{activo ? 'Desactivar' : 'Reactivar'}</Boton>
    </td>
  )

  const uso = (usos: number, ultimo: string | null) =>
    usos === 0 ? 'sin usar' : `${usos} guía${usos === 1 ? '' : 's'}${ultimo ? ` · última ${fecha(ultimo)}` : ''}`

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">Transporte guardado</h1>
          <p className="secundario">Se guarda solo al emitir una guía. Aquí se corrige o se desactiva (nada se borra).</p>
        </div>
        {gestiona && <Boton onClick={() => abrir(NUEVO[pestana])}>Agregar {TITULOS[pestana]}</Boton>}
      </div>

      <div className="filtros-guias">
        <div className="segmentado" role="tablist">
          <button type="button" className={pestana === 'vehiculos' ? 'elegido' : ''} onClick={() => setPestana('vehiculos')}>Vehículos ({n(t.vehiculos)})</button>
          <button type="button" className={pestana === 'conductores' ? 'elegido' : ''} onClick={() => setPestana('conductores')}>Conductores ({n(t.conductores)})</button>
          <button type="button" className={pestana === 'transportistas' ? 'elegido' : ''} onClick={() => setPestana('transportistas')}>Empresas de transporte ({n(t.transportistas)})</button>
        </div>
        <label className="casilla">
          <input type="checkbox" checked={ver === 'todos'} onChange={e => setVer(e.target.checked ? 'todos' : 'activos')} /> Ver también los desactivados
        </label>
      </div>

      <div className="bloque sin-relleno">
        {pestana === 'vehiculos' && (filtrar(t.vehiculos).length === 0 ? <div className="relleno"><Vacio>Todavía no hay vehículos. Se guardan solos al emitir una guía con tu vehículo.</Vacio></div> : (
          <table className="tabla">
            <thead><tr><th>Placa</th><th>Descripción</th><th>Certificado (TUC)</th><th>Uso</th>{gestiona && <th aria-label="Acciones" />}</tr></thead>
            <tbody>
              {filtrar(t.vehiculos).map((v: VehiculoGuardado) => (
                <tr key={v.id} className={v.activo ? '' : 'inactivo'}>
                  <td className="mono principal">{v.placa}{!v.activo && <span className="etiqueta"> desactivado</span>}</td>
                  <td>{v.descripcion ?? '—'}{v.autorizacion && <div className="secundario">Autorización {ENTIDADES.find(x => x[0] === v.entidad)?.[1]} {v.autorizacion}</div>}</td>
                  <td className="mono">{v.tuc ?? '—'}</td>
                  <td className="secundario">{uso(v.usos, v.ultimoUso)}</td>
                  {acciones('vehiculos', v.id, v.activo, () => abrir({ clase: 'vehiculos', id: v.id, placa: v.placa, descripcion: v.descripcion ?? '', tuc: v.tuc ?? '', autorizacion: v.autorizacion ?? '', entidad: v.entidad ?? '' }))}
                </tr>
              ))}
            </tbody>
          </table>
        ))}

        {pestana === 'conductores' && (filtrar(t.conductores).length === 0 ? <div className="relleno"><Vacio>Todavía no hay conductores. Se guardan solos al emitir; también puedes elegir a alguien de tu personal.</Vacio></div> : (
          <table className="tabla">
            <thead><tr><th>Conductor</th><th>Documento</th><th>Licencia</th><th>Uso</th>{gestiona && <th aria-label="Acciones" />}</tr></thead>
            <tbody>
              {filtrar(t.conductores).map((c: ConductorGuardado) => (
                <tr key={c.id} className={c.activo ? '' : 'inactivo'}>
                  <td className="principal">{c.nombres} {c.apellidos}{c.usuarioId && <span className="etiqueta"> del personal</span>}{!c.activo && <span className="etiqueta"> desactivado</span>}</td>
                  <td className="mono">{c.tipoDoc === '1' ? 'DNI' : 'Doc.'} {c.numeroDoc}</td>
                  <td className="mono">{c.licencia}</td>
                  <td className="secundario">{uso(c.usos, c.ultimoUso)}</td>
                  {acciones('conductores', c.id, c.activo, () => abrir({ clase: 'conductores', id: c.id, tipoDoc: c.tipoDoc, numeroDoc: c.numeroDoc, nombres: c.nombres, apellidos: c.apellidos, licencia: c.licencia, usuarioId: c.usuarioId }))}
                </tr>
              ))}
            </tbody>
          </table>
        ))}

        {pestana === 'transportistas' && (filtrar(t.transportistas).length === 0 ? <div className="relleno"><Vacio>Todavía no hay empresas de transporte. Se guardan solas al emitir una guía con transporte público.</Vacio></div> : (
          <table className="tabla">
            <thead><tr><th>Empresa</th><th>RUC</th><th>Registro MTC</th><th>Uso</th>{gestiona && <th aria-label="Acciones" />}</tr></thead>
            <tbody>
              {filtrar(t.transportistas).map((x: TransportistaGuardado) => (
                <tr key={x.id} className={x.activo ? '' : 'inactivo'}>
                  <td className="principal">{x.razonSocial}{!x.activo && <span className="etiqueta"> desactivada</span>}</td>
                  <td className="mono">{x.ruc}</td>
                  <td className="mono">{x.mtc ?? '—'}</td>
                  <td className="secundario">{uso(x.usos, x.ultimoUso)}</td>
                  {acciones('transportistas', x.id, x.activo, () => abrir({ clase: 'transportistas', id: x.id, ruc: x.ruc, razonSocial: x.razonSocial, mtc: x.mtc ?? '' }))}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>

      {edicion && (
        <Dialogo titulo={`${edicion.id ? 'Corregir' : 'Agregar'} ${TITULOS[edicion.clase]}`} abierto onCerrar={() => setEdicion(undefined)}
          acciones={<>
            <Boton estilo="secundario" onClick={() => setEdicion(undefined)}>Cancelar</Boton>
            <Boton onClick={() => void guardar()} ocupado={guardando}>Guardar</Boton>
          </>}>
          {edicion.clase === 'vehiculos' && (
            <>
              <Campo etiqueta="Placa" obligatorio value={edicion.placa} className="mono" pista="Sin guion. Ej.: ABC123"
                     onChange={e => setEdicion({ ...edicion, placa: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
              <Campo etiqueta="Descripción" value={edicion.descripcion} placeholder="Furgón Hyundai" onChange={e => setEdicion({ ...edicion, descripcion: e.target.value })} />
              <Campo etiqueta="Certificado de habilitación (TUC)" value={edicion.tuc} pista="Obligatorio en la guía del transportista."
                     onChange={e => setEdicion({ ...edicion, tuc: e.target.value.toUpperCase() })} />
              <div className="pareja">
                <div className="campo">
                  <label htmlFor="ent">Autorización especial</label>
                  <select id="ent" value={edicion.entidad} onChange={e => setEdicion({ ...edicion, entidad: e.target.value, autorizacion: e.target.value ? edicion.autorizacion : '' })}>
                    <option value="">No necesita</option>
                    {ENTIDADES.map(([c, nombre]) => <option key={c} value={c}>{nombre}</option>)}
                  </select>
                </div>
                {edicion.entidad && <Campo etiqueta="N.° de autorización" value={edicion.autorizacion} onChange={e => setEdicion({ ...edicion, autorizacion: e.target.value })} />}
              </div>
            </>
          )}
          {edicion.clase === 'conductores' && (
            <>
              {!edicion.id && personal && personal.length > 0 && (
                <div className="campo">
                  <label htmlFor="del-personal">Elegir de tu personal</label>
                  <select id="del-personal" value="" onChange={e => {
                    const u = personal.find(x => x.usuarioId === e.target.value)
                    if (u) setEdicion({ ...edicion, tipoDoc: u.tipoDoc, numeroDoc: u.numeroDoc, nombres: u.nombres, apellidos: u.apellidos, usuarioId: u.usuarioId })
                  }}>
                    <option value="">Escribir a mano…</option>
                    {personal.map(u => <option key={u.usuarioId} value={u.usuarioId}>{u.nombres} {u.apellidos} · {u.numeroDoc}{u.cargo ? ` · ${u.cargo}` : ''}</option>)}
                  </select>
                </div>
              )}
              <div className="pareja">
                <div className="campo">
                  <label htmlFor="tdoc">Documento</label>
                  <select id="tdoc" value={edicion.tipoDoc} onChange={e => setEdicion({ ...edicion, tipoDoc: e.target.value })}>
                    <option value="1">DNI</option><option value="4">Carné de extranjería</option><option value="7">Pasaporte</option>
                  </select>
                </div>
                <Campo etiqueta="Número" obligatorio value={edicion.numeroDoc} onChange={e => setEdicion({ ...edicion, numeroDoc: e.target.value.trim().toUpperCase() })} />
              </div>
              <div className="pareja">
                <Campo etiqueta="Nombres" obligatorio value={edicion.nombres} onChange={e => setEdicion({ ...edicion, nombres: e.target.value })} />
                <Campo etiqueta="Apellidos" obligatorio value={edicion.apellidos} onChange={e => setEdicion({ ...edicion, apellidos: e.target.value })} />
              </div>
              <Campo etiqueta="Licencia de conducir" obligatorio value={edicion.licencia} className="mono" placeholder="Q41025874"
                     onChange={e => setEdicion({ ...edicion, licencia: e.target.value.toUpperCase().replace(/\s/g, '') })} />
            </>
          )}
          {edicion.clase === 'transportistas' && (
            <>
              <Campo etiqueta="RUC" obligatorio value={edicion.ruc} inputMode="numeric" onChange={e => setEdicion({ ...edicion, ruc: e.target.value.replace(/\D/g, '').slice(0, 11) })} />
              <Campo etiqueta="Razón social" obligatorio value={edicion.razonSocial} onChange={e => setEdicion({ ...edicion, razonSocial: e.target.value })} />
              <Campo etiqueta="Registro MTC" value={edicion.mtc} onChange={e => setEdicion({ ...edicion, mtc: e.target.value.toUpperCase() })} />
            </>
          )}
          {fallo && <Aviso>{fallo}</Aviso>}
        </Dialogo>
      )}
    </>
  )
}