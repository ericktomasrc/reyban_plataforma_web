import { useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { NOMBRE_RELACION_RECLAMO, pedidosServicio } from '../servicios/pedidosServicio'
import type { ReclamoSobreMia } from '../servicios/pedidosServicio'

/**
 * «TRASPASO EN REVISIÓN» (fase 4d, lienzo «Fase 4», pantalla 13).
 *
 * La franja que avisa a la cuenta que tiene una empresa reclamada con
 * documentos, con su botón «Responder». Sale en Mis empresas (Cuenta
 * Profesional) y en el Inicio (Cuenta Negocio).
 */
export function FranjaReclamos({ reclamos, onRespondido }: {
  reclamos: ReclamoSobreMia[]
  onRespondido: () => Promise<void>
}) {
  const [abierto, setAbierto] = useState<ReclamoSobreMia | null>(null)

  if (reclamos.length === 0) return null

  return (
    <>
      {reclamos.map(r => (
        <div key={r.id} className="aviso ojo franja-reclamo">
          {r.respuesta ? (
            <span>
              <strong>Piden el traspaso de {conPunto(r.empresa)}</strong> Ya respondiste
              {r.respuesta === 'de_acuerdo' ? ' que estás de acuerdo' : ' que no estás de acuerdo'}.
              Lo revisa el equipo de Reyban.
            </span>
          ) : (
            <span>
              <strong>Piden el traspaso de {conPunto(r.empresa)}</strong> {r.pide}{' '}
              ({NOMBRE_RELACION_RECLAMO[r.relacion]}) presentó documentos.
              {r.puedoResponder
                ? <> Si crees que es un error, respóndenos hasta el <strong>{fecha(r.plazoHasta)}</strong>.</>
                : <> Puede responder el dueño de la cuenta hasta el {fecha(r.plazoHasta)}.</>}
            </span>
          )}
          {r.puedoResponder && (
            <Boton estilo="secundario" onClick={() => setAbierto(r)}>Responder</Boton>
          )}
        </div>
      ))}

      {abierto && (
        <DialogoResponder reclamo={abierto} onCerrar={() => setAbierto(null)}
                          onHecho={async () => { setAbierto(null); await onRespondido() }} />
      )}
    </>
  )
}


/** «TALLER S.A.C.» ya termina en punto: no se le pone otro. */
function conPunto(texto: string): string {
  return texto.endsWith('.') ? texto : texto + '.'
}


function DialogoResponder({ reclamo, onCerrar, onHecho }: {
  reclamo: ReclamoSobreMia; onCerrar: () => void; onHecho: () => Promise<void>
}) {
  const mensaje = useMensaje()
  const [respuesta, setRespuesta] = useState<'de_acuerdo' | 'se_opone' | null>(null)
  const [texto, setTexto] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const enviar = async () => {
    setError(null)
    if (!respuesta) { setError('Elige tu respuesta.'); return }
    if (respuesta === 'se_opone' && texto.trim().length < 10) {
      setError('Cuéntanos por qué (mínimo 10 caracteres).'); return
    }

    const f = new FormData()
    f.append('respuesta', respuesta)
    f.append('texto', texto.trim())
    if (archivo) f.append('archivo', archivo)

    setOcupado(true)
    try {
      mensaje.bien((await pedidosServicio.responderReclamo(reclamo.id, f)).mensaje)
      await onHecho()
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo enviar tu respuesta.')
      setOcupado(false)
    }
  }

  return (
    <Dialogo titulo={`Responder a la solicitud N.º ${String(reclamo.numero).padStart(4, '0')}`} abierto onCerrar={onCerrar}
             acciones={<>
               <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
               <Boton onClick={() => void enviar()} ocupado={ocupado} textoOcupado="Enviando…">Enviar respuesta</Boton>
             </>}>
      <p className="texto-paso">
        <strong>{reclamo.pide}</strong> dice ser {NOMBRE_RELACION_RECLAMO[reclamo.relacion]} de {reclamo.empresa} y
        pide que la empresa pase a su nombre. Lo revisa una persona de Reyban.
      </p>

      <fieldset className="opciones-respuesta">
        <legend>Tu respuesta</legend>
        <label className={respuesta === 'de_acuerdo' ? 'elegida' : undefined}>
          <input type="radio" name="respuesta" checked={respuesta === 'de_acuerdo'}
                 onChange={() => setRespuesta('de_acuerdo')} />
          <span><strong>Estoy de acuerdo</strong>
            <span className="secundario">Es quien dice ser. Pueden aprobarlo sin esperar el plazo.</span></span>
        </label>
        <label className={respuesta === 'se_opone' ? 'elegida' : undefined}>
          <input type="radio" name="respuesta" checked={respuesta === 'se_opone'}
                 onChange={() => setRespuesta('se_opone')} />
          <span><strong>No estoy de acuerdo</strong>
            <span className="secundario">Cuéntanos por qué. Puedes adjuntar un documento.</span></span>
        </label>
      </fieldset>

      <div className="campo">
        <label htmlFor="texto-respuesta">
          {respuesta === 'se_opone' ? 'Por qué' : 'Comentario'}{' '}
          <span className="detalle-paso">({respuesta === 'se_opone' ? 'obligatorio' : 'opcional'})</span>
        </label>
        <textarea id="texto-respuesta" rows={3} maxLength={1000} value={texto} onChange={e => setTexto(e.target.value)}
                  placeholder="Jorge dejó de ser gerente en agosto. Adjunto la vigencia de poder nueva." />
        <span className="pista">{texto.length} / 1000</span>
      </div>

      <div className="fila-archivo">
        <div>
          <strong>Documento</strong><span className="secundario"> (opcional)</span>
          <span className="secundario">PDF o foto, hasta 5 MB.</span>
        </div>
        <label className="boton secundario">
          {archivo ? `✓ ${archivo.name}` : 'Subir PDF o foto'}
          <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png"
                 onChange={e => setArchivo(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      <p className="nota">
        Tu respuesta la lee solo el equipo de Reyban, no quien reclama. Se responde una sola vez.
      </p>

      {error && <Aviso>{error}</Aviso>}
    </Dialogo>
  )
}