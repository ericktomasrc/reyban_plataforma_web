import { useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { empresasServicio } from '../servicios/empresasServicio'
import type { EmpresaEnLista } from '../tipos'

/**
 * Cuánto duran los enlaces de invitación de una empresa.
 *
 * POR EMPRESA Y NO GLOBAL porque no todos los clientes trabajan igual: una
 * oficina que revisa el correo cada mañana necesita más margen que otra donde
 * el administrador llama por teléfono antes de crear la cuenta.
 *
 * Los enlaces ya emitidos conservan su fecha: se calculó al crearlos. Cambiar
 * esto no alarga ni acorta lo que ya salió.
 */
export function DialogoPlazo({ empresa, onCerrar, onGuardado }: {
  empresa: EmpresaEnLista
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [horas, setHoras] = useState(String(empresa.horasInvitacion))
  const [error, setError] = useState<string>()
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    const n = Number(horas)

    if (!Number.isInteger(n) || n < 1 || n > 168) {
      setError('Tiene que estar entre 1 y 168 horas (siete días).')
      return
    }

    setError(undefined)
    setGuardando(true)
    try {
      await empresasServicio.cambiarHorasInvitacion(empresa.id, n)
      onGuardado()
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo guardar.')
      setGuardando(false)
    }
  }

  return (
    <Dialogo
      titulo={`Enlaces de ${empresa.razonSocial}`}
      abierto
      onCerrar={onCerrar}
      acciones={
        <>
          <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={() => void guardar()} ocupado={guardando} textoOcupado="Guardando…">
            Guardar
          </Boton>
        </>
      }
    >
      {error && <Aviso>{error}</Aviso>}

      <p className="parrafo">
        Cuánto tiempo sirve un enlace de invitación o de contraseña nueva para
        la gente de esta empresa.
      </p>

      <Campo
        etiqueta="Horas"
        type="number"
        min={1}
        max={168}
        value={horas}
        onChange={e => setHoras(e.target.value)}
        pista="Entre 1 y 168. Lo normal son 24."
        autoFocus
      />

      <p className="nota">
        Los enlaces que ya salieron conservan su fecha: se calculó al crearlos.
      </p>
    </Dialogo>
  )
}
