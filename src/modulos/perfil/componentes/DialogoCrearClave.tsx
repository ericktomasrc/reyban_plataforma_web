import { useEffect, useRef, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { CodigoQr } from '../../../componentes/CodigoQr'
import { CodigosDeRescate } from '../../../componentes/CodigosDeRescate'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import type { QrSegundoFactor } from '../../../nucleo/sesion/tipos'
import { accesoServicio } from '../../acceso/servicios/accesoServicio'

/**
 * 24 OCT — «CREAR CONTRASEÑA» para quien entra solo con Google, sin pasar por
 * el correo y sin cerrar sesión.
 *
 *   1. La contraseña (dos veces).
 *   2. EN EL ACTO, el segundo factor: QR + seis dígitos. Entrar con contraseña
 *      siempre lo pide; así queda listo ahora y no al próximo ingreso.
 *   3. Los ocho códigos de recuperación (se ven una sola vez).
 *
 * El servidor solo deja crearla recién entrado con Google (30 minutos).
 */
export function DialogoCrearClave({ onCerrar, onHecho, soloFactor = false }: {
  onCerrar: () => void
  onHecho: () => void
  /** Ya tiene contraseña: solo el segundo factor (QR y códigos). */
  soloFactor?: boolean
}) {
  const [paso, setPaso] = useState<'clave' | 'factor' | 'codigos'>(soloFactor ? 'factor' : 'clave')
  const [clave, setClave] = useState('')
  const [repetida, setRepetida] = useState('')
  const [qr, setQr] = useState<QrSegundoFactor>()
  const [codigo, setCodigo] = useState('')
  const [rescate, setRescate] = useState<string[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string>()

  const texto = (e: unknown, si: string) => e instanceof ErrorApi ? e.message : si

  // Solo el factor: el QR se pide al abrir (una vez: cada llamada genera otro secreto).
  const pedido = useRef(false)
  useEffect(() => {
    if (!soloFactor || pedido.current) return
    pedido.current = true
    accesoServicio.prepararSegundoFactor()
      .then(setQr)
      .catch(err => setFallo(err instanceof ErrorApi ? err.message : 'No se pudo preparar el código.'))
  }, [soloFactor])

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    if (clave !== repetida) { setFallo('Las dos contraseñas no son iguales.'); return }
    setOcupado(true); setFallo(undefined)
    try {
      const r = await accesoServicio.crearClave(clave)
      if (!r.configurarSegundoFactor) { onHecho(); return }
      setQr(await accesoServicio.prepararSegundoFactor())
      setPaso('factor')
    } catch (err) {
      setFallo(texto(err, 'No se pudo crear la contraseña.'))
    } finally { setOcupado(false) }
  }

  async function activar(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true); setFallo(undefined)
    try {
      const r = await accesoServicio.confirmarSegundoFactor(codigo)
      setRescate(r.codigosRecuperacion)
      setPaso('codigos')
    } catch (err) {
      setFallo(texto(err, 'No se pudo confirmar el código.'))
    } finally { setOcupado(false) }
  }

  if (paso === 'codigos') {
    return (
      <Dialogo titulo="Tus códigos de recuperación" abierto onCerrar={onHecho}>
        <CodigosDeRescate codigos={rescate} onSeguir={onHecho} />
      </Dialogo>
    )
  }

  if (paso === 'factor' && !qr) {
    return (
      <Dialogo titulo="Configurar tu segundo factor" abierto onCerrar={onCerrar}>
        {fallo ? <Aviso>{fallo}</Aviso> : <p>Preparando tu código…</p>}
      </Dialogo>
    )
  }

  if (paso === 'factor' && qr) {
    return (
      <Dialogo titulo="Ahora, tu segundo factor" abierto onCerrar={onHecho}
        acciones={<>
          <Boton type="submit" form="activar-factor" ocupado={ocupado} textoOcupado="Comprobando…"
                 disabled={codigo.replace(/\D/g, '').length !== 6}>Activar</Boton>
        </>}>
        <form id="activar-factor" onSubmit={activar}>
          {!soloFactor && <Aviso tono="bien">Contraseña creada.</Aviso>}
          <p>
            Para entrar con correo y contraseña hace falta además un código de tu teléfono. Abre Google Authenticator o
            Microsoft Authenticator, pulsa «Añadir cuenta» o +, y escanea:
          </p>
          <CodigoQr contenido={qr.direccionQr} />
          <p className="nota centrado">
            ¿No puedes escanearlo? Escribe esta clave a mano:<br />
            <code className="clave-manual">{qr.secretoLegible}</code>
          </p>
          <Campo etiqueta="Código de seis dígitos" inputMode="numeric" autoComplete="one-time-code" maxLength={7}
                 required autoFocus value={codigo} onChange={e => setCodigo(e.target.value)} />
          {fallo && <Aviso>{fallo}</Aviso>}
          <p className="nota se-aplica">
            Se aplica: si cierras esta ventana sin activarlo, te lo pedirá la primera vez que entres con contraseña.
            Con «Entrar con Google» sigues entrando igual.
          </p>
        </form>
      </Dialogo>
    )
  }

  return (
    <Dialogo titulo="Crear una contraseña" abierto onCerrar={onCerrar}
      acciones={<>
        <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton type="submit" form="crear-clave" ocupado={ocupado} textoOcupado="Creando…"
               disabled={clave.length < 8 || repetida.length < 8}>Crear y seguir</Boton>
      </>}>
      <form id="crear-clave" onSubmit={crear}>
        <p>
          Con ella podrás entrar con tu <strong>correo y contraseña</strong> desde cualquier equipo, además de con Google.
          Después te pediremos configurar el segundo factor (un código de tu teléfono).
        </p>
        <Campo etiqueta="Contraseña nueva" type="password" autoComplete="new-password" required autoFocus
               value={clave} onChange={e => setClave(e.target.value)}
               pista="Al menos 8 caracteres. Mejor una frase larga que algo corto con símbolos." />
        <Campo etiqueta="Repítela" type="password" autoComplete="new-password" required
               value={repetida} onChange={e => setRepetida(e.target.value)} />
        {fallo && <Aviso>{fallo}</Aviso>}
      </form>
    </Dialogo>
  )
}