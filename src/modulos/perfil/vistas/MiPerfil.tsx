import { useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha, fechaYHora } from '../../../nucleo/formato/fechas'
import { useCargar } from '../../../nucleo/hooks/useCargar'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useSesion } from '../../../nucleo/sesion/SesionContexto'
import { DialogoClave } from '../componentes/DialogoClave'
import { DialogoCodigosNuevos } from '../componentes/DialogoCodigosNuevos'
import { DialogoOtroTelefono } from '../componentes/DialogoOtroTelefono'
import { perfilServicio } from '../servicios/perfilServicio'
import type { MiPerfil as Datos } from '../tipos'

/**
 * Mi cuenta.
 *
 * LA ÚNICA PANTALLA SIN PERMISO DE TODA LA APLICACIÓN, y es lo correcto: un
 * permiso sirve para decidir qué puedes hacerle a OTRO. Nadie tiene que
 * autorizarte a mirar tu propia cuenta.
 *
 * Tres bloques, en orden de lo que la gente viene a buscar:
 *
 *   1. Quién soy — y el nombre, que se cambia aquí mismo.
 *   2. Cómo entro — contraseña y segundo factor, lo delicado.
 *   3. Mis sesiones — el botón de «cierra todo lo demás».
 *
 * El correo no se cambia desde aquí. Está explicado en el bloque 1, en la
 * pantalla, porque quien busque ese campo merece saber por qué no está en vez
 * de pensar que falta.
 */
