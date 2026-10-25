import { useCallback, useEffect, useState } from 'react'
import { Paginacion } from '../../../componentes/Paginacion'
import { usePaginaLocal } from '../../../nucleo/hooks/usePaginaLocal'
import { Link, useNavigate } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Cargando } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { useSesion, useYo } from '../../../nucleo/sesion/SesionContexto'
import { carteraServicio, estadoDe, hace, textoEstado } from '../servicios/carteraServicio'
import type { EmpresaCartera } from '../servicios/carteraServicio'
import { pedidosServicio } from '../servicios/pedidosServicio'
import type { Pedido, ReclamoSobreMia } from '../servicios/pedidosServicio'
import { FranjaReclamos } from '../componentes/ResponderReclamo'

type Filtro = 'todas' | 'atencion' | 'pausa' | 'pedidas'   // e175: los pedidos a su titular, en su pestaña

/**
 * «MIS EMPRESAS» (fase 3): la bandeja de la Cuenta Profesional.
 *
 * Las empresas que puede ver quien entra (el dueño, todas; un colaborador,
 * las que le dieron), con su estado. «Entrar» la abre y lleva a su inicio.
 * «Quitar de mi cartera» y «Reanudar» son solo del dueño: el back lo
 * comprueba igual.
 *
 * FASE 4d: arriba, la franja de los reclamos sobre empresas de la cuenta
 * («traspaso en revisión», con «Responder»); y los pedidos del camino B que
 * esperan al titular (o que él no aceptó).
 */
