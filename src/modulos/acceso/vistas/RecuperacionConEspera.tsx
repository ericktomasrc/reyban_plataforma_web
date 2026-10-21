import { useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { useSesion } from '../../../nucleo/sesion/SesionContexto'
import { recuperacion2faServicio } from '../servicios/recuperacion2faServicio'
import type { MiRecuperacion } from '../servicios/recuperacion2faServicio'

/**
 * 039 — «TAMPOCO TENGO MIS CÓDIGOS»: pedir la recuperación con espera.
 *
 * Explica qué va a pasar antes de pedirla, porque cierra todas las sesiones y
 * avisa al administrador: nadie debería llevarse una sorpresa.
 */
export function PedirRecuperacion({ onVolver, onPedida }: {
  onVolver: () => void
  onPedida: (r: MiRecuperacion | null) => void
}) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<{ mensaje: string; enlace?: string | null } | null>(null)

  async function pedir() {
    setEnviando(true)
    setError(null)
    try {
      const r = await recuperacion2faServicio.pedir()
      if (r.resultado === 'en_curso') { onPedida(r.recuperacion); return }
      setHecho({ mensaje: r.mensaje ?? 'Te mandamos un enlace a tu correo.', enlace: r.enlaceDePrueba })
      if (!r.enviado) setError(r.mensaje ?? 'No pudimos mandarte el correo.')
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo pedir la recuperación.')
    } finally {
      setEnviando(false)
    }
  }

  if (hecho && !error) {
    return (
      <>
        <h1>Revisa tu correo</h1>
        <Aviso tono="bien">{hecho.mensaje}</Aviso>
        {hecho.enlace && (
          <p className="nota">Modo desarrollo, correo apagado: <a href={hecho.enlace}>abrir el enlace</a></p>
        )}
        <p className="nota">
          Al abrirlo empieza la espera. Cuando termine, vuelve a entrar con tu contraseña y
          configurarás un teléfono nuevo. Si no te llega, mira en la carpeta de spam.
        </p>
        <Boton estilo="plano" ancho onClick={onVolver}>Volver</Boton>
      </>
    )
  }

  return (
    <>
      <h1>Perdí el teléfono y los códigos</h1>
      <p className="bajada">
        Puedes recuperar el acceso tú solo, pero con una espera de seguridad.
      </p>
      <ol className="lista-recuperar">
        <li>Te mandamos un enlace a tu correo. Ábrelo en la próxima hora.</li>
        <li>
          Al abrirlo se cierran <strong>todas</strong> tus sesiones (también la de un equipo
          perdido o robado) y empieza la espera: <strong>24 horas</strong>, o <strong>3 días</strong> si
          eres administrador.
        </li>
        <li>Avisamos a tu administrador. Él (o tú, si encuentras el teléfono) puede cancelarla.</li>
        <li>Pasada la espera, entras con tu contraseña y configuras un teléfono nuevo.</li>
      </ol>
      <p className="nota">
        ¿Prisa? Pide a tu administrador que te envíe un enlace de acceso desde Usuarios: es
        inmediato.
      </p>
      {error && <Aviso>{error}</Aviso>}
      <Boton ancho ocupado={enviando} textoOcupado="Enviando…" onClick={() => void pedir()}>
        Mandarme el enlace
      </Boton>
      <Boton estilo="plano" ancho style={{ marginTop: 8 }} onClick={onVolver}>
        Volver al código
      </Boton>
    </>
  )
}


/**
 * 039 — LA RECUPERACIÓN EN CURSO, arriba de la pantalla del código.
 *
 * Por confirmar → «revisa tu correo». En espera → hasta cuándo. Lista →
 * «Configurar mi teléfono nuevo», que borra el factor viejo y lleva al QR.
 */
export function RecuperacionEnCurso({ r }: { r: MiRecuperacion }) {
  const { refrescar } = useSesion()
  const mensaje = useMensaje()
  const [enviando, setEnviando] = useState(false)

  async function completar() {
    setEnviando(true)
    try {
      await recuperacion2faServicio.completar()
      await refrescar()      // ahora /api/yo dice «configurar»: sale el QR
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo completar.')
      setEnviando(false)
    }
  }

  if (r.estado === 'por_confirmar') {
    return (
      <Aviso tono="ojo">
        Pediste recuperar tu segundo factor. <strong>Abre el enlace que te mandamos al correo</strong> para
        empezar la espera de {r.esperaTexto}.
      </Aviso>
    )
  }

  if (r.lista) {
    return (
      <div className="recuperacion-lista">
        <Aviso tono="bien">
          Terminó la espera. Ya puedes configurar tu teléfono nuevo: el anterior y tus códigos dejarán de valer.
        </Aviso>
        <Boton ancho ocupado={enviando} textoOcupado="Preparando…" onClick={() => void completar()}>
          Configurar mi teléfono nuevo
        </Boton>
      </div>
    )
  }

  return (
    <Aviso tono="ojo">
      <strong>Recuperación en espera.</strong> Podrás configurar un teléfono nuevo el {r.disponibleTexto}.
      Si encontraste tu teléfono o tus códigos, entra con ellos: la recuperación se cancela sola.
    </Aviso>
  )
}