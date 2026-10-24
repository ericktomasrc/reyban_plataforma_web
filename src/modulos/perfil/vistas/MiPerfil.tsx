import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha, fechaYHora } from '../../../nucleo/formato/fechas'
import { useCargar } from '../../../nucleo/hooks/useCargar'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { useSesion, useYo } from '../../../nucleo/sesion/SesionContexto'
import { ConvertirCuenta } from '../../cartera/componentes/ConvertirCuenta'
import { NOMBRE_NIVEL } from '../../cartera/servicios/carteraServicio'
import { DialogoClave } from '../componentes/DialogoClave'
import { DialogoCodigosNuevos } from '../componentes/DialogoCodigosNuevos'
import { DialogoCorreo } from '../componentes/DialogoCorreo'
import { FormularioMiFicha } from '../componentes/FormularioMiFicha'
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
 * 048: DOS PESTAÑAS, como en todo sistema de gestión.
 *
 *   Mis datos   mi ficha (documento, nombres, apellidos…: de ahí sale mi
 *               nombre), dónde trabajo y mi tipo de cuenta (y «Convertir en
 *               Cuenta Profesional»: el inicio enlaza con /perfil#convertir).
 *   Seguridad   correo (lo cambio yo, con contraseña y código), contraseña,
 *               segundo factor, códigos y mis sesiones.  /perfil?pestana=seguridad
 */
export function MiPerfil() {
  const { refrescar } = useSesion()
  const { cuenta, ficha } = useYo()
  const ruta = useLocation()
  const [parametros] = useSearchParams()
  const seguridad = parametros.get('pestana') === 'seguridad'
  const [cambiandoCorreo, setCambiandoCorreo] = useState(false)
  const [guardandoFicha, setGuardandoFicha] = useState(false)
  const { pedir, dialogo: confirmacion } = useConfirmar()
  const mensaje = useMensaje()

  const perfil = useCargar<Datos>(() => perfilServicio.mio())

  const [nombre, setNombre]   = useState<string>()
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

    if (!valor.trim()) {
      mensaje.error('El nombre no puede quedar vacío.')
      return
    }

    setGuardando(true)
    try {
      const r = await perfilServicio.cambiarNombre(valor.trim())
      mensaje.bien(r.mensaje)
      setNombre(undefined)
      await perfil.recargar()

      // La cabecera enseña el nombre, y sale de /api/yo. Sin refrescar la
      // sesión seguiría diciendo el anterior hasta la siguiente recarga
      // completa de la página — y parecería que el cambio no se guardó.
      await refrescar()
    } catch (err) {
      mensaje.error(err instanceof ErrorApi ? err.message : 'No se pudo guardar el nombre.')
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

    try {
      const r = await perfilServicio.cerrarOtrasSesiones()
      mensaje.bien(r.mensaje)
      await perfil.recargar()
    } catch (err) {
      mensaje.error(err instanceof ErrorApi ? err.message : 'No se pudieron cerrar las sesiones.')
    }
  }

  // Desde el inicio se llega con #convertir: se baja hasta ese bloque en
  // cuanto existe (la página carga primero el perfil).
  useEffect(() => {
    if (d && ruta.hash) document.getElementById(ruta.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [d, ruta.hash])

  const convierte = cuenta?.tipo === 'negocio' && cuenta.nivel === 'dueno'

  if (perfil.cargando && !d) return <Cargando />
  if (!d) return <Aviso>{perfil.error ?? 'No se pudo cargar tu perfil.'}</Aviso>

  return (
    <>
      <div className="encabezado-pagina">
        <h1 className="titulo-pagina">Mi cuenta</h1>
        <nav className="pestanas" aria-label="Mi cuenta">
          <Link to="/perfil" className={!seguridad ? 'activa' : undefined}>Mis datos</Link>
          <Link to="/perfil?pestana=seguridad" className={seguridad ? 'activa' : undefined}>Seguridad</Link>
        </nav>
      </div>

      {perfil.error && <Aviso>{perfil.error}</Aviso>}

      {!seguridad && <>
      {/* ===================================================================
          MIS DATOS — la ficha (048). El super administrador no tiene ficha:
          solo su nombre.
          =================================================================== */}
      {d.esSuperAdmin ? (
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
        </div>
      ) : (
        <div className="bloque">
          <h2 className="subtitulo">Mis datos</h2>
          {ficha?.incompleta && (
            <Aviso tono="ojo">
              {ficha.exigida
                ? 'Completa tu documento, nombres y apellidos: sin ellos no puedes emitir, anular ni hacer notas.'
                : <>Completa tu documento, nombres y apellidos{ficha.plazo ? <> antes del <strong>{fecha(ficha.plazo)}</strong></> : null}: después no podrás emitir ni anular sin ellos.</>}
            </Aviso>
          )}
          <FormularioMiFicha
            id="mi-ficha-perfil"
            onOcupado={setGuardandoFicha}
            onGuardado={m => { mensaje.bien(m); void perfil.recargar() }}
          />
          <div style={{ marginTop: 12 }}>
            <Boton type="submit" form="mi-ficha-perfil" ocupado={guardandoFicha} textoOcupado="Guardando…" ancho={false}>
              Guardar mis datos
            </Boton>
          </div>
        </div>
      )}

      <div className="bloque">
        <h2 className="subtitulo">Dónde trabajo</h2>
        <dl className="datos">
          <div className="fila">
            <dt>Correo</dt>
            <dd>
              {d.correo}
              <div className="secundario">
                Con él entras. <Link to="/perfil?pestana=seguridad">Cambiarlo en Seguridad</Link>
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
          4. MI CUENTA (016, 018): Negocio o Profesional
          =================================================================== */}
      {!d.esSuperAdmin && cuenta?.titularNombre && (
        <div className="bloque">
          <h2 className="subtitulo">Tipo de cuenta</h2>
          <dl className="datos">
            <div className="fila">
              <dt>Cuenta</dt>
              <dd>
                <span className="etiqueta acento">{cuenta.tipo === 'profesional' ? 'Cuenta Profesional' : 'Cuenta Negocio'}</span>
                {cuenta.nivel && <span className="secundario"> · {NOMBRE_NIVEL[cuenta.nivel]}</span>}
              </dd>
            </div>
            <div className="fila"><dt>Titular</dt><dd>{cuenta.titularNombre}</dd></div>
          </dl>
        </div>
      )}

      {convierte && <ConvertirCuenta />}
      </>}

      {seguridad && <>
      {/* ===================================================================
          2. CÓMO ENTRO
          =================================================================== */}
      <div className="bloque">
        <h2 className="subtitulo">Cómo entro</h2>

        <dl className="datos">
          <div className="fila">
          <dt>Correo</dt>
          <dd>
            {d.correo}
            <div className="secundario">Con él entras y te llegan los avisos.</div>
            <div className="acciones-linea">
              <Boton estilo="plano" onClick={() => setCambiandoCorreo(true)}>
                Cambiarlo
              </Boton>
            </div>
          </dd>
          </div>

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

      </>}

      {confirmacion}

      {cambiandoClave && (
        <DialogoClave
          onCerrar={() => setCambiandoClave(false)}
          onCambiada={texto => {
            setCambiandoClave(false)
            mensaje.bien(texto)
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

      {cambiandoCorreo && <DialogoCorreo actual={d.correo} onCerrar={() => setCambiandoCorreo(false)} />}

      {pidiendoCodigos && (
        <DialogoCodigosNuevos
          onCerrar={() => setPidiendoCodigos(false)}
          onHechos={() => {
            setPidiendoCodigos(false)
            mensaje.bien('Tienes ocho códigos nuevos. Los anteriores ya no valen.')
            void perfil.recargar()
          }}
        />
      )}
    </>
  )
}