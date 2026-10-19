import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Cargando } from '../../../componentes/Cargando'
import { CodigoQr } from '../../../componentes/CodigoQr'
import { CodigosDeRescate } from '../../../componentes/CodigosDeRescate'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fechaYHora } from '../../../nucleo/formato/fechas'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { invitacionServicio } from '../servicios/invitacionServicio'
import type { EnlaceValido } from '../servicios/invitacionServicio'

/**
 * El mínimo, y tiene que coincidir con el del back
 * (`EndpointsInvitacion.LongitudMinimaClave`).
 *
 * OCHO desde el 11 de octubre (antes doce), igual que en el registro: con el
 * segundo factor obligatorio, la contraseña sola no abre la cuenta.
 */
const LARGO_MINIMO = 8

type Paso = 'clave' | 'factor' | 'rescate'

/**
 * La pantalla del enlace del correo. Tres pasos, una sola dirección.
 *
 *   1. Elige contraseña
 *   2. Escanea el QR y confirma un código
 *   3. Guarda sus códigos de recuperación
 *
 * NADA SE GUARDA HASTA EL FINAL. La contraseña y el segundo factor se mandan
 * juntos en una sola llamada, y el enlace no se consume hasta que las dos
 * cosas son correctas. Quien cierre la ventana a medias vuelve a abrir el
 * mismo enlace y empieza de nuevo, sin haber roto nada.
 *
 * Al terminar NO entra solo: va al login a escribir la contraseña que acaba de
 * elegir. Así comprueba que la recuerda y el navegador le ofrece guardarla.
 */
