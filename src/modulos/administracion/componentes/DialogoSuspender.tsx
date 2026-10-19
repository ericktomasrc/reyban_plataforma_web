import { useState } from 'react'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { empresasServicio } from '../servicios/empresasServicio'
import type { EmpresaEnLista } from '../tipos'

/**
 * Suspender una empresa.
 *
 * SE PIDE UN MOTIVO Y ES OBLIGATORIO. Queda escrito en la bitácora, y es lo
 * único que dentro de seis meses explicará por qué un cliente no puede entrar.
 *
 * NO ES UN CAMBIO COSMÉTICO: el back corta en el acto todas las sesiones
 * abiertas de esa empresa. Quien esté dentro en ese momento se queda fuera en
 * su siguiente clic, no cuando caduque su sesión doce horas después.
 */
export function DialogoSuspender({ empresa, onCerrar, onHecho }: {
  empresa: EmpresaEnLista
  onCerrar: () => void
  onHecho: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const mensaje = useMensaje()
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    if (!motivo.trim()) {
      mensaje.error('Escribe el motivo: es lo que se verá en la bitácora.')
      return
    }

    setEnviando(true)
    try {
      await empresasServicio.suspender(empresa.id, motivo.trim())
      onHecho()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo suspender la empresa.')
      setEnviando(false)
    }
  }

  return (
    <Dialogo
      titulo={`Suspender ${empresa.nombre}`}
      abierto
      onCerrar={onCerrar}
      acciones={
        <>
          <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton
            estilo="peligro"
            onClick={() => void confirmar()}
            ocupado={enviando}
            textoOcupado="Suspendiendo…"
          >
            Suspender
          </Boton>
        </>
      }
    >

      <div className="aviso ojo">
        Sus {empresa.usuarios} usuario{empresa.usuarios === 1 ? '' : 's'} no
        podrá{empresa.usuarios === 1 ? '' : 'n'} entrar, y las sesiones que
        tengan abiertas se cierran ahora mismo. Se puede reactivar después sin
        perder nada.
      </div>

      <Campo
        etiqueta="Motivo"
        obligatorio
        value={motivo}
        onChange={e => setMotivo(e.target.value)}
        placeholder="Falta de pago de la mensualidad de agosto"
        autoFocus
      />
    </Dialogo>
  )
}