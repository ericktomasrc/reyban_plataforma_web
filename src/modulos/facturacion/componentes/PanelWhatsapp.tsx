import { useEffect, useRef, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fechaYHora } from '../../../nucleo/formato/fechas'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { whatsappServicio } from '../servicios/facturacionServicio'
import type { MensajeWhatsapp } from '../servicios/facturacionServicio'
import type { DocumentoCompleto } from '../tipos'

/** «51987654321» → «+51 987 654 321». */
export function whatsappLegible(numero: string | null | undefined) {
  if (!numero) return ''
  return numero.length === 11 && numero.startsWith('51')
    ? `+51 ${numero.slice(2, 5)} ${numero.slice(5, 8)} ${numero.slice(8)}`
    : `+${numero}`
}

/**
 * 043 — EL COMPROBANTE POR WHATSAPP, desde su detalle (maqueta del 22 oct).
 *
 * SEMIAUTOMÁTICO: se pide al back el mensaje (con un enlace al portal que abre
 * solo este comprobante) y se abre WhatsApp con el número y el texto listos.
 * La persona pulsa Enviar en WhatsApp y, al volver, dice cómo salió. Desde
 * aquí no se puede saber si el número tiene WhatsApp: lo dice WhatsApp.
 *
 * `autoAbrir`: recién emitido y marcado «por WhatsApp», se intenta abrir solo.
 * El navegador puede bloquearlo (no viene de un clic): entonces queda el botón.
 */