export function MiPerfil() {
  const { refrescar } = useSesion()
  const { pedir, dialogo: confirmacion } = useConfirmar()

  const perfil = useCargar<Datos>(() => perfilServicio.mio())

  const [nombre, setNombre]   = useState<string>()
  const [aviso, setAviso]     = useState<string>()
  const [error, setError]     = useState<string>()
  const [guardando, setGuardando] = useState(false)

  const [cambiandoClave, setCambiandoClave] = useState(false)
  const [pidiendoCodigos, setPidiendoCodigos] = useState(false)
  const [otroTelefono, setOtroTelefono]       = useState(false)

  const d = perfil.datos

  // El campo arranca con lo que hay en la base, no con un estado vacío: así se
  // ve el nombre actual y se edita encima.
  const valor = nombre ?? d?.nombre ?? ''
  const cambioPendiente = d !== undefined && valor.trim() !== d.nombre

  async function guardarNombre(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined); setAviso(undefined)

    if (!valor.trim()) {
      setError('El nombre no puede quedar vacío.')
      return
    }

    setGuardando(true)
    try {
      const r = await perfilServicio.cambiarNombre(valor.trim())
      setAviso(r.mensaje)
      setNombre(undefined)
      await perfil.recargar()

      // La cabecera enseña el nombre, y sale de /api/yo. Sin refrescar la
      // sesión seguiría diciendo el anterior hasta la siguiente recarga
      // completa de la página — y parecería que el cambio no se guardó.
      await refrescar()
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar el nombre.')
    } finally {
      setGuardando(false)
    }
  }

  async function cerrarOtras() {
    const seguro = await pedir({
      titulo: 'Cerrar tus demás sesiones',
      confirmar: 'Cerrar las demás',
      tono: 'peligro',
      mensaje: (
        <>
          <p>
            Se cerrarán todas tus sesiones abiertas en otros navegadores y otros
            equipos. <strong>Esta se queda abierta.</strong>
          </p>
          <p>Tendrás que volver a entrar en los demás sitios.</p>
        </>
      ),
    })
    if (!seguro) return

    setError(undefined); setAviso(undefined)
    try {
      const r = await perfilServicio.cerrarOtrasSesiones()
      setAviso(r.mensaje)
      await perfil.recargar()
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudieron cerrar las sesiones.')
    }
  }

  if (perfil.cargando && !d) return <Cargando />
  if (!d) return <Aviso>{perfil.error ?? 'No se pudo cargar tu perfil.'}</Aviso>

  return (
    <>
      <h1 className="titulo-pagina">Mi cuenta</h1>

      {perfil.error && <Aviso>{perfil.error}</Aviso>}
      {error && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="bien">{aviso}</Aviso>}

      {/* ===================================================================
          1. QUIÉN SOY
          =================================================================== */}
      <div className="bloque">
        <h2 className="subtitulo">Quién soy</h2>

        <form onSubmit={guardarNombre}>
          <Campo
            etiqueta="Nombre"
            value={valor}
            onChange={e => setNombre(e.target.value)}
            pista="Es lo que ven los demás en la bitácora y en la lista de usuarios."
          />

          {cambioPendiente && (
            <Boton type="submit" ocupado={guardando} textoOcupado="Guardando…">
              Guardar el nombre
            </Boton>
          )}
        </form>

        <dl className="datos">
          <div className="fila">
          <dt>Correo</dt>
          <dd>
            {d.correo}
            {/* Quien busque aquí el campo del correo merece saber por qué no
                está, en vez de pensar que se olvidó. */}
            <div className="secundario">
              {d.esSuperAdmin
                ? 'Para cambiarlo hay que hacerlo en la base de datos: eres el único que no tiene administrador por encima.'
                : 'Para cambiarlo, pídeselo al administrador de tu empresa. Se avisa a esta dirección cuando cambia.'}
            </div>
          </dd>

          </div>

          <div className="fila">
          <dt>{d.esSuperAdmin ? 'Alcance' : 'Empresa'}</dt>
          <dd>
            {d.esSuperAdmin
              ? 'Administración de la plataforma'
              : d.empresa
                ? <>{d.empresa.razonSocial} <span className="secundario">· RUC {d.empresa.ruc}</span></>
                : '—'}
          </dd>

          </div>

          <div className="fila">
          <dt>Rol</dt>
          <dd>
            {d.esSuperAdmin ? (
              <span className="etiqueta acento">Super administrador</span>
            ) : d.roles.length > 0 ? (
              <div className="etiquetas">
                {d.roles.map(r => <span key={r} className="etiqueta acento">{r}</span>)}
              </div>
            ) : (
              <span className="vacio">Sin rol</span>
            )}
          </dd>

          </div>

          <div className="fila">
            <dt>Cuenta creada</dt>
            <dd className="secundario">{fecha(d.creadoEn)}</dd>
          </div>
        </dl>
      </div>

      {/* ===================================================================
          2. CÓMO ENTRO
          =================================================================== */}
      <div className="bloque">
        <h2 className="subtitulo">Cómo entro</h2>

        <dl className="datos">
          <div className="fila">
          <dt>Contraseña</dt>
          <dd>
            <span className="secundario">
              {d.claveCambiadaEn
                ? `Cambiada el ${fecha(d.claveCambiadaEn)}`
                : 'Sin cambiar desde que abriste la cuenta'}
            </span>
            <div className="acciones-linea">
              <Boton estilo="plano" onClick={() => setCambiandoClave(true)}>
                Cambiarla
              </Boton>
            </div>
          </dd>

          </div>

          <div className="fila">
          <dt>Segundo factor</dt>
          <dd>
            {d.dosfaActivo ? (
              <>
                <span className="estado bueno">Activo</span>
                {d.dosfaActivadoEn && (
                  <span className="secundario"> · desde el {fecha(d.dosfaActivadoEn)}</span>
                )}
                <div className="acciones-linea">
                  <Boton estilo="plano" onClick={() => setOtroTelefono(true)}>
                    Cambiar de teléfono
                  </Boton>
                </div>
              </>
            ) : (
              <span className="estado malo">Sin configurar</span>
            )}
          </dd>

          </div>

          <div className="fila">
          <dt>Códigos de recuperación</dt>
          <dd>
            {/* EL NÚMERO MÁS ÚTIL DE LA PANTALLA. Quien había gastado seis de
                los ocho no se enteraba hasta quedarse sin ninguno, que es el
                peor momento posible para descubrirlo. */}
            <span className={d.codigosRestantes <= 2 ? 'estado aviso' : undefined}>
              Te quedan <strong>{d.codigosRestantes}</strong> de 8
            </span>

            {d.codigosRestantes <= 2 && (
              <div className="secundario">
                Quedan muy pocos. Genera ocho nuevos mientras tengas el teléfono
                a mano, no cuando lo hayas perdido.
              </div>
            )}

            {d.dosfaActivo && (
              <div className="acciones-linea">
                <Boton estilo="plano" onClick={() => setPidiendoCodigos(true)}>
                  Generar ocho nuevos
                </Boton>
              </div>
            )}
          </dd>

          </div>

          <div className="fila">
            <dt>Último ingreso</dt>
            <dd className="secundario">{fechaYHora(d.ultimoIngresoEn)}</dd>
          </div>
        </dl>
      </div>

      {/* ===================================================================
          3. MIS SESIONES
          =================================================================== */}
      <div className="bloque">
        <h2 className="subtitulo">Mis sesiones</h2>

        <p>
          Tienes <strong>{d.sesionesAbiertas}</strong>{' '}
          {d.sesionesAbiertas === 1 ? 'sesión abierta' : 'sesiones abiertas'},
          contando esta.
        </p>

        <p className="nota">
          Si entraste en un ordenador que no era tuyo y no te acuerdas de si
          cerraste, ciérralas todas desde aquí. Esta se queda abierta.
        </p>

        <Boton
          estilo="secundario"
          onClick={() => void cerrarOtras()}
          ancho={false}
        >
          Cerrar mis demás sesiones
        </Boton>
      </div>

      {confirmacion}

      {cambiandoClave && (
        <DialogoClave
          onCerrar={() => setCambiandoClave(false)}
          onCambiada={mensaje => {
            setCambiandoClave(false)
            setAviso(mensaje)
            void perfil.recargar()
          }}
        />
      )}

      {otroTelefono && (
        <DialogoOtroTelefono
          onCerrar={() => setOtroTelefono(false)}
          onHecho={() => {
            // La sesión ya no vale: `reiniciar_segundo_factor` corta todas.
            // Refrescar echa a la pantalla de ingreso, que es justo donde tiene
            // que continuar — con el QR nuevo esperándole al entrar.
            void refrescar()
          }}
        />
      )}

      {pidiendoCodigos && (
        <DialogoCodigosNuevos
          onCerrar={() => setPidiendoCodigos(false)}
          onHechos={() => {
            setPidiendoCodigos(false)
            setAviso('Tienes ocho códigos nuevos. Los anteriores ya no valen.')
            void perfil.recargar()
          }}
        />
      )}
    </>
  )
}
