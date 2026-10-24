import { useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Dialogo } from '../../../componentes/Dialogo'
import { fecha } from '../../../nucleo/formato/fechas'
import type { FichaYo } from '../../../nucleo/sesion/tipos'
import { FormularioMiFicha } from './FormularioMiFicha'

/**
 * 048 — «COMPLETA TUS DATOS». Se abre desde la franja de arriba, o sola
 * cuando la API dice «ficha_incompleta» al emitir, anular, hacer una nota o
 * agregar una empresa.
 */
export function DialogoMiFicha({ ficha, onCerrar, onGuardado }: {
  ficha: FichaYo | null | undefined
  onCerrar: () => void
  onGuardado: (mensaje: string) => void
}) {
  const [guardando, setGuardando] = useState(false)

  return (
    <Dialogo
      titulo="Completa tus datos"
      abierto
      onCerrar={onCerrar}
      acciones={
        <>
          <Boton estilo="secundario" onClick={onCerrar}>Después</Boton>
          <Boton type="submit" form="mi-ficha-dialogo" ocupado={guardando} textoOcupado="Guardando…">
            Guardar mis datos
          </Boton>
        </>
      }
    >
      {ficha?.exigida ? (
        <Aviso tono="ojo">
          Para emitir, anular o hacer notas, completa tu documento, nombres y apellidos. Cada comprobante queda
          firmado por una persona identificada. Mientras tanto puedes seguir mirando todo.
        </Aviso>
      ) : ficha?.plazo ? (
        <Aviso tono="ojo">
          Tienes hasta el <strong>{fecha(ficha.plazo)}</strong>. Después, para emitir o anular tendrás que
          completarlos.
        </Aviso>
      ) : null}

      <FormularioMiFicha id="mi-ficha-dialogo" onGuardado={onGuardado} onOcupado={setGuardando} />
    </Dialogo>
  )
}