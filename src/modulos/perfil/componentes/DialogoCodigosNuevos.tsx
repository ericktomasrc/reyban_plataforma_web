import { useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { CodigosDeRescate } from '../../../componentes/CodigosDeRescate'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { perfilServicio } from '../servicios/perfilServicio'

interface Props {
  onCerrar: () => void
  onHechos: () => void
}

/**
 * Generar ocho códigos de recuperación nuevos.
 *
 * DOS PASOS, Y EL SEGUNDO NO SE PUEDE CERRAR SIN MARCAR LA CASILLA: en cuanto
 * los códigos aparecen, ya son los únicos que valen. Quien cierre esa ventana
 * sin guardarlos se queda peor que antes, porque los viejos ya no sirven.
 *
 * Por eso el paso 1 avisa de que los anteriores dejan de valer ANTES de
 * generarlos, no después.
 */
export function DialogoCodigosNuevos({ onCerrar, onHechos }: Props) {
  const [clave, setClave]   = useState('')
  const [codigo, setCodigo] = useState('')
  const mensaje = useMensaje()
  const [pidiendo, setPidiendo] = useState(false)

  /** Cuando esto tiene valor, ya no hay marcha atrás: los viejos se anularon. */
  const [nuevos, setNuevos] = useState<string[]>()

  async function enviar(e: React.FormEvent) {
    e.preventDefault()

    if (codigo.trim().length !== 6) {
      mensaje.error('El código del teléfono son seis dígitos.')
      return
    }

    setPidiendo(true)
    try {
      const r = await perfilServicio.codigosNuevos(clave, codigo.trim())
      setNuevos(r.codigos)
      setClave('')
      setCodigo('')
    } catch (err) {
      mensaje.error(err instanceof ErrorApi ? err.message : 'No se pudieron generar los códigos.')
    } finally {
      setPidiendo(false)
    }
  }

  // ---------------------------------------------------------------------------
  // PASO 2 — los códigos, una sola vez
  // ---------------------------------------------------------------------------
  if (nuevos) {
    return (
      <Dialogo
        titulo="Tus códigos nuevos"
        abierto
        onCerrar={onHechos}
        obligatorio
      >
        <Aviso tono="ojo">
          Los anteriores ya no valen. Estos son los únicos que quedan, y no se
          pueden volver a consultar.
        </Aviso>

        <CodigosDeRescate codigos={nuevos} onSeguir={onHechos} />
      </Dialogo>
    )
  }

  // ---------------------------------------------------------------------------
  // PASO 1 — demostrar quién eres
  // ---------------------------------------------------------------------------
  return (
    <Dialogo
      titulo="Códigos de recuperación nuevos"
      abierto
      onCerrar={onCerrar}
      acciones={
        <>
          <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="submit" form="codigos-nuevos" ocupado={pidiendo} textoOcupado="Generando…">
            Generar los ocho
          </Boton>
        </>
      }
    >
      <form id="codigos-nuevos" onSubmit={enviar}>

        <Aviso tono="ojo">
          Tus códigos actuales <strong>dejarán de valer</strong>, incluidos los
          que no hayas usado. Si tienes los ocho guardados y no sospechas nada,
          no hace falta que hagas esto.
        </Aviso>

        <Campo
          etiqueta="Tu contraseña"
          type="password"
          value={clave}
          onChange={e => setClave(e.target.value)}
          autoComplete="current-password"
          autoFocus
        />

        <Campo
          etiqueta="Código de tu teléfono"
          value={codigo}
          onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pista="Los seis dígitos de tu aplicación de autenticación, ahora mismo."
        />

        <p className="nota">
          Se piden las dos cosas porque estos códigos son la puerta de atrás de
          tu segundo factor. Si bastara la contraseña, el segundo factor no
          estaría protegiendo nada: cualquiera con tu contraseña se fabricaría
          una llave que lo salta.
        </p>
      </form>
    </Dialogo>
  )
}