export function PanelWhatsapp({ d, autoAbrir, onCambio }: {
  d: DocumentoCompleto
  autoAbrir: boolean
  onCambio: () => Promise<void> | void
}) {
  const mensaje = useMensaje()
  const w = d.whatsapp
  const [preparado, setPreparado] = useState<MensajeWhatsapp>()
  const [preguntar, setPreguntar] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string>()
  const [dialogo, setDialogo] = useState(false)
  const [numero, setNumero] = useState('')
  const intentado = useRef(false)

  // e181: el enlace es largo y sin espacios: escrito en la tarjeta la estiraba. Se copia con un toque.
  async function copiar(enlace: string) {
    try { await navigator.clipboard.writeText(enlace); mensaje.bien('Enlace copiado.') }
    catch { mensaje.error('No se pudo copiar. Ábrelo y cópialo desde WhatsApp.') }
  }

  const emitido = !!d.comprobanteId && !['borrador', 'error', 'rechazado'].includes(d.estado)
  const numeroCliente = w?.numero ?? d.cliente?.whatsapp ?? null

  async function abrir(otroNumero?: string) {
    setOcupado(true); setFallo(undefined)
    try {
      const r = await whatsappServicio.preparar(d.id, otroNumero)
      setPreparado(r)
      setDialogo(false)
      // Si el navegador lo bloquea (no vino de un clic), queda el enlace para
      // pulsarlo: un <a> pulsado a mano siempre abre.
      const ventana = window.open(r.abrir, '_blank')
      if (ventana) {
        ventana.opener = null
        setPreguntar(true)
      }
      await onCambio()
    } catch (e) {
      setFallo(e instanceof ErrorApi ? e.message : 'No se pudo preparar el mensaje de WhatsApp.')
    } finally {
      setOcupado(false)
    }
  }

  // Recién emitido: se intenta abrir solo, una vez.
  useEffect(() => {
    if (!autoAbrir || intentado.current || !emitido || w?.estado !== 'pendiente' || !numeroCliente) return
    intentado.current = true
    void abrir()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAbrir, emitido, w?.estado])

  async function anotar(resultado: 'enviado' | 'sin_whatsapp' | 'no_enviado') {
    setOcupado(true)
    try {
      const r = await whatsappServicio.resultado(d.id, resultado)
      setPreguntar(false)
      if (resultado === 'sin_whatsapp') mensaje.error(r.mensaje)
      else mensaje.bien(r.mensaje)
      await onCambio()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo anotar.')
    } finally {
      setOcupado(false)
    }
  }

  function otro() {
    setNumero(whatsappLegible(numeroCliente))
    setFallo(undefined)
    setDialogo(true)
  }

  if (!emitido) return null

  const destino = whatsappLegible(preparado?.numero ?? numeroCliente)

  return (
    <div className={w?.estado === 'pendiente' || preguntar ? 'bloque caja-whatsapp' : 'bloque'}>
      <h2 className="subtitulo">WhatsApp</h2>

      {preguntar ? (
        <>
          <p><strong>¿Se envió?</strong> Se abrió WhatsApp con el mensaje para {destino}.</p>
          <div className="acciones-linea">
            <Boton onClick={() => void anotar('enviado')} disabled={ocupado}>Sí, se envió</Boton>
            <Boton estilo="secundario" onClick={() => void anotar('sin_whatsapp')} disabled={ocupado}>
              No: ese número no tiene WhatsApp
            </Boton>
            <Boton estilo="plano" onClick={() => setPreguntar(false)} disabled={ocupado}>Todavía no</Boton>
          </div>
          {preparado && (
            <p className="nota">
              ¿No se abrió? <a href={preparado.abrir} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>
              {' '}o <button type="button" className="enlace" onClick={() => void copiar(preparado.enlace)}>copia el enlace del comprobante</button> y pégalo donde quieras.
            </p>
          )}
        </>
      ) : w?.estado === 'pendiente' ? (
        <>
          <p><strong>Falta un toque:</strong> mandarlo por WhatsApp a {destino || 'su número'}.</p>
          <div className="acciones-linea">
            {preparado ? (
              <a className="boton" href={preparado.abrir} target="_blank" rel="noopener noreferrer"
                 onClick={() => setPreguntar(true)}>Abrir WhatsApp</a>
            ) : (
              <Boton onClick={() => void (numeroCliente ? abrir() : otro())} ocupado={ocupado} textoOcupado="Preparando…">
                Abrir WhatsApp
              </Boton>
            )}
            <Boton estilo="secundario" onClick={otro} disabled={ocupado}>Otro número</Boton>
            <Boton estilo="plano" onClick={() => void anotar('no_enviado')} disabled={ocupado}>No enviarlo</Boton>
          </div>
        </>
      ) : w?.estado === 'enviado' ? (
        <>
          <p className="secundario">
            Enviado a {whatsappLegible(w.numero)}{w.en && <> el {fechaYHora(w.en)}</>}.
          </p>
          <div className="acciones-linea">
            <Boton estilo="secundario" onClick={() => void abrir()} ocupado={ocupado} textoOcupado="Preparando…">
              Volver a enviar
            </Boton>
            <Boton estilo="plano" onClick={otro} disabled={ocupado}>A otro número</Boton>
          </div>
        </>
      ) : w?.estado === 'sin_whatsapp' ? (
        <>
          <Aviso tono="ojo">El {whatsappLegible(w.numero)} no tiene WhatsApp. Se mandó solo por correo.</Aviso>
          <div className="acciones-linea">
            <Boton estilo="secundario" onClick={otro} disabled={ocupado}>Enviar a otro número</Boton>
          </div>
        </>
      ) : (
        <div className="acciones-linea">
          <Boton estilo="secundario" onClick={() => void (numeroCliente ? abrir() : otro())}
                 ocupado={ocupado} textoOcupado="Preparando…">
            Enviar por WhatsApp
          </Boton>
          {numeroCliente && <Boton estilo="plano" onClick={otro} disabled={ocupado}>A otro número</Boton>}
          <span className="secundario">
            {w?.estado === 'no_enviado' ? 'No se envió por WhatsApp.'
              : numeroCliente ? `A ${whatsappLegible(numeroCliente)}.` : 'El cliente no tiene WhatsApp guardado.'}
          </span>
        </div>
      )}

      {preparado && !preguntar && w?.estado !== 'pendiente' && (
        <p className="nota">
          ¿No se abrió WhatsApp?{' '}
          <a href={preparado.abrir} target="_blank" rel="noopener noreferrer" onClick={() => setPreguntar(true)}>Ábrelo aquí</a>.
        </p>
      )}
      {fallo && !dialogo && <Aviso>{fallo}</Aviso>}

      <Dialogo titulo="Enviar por WhatsApp" abierto={dialogo} onCerrar={() => setDialogo(false)}
               acciones={<>
                 <Boton estilo="secundario" onClick={() => setDialogo(false)} disabled={ocupado}>Cancelar</Boton>
                 <Boton onClick={() => void abrir(numero)} ocupado={ocupado} textoOcupado="Preparando…"
                        disabled={numero.replace(/\D/g, '').length < 8}>Abrir WhatsApp</Boton>
               </>}>
        <label className="campo">
          <span className="etiqueta">Celular del cliente</span>
          <input value={numero} inputMode="tel" placeholder="987 654 321" autoFocus
                 onChange={e => setNumero(e.target.value.replace(/[^\d +()-]/g, ''))} />
          <span className="pista">Se guarda en el cliente para la próxima. Sin código de país, se entiende Perú (+51).</span>
        </label>
        <p className="nota">
          Se abre WhatsApp con el mensaje y un enlace al comprobante (vale 30 días). WhatsApp no deja adjuntar
          archivos desde una página: el cliente baja el PDF del enlace.
        </p>
        {fallo && <Aviso>{fallo}</Aviso>}
      </Dialogo>
    </div>
  )
}