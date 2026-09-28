import { useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { useCargar } from '../../../nucleo/hooks/useCargar'
import { DialogoAltaEmpresa } from '../componentes/DialogoAltaEmpresa'
import { DialogoModulos } from '../componentes/DialogoModulos'
import { DialogoPlazo } from '../componentes/DialogoPlazo'
import { DialogoSuspender } from '../componentes/DialogoSuspender'
import { DialogoVerComo } from '../componentes/DialogoVerComo'
import { empresasServicio } from '../servicios/empresasServicio'
import { Si } from '../../../nucleo/autorizacion/Protegido'
import { Permisos } from '../../../nucleo/autorizacion/permisos'
import { useSesion } from '../../../nucleo/sesion/SesionContexto'
import type { EmpresaEnLista } from '../tipos'

/**
 * La pantalla del super administrador: sus clientes.
 *
 * ES LA ÚNICA PANTALLA DE LA PLATAFORMA QUE CRUZA EMPRESAS. Todas las demás
 * viven dentro de una: el aislamiento de la base no las deja ver fuera. Esta
 * puede porque quien la abre no pertenece a ninguna, y el back lo comprueba
 * con `SoloSuperAdmin` en cada endpoint.
 *
 * Las suspendidas salen en la lista a propósito. Son precisamente las que
 * alguien va a querer mirar cuando un cliente llame diciendo que no entra.
 */
export function ListaEmpresas() {
  const { refrescar } = useSesion()

  const empresas = useCargar<EmpresaEnLista[]>(() => empresasServicio.listar())
  const catalogo = useCargar(() => empresasServicio.modulos())

  const [creando, setCreando] = useState(false)
  const [editandoModulos, setEditandoModulos] = useState<EmpresaEnLista>()
  const [editandoPlazo, setEditandoPlazo] = useState<EmpresaEnLista>()
  const [suspendiendo, setSuspendiendo] = useState<EmpresaEnLista>()
  const [viendoComo, setViendoComo]     = useState<EmpresaEnLista>()
  const [errorAccion, setErrorAccion] = useState<string>()
  const [aviso, setAviso] = useState<string>()

  const modulos = catalogo.datos ?? []

  /** El nombre bonito del módulo; si no está en el catálogo, su código. */
  const nombreModulo = (codigo: string) =>
    modulos.find(m => m.codigo === codigo)?.nombre ?? codigo

  async function reactivar(empresa: EmpresaEnLista) {
    setErrorAccion(undefined)
    try {
      await empresasServicio.reactivar(empresa.id)
      await empresas.recargar()
    } catch {
      setErrorAccion(`No se pudo reactivar ${empresa.razonSocial}.`)
    }
  }

  if (empresas.cargando && !empresas.datos) return <Cargando />

  return (
    <>
      <div className="encabezado-pagina">
        <h1 className="titulo-pagina">Empresas</h1>
        <Boton onClick={() => setCreando(true)}>Dar de alta</Boton>
      </div>

      {empresas.error && <Aviso>{empresas.error}</Aviso>}
      {errorAccion && <Aviso>{errorAccion}</Aviso>}
      {aviso && <Aviso tono="bien">{aviso}</Aviso>}

      <div className="bloque sin-relleno">
        {empresas.datos && empresas.datos.length > 0 ? (
          <table className="tabla">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>RUC</th>
                <th className="centro">Usuarios</th>
                <th>Módulos</th>
                <th>Estado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>

            <tbody>
              {empresas.datos.map(e => {
                const suspendida = e.suspendidaEn !== null

                return (
                  <tr key={e.id} className={suspendida ? 'apagada' : undefined}>
                    <td>
                      <div className="principal">{e.razonSocial}</div>
                      {suspendida && e.motivoSuspension && (
                        <div className="secundario">{e.motivoSuspension}</div>
                      )}
                    </td>

                    <td className="mono">{e.ruc}</td>

                    <td className="centro">{e.usuarios}</td>

                    <td>
                      {e.modulos.length > 0 ? (
                        <div className="etiquetas">
                          {e.modulos.map(c => (
                            <span key={c} className="etiqueta acento">{nombreModulo(c)}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="vacio">Ninguno</span>
                      )}
                    </td>

                    <td>
                      <span className={suspendida ? 'estado malo' : 'estado bueno'}>
                        {suspendida ? 'Suspendida' : 'Operativa'}
                      </span>
                    </td>

                    <td className="acciones">
                      {/* «Ver como» va primero porque es lo que se busca en el
                          momento de más prisa: un cliente al teléfono diciendo
                          que algo no le sale. Los módulos y los enlaces se
                          tocan con calma.

                          No sale para una empresa suspendida: el aislamiento la
                          esconde entera, así que entrar como uno de sus
                          usuarios no enseñaría nada. */}
                      {!suspendida && (
                        <Si puede={Permisos.Plataforma.Suplantar}>
                          <Boton estilo="plano" onClick={() => setViendoComo(e)}>
                            Ver como
                          </Boton>
                        </Si>
                      )}

                      <Boton estilo="plano" onClick={() => setEditandoModulos(e)}>
                        Módulos
                      </Boton>

                      <Boton estilo="plano" onClick={() => setEditandoPlazo(e)}>
                        Enlaces
                      </Boton>

                      {suspendida ? (
                        <Boton estilo="plano" onClick={() => void reactivar(e)}>
                          Reactivar
                        </Boton>
                      ) : (
                        <Boton estilo="plano" onClick={() => setSuspendiendo(e)}>
                          Suspender
                        </Boton>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="relleno">
            <Vacio>
              Todavía no hay ninguna empresa. La primera que des de alta recibirá
              su propio administrador, y a partir de ahí se gestiona sola.
            </Vacio>
          </div>
        )}
      </div>

      <DialogoAltaEmpresa
        abierto={creando}
        modulos={modulos}
        onCerrar={() => setCreando(false)}
        onCreada={r => {
          setCreando(false)
          setErrorAccion(undefined)

          // El correo puede no haber salido sin que eso impida crear la
          // empresa: el aviso tiene que distinguir los dos casos, o alguien se
          // quedará esperando un correo que nunca llegó.
          if (r.administrador.invitacionEnviada) {
            setAviso(
              `${r.empresa.razonSocial} quedó creada. ` +
              `Le mandamos a ${r.administrador.correo} el enlace para elegir su contraseña.`)
          } else {
            setAviso(undefined)
            setErrorAccion(
              `${r.empresa.razonSocial} quedó creada, pero el correo a ` +
              `${r.administrador.correo} no salió. Reenvíalo desde sus usuarios.`)
          }

          void empresas.recargar()
        }}
      />

      {viendoComo && (
        <DialogoVerComo
          empresa={viendoComo}
          onCerrar={() => setViendoComo(undefined)}
          onEmpezada={() => {
            setViendoComo(undefined)

            // No hace falta navegar a ningún sitio: al refrescar, /api/yo
            // responde ya con la identidad del cliente y toda la aplicación
            // —menú, permisos, cabecera— se convierte en la suya. Esta misma
            // pantalla desaparece del menú, porque el cliente no la tiene.
            void refrescar()
          }}
        />
      )}

      {editandoModulos && (
        <DialogoModulos
          empresa={editandoModulos}
          modulos={modulos}
          onCerrar={() => setEditandoModulos(undefined)}
          onCambiado={() => void empresas.recargar()}
        />
      )}

      {editandoPlazo && (
        <DialogoPlazo
          empresa={editandoPlazo}
          onCerrar={() => setEditandoPlazo(undefined)}
          onGuardado={() => {
            setEditandoPlazo(undefined)
            void empresas.recargar()
          }}
        />
      )}

      {suspendiendo && (
        <DialogoSuspender
          empresa={suspendiendo}
          onCerrar={() => setSuspendiendo(undefined)}
          onHecho={() => {
            setSuspendiendo(undefined)
            void empresas.recargar()
          }}
        />
      )}
    </>
  )
}
