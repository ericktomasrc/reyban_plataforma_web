import { useState } from 'react'
import { Paginacion } from '../../../componentes/Paginacion'
import { FiltroFechas } from '../../../componentes/FiltrosComunes'
import { contiene, usePaginaLocal } from '../../../nucleo/hooks/usePaginaLocal'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { useCargar } from '../../../nucleo/hooks/useCargar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { DialogoAltaEmpresa } from '../componentes/DialogoAltaEmpresa'
import { DialogoModulos } from '../componentes/DialogoModulos'
import { DialogoPlazo } from '../componentes/DialogoPlazo'
import { DialogoSuspender } from '../componentes/DialogoSuspender'
import { DialogoFacturacion } from '../componentes/DialogoFacturacion'
import { DialogoVerComo } from '../componentes/DialogoVerComo'
import { empresasServicio } from '../servicios/empresasServicio'
import { diasHasta } from '../../cartera/servicios/carteraServicio'
import { fecha } from '../../../nucleo/formato/fechas'
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
  const [facturacion, setFacturacion]   = useState<EmpresaEnLista>()
  const [qE, setQE] = useState('')
  const [estadoE, setEstadoE] = useState('todas')
  const [desdeE, setDesdeE] = useState('')
  const [hastaE, setHastaE] = useState('')

  const mensaje = useMensaje()

  const modulos = catalogo.datos ?? []

  /** El nombre bonito del módulo; si no está en el catálogo, su código. */
  const nombreModulo = (codigo: string) =>
    modulos.find(m => m.codigo === codigo)?.nombre ?? codigo

  async function reactivar(empresa: EmpresaEnLista) {
    try {
      await empresasServicio.reactivar(empresa.id)
      await empresas.recargar()
    } catch {
      mensaje.error(`No se pudo reactivar ${empresa.nombre}.`)
    }
  }

  // 24 oct: buscar, estado, fechas de alta y páginas (antes del «return»).
  const filtradas = (empresas.datos ?? []).filter(e =>
    contiene(qE, e.nombre, e.ruc, e.razonSocial) &&
    (estadoE === 'todas' || (estadoE === 'certificado' ? certificadoUrgente(e) : estadoE === 'suspendidas' ? !!e.suspendidaEn : estadoE === 'activas' ? e.activo && !e.suspendidaEn : !e.activo)) &&
    (!desdeE || (e.creadoEn ?? '').slice(0, 10) >= desdeE) && (!hastaE || (e.creadoEn ?? '').slice(0, 10) <= hastaE))
  const { visibles, paginacion } = usePaginaLocal(filtradas, `${qE}|${estadoE}|${desdeE}|${hastaE}`)

  if (empresas.cargando && !empresas.datos) return <Cargando />

  return (
    <>
      <div className="encabezado-pagina">
        <h1 className="titulo-pagina">Empresas</h1>
        {/* e193: cada botón, solo a quien tiene su permiso (equipo de la plataforma). */}
        <Si puede={Permisos.Plataforma.EmpresasGestionar}>
          <Boton onClick={() => setCreando(true)}>Dar de alta</Boton>
        </Si>
      </div>

      {empresas.error && <Aviso>{empresas.error}</Aviso>}

      {empresas.datos && <CertificadosPorVencer empresas={empresas.datos} filtrando={estadoE === 'certificado'}
                                                onVer={() => { setEstadoE('certificado'); setQE(''); setDesdeE(''); setHastaE('') }} />}

      <div className="filtros-lista">
        <label className="buscar"><span>Buscar</span>
          <input value={qE} onChange={e => setQE(e.target.value)} placeholder="Nombre, RUC o razón social" /></label>
        <label><span>Estado</span>
          <select value={estadoE} onChange={e => setEstadoE(e.target.value)}>
            <option value="todas">Todas</option><option value="activas">Activas</option>
            <option value="suspendidas">Suspendidas</option><option value="desactivadas">Desactivadas</option>
            <option value="certificado">Certificado por vencer o vencido</option>
          </select></label>
        <FiltroFechas desde={desdeE} hasta={hastaE} onDesde={setDesdeE} onHasta={setHastaE} />
      </div>

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
              {visibles.map(e => {
                const suspendida = e.suspendidaEn !== null

                return (
                  <tr key={e.id} className={suspendida ? 'apagada' : undefined}>
                    <td>
                      <div className="principal">{e.nombre}</div>
                      {e.razonSocial && e.razonSocial !== e.nombre && (
                        <div className="secundario">{e.razonSocial}</div>
                      )}
                      {suspendida && e.motivoSuspension && (
                        <div className="secundario">{e.motivoSuspension}</div>
                      )}
                    </td>

                    <td>
                      {e.ruc
                        ? <span className="mono">{e.ruc}</span>
                        : <span className="vacio">sin conectar</span>}
                      {e.ambiente && (
                        <div className="secundario">{e.ambiente === 'produccion' ? 'producción' : 'beta'}</div>
                      )}
                    </td>

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
                      <MarcasDeFacturacion empresa={e} />
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

                      <Si puede={Permisos.Plataforma.ModulosGestionar}>
                        <Boton estilo="plano" onClick={() => setEditandoModulos(e)}>
                          Módulos
                        </Boton>
                      </Si>

                      <Si puede={Permisos.Plataforma.EmpresasGestionar}>
                        <Boton estilo="plano" onClick={() => setEditandoPlazo(e)}>
                          Enlaces
                        </Boton>
                      </Si>

                      {/* SIEMPRE, no solo con el módulo activo: desde la
                          parte C la empresa nace conectada, y esta ventana es
                          donde se ve qué le falta para PODER activarlo. */}
                      <Si puede={Permisos.Plataforma.CredencialesGestionar}>
                        <Boton estilo="plano" onClick={() => setFacturacion(e)}>
                          Facturación
                        </Boton>
                      </Si>

                      <Si puede={Permisos.Plataforma.EmpresasGestionar}>
                        {suspendida ? (
                          <Boton estilo="plano" onClick={() => void reactivar(e)}>
                            Reactivar
                          </Boton>
                        ) : (
                          <Boton estilo="plano" onClick={() => setSuspendiendo(e)}>
                            Suspender
                          </Boton>
                        )}
                      </Si>
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
      <Paginacion {...paginacion} />

      <DialogoAltaEmpresa
        abierto={creando}
        modulos={modulos}
        onCerrar={() => setCreando(false)}
        onCreada={(r, confirmada) => {
          setCreando(false)

          // El correo puede no haber salido sin que eso impida crear la
          // empresa: el aviso tiene que distinguir los dos casos, o alguien se
          // quedará esperando un correo que nunca llegó. Lo mismo con la
          // confirmación al servicio: si no llegó, se reintenta sola.
          const creada = `${r.empresa.nombre} quedó creada aquí y en el servicio (beta).`

          if (r.administrador.invitacionEnviada && confirmada) {
            mensaje.bien(
              `${creada} Le mandamos a ${r.administrador.correo} el enlace para elegir su contraseña. ` +
              'Ahora carga en el panel del servicio el certificado, el usuario SOL, las series y la Marca.')
          } else {
            // NI ROJO NI VERDE: la empresa SÍ quedó creada, y pintarlo de rojo
            // haría pensar que hay que repetir el alta. Ámbar, que es «salió,
            // pero léelo».
            mensaje.ojo(
              creada +
              (r.administrador.invitacionEnviada ? '' :
                ` Pero el correo a ${r.administrador.correo} no salió: reenvíalo desde sus usuarios.`) +
              (confirmada ? '' :
                ' El servicio no recibió la confirmación del alta: se confirma sola al abrir Facturación y pulsar «Volver a preguntar al servicio».'))
          }

          void empresas.recargar()
        }}
      />

      {facturacion && (
        <DialogoFacturacion
          empresa={facturacion}
          onCerrar={() => setFacturacion(undefined)}
          onCambiado={() => void empresas.recargar()}
        />
      )}

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


/**
 * Las marcas de facturación de una fila, de lo último que dijo el servicio
 * (la lista no le pregunta: tiene que abrir aunque esté apagado). Un `null`
 * es «todavía no se preguntó»: no se pinta nada, ni bueno ni malo.
 */
function MarcasDeFacturacion({ empresa }: { empresa: EmpresaEnLista }) {
  const f = empresa.facturacion
  if (!f) return null

  const conModulo = empresa.modulos.includes('facturacion')
  const marcas: { clase: string; texto: string }[] = []

  if (f.claveAnteriorPendiente)
    marcas.push({ clase: 'estado malo', texto: 'Clave anterior sin revocar' })
  if (f.altaSinConfirmar)
    marcas.push({ clase: 'estado aviso', texto: 'Alta sin confirmar' })
  if (f.listoParaEmitir === false)
    marcas.push({ clase: conModulo ? 'estado malo' : 'estado aviso', texto: 'Le falta algo para emitir' })
  if (f.listoParaEmitir === true && !conModulo)
    marcas.push({ clase: 'estado bueno', texto: 'Lista para activar Facturación' })
  if (f.correosAlReceptor === false)
    marcas.push({ clase: 'estado aviso', texto: 'Sin correo al receptor' })

  // EL CERTIFICADO (paso 6.2): a 30 días o menos, en ámbar; a 7 o vencido,
  // en rojo. Es lo que más rápido deja a un cliente sin poder facturar.
  const dias = f.certificadoValidoHasta ? diasHasta(f.certificadoValidoHasta) : null
  if (dias !== null && dias <= 30)
    marcas.push({
      clase: dias <= 7 ? 'estado malo' : 'estado aviso',
      texto: dias < 0 ? 'Certificado vencido'
           : dias === 0 ? 'Certificado vence hoy'
           : `Certificado vence en ${dias} día${dias === 1 ? '' : 's'}`
    })

  return (
    <>
      {marcas.map(m => (
        <div key={m.texto}><span className={m.clase}>{m.texto}</span></div>
      ))}
    </>
  )
}


/**
 * La franja de arriba: las empresas con el certificado a 30 días o menos, la
 * más urgente primero. Las suspendidas no cuentan: no pueden emitir igual.
 *
 * NO MANDA NADA: los correos los manda la plataforma sola (AvisosCertificado,
 * paso 6.3) a los 30, 15, 7 y 1 días y el día que vence. Esto es para que el
 * super administrador lo vea sin abrir cada empresa.
 */
/** e196: no suspendida y con el certificado a 30 días o menos (o ya vencido). */
function certificadoUrgente(e: EmpresaEnLista): boolean {
  return e.suspendidaEn === null && !!e.facturacion?.certificadoValidoHasta && diasHasta(e.facturacion.certificadoValidoHasta) <= 30
}

function CertificadosPorVencer({ empresas, filtrando, onVer }: { empresas: EmpresaEnLista[]; filtrando: boolean; onVer: () => void }) {
  const urgentes = empresas
    .filter(certificadoUrgente)
    .map(e => ({ e, dias: diasHasta(e.facturacion!.certificadoValidoHasta!) }))
    .sort((a, b) => a.dias - b.dias)

  if (urgentes.length === 0) return null

  const vencidas = urgentes.filter(x => x.dias < 0).length

  return (
    <Aviso tono={urgentes[0].dias <= 7 ? 'error' : 'ojo'}>
      <strong>
        {urgentes.length === 1
          ? 'Una empresa tiene el certificado digital por vencer'
          : `${urgentes.length} empresas tienen el certificado digital por vencer`}
        {vencidas > 0 && ` (${vencidas === 1 ? 'una ya venció' : `${vencidas} ya vencieron`})`}.
      </strong>{' '}
      {urgentes.slice(0, 5).map((x, i) => (
        <span key={x.e.id}>
          {i > 0 && ' · '}
          {x.e.nombre}: {x.dias < 0 ? `venció el ${fecha(x.e.facturacion!.certificadoValidoHasta!)}`
                       : x.dias === 0 ? 'vence hoy'
                       : `${x.dias} día${x.dias === 1 ? '' : 's'}`}
        </span>
      ))}
      {urgentes.length > 5 && <> · y {urgentes.length - 5} más</>}
      . Sin certificado no pueden emitir. Ya les llega el aviso por correo.{' '}
      {/* e196: ver todas en la tabla (filtra por «Certificado por vencer o vencido»). */}
      {!filtrando && (
        <button type="button" className="enlace" onClick={onVer}>
          {urgentes.length === 1 ? 'Verla en la tabla' : `Ver las ${urgentes.length} en la tabla`}
        </button>
      )}
    </Aviso>
  )
}