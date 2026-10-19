import { useCallback, useEffect, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { fecha, fechaYHora } from '../../../nucleo/formato/fechas'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { NOMBRE_DOCUMENTO, NOMBRE_RELACION, traspasosServicio } from '../servicios/traspasosServicio'
import type { SolicitudTraspaso } from '../servicios/traspasosServicio'

/**
 * SOLICITUDES DE TRASPASO (lienzo «Fase 4», pantalla 6). Solo el super
 * administrador. A la izquierda la lista; a la derecha, la elegida, con sus
 * documentos y lo que hay que revisar antes de aprobar.
 *
 * Aprobar = la empresa queda en pausa, su correo del titular pasa a ser el de
 * quien reclamó, y le llega el enlace para recuperarla (el mismo de la 4a).
 *
 * FASE 4d: la cuenta que la tiene puede responder (de acuerdo / se opone, con
 * un documento). Sale al lado de los documentos de quien reclama. Y pestañas
 * «Por revisar» / «Todas», para cuando haya muchas.
 */
export function SolicitudesTraspaso() {
  const mensaje = useMensaje()
  const { pedir, dialogo: confirmacion } = useConfirmar()
  const [lista, setLista] = useState<SolicitudTraspaso[] | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [elegida, setElegida] = useState<string | null>(null)
  const [revisado, setRevisado] = useState<Record<string, boolean>>({})
  const [rechazando, setRechazando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [bajando, setBajando] = useState<string | null>(null)
  const [pestana, setPestana] = useState<'por_revisar' | 'todas'>('por_revisar')

  const cargar = useCallback(async () => {
    try {
      const l = await traspasosServicio.lista()
      setLista(l); setFallo(null)
      setElegida(e => e ?? l.find(s => s.estado === 'por_revisar')?.id ?? l[0]?.id ?? null)
    } catch (e) {
      setFallo(e instanceof ErrorApi ? e.message : 'No se pudieron leer las solicitudes.')
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  if (fallo) return <Aviso>{fallo}</Aviso>
  if (!lista) return <Cargando texto="Leyendo las solicitudes…" />

  const porRevisar = lista.filter(x => x.estado === 'por_revisar').length
  const visibles = pestana === 'todas' ? lista : lista.filter(x => x.estado === 'por_revisar')
  const s = visibles.find(x => x.id === elegida) ?? visibles[0] ?? null
  const deQuienReclama = s ? s.documentos.filter(d => d.tipo !== 'respuesta') : []
  const deLaCuenta = s ? s.documentos.filter(d => d.tipo === 'respuesta') : []

  const aprobar = async () => {
    if (!s) return
    const seguro = await pedir({
      titulo: `Aprobar el traspaso de ${s.empresa}`,
      confirmar: 'Aprobar traspaso',
      mensaje: (
        <>
          <p>Pasa a <strong>{s.nombre}</strong>. La empresa queda en pausa y le enviamos el enlace para recuperarla a <strong>{s.correoNuevo}</strong>.</p>
          <p><strong>Nada se borra.</strong></p>
        </>
      ),
    })
    if (!seguro) return
    setOcupado(true)
    try {
      const r = await traspasosServicio.aprobar(s.id)
      mensaje.bien(r.mensaje)
      if (r.enlaceDePrueba) console.info('Enlace de recuperación (solo desarrollo):', r.enlaceDePrueba)
      await cargar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo aprobar.')
    } finally {
      setOcupado(false)
    }
  }

  const bajar = async (id: string) => {
    setBajando(id)
    try {
      await traspasosServicio.descargarDocumento(id)
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo bajar el documento.')
    } finally {
      setBajando(null)
    }
  }

  const checks = s ? [
    `El RUC de la ficha es ${s.ruc}`,
    `El DNI ${s.dni} es de ${s.nombre}`,
    s.ruc.startsWith('20') ? 'La vigencia de poder nombra a esa persona y tiene menos de 30 días' : 'La ficha RUC está a nombre de esa persona',
  ] : []
  const plazoVencido = s ? new Date(s.plazoHasta).getTime() < Date.now() : false

  return (
    <>
      <div className="cabecera-bandeja">
        <div>
          <h1 className="titulo-pagina titulo-serif">Solicitudes de traspaso</h1>
          <p className="bajada-pagina">Reclamos con documentos. Nada se mueve sin tu aprobación.</p>
        </div>
        <div className="segmentado" role="tablist">
          <button type="button" role="tab" aria-selected={pestana === 'por_revisar'}
                  className={pestana === 'por_revisar' ? 'elegido' : undefined}
                  onClick={() => setPestana('por_revisar')}>Por revisar · {porRevisar}</button>
          <button type="button" role="tab" aria-selected={pestana === 'todas'}
                  className={pestana === 'todas' ? 'elegido' : undefined}
                  onClick={() => setPestana('todas')}>Todas · {lista.length}</button>
        </div>
      </div>

      {visibles.length === 0 ? (
        <section className="bloque">
          <Vacio>{lista.length === 0 ? 'Todavía no hay solicitudes.' : 'No hay solicitudes por revisar.'}</Vacio>
        </section>
      ) : (
        <div className="colaboradores">
          <div className="tabla-envoltura">
            <table className="tabla tabla-clic">
              <thead><tr><th>N.º</th><th>Empresa</th><th>Pide</th><th>Estado</th></tr></thead>
              <tbody>
                {visibles.map(x => (
                  <tr key={x.id} className={x.id === s?.id ? 'elegida' : undefined} onClick={() => setElegida(x.id)}>
                    <td className="mono">{String(x.numero).padStart(4, '0')}</td>
                    <td><div className="principal">{x.empresa}</div><div className="secundario mono">{x.ruc}</div></td>
                    <td>{x.nombre}</td>
                    <td><EstadoSolicitud s={x} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {s && (
            <aside className="bloque panel-colaborador">
              <h2>N.º {String(s.numero).padStart(4, '0')} · {s.empresa}</h2>
              <dl className="datos-cortos">
                <div><dt>Pide</dt><dd>{s.nombre} · DNI {s.dni}</dd></div>
                <div><dt>Relación</dt><dd>{NOMBRE_RELACION[s.relacion]}</dd></div>
                <div><dt>Correo nuevo</dt><dd className="cortar">{s.correoNuevo}</dd></div>
                {s.telefono && <div><dt>Teléfono</dt><dd>{s.telefono}</dd></div>}
                <div><dt>Hoy la tiene</dt><dd>{s.cuentaAnterior ?? '—'}{s.pausada && <span className="secundario"> (en pausa)</span>}</dd></div>
                <div><dt>Pedida</dt><dd>{fechaYHora(s.creadoEn)}</dd></div>
              </dl>
              <p className="explicacion-reclamo">«{s.explicacion}»</p>

              <div>
                <strong className="etiqueta-panel">Documentos de quien pide</strong>
                <ul className="lista-documentos">
                  {deQuienReclama.map(d => (
                    <li key={d.id}>
                      <button type="button" className="enlace" disabled={bajando === d.id} onClick={() => void bajar(d.id)}>
                        {bajando === d.id ? 'Bajando…' : NOMBRE_DOCUMENTO[d.tipo]}
                      </button>
                      <span className="secundario"> · {d.nombre} · {Math.ceil(d.tamano / 1024)} KB</span>
                    </li>
                  ))}
                </ul>
              </div>

              <RespuestaDeLaCuenta s={s} documentos={deLaCuenta} bajando={bajando} bajar={bajar} />

              {s.estado === 'por_revisar' ? (
                <>
                  <strong className="etiqueta-panel">Revisa antes de aprobar</strong>
                  {checks.map(c => (
                    <label key={c} className="casilla-terminos">
                      <input type="checkbox" checked={!!revisado[s.id + c]}
                             onChange={e => setRevisado(r => ({ ...r, [s.id + c]: e.target.checked }))} />
                      {c}
                    </label>
                  ))}
                  <div className={'aviso ' + (plazoVencido ? 'bien' : 'ojo')}>
                    {plazoVencido
                      ? <>La cuenta que la tenía tuvo hasta el {fecha(s.plazoHasta)} para responder.</>
                      : <>La cuenta que la tiene puede responder hasta el <strong>{fecha(s.plazoHasta)}</strong>. Puedes aprobar antes si los documentos son claros.</>}
                  </div>
                  <div className="aviso ojo">
                    Al aprobar: la empresa queda en pausa, el correo del titular pasa a ser {s.correoNuevo} y le llega el
                    enlace para recuperarla. <strong>Nada se borra.</strong>
                  </div>
                  <div className="pie-panel">
                    <Boton onClick={() => void aprobar()} ocupado={ocupado} textoOcupado="Aprobando…"
                           disabled={!checks.every(c => revisado[s.id + c])}>
                      Aprobar traspaso
                    </Boton>
                    <Boton estilo="secundario" onClick={() => setRechazando(true)}>Rechazar…</Boton>
                  </div>
                  <span className="nota">Marca las tres casillas para poder aprobar.</span>
                </>
              ) : (
                <div className={'aviso ' + (s.estado === 'aprobada' ? 'bien' : 'error')}>
                  {s.estado === 'aprobada'
                    ? <>Aprobada el {fechaYHora(s.revisadaEn)}. Se envió el enlace a {s.correoNuevo}.</>
                    : <>Rechazada el {fechaYHora(s.revisadaEn)}: «{s.motivoRechazo}»</>}
                </div>
              )}
            </aside>
          )}
        </div>
      )}

      {confirmacion}

      {rechazando && s && (
        <DialogoRechazo solicitud={s} onCerrar={() => setRechazando(false)}
                        onHecho={async () => { setRechazando(false); await cargar() }} />
      )}
    </>
  )
}


function EstadoSolicitud({ s }: { s: SolicitudTraspaso }) {
  if (s.estado === 'aprobada') return <span className="estado-empresa lista">Aprobada</span>
  if (s.estado === 'rechazada') return <span className="estado-empresa rechazos">Rechazada</span>
  if (s.respuesta === 'se_opone') return <span className="estado-empresa rechazos">La cuenta se opone</span>
  if (s.respuesta === 'de_acuerdo') return <span className="estado-empresa lista">La cuenta está de acuerdo</span>
  const dias = Math.ceil((new Date(s.plazoHasta).getTime() - Date.now()) / 86_400_000)
  return <span className="estado-empresa certificado">{dias > 0 ? `Por revisar · ${dias} d de plazo` : 'Por revisar'}</span>
}


/**
 * Lo que respondió la cuenta que tiene la empresa (fase 4d). Si no respondió,
 * se dice: dentro del plazo, que aún puede; pasado, que no lo hizo.
 */
function RespuestaDeLaCuenta({ s, documentos, bajando, bajar }: {
  s: SolicitudTraspaso
  documentos: SolicitudTraspaso['documentos']
  bajando: string | null
  bajar: (id: string) => Promise<void>
}) {
  if (!s.respuesta) {
    if (s.estado !== 'por_revisar') return null
    const vencido = new Date(s.plazoHasta).getTime() < Date.now()
    return (
      <p className="nota">
        {vencido ? 'La cuenta que la tiene no respondió.' : 'La cuenta que la tiene todavía no responde.'}
      </p>
    )
  }

  const deAcuerdo = s.respuesta === 'de_acuerdo'
  return (
    <section className={'respuesta-cuenta ' + (deAcuerdo ? 'de-acuerdo' : 'se-opone')}>
      <strong>Respuesta de la cuenta · {deAcuerdo ? 'Está de acuerdo' : 'No está de acuerdo'}</strong>
      <span className="secundario">{s.respuestaQuien ?? 'La cuenta'} · {fechaYHora(s.respuestaEn)}</span>
      {s.respuestaTexto && <p>«{s.respuestaTexto}»</p>}
      {documentos.map(d => (
        <button key={d.id} type="button" className="enlace" disabled={bajando === d.id} onClick={() => void bajar(d.id)}>
          {bajando === d.id ? 'Bajando…' : d.nombre}
        </button>
      ))}
    </section>
  )
}


function DialogoRechazo({ solicitud, onCerrar, onHecho }: {
  solicitud: SolicitudTraspaso; onCerrar: () => void; onHecho: () => Promise<void>
}) {
  const mensaje = useMensaje()
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const rechazar = async () => {
    setError(null)
    if (motivo.trim().length < 10) { setError('Escribe el motivo (mínimo 10 caracteres): le llega a quien lo pidió.'); return }
    setOcupado(true)
    try {
      mensaje.bien((await traspasosServicio.rechazar(solicitud.id, motivo.trim())).mensaje)
      await onHecho()
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo rechazar.')
      setOcupado(false)
    }
  }

  return (
    <Dialogo titulo={`Rechazar la solicitud de ${solicitud.empresa}`} abierto onCerrar={onCerrar}
             acciones={<>
               <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
               <Boton estilo="peligro" onClick={() => void rechazar()} ocupado={ocupado} textoOcupado="Rechazando…">Rechazar</Boton>
             </>}>
      <div className="campo">
        <label htmlFor="motivo-rechazo">Motivo <span className="detalle-paso">(lo lee {solicitud.nombre})</span></label>
        <textarea id="motivo-rechazo" rows={3} maxLength={500} value={motivo} onChange={e => setMotivo(e.target.value)}
                  placeholder="La vigencia de poder tiene más de 30 días. Envía una actualizada." />
      </div>
      {error && <Aviso>{error}</Aviso>}
    </Dialogo>
  )
}