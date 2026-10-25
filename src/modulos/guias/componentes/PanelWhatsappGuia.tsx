import { useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { whatsappLegible } from '../../facturacion/componentes/PanelWhatsapp'
import { guiasServicio, type MensajeWhatsappGuia } from '../servicios/guiasServicio'

type Para = 'cliente' | 'conductor'

/**
 * e174 (057) — LA GUÍA POR WHATSAPP, como las facturas: se abre WhatsApp con
 * el mensaje y un enlace al PDF (vale 30 días). Se elige a quién: el cliente
 * (su número guardado) o el conductor (otro número), que es quien la lleva.
 */
export function PanelWhatsappGuia({ guiaId, conductor, clienteWhatsapp }: {
  guiaId: string
  conductor: string | null
  clienteWhatsapp: string | null | undefined
}) {
  const [para, setPara] = useState<Para>()
  const [numero, setNumero] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string>()
  const [preparado, setPreparado] = useState<MensajeWhatsappGuia & { para: Para }>()

  function elegir(p: Para) {
    setPara(p)
    setFallo(undefined)
    setNumero(p === 'cliente' ? whatsappLegible(clienteWhatsapp) : '')
  }

  async function abrir() {
    if (!para) return
    setOcupado(true); setFallo(undefined)
    try {
      const guardado = para === 'cliente' && clienteWhatsapp && numero.replace(/\D/g, '') === clienteWhatsapp
      const r = await guiasServicio.whatsapp(guiaId, para, guardado ? undefined : numero)
      setPreparado({ ...r, para })
      setPara(undefined)
      const ventana = window.open(r.abrir, '_blank')
      if (ventana) ventana.opener = null
    } catch (e) {
      setFallo(e instanceof ErrorApi ? e.message : 'No se pudo preparar el mensaje de WhatsApp.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="bloque vc-tarjeta">
      <h2 className="subtitulo">WhatsApp</h2>
      <div className="vc-botones">
        <Boton estilo="secundario" onClick={() => elegir('conductor')}>Al conductor</Boton>
        <Boton estilo="secundario" onClick={() => elegir('cliente')}>Al cliente</Boton>
      </div>
      {preparado ? (
        <p className="nota">
          Se abrió WhatsApp para {preparado.para === 'conductor' ? 'el conductor' : 'el cliente'} ({preparado.numeroLegible}).
          {' '}¿No se abrió? <a href={preparado.abrir} target="_blank" rel="noopener noreferrer">Ábrelo aquí</a>
          {' '}o copia el enlace del PDF: <span className="mono">{preparado.enlace}</span>
        </p>
      ) : (
        <p className="nota">Manda el PDF de la guía con un enlace que vale 30 días.</p>
      )}

      <Dialogo titulo={para === 'conductor' ? 'Enviar la guía al conductor' : 'Enviar la guía al cliente'}
               abierto={!!para} onCerrar={() => setPara(undefined)}
               acciones={<>
                 <Boton estilo="secundario" onClick={() => setPara(undefined)} disabled={ocupado}>Cancelar</Boton>
                 <Boton onClick={() => void abrir()} ocupado={ocupado} textoOcupado="Preparando…"
                        disabled={numero.replace(/\D/g, '').length < 8}>Abrir WhatsApp</Boton>
               </>}>
        <label className="campo">
          <span className="etiqueta">
            {para === 'conductor' ? `Celular del conductor${conductor ? ` (${conductor})` : ''}` : 'Celular del cliente'}
          </span>
          <input value={numero} inputMode="tel" placeholder="987 654 321" autoFocus
                 onChange={e => setNumero(e.target.value.replace(/[^\d +()-]/g, ''))} />
          <span className="pista">
            {para === 'cliente'
              ? 'Si lo cambias, se guarda en el cliente para la próxima. Sin código de país, se entiende Perú (+51).'
              : 'Sin código de país, se entiende Perú (+51).'}
          </span>
        </label>
        <p className="nota">
          Se abre WhatsApp con el mensaje y un enlace al PDF de la guía. WhatsApp no deja adjuntar archivos desde
          una página: {para === 'conductor' ? 'el conductor' : 'el cliente'} abre el PDF desde el enlace.
        </p>
        {fallo && <Aviso>{fallo}</Aviso>}
      </Dialogo>
    </div>
  )
}