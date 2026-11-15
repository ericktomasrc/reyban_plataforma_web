import { useCallback, useEffect, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { revisionServicio, type AccesoRevision } from '../servicios/revisionServicio'

const dia = (iso: string) => new Date(iso).toLocaleDateString('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'short', year: 'numeric' })
const diaHora = (iso: string) => new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** «Culqi Perú» → «culqi-peru-revision» (lo puede cambiar). */
function usuarioSugerido(para: string) {
  const base = para.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20)
  return base ? `${base}-revision` : ''
}

/**
 * 089 — ACCESOS DE REVISIÓN. Para que alguien de fuera (Culqi, un banco, un
 * socio) pruebe la plataforma como un cliente: usuario y contraseña, sin
 * correo y sin segundo factor. Tú creas el acceso, entras con él para crear la
 * empresa (el asistente de siempre) y se lo pasas.
 */
export function AccesosRevisionPagina() {
  const mensaje = useMensaje()
  const { pedir, dialogo: confirmacion } = useConfirmar()
  const [lista, setLista] = useState<AccesoRevision[]>()
  const [error, setError] = useState<string>()
  const [creando, setCreando] = useState(false)
  const [clave, setClave] = useState<{ usuario: string; clave: string; nuevo: boolean }>()

  const cargar = useCallback(async () => {
    try { setLista(await revisionServicio.leer()); setError(undefined) }
    catch (e) { setError(e instanceof ErrorApi ? e.message : 'No se pudieron cargar los accesos.') }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  async function hacer(a: AccesoRevision, que: 'apagar' | 'alargar' | 'clave' | 'terminar' | 'dar') {
    if (que === 'apagar' && !(await pedir({
      titulo: `¿Apagar el acceso de ${a.para}?`,
      mensaje: 'Ya no podrá entrar y se cierran sus sesiones abiertas. Lo que hizo se conserva, y lo puedes volver a encender con «Alargar».',
      confirmar: 'Apagar', tono: 'peligro',
    }))) return
    if (que === 'clave' && !(await pedir({
      titulo: `¿Contraseña nueva para ${a.usuario}?`,
      mensaje: 'La anterior deja de servir y se cierran sus sesiones abiertas. La nueva se muestra una sola vez.',
      confirmar: 'Generar contraseña nueva',
    }))) return
    try {
      if (que === 'clave') {
        const r = await revisionServicio.clave(a.id)
        setClave({ usuario: a.usuario, clave: r.clave, nuevo: false })
      } else {
        const r = que === 'apagar' ? await revisionServicio.apagar(a.id)
          : que === 'alargar' ? await revisionServicio.alargar(a.id, 15)
          : await revisionServicio.prueba(a.id, que === 'dar')
        mensaje.bien(r.mensaje)
      }
      void cargar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo.')
    }
  }

  if (error) return <Aviso>{error}</Aviso>
  if (!lista) return <Cargando />

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">Accesos de revisión</h1>
          <p className="secundario">
            Para que alguien de fuera (Culqi, un banco, un socio) pruebe la plataforma como un cliente: entra con
            usuario y contraseña, sin correo y sin segundo factor. Todo lo que hace es de prueba: SUNAT beta y pagos
            de prueba. Vence solo.
          </p>
        </div>
        <Boton onClick={() => setCreando(true)}>Crear acceso</Boton>
      </div>

      {lista.length === 0 ? (
        <div className="bloque">
          <p><strong>Todavía no hay accesos de revisión.</strong></p>
          <p className="secundario">
            Crea uno con «Crear acceso». Después entra tú con ese usuario en una ventana privada, crea la empresa con el
            asistente y pásale el usuario y la contraseña a quien va a revisar.
          </p>
        </div>
      ) : (
        <div className="bloque sin-relleno">
          <table className="tabla tabla-revision">
            <thead><tr><th>Para quién</th><th>Estado</th><th>Empresas</th><th>Plan</th><th>Qué hizo</th><th /></tr></thead>
            <tbody>
              {lista.map(a => {
                const enPrueba = !!a.pruebaHasta && new Date(a.pruebaHasta) > new Date()
                return (
                  <tr key={a.id} className={a.estado === 'activo' ? undefined : 'apagada'}>
                    <td>
                      <div className="principal">{a.para}</div>
                      <div className="secundario">Usuario <code>{a.usuario}</code> · Cuenta {a.tipo === 'negocio' ? 'Negocio' : 'Profesional'}</div>
                    </td>
                    <td>
                      {a.estado === 'activo' && <span className="estado-empresa lista">Activo hasta el {dia(a.hasta)}</span>}
                      {a.estado === 'vencido' && <span className="estado-empresa apagado">Venció el {dia(a.hasta)}</span>}
                      {a.estado === 'apagado' && <span className="estado-empresa apagado">Apagado</span>}
                    </td>
                    <td>
                      {a.empresas.length === 0
                        ? <span className="secundario">Aún sin empresa: entra con el usuario y créala</span>
                        : a.empresas.map(e => <div key={e.ruc}>{e.nombre} <span className="secundario">· {e.ruc}</span></div>)}
                    </td>
                    <td>{enPrueba ? <>En prueba gratis<div className="secundario">hasta el {dia(a.pruebaHasta!)}</div></> : 'Prueba terminada'}</td>
                    <td className="secundario">
                      {a.ingresos === 0 ? 'Aún no entra' : <>Entró {a.ingresos} {a.ingresos === 1 ? 'vez' : 'veces'}{a.ultimoIngreso && <>, la última el {diaHora(a.ultimoIngreso)}</>}</>}
                      <div>{a.pagos === 0 ? 'Sin pagos' : `${a.pagos} pago(s) aprobado(s)`}{a.rechazos > 0 && ` · ${a.rechazos} rechazado(s)`}</div>
                    </td>
                    <td>
                      <div className="acciones-equipo">
                        <button type="button" className="enlace" onClick={() => void hacer(a, 'clave')}>Contraseña nueva</button>
                        {enPrueba
                          ? <button type="button" className="enlace" onClick={() => void hacer(a, 'terminar')}>Terminar la prueba</button>
                          : <button type="button" className="enlace" onClick={() => void hacer(a, 'dar')}>Dar prueba gratis</button>}
                        <button type="button" className="enlace" onClick={() => void hacer(a, 'alargar')}>
                          {a.estado === 'activo' ? 'Alargar 15 días' : 'Encender 15 días'}
                        </button>
                        {a.estado === 'activo' && <button type="button" className="enlace" onClick={() => void hacer(a, 'apagar')}>Apagar</button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="nota">
        Un acceso de revisión no puede invitar gente, cambiar su contraseña o su correo, subir certificado ni hacer
        traspasos. Cuando la plataforma cobre de verdad, sus pagos serán simulados y no llevan comprobante.
      </p>

      {creando && (
        <DialogoNuevo onCerrar={() => setCreando(false)}
                      onHecho={r => { setCreando(false); setClave({ ...r, nuevo: true }); void cargar() }} />
      )}
      {clave && <DialogoClave {...clave} onCerrar={() => setClave(undefined)} />}
      {confirmacion}
    </>
  )
}

function DialogoNuevo({ onCerrar, onHecho }: { onCerrar: () => void; onHecho: (r: { usuario: string; clave: string }) => void }) {
  const mensaje = useMensaje()
  const [para, setPara] = useState('')
  const [usuario, setUsuario] = useState('')
  const [usuarioTocado, setUsuarioTocado] = useState(false)
  const [tipo, setTipo] = useState<'negocio' | 'profesional'>('negocio')
  const [dias, setDias] = useState(15)
  const [enPrueba, setEnPrueba] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const usuarioFinal = usuarioTocado ? usuario : usuarioSugerido(para)

  async function crear() {
    setGuardando(true)
    try {
      const r = await revisionServicio.crear({ usuario: usuarioFinal.trim(), para: para.trim(), tipo, dias, enPrueba })
      onHecho({ usuario: r.usuario, clave: r.clave })
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo crear el acceso.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialogo titulo="Crear un acceso de revisión" abierto onCerrar={onCerrar}
             acciones={<><Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
               <Boton ocupado={guardando} disabled={para.trim().length < 2 || usuarioFinal.trim().length < 3} onClick={() => void crear()}>
                 Crear acceso
               </Boton></>}>
      <label className="campo"><span className="etiqueta">Para quién</span>
        <input className="sin-mayusculas" value={para} autoFocus maxLength={80} placeholder="Culqi" onChange={e => setPara(e.target.value)} />
        <span className="pista">Solo para reconocerlo. Se ve en la franja de arriba que verá el revisor.</span></label>

      <label className="campo"><span className="etiqueta">Usuario</span>
        <input className="sin-mayusculas" value={usuarioFinal} maxLength={30} placeholder="culqi-revision"
               onChange={e => { setUsuarioTocado(true); setUsuario(e.target.value.toLowerCase()) }} />
        <span className="pista">Entra con esto en el campo «Correo». Minúsculas, números, punto o guion; sin espacios.</span></label>

      <fieldset className="grupo-permisos">
        <legend>Tipo de cuenta</legend>
        <label><input type="radio" name="tipo" checked={tipo === 'negocio'} onChange={() => setTipo('negocio')} />
          <span><strong>Negocio</strong>: una empresa, la suya</span></label>
        <label><input type="radio" name="tipo" checked={tipo === 'profesional'} onChange={() => setTipo('profesional')} />
          <span><strong>Profesional</strong>: contadores y estudios, varias empresas (Cartera)</span></label>
      </fieldset>

      <fieldset className="grupo-permisos">
        <legend>Cómo empieza</legend>
        <label><input type="radio" name="prueba" checked={!enPrueba} onChange={() => setEnPrueba(false)} />
          <span><strong>Con la prueba gratis terminada</strong>: ve los menús con candado y tiene que elegir y pagar un plan (lo que pide Culqi)</span></label>
        <label><input type="radio" name="prueba" checked={enPrueba} onChange={() => setEnPrueba(true)} />
          <span><strong>En prueba gratis</strong>: todo abierto, con el aviso de los días que le quedan</span></label>
      </fieldset>

      <label className="campo"><span className="etiqueta">Puede entrar durante</span>
        <select value={dias} onChange={e => setDias(Number(e.target.value))}>
          {[7, 15, 30, 60].map(d => <option key={d} value={d}>{d} días</option>)}
        </select></label>

      <p className="nota">El rol es el de dueño de la cuenta (Administrador): ve y prueba todo lo que ve un cliente.</p>
    </Dialogo>
  )
}

function DialogoClave({ usuario, clave, nuevo, onCerrar }: { usuario: string; clave: string; nuevo: boolean; onCerrar: () => void }) {
  const mensaje = useMensaje()
  const direccion = `${window.location.origin}/entrar`
  const texto = `Dirección: ${direccion}\nUsuario (en el campo «Correo»): ${usuario}\nContraseña: ${clave}`

  async function copiar() {
    try { await navigator.clipboard.writeText(texto); mensaje.bien('Copiado.') }
    catch { mensaje.error('No se pudo copiar: selecciónalo y cópialo a mano.') }
  }

  return (
    <Dialogo titulo={nuevo ? 'Acceso creado' : 'Contraseña nueva'} abierto onCerrar={onCerrar}
             acciones={<><Boton estilo="secundario" onClick={() => void copiar()}>Copiar</Boton><Boton onClick={onCerrar}>Ya lo guardé</Boton></>}>
      <Aviso tono="ojo">Esta contraseña se muestra <strong>una sola vez</strong>. Cópiala ahora; si la pierdes, genera otra.</Aviso>
      <pre className="clave-revision">{texto}</pre>
      {nuevo && (
        <>
          <p><strong>Ahora prepara la empresa:</strong></p>
          <ol className="pasos-revision">
            <li>Abre una <strong>ventana privada</strong> del navegador y entra con ese usuario y esa contraseña.</li>
            <li>Completa el asistente como un cliente: RUC de prueba, razón social, dirección y, como correo del titular, el tuyo. Queda en SUNAT beta.</li>
            <li>Sal, y pásale el usuario y la contraseña a quien va a revisar.</li>
          </ol>
        </>
      )}
    </Dialogo>
  )
}