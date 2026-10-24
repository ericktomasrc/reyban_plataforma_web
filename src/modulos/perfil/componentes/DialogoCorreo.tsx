import { useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { perfilServicio } from '../servicios/perfilServicio'

/**
 * 048 — CAMBIAR MI CORREO.
 *
 * Con la contraseña y el código del teléfono: con el correo se roba una
 * cuenta, y una sesión abierta y olvidada no debe bastar. El cambio vale
 * cuando se abre el enlace que llega a la dirección NUEVA (así se sabe que
 * es suya); a la anterior se le avisa. Queda en la bitácora.
 */
export function DialogoCorreo({ actual, onCerrar }: { actual: string; onCerrar: () => void }) {
  const mensaje = useMensaje()
  const [nuevo, setNuevo] = useState('')
  const [clave, setClave] = useState('')
  const [codigo, setCodigo] = useState('')
  const [campoMal, setCampoMal] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [hecho, setHecho] = useState<{ texto: string; prueba: string | null }>()

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevo.trim())) {
      setCampoMal('nuevo'); mensaje.error('Ese correo no tiene forma de correo.'); return
    }
    if (codigo.length !== 6) {
      setCampoMal('codigo'); mensaje.error('El código del teléfono son seis dígitos.'); return
    }

    setEnviando(true)
    try {
      const r = await perfilServicio.cambiarCorreo(nuevo.trim(), clave, codigo)
      if (!r.enviado) { mensaje.error(r.mensaje); return }
      setHecho({ texto: r.mensaje, prueba: r.enlaceDePrueba })
    } catch (err) {
      setCampoMal(err instanceof ErrorApi ? err.campo ?? null : null)
      mensaje.error(err instanceof ErrorApi ? err.message : 'No se pudo pedir el cambio.')
    } finally {
      setEnviando(false)
      setCodigo('')
    }
  }

  if (hecho) {
    return (
      <Dialogo titulo="Revisa tu correo nuevo" abierto onCerrar={onCerrar}
               acciones={<Boton onClick={onCerrar}>Entendido</Boton>}>
        <Aviso tono="bien">{hecho.texto}</Aviso>
        {hecho.prueba && (
          <p className="nota">Modo de prueba (sin correo): <a href={hecho.prueba}>abrir el enlace</a></p>
        )}
        <p className="nota">¿No llega? Mira en spam o «Promociones». Puedes pedirlo otra vez: el enlace anterior deja de valer.</p>
      </Dialogo>
    )
  }

  return (
    <Dialogo
      titulo="Cambiar mi correo"
      abierto
      onCerrar={onCerrar}
      acciones={
        <>
          <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="submit" form="cambiar-correo" ocupado={enviando} textoOcupado="Enviando…">
            Enviar el enlace
          </Boton>
        </>
      }
    >
      <form id="cambiar-correo" onSubmit={e => void enviar(e)}>
        <p>Ahora entras con <strong>{actual}</strong>.</p>

        <Campo etiqueta="Correo nuevo" type="email" value={nuevo} autoFocus autoComplete="email"
               onChange={e => setNuevo(e.target.value)} mal={campoMal === 'nuevo'} />
        <Campo etiqueta="Tu contraseña" type="password" value={clave} autoComplete="current-password"
               onChange={e => setClave(e.target.value)} mal={campoMal === 'clave'} />
        <Campo etiqueta="Código de tu teléfono" value={codigo} inputMode="numeric" autoComplete="one-time-code"
               onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} mal={campoMal === 'codigo'}
               pista="Los seis dígitos de tu aplicación de autenticación, ahora mismo." />

        <p className="nota">
          Te mandamos un enlace al correo nuevo; el cambio vale cuando lo abres (24 horas). Hasta entonces sigues
          entrando con el de siempre, y a ese le avisamos cuando cambie.
        </p>
      </form>
    </Dialogo>
  )
}