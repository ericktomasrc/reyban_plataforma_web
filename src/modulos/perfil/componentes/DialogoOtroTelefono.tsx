import { useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { accesoServicio } from '../../acceso/servicios/accesoServicio'

interface Props {
  onCerrar: () => void
  onHecho: () => void
}

/**
 * Cambiar de teléfono: borra el segundo factor para configurarlo otra vez.
 *
 * PIDE LA CONTRASEÑA, y es lo único que impide el peor caso de toda la
 * aplicación: quien encuentre un ordenador con la sesión abierta se pone el
 * segundo factor en SU teléfono y se queda con la cuenta para siempre — con
 * contraseña y con factor, sin forma de recuperarla desde dentro.
 *
 * Es un diálogo y no un `prompt()` del navegador por un motivo concreto: el
 * `prompt` no tiene campo de contraseña, así que la escribe a la vista de
 * cualquiera que esté mirando la pantalla.
 */
export function DialogoOtroTelefono({ onCerrar, onHecho }: Props) {
  const [clave, setClave] = useState('')
  const mensaje = useMensaje()
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()

    setEnviando(true)
    try {
      await accesoServicio.reiniciarMiSegundoFactor(clave)
      onHecho()
    } catch (err) {
      mensaje.error(err instanceof ErrorApi ? err.message : 'No se pudo reiniciar el segundo factor.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialogo
      titulo="Configurar el segundo factor en otro teléfono"
      abierto
      onCerrar={onCerrar}
      acciones={
        <>
          <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton
            estilo="peligro"
            type="submit"
            form="otro-telefono"
            ocupado={enviando}
            textoOcupado="Borrando…"
          >
            Borrar y volver a entrar
          </Boton>
        </>
      }
    >
      <form id="otro-telefono" onSubmit={enviar}>

        <Aviso tono="ojo">
          Se borrará tu segundo factor actual y <strong>se cerrará esta
          sesión</strong>. Al volver a entrar te saldrá un QR nuevo para
          escanear con el teléfono nuevo.
          <br />
          Tus códigos de recuperación actuales también dejarán de valer: al
          configurarlo te daremos ocho nuevos.
        </Aviso>

        <Campo
          etiqueta="Tu contraseña"
          type="password"
          value={clave}
          onChange={e => setClave(e.target.value)}
          autoComplete="current-password"
          pista="Se pide para que quien encuentre tu sesión abierta no pueda ponerse el segundo factor en su propio teléfono."
          autoFocus
        />
      </form>
    </Dialogo>
  )
}