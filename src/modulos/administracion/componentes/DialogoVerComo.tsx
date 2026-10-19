import { useEffect, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fechaYHora } from '../../../nucleo/formato/fechas'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { suplantacionServicio } from '../servicios/suplantacionServicio'
import type { EmpresaEnLista, UsuariosDeEmpresa } from '../tipos'

interface Props {
  empresa: EmpresaEnLista
  onCerrar: () => void
  onEmpezada: () => void
}

/**
 * Elegir a quién ver dentro de una empresa.
 *
 * SE ABRE DESDE LA FILA DE LA EMPRESA y no desde un menú aparte, porque así se
 * llega buscando: un cliente llama con un problema, y lo primero que se busca
 * es su empresa en la lista.
 *
 * NO ES UNA PANTALLA DE GESTIÓN. No deja crear, desactivar ni cambiar roles —
 * eso lo hace el administrador del cliente desde su propia cuenta. Aquí solo se
 * elige a quién mirar, y el diálogo enseña justo lo necesario para reconocer a
 * una persona: nombre, correo, roles y estado.
 */
export function DialogoVerComo({ empresa, onCerrar, onEmpezada }: Props) {
  const [datos, setDatos] = useState<UsuariosDeEmpresa>()
  const [errorCarga, setErrorCarga] = useState<string>()
  const [cargando, setCargando] = useState(true)
  const [entrando, setEntrando] = useState<string>()
  const { pedir, dialogo: confirmacion } = useConfirmar()
  const mensaje = useMensaje()

  useEffect(() => {
    let vivo = true
    void (async () => {
      try {
        const d = await suplantacionServicio.usuarios(empresa.id)
        if (vivo) setDatos(d)
      } catch (e) {
        if (vivo) setErrorCarga(e instanceof ErrorApi ? e.message : 'No se pudieron cargar los usuarios.')
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [empresa.id])

  async function verComo(id: string, nombre: string) {
    const seguro = await pedir({
      titulo: `Ver la plataforma como ${nombre}`,
      confirmar: 'Ver como esta persona',
      mensaje: (
        <>
          <p>
            Verás exactamente lo que ve <strong>{nombre}</strong>, con sus
            permisos y no con los tuyos.
          </p>
          <p>
            Es de <strong>solo lectura</strong>: no podrás cambiar nada mientras
            dure.
          </p>
          <p>
            Queda registrado al empezar y al terminar, y también en la auditoría
            de {empresa.nombre}.
          </p>
        </>
      ),
    })
    if (!seguro) return

    setEntrando(id)
    try {
      await suplantacionServicio.empezar(id)
      onEmpezada()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo entrar a esa cuenta.')
      setEntrando(undefined)
    }
  }

  return (
    <>
    <Dialogo
      titulo={`Ver como alguien de ${empresa.nombre}`}
      abierto
      onCerrar={onCerrar}
      acciones={<Boton estilo="secundario" onClick={onCerrar}>Cerrar</Boton>}
    >
      {errorCarga && <Aviso>{errorCarga}</Aviso>}

      {cargando ? (
        <Cargando />
      ) : !datos ? (
        <Vacio>No se pudo cargar la lista.</Vacio>
      ) : !datos.operativa ? (
        /* Con la empresa suspendida, el aislamiento la esconde entera: entrar
           como alguien de dentro no enseñaría nada. Se dice aquí, antes de que
           nadie lo intente y se lleve un error que no explica por qué. */
        <Aviso tono="ojo">
          Esta empresa está suspendida. Mientras lo esté, entrar como uno de sus
          usuarios no enseñaría nada: el aislamiento esconde sus datos también
          para ellos. Reactívala primero.
        </Aviso>
      ) : datos.usuarios.length === 0 ? (
        <Vacio>Esta empresa todavía no tiene usuarios.</Vacio>
      ) : (
        <>
          <p className="nota" style={{ marginTop: 0 }}>
            Entrarás en <strong>solo lectura</strong> y con los permisos de esa
            persona, no con los tuyos. Queda registrado al empezar y al terminar.
          </p>

          <table className="tabla compacta">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Roles</th>
                <th>Último ingreso</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>

            <tbody>
              {datos.usuarios.map(u => (
                <tr key={u.id} className={u.activo ? undefined : 'apagada'}>
                  <td>
                    <div className="principal">{u.nombre}</div>
                    <div className="secundario">{u.correo}</div>
                  </td>

                  <td>
                    {u.roles.length > 0 ? (
                      <div className="etiquetas">
                        {u.roles.map(r => <span key={r} className="etiqueta acento">{r}</span>)}
                      </div>
                    ) : (
                      <span className="vacio">Sin rol</span>
                    )}
                  </td>

                  <td className="secundario">{fechaYHora(u.ultimoIngresoEn)}</td>

                  <td className="acciones">
                    {u.activo ? (
                      <Boton
                        estilo="plano"
                        onClick={() => void verComo(u.id, u.nombre)}
                        ocupado={entrando === u.id}
                        textoOcupado="Entrando…"
                      >
                        Ver como
                      </Boton>
                    ) : (
                      /* A un desactivado no se entra: el back lo rechaza. Se
                         dice en vez de ofrecer un botón que va a fallar. */
                      <span className="estado malo">Desactivado</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Dialogo>

    {/* FUERA del diálogo de arriba, no dentro. Los dos son <dialog> nativos y
        el navegador los apila en la capa superior, así que la confirmación sale
        encima y el fondo se oscurece dos veces — que es exactamente la señal de
        que esto es un paso más, y el importante. */}
    {confirmacion}
    </>
  )
}