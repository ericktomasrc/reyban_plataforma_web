import { useCallback, useEffect, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha, fechaYHora } from '../../../nucleo/formato/fechas'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { soles } from '../../../nucleo/planes/planes'
import { EVENTO_RECLAMOS, reclamosAdminServicio, type HojaAdmin } from '../servicios/reclamosAdminServicio'

/**
 * 078 — EL LIBRO DE RECLAMACIONES, del lado de la plataforma.
 *
 * Las hojas las llena el cliente en la página pública (/libro-reclamaciones).
 * Aquí se ven, con cuántos días hábiles quedan para responder, y se responden:
 * la respuesta se guarda y le llega por correo. Una hoja no se edita ni se
 * borra, y se responde una sola vez.
 */
export function ReclamosPagina() {
  const mensaje = useMensaje()
  const [lista, setLista] = useState<HojaAdmin[]>()
  const [error, setError] = useState<string>()
  const [abierta, setAbierta] = useState<HojaAdmin>()
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(async () => {
    try { setLista(await reclamosAdminServicio.lista()); setError(undefined) }
    catch (e) { setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar el Libro de Reclamaciones.') }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  async function responder() {
    if (!abierta) return
    setOcupado(true)
    try {
      mensaje.bien((await reclamosAdminServicio.responder(abierta.id, texto)).mensaje)
      window.dispatchEvent(new Event(EVENTO_RECLAMOS))   // e233
      setAbierta(undefined); setTexto('')
      await cargar()
    } catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo guardar la respuesta.') }
    finally { setOcupado(false) }
  }

  if (error) return <Aviso>{error}</Aviso>
  if (!lista) return <Cargando />
  const pendientes = lista.filter(h => h.estado === 'pendiente')

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">Libro de Reclamaciones</h1>
          <p className="secundario">Las hojas que tus clientes registran en la página pública. Tienes <strong>15 días hábiles</strong> para responder cada una; la respuesta le llega por correo.</p>
        </div>
        <a className="boton secundario" href="/libro-reclamaciones" target="_blank" rel="noreferrer">Ver el formulario público</a>
      </div>

      {pendientes.some(h => (h.diasQuedan ?? 99) <= 3) && (
        <Aviso tono="ojo">Hay hojas por vencer: respóndelas antes de la fecha límite (Indecopi puede multar por no responder a tiempo).</Aviso>
      )}

      <div className="resumen-planes">
        <div><strong>{pendientes.length}</strong><span>Por responder</span></div>
        <div><strong>{lista.length - pendientes.length}</strong><span>Respondidas</span></div>
        <div><strong>{lista.length}</strong><span>Hojas en total</span></div>
      </div>

      {lista.length === 0 ? <p className="secundario">Todavía no hay hojas. Cuando un cliente registre un reclamo o una queja, aparecerá aquí y te llegará un correo.</p> : (
        <div className="tabla-desliza">
          <table className="tabla compacta">
            <thead><tr><th>Hoja</th><th>Cliente</th><th>Tipo</th><th>Detalle</th><th>Plazo</th><th>Estado</th><th /></tr></thead>
            <tbody>{lista.map(h => (
              <tr key={h.id}>
                <td><strong>{h.hoja}</strong><div className="secundario">{fecha(h.fecha)}</div></td>
                <td>{h.nombre}<div className="secundario">{h.docTipo} {h.docNumero} · {h.correo}</div></td>
                <td>{h.tipo === 'queja' ? 'Queja' : 'Reclamo'}<div className="secundario">{h.bien}{h.monto !== null ? ` · ${soles(h.monto)}` : ''}</div></td>
                <td className="celda-texto">{h.detalle.length > 90 ? h.detalle.slice(0, 90) + '…' : h.detalle}</td>
                <td>{fecha(h.vence)}{h.estado === 'pendiente' && h.diasQuedan !== null && (
                  <div className={h.diasQuedan <= 3 ? 'texto-peligro' : 'secundario'}>{h.diasQuedan < 0 ? `vencida hace ${-h.diasQuedan} días` : `quedan ${h.diasQuedan} días`}</div>)}</td>
                <td><span className={'etiqueta ' + (h.estado === 'pendiente' ? 'aviso' : 'acento')}>{h.estado === 'pendiente' ? 'Por responder' : 'Respondida'}</span></td>
                <td><Boton estilo={h.estado === 'pendiente' ? 'principal' : 'secundario'} onClick={() => { setAbierta(h); setTexto('') }}>
                  {h.estado === 'pendiente' ? 'Responder' : 'Ver'}</Boton></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {abierta && (
        <Dialogo titulo={`Hoja N.° ${abierta.hoja}`} abierto ancho="grande" onCerrar={() => setAbierta(undefined)}
                 acciones={abierta.estado === 'pendiente'
                   ? <><Boton estilo="secundario" onClick={() => setAbierta(undefined)}>Cancelar</Boton>
                       <Boton ocupado={ocupado} onClick={() => void responder()}>Guardar y enviar la respuesta</Boton></>
                   : <Boton onClick={() => setAbierta(undefined)}>Cerrar</Boton>}>
          <dl className="ficha-hoja">
            <dt>Registrada</dt><dd>{fechaYHora(abierta.fecha)} · responder hasta el <strong>{fecha(abierta.vence)}</strong></dd>
            <dt>Tipo</dt><dd>{abierta.tipo === 'queja' ? 'Queja' : 'Reclamo'} · {abierta.bien === 'producto' ? 'Producto' : 'Servicio'}: {abierta.descripcion}{abierta.monto !== null ? ` · ${soles(abierta.monto)}` : ''}</dd>
            <dt>Cliente</dt><dd>{abierta.nombre} · {abierta.docTipo} {abierta.docNumero}{abierta.apoderado ? ` · apoderado: ${abierta.apoderado}` : ''}</dd>
            <dt>Contacto</dt><dd>{abierta.correo} · {abierta.telefono} · {abierta.domicilio}</dd>
            <dt>Detalle</dt><dd className="texto-largo">{abierta.detalle}</dd>
            <dt>Pedido</dt><dd className="texto-largo">{abierta.pedido}</dd>
            {abierta.estado === 'respondido' && <><dt>Respuesta</dt><dd className="texto-largo">{abierta.respuesta}<div className="secundario">Enviada el {fechaYHora(abierta.respondidoEn)}</div></dd></>}
          </dl>
          {abierta.estado === 'pendiente' && (
            <label className="campo">
              <span>Tu respuesta (le llega a {abierta.correo})</span>
              <textarea rows={6} maxLength={4000} value={texto} onChange={e => setTexto(e.target.value)}
                        placeholder="Explica qué revisaste y qué solución le das. Se responde una sola vez." />
            </label>
          )}
        </Dialogo>
      )}
    </>
  )
}