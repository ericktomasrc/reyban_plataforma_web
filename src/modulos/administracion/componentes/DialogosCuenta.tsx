import { useState } from 'react'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { cuentasServicio } from '../servicios/cuentasServicio'
import type { CuentaEnLista } from '../servicios/cuentasServicio'

/** Cómo se llama una cuenta en la pantalla: su titular, o su correo. */
export function nombreDeCuenta(c: CuentaEnLista) {
  return c.titularNombre ?? c.usuario?.correo ?? 'Cuenta sin nombre'
}

/**
 * Suspender una cuenta.
 *
 * MOTIVO OBLIGATORIO, como al suspender una empresa: es lo único que dentro de
 * seis meses explicará por qué no entra. Y NO ES COSMÉTICO: el back corta en
 * el acto las sesiones abiertas de todos sus usuarios. No se borra nada; se
 * reactiva con un clic.
 */
export function DialogoSuspenderCuenta({ cuenta, onCerrar, onHecho }: {
  cuenta: CuentaEnLista
  onCerrar: () => void
  onHecho: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const mensaje = useMensaje()

  async function confirmar() {
    if (motivo.trim().length < 5) {
      mensaje.error('Escribe el motivo (mínimo 5 caracteres): es lo que quedará en la bitácora.')
      return
    }

    setEnviando(true)
    try {
      const r = await cuentasServicio.suspender(cuenta.id, motivo.trim())
      mensaje.bien(r.mensaje)
      onHecho()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo suspender la cuenta.')
      setEnviando(false)
    }
  }

  return (
    <Dialogo
      titulo={`Suspender ${nombreDeCuenta(cuenta)}`}
      abierto
      onCerrar={onCerrar}
      acciones={
        <>
          <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton estilo="peligro" onClick={() => void confirmar()}
                 ocupado={enviando} textoOcupado="Suspendiendo…">
            Suspender
          </Boton>
        </>
      }
    >
      <div className="aviso ojo">
        Nadie de esta cuenta podrá entrar, y las sesiones que tengan abiertas
        se cierran ahora mismo. No se borra nada: se puede reactivar después.
      </div>

      <Campo
        etiqueta="Motivo"
        obligatorio
        value={motivo}
        onChange={e => setMotivo(e.target.value)}
        placeholder="Datos falsos en el registro"
        autoFocus
      />
    </Dialogo>
  )
}

/**
 * Cambiar el tope de empresas nuevas por día. 50 por defecto; se sube a una
 * cuenta concreta, por ejemplo a un estudio que migra 300 clientes.
 */
export function DialogoTopeCuenta({ cuenta, onCerrar, onHecho }: {
  cuenta: CuentaEnLista
  onCerrar: () => void
  onHecho: () => void
}) {
  const [tope, setTope] = useState(String(cuenta.tope))
  const [enviando, setEnviando] = useState(false)
  const mensaje = useMensaje()

  const numero = Number(tope)
  const valido = Number.isInteger(numero) && numero >= 1 && numero <= 10000

  async function guardar() {
    setEnviando(true)
    try {
      const r = await cuentasServicio.cambiarTope(cuenta.id, numero)
      mensaje.bien(r.mensaje)
      onHecho()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo cambiar el tope.')
      setEnviando(false)
    }
  }

  return (
    <Dialogo
      titulo={`Tope de ${nombreDeCuenta(cuenta)}`}
      abierto
      onCerrar={onCerrar}
      acciones={
        <>
          <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={() => void guardar()} disabled={!valido}
                 ocupado={enviando} textoOcupado="Guardando…">
            Guardar
          </Boton>
        </>
      }
    >
      <Campo
        etiqueta="Empresas nuevas por día"
        obligatorio
        inputMode="numeric"
        value={tope}
        onChange={e => setTope(e.target.value.replace(/\D/g, ''))}
        mal={!valido}
        pista="Entre el dueño y todos sus colaboradores. Por defecto, 50."
        autoFocus
      />
    </Dialogo>
  )
}