export function Invitacion() {
  const { token = '' } = useParams()
  const mensaje = useMensaje()

  const [enlace, setEnlace]   = useState<EnlaceValido>()
  const [fallo, setFallo]     = useState<string>()
  const [mirando, setMirando] = useState(true)

  const [paso, setPaso] = useState<Paso>('clave')

  const [clave, setClave]       = useState('')
  const [repetida, setRepetida] = useState('')
  const [codigo, setCodigo]     = useState('')
  const [rescate, setRescate]   = useState<string[]>([])

  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let vivo = true

    void (async () => {
      try {
        const datos = await invitacionServicio.comprobar(token)
        if (vivo) setEnlace(datos)
      } catch (e) {
        if (vivo) {
          setFallo(e instanceof ErrorApi ? e.message : 'No se pudo comprobar el enlace.')
        }
      } finally {
        if (vivo) setMirando(false)
      }
    })()

    return () => { vivo = false }
  }, [token])

  const bastante  = clave.length >= LARGO_MINIMO
  const coinciden = clave.length > 0 && clave === repetida

  function alPasoDelFactor(e: React.FormEvent) {
    e.preventDefault()
    setPaso('factor')
  }

  async function terminar(e: React.FormEvent) {
    e.preventDefault()
    if (!enlace) return

    setEnviando(true)

    try {
      const r = await invitacionServicio.establecer(token, clave, enlace.secreto, codigo)
      setRescate(r.codigosRecuperacion)
      setPaso('rescate')
    } catch (err) {
      mensaje.error(err instanceof ErrorApi ? err.message : 'No se pudo guardar.')
    } finally {
      setEnviando(false)
    }
  }

  if (mirando) return <Cargando texto="Comprobando el enlace…" />

  // -------------------------------------------------------------------------
  if (fallo || !enlace) {
    return (
      <Marco titulo="Este enlace ya no sirve">
        <p className="bajada">
          Puede que haya caducado, o que ya lo hayas usado. Los enlaces valen
          una sola vez.
        </p>

        <Aviso tono="ojo">
          Si te registraste tú, pide un enlace nuevo en la pantalla de
          registro. Si te invitaron, pídeselo a quien te creó la cuenta: lo
          hace con un clic desde su pantalla de usuarios.
        </Aviso>

        <Boton estilo="secundario" ancho onClick={() => { window.location.href = '/' }}>
          Ir al inicio
        </Boton>
      </Marco>
    )
  }

  // --- Paso 3: los códigos de recuperación ---------------------------------
  if (paso === 'rescate') {
    return (
      <Marco titulo="Ya está" ancha>
        <p className="bajada">
          Tu cuenta quedó lista. Antes de entrar, guarda esto.
        </p>

        <CodigosDeRescate
          codigos={rescate}
          onSeguir={() => { window.location.href = '/' }}
        />
      </Marco>
    )
  }

  // --- Paso 2: el segundo factor -------------------------------------------
  if (paso === 'factor') {
    return (
      <Marco titulo="Protege tu cuenta" ancha>
        <p className="bajada">
          Hace falta para entrar. Necesitas una aplicación de códigos en el
          teléfono: Google Authenticator o Microsoft Authenticator sirven, y
          son gratis.
        </p>

        <form onSubmit={terminar}>
          <ol className="pasos">
            <li>Abre la aplicación y pulsa «Añadir cuenta» o el signo +.</li>
            <li>Escanea este código:</li>
          </ol>

          <CodigoQr contenido={enlace.direccionQr} />

          <p className="nota centrado">
            ¿No puedes escanearlo? Escribe esta clave a mano:<br />
            <code className="clave-manual">{enlace.secretoLegible}</code>
          </p>

          <ol className="pasos" start={3}>
            <li>Escribe aquí los seis dígitos que te muestre:</li>
          </ol>

          <Campo
            etiqueta="Código de seis dígitos"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            required
            autoFocus
            value={codigo}
            onChange={e => setCodigo(e.target.value)}
          />

          <Boton
            type="submit"
            ancho
            disabled={codigo.replace(/\D/g, '').length !== 6}
            ocupado={enviando}
            textoOcupado="Guardando…"
          >
            Terminar
          </Boton>

          <Boton
            estilo="plano"
            ancho
            style={{ marginTop: 8 }}
            onClick={() => setPaso('clave')}
          >
            Volver a la contraseña
          </Boton>
        </form>
      </Marco>
    )
  }

  // --- Paso 1: la contraseña ------------------------------------------------
  return (
    <Marco titulo={enlace.primeraVez ? `Hola, ${enlace.nombre}` : 'Contraseña nueva'}>
      <p className="bajada">
        {enlace.primeraVez ? (
          <>
            Tu cuenta en <strong>{enlace.empresa ?? 'la plataforma'}</strong>{' '}
            está lista. Solo falta que elijas tu contraseña.
          </>
        ) : (
          <>Elige tu contraseña nueva para <strong>{enlace.correo}</strong>.</>
        )}
      </p>

      <form onSubmit={alPasoDelFactor}>
        {/* El correo, oculto pero presente, para que el gestor de contraseñas
            del navegador sepa a qué cuenta asociar lo que guarde. */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={enlace.correo}
          readOnly
          hidden
        />

        <Campo
          etiqueta="Tu contraseña"
          type="password"
          autoComplete="new-password"
          required
          autoFocus
          value={clave}
          onChange={e => setClave(e.target.value)}
          pista={
            clave.length === 0
              ? `Al menos ${LARGO_MINIMO} caracteres. Una frase larga que recuerdes vale más que símbolos raros.`
              : bastante ? 'Bien.' : `Faltan ${LARGO_MINIMO - clave.length}.`
          }
          mal={clave.length > 0 && !bastante}
        />

        <Campo
          etiqueta="Repítela"
          type="password"
          autoComplete="new-password"
          required
          value={repetida}
          onChange={e => setRepetida(e.target.value)}
          pista={repetida.length > 0 && !coinciden ? 'No coinciden.' : undefined}
          mal={repetida.length > 0 && !coinciden}
        />

        <Boton type="submit" ancho disabled={!bastante || !coinciden}>
          Continuar
        </Boton>

        <p className="nota centrado">
          Este enlace caduca el {fechaYHora(enlace.expiraEn)}.
        </p>
      </form>
    </Marco>
  )
}


function Marco({ titulo, ancha, children }: {
  titulo: string
  ancha?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="pantalla-centrada">
      <div className={ancha ? 'tarjeta-acceso ancha' : 'tarjeta-acceso'}>
        <p className="marca">Reyban Consulting</p>
        <h1>{titulo}</h1>
        {children}
      </div>
    </div>
  )
}