export function MisEmpresas() {
  const { cuenta } = useYo()
  const { refrescar } = useSesion()
  const mensaje = useMensaje()
  const navegar = useNavigate()

  const [empresas, setEmpresas] = useState<EmpresaCartera[] | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [buscar, setBuscar] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [menu, setMenu] = useState<string | null>(null)
  const [quitar, setQuitar] = useState<EmpresaCartera | null>(null)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [reclamos, setReclamos] = useState<ReclamoSobreMia[]>([])

  const dueno = cuenta?.nivel === 'dueno'
  const agrega = cuenta?.nivel !== 'colaborador'

  const cargar = useCallback(async () => {
    try { setEmpresas(await carteraServicio.empresas()); setFallo(null) }
    catch (e) { setFallo(e instanceof ErrorApi ? e.message : 'No se pudo leer tu cartera.') }

    // Lo de la fase 4d no tumba la bandeja si falla: es información de más.
    try { setReclamos(await pedidosServicio.reclamos()) } catch { setReclamos([]) }
    try { setPedidos(await pedidosServicio.mios()) } catch { setPedidos([]) }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  const entrar = async (e: EmpresaCartera, destino = '/') => {
    try {
      if (!e.abierta) await carteraServicio.abrir(e.id)
      await refrescar()
      navegar(destino)
    } catch (err) {
      mensaje.error(err instanceof ErrorApi ? err.message : 'No se pudo abrir esa empresa.')
    }
  }

  const reanudar = async (e: EmpresaCartera) => {
    setMenu(null)
    try {
      mensaje.bien((await carteraServicio.reanudar(e.id)).mensaje)
      await cargar()
    } catch (err) {
      mensaje.error(err instanceof ErrorApi ? err.message : 'No se pudo reanudar.')
    }
  }

  const cancelarPedido = async (p: Pedido) => {
    try {
      mensaje.bien((await pedidosServicio.cancelar(p.id)).mensaje)
      await cargar()
    } catch (err) {
      mensaje.error(err instanceof ErrorApi ? err.message : 'No se pudo cancelar.')
    }
  }

  const ocultarPedido = async (p: Pedido) => {
    try {
      await pedidosServicio.ocultar(p.id)
      await cargar()
    } catch (err) {
      mensaje.error(err instanceof ErrorApi ? err.message : 'No se pudo quitar de la lista.')
    }
  }

  const enRevision = (id: string) => reclamos.some(r => r.empresaId === id)

  // 24 oct: páginas (lo más nuevo arriba lo da el servidor). Antes de los
  // «return» de abajo: un hook no puede quedar detrás de uno.
  const textoB = buscar.trim().toLowerCase()
  const filtradas = (empresas ?? [])
    .filter(e => filtro === 'todas' ? true : filtro === 'pausa' ? !!e.pausadaEn
                 : ['falta', 'rechazos', 'certificado'].includes(estadoDe(e)))
    .filter(e => !textoB || e.nombre.toLowerCase().includes(textoB)
                 || (e.razonSocial ?? '').toLowerCase().includes(textoB) || (e.ruc ?? '').includes(textoB))
  const { visibles, paginacion } = usePaginaLocal(filtradas, `${textoB}|${filtro}`)

  if (fallo) return <Aviso>{fallo}</Aviso>
  if (!empresas) return <Cargando texto="Leyendo tu cartera…" />

  const atencion = empresas.filter(e => ['falta', 'rechazos', 'certificado'].includes(estadoDe(e)))
  const pausadas = empresas.filter(e => e.pausadaEn)
  const listas = empresas.filter(e => estadoDe(e) === 'lista')


  return (
    <>
      <div className="cabecera-bandeja">
        <div>
          <h1 className="titulo-pagina titulo-serif">Mis empresas</h1>
          <p className="bajada-pagina">Las empresas que gestionas. Entra en una para emitir; una a la vez.</p>
        </div>
        {agrega && <Link to="/configurar?nueva=1" className="boton">+ Agregar empresa</Link>}
      </div>

      <FranjaReclamos reclamos={reclamos} onRespondido={cargar} />

      {empresas.length === 0 ? (<>
        {pedidos.length > 0 && <PedidosATitulares pedidos={pedidos} onCancelar={cancelarPedido} onOcultar={ocultarPedido} />}
        <section className="bloque vacio-bandeja">
          <h2>Todavía no tienes empresas</h2>
          <p className="texto-paso">Agrega la primera y te guiamos hasta emitir.</p>
          {agrega && <Link to="/configurar?nueva=1" className="boton">Agregar mi primera empresa</Link>}
        </section>
      </>) : (
        <>
          <div className="resumen-bandeja">
            <div><strong>{empresas.length}</strong><span>en tu cartera</span></div>
            <div className="bien"><strong>{listas.length}</strong><span>listas para emitir</span></div>
            <div className="ojo"><strong>{atencion.length}</strong><span>necesitan atención</span></div>
            <div className="gris"><strong>{pausadas.length}</strong><span>en pausa</span></div>
          </div>

          <div className="filtros-bandeja">
            <input className="buscar-bandeja" placeholder="Buscar por nombre o RUC" value={buscar}
                   onChange={e => setBuscar(e.target.value)} aria-label="Buscar empresa" />
            <div className="segmentado">
              {([['todas', `Todas (${empresas.length})`], ['atencion', `Necesitan atención (${atencion.length})`],
                 ['pausa', `En pausa (${pausadas.length})`],
                 ...(pedidos.length > 0 || filtro === 'pedidas' ? [['pedidas', `Pedidas a su titular (${pedidos.length})`]] : [])] as [Filtro, string][]).map(([f, t]) => (
                <button key={f} type="button" className={filtro === f ? 'elegido' : undefined}
                        onClick={() => setFiltro(f)}>{t}</button>
              ))}
            </div>
          </div>

          {filtro === 'pedidas' ? (
            <PedidosATitulares pedidos={pedidos} onCancelar={cancelarPedido} onOcultar={ocultarPedido} />
          ) : <>
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr><th>Empresa</th><th>Estado</th><th>Último comprobante</th><th>La ven</th><th /></tr>
              </thead>
              <tbody>
                {visibles.map(e => {
                  const estado = estadoDe(e)
                  return (
                    <tr key={e.id} className={e.pausadaEn ? 'apagada' : undefined}>
                      <td>
                        <div className="principal">{e.nombre}{e.abierta && <span className="etiqueta acento abierta">abierta</span>}</div>
                        <div className="secundario mono">RUC {e.ruc} · {e.ambiente === 'produccion' ? 'producción' : 'beta'}</div>
                        {e.correoTitular && <div className="secundario">Titular: {e.correoTitular}</div>}
                      </td>
                      <td>
                        <span className={`estado-empresa ${estado}`}>{textoEstado(e)}</span>
                        {enRevision(e.id) && <span className="estado-empresa certificado en-revision">⇄ Traspaso en revisión</span>}
                        {e.pausadaEn && e.motivoPausa && <div className="secundario">«{e.motivoPausa}»</div>}
                      </td>
                      <td>{hace(e.ultimoDocumento)}</td>
                      <td>{e.laVen.length ? e.laVen.join(', ') : <span className="secundario">Solo tú</span>}</td>
                      <td className="acciones-bandeja">
                        {e.pausadaEn
                          ? dueno && (enRevision(e.id)
                              ? <span className="secundario">No se reanuda mientras se revisa</span>
                              : <Boton estilo="secundario" onClick={() => void reanudar(e)}>Reanudar</Boton>)
                          : <Boton onClick={() => void entrar(e)}>Entrar</Boton>}

                        {!e.pausadaEn && (
                          <div className="menu-fila">
                            <Boton estilo="secundario" aria-label={`Más acciones de ${e.nombre}`}
                                   aria-expanded={menu === e.id} onClick={() => setMenu(m => m === e.id ? null : e.id)}>⋯</Boton>
                            {menu === e.id && (
                              <div className="menu-fila-lista" role="menu">
                                {agrega && (
                                  <button type="button" role="menuitem" onClick={() => { setMenu(null); void entrar(e, '/configurar') }}>
                                    Configuración
                                  </button>
                                )}
                                {agrega && (
                                  <button type="button" role="menuitem" onClick={() => { setMenu(null); navegar('/colaboradores') }}>
                                    Quién la ve
                                  </button>
                                )}
                                {dueno && (
                                  <button type="button" role="menuitem" className="peligro"
                                          onClick={() => { setMenu(null); setQuitar(e) }}>
                                    Quitar de mi cartera
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {visibles.length === 0 && (
                  <tr><td colSpan={5} className="centro secundario">Ninguna empresa con ese filtro.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Paginacion {...paginacion} />
          </>}

          <p className="nota">
            Una empresa en pausa no emite y no se borra nada. Reanudarla la devuelve tal cual estaba.
          </p>
        </>
      )}

      {quitar && (
        <DialogoQuitar empresa={quitar} onCerrar={() => setQuitar(null)}
                       onHecho={async () => { setQuitar(null); await refrescar(); await cargar() }} />
      )}
    </>
  )
}


/**
 * Los pedidos del camino B (lienzo «Fase 4», pantalla 12): esperando al
 * titular, o lo que respondió. Los aprobados no salen: ya están en la lista.
 */
function PedidosATitulares({ pedidos, onCancelar, onOcultar }: {
  pedidos: Pedido[]
  onCancelar: (p: Pedido) => Promise<void>
  onOcultar: (p: Pedido) => Promise<void>
}) {
  const ESTADO: Record<Pedido['estado'], [string, string]> = {
    abierto:   ['esperando', '◷ Esperando al titular'],
    rechazado: ['apagado', 'El titular no aceptó'],
    vencido:   ['apagado', 'El titular no respondió'],
    cancelado: ['apagado', 'Pedido cancelado'],
  }

  return (
    <section className="bloque pedidos-titular">
      <h2>Pedidas a su titular</h2>
      <div className="tabla-envoltura">
        <table className="tabla">
          <tbody>
            {pedidos.map(p => {
              const [clase, texto] = ESTADO[p.estado]
              return (
                <tr key={p.id}>
                  <td>
                    <div className="principal">{p.empresa}</div>
                    <div className="secundario mono">RUC {p.ruc}</div>
                  </td>
                  <td>
                    <span className={`estado-empresa ${clase}`}>{texto}</span>
                    <div className="secundario">
                      {p.estado === 'abierto'
                        ? <>Pedida el {fecha(p.creadoEn)} · el enlace vence el {fecha(p.expiraEn)}</>
                        : <>{fecha(p.respondidoEn ?? p.expiraEn)}</>}
                    </div>
                  </td>
                  <td className="acciones-bandeja">
                    {p.estado === 'abierto'
                      ? <Boton estilo="secundario" onClick={() => void onCancelar(p)}>Cancelar pedido</Boton>
                      : <button type="button" className="enlace" onClick={() => void onOcultar(p)}>Quitar de la lista</button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="nota">Una empresa pedida no se abre hasta que su titular apruebe. Te avisamos por correo.</p>
    </section>
  )
}


/**
 * «Quitar de mi cartera»: motivo obligatorio (lo lee el titular) y, para
 * confirmar, el RUC. La empresa queda en pausa; nada se borra.
 */
function DialogoQuitar({ empresa, onCerrar, onHecho }: {
  empresa: EmpresaCartera; onCerrar: () => void; onHecho: () => Promise<void>
}) {
  const mensaje = useMensaje()
  const [motivo, setMotivo] = useState('')
  const [ruc, setRuc] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const confirmar = async () => {
    setError(null)
    if (motivo.trim().length < 10) { setError('Escribe el motivo (mínimo 10 caracteres): lo leerá el titular.'); return }
    if (ruc.trim() !== empresa.ruc) { setError('El RUC no coincide.'); return }

    setOcupado(true)
    try {
      mensaje.bien((await carteraServicio.pausar(empresa.id, motivo.trim(), ruc.trim())).mensaje)
      await onHecho()
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo quitar.')
      setOcupado(false)
    }
  }

  return (
    <Dialogo
      titulo={`Quitar ${empresa.nombre} de tu cartera`}
      abierto
      onCerrar={onCerrar}
      acciones={
        <>
          <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton estilo="peligro" onClick={() => void confirmar()} ocupado={ocupado} textoOcupado="Quitando…">
            Quitar de mi cartera
          </Boton>
        </>
      }
    >
      <ul className="lista-nota">
        <li>La empresa pasa a <strong>«En pausa»</strong>: no emite. <strong>No se borra nada</strong>:
            comprobantes, clientes y series se quedan.</li>
        <li>Le escribimos al titular para avisarle.</li>
        <li>Tus colaboradores dejan de verla mientras esté en pausa.</li>
      </ul>

      <div className="campo">
        <label htmlFor="motivo-pausa">Motivo <span className="detalle-paso">(obligatorio, lo verá el titular)</span></label>
        <textarea id="motivo-pausa" rows={3} maxLength={500} value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  placeholder="El cliente decidió llevar su contabilidad con otro estudio." />
        <span className="pista">{motivo.length} / 500</span>
      </div>

      <div className="aviso ojo">
        Recomiéndale al titular <strong>cambiar la clave de su usuario SOL secundario</strong>: tu estudio la conocía.
      </div>

      <Campo etiqueta="Para confirmar, escribe el RUC" className="mono" inputMode="numeric" maxLength={11}
             value={ruc} onChange={e => setRuc(e.target.value)} placeholder={empresa.ruc ?? ''} />

      {error && <Aviso>{error}</Aviso>}
    </Dialogo>
  )
}