import { useCallback, useEffect, useState } from 'react'
import { Paginacion } from '../../../componentes/Paginacion'
import { contiene, usePaginaLocal } from '../../../nucleo/hooks/usePaginaLocal'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Asterisco, Campo } from '../../../componentes/Campo'
import { nombresDeCargos } from '../../usuarios/servicios/cargosServicio'
import { Cargando } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { useYo } from '../../../nucleo/sesion/SesionContexto'
import { CamposFicha, FICHA_VACIA, NOMBRE_DOCUMENTO, fichaDe, paraEnviar, problemaFicha } from '../../usuarios/componentes/CamposFicha'
import type { DatosFicha } from '../../usuarios/componentes/CamposFicha'
import { EXPLICA_ALCANCE, NOMBRE_ALCANCE } from '../../usuarios/tipos'
import type { TipoAlcance } from '../../usuarios/tipos'
import { carteraServicio, NOMBRE_NIVEL } from '../servicios/carteraServicio'
import type { AccesoEquipo, DatosAccesoEquipo, EmpresaEquipo, Nivel, PersonaEquipo } from '../servicios/carteraServicio'

const JEFE = '55555555-5555-5555-5555-555555555555'
const FACTURADOR = '22222222-2222-2222-2222-222222222222'

/**
 * 046 — MI EQUIPO (antes «Colaboradores»; solo Cuenta Profesional; maqueta
 * aprobada, pantalla 5). Acento azul: es de «Mi estudio», no de una empresa.
 *
 * Las personas del estudio con la MISMA ficha que el personal de una empresa,
 * y cada una con un acceso POR EMPRESA de la cartera: su rol, su alcance y
 * sus sucursales en esa empresa. Un solo correo y una sola contraseña para
 * todas: arriba elige en cuál trabaja («Trabajando en»).
 *
 *   Colaborador                 un acceso por empresa (rol, alcance, sucursales)
 *   Colaborador administrador   administrador en todas las empresas
 *   Dueño                       todo; el único que quita personas
 *
 * 047: el acceso de cada empresa (rol, alcance, sucursales) se configura en
 * la MISMA ventana, antes de enviar la invitación: nunca hay un momento en que
 * vea de más. El cargo sale de la maestra del estudio (Cargos del estudio).
 *
 * Quién puede qué lo decide la base (equipo_puede); aquí se esconde lo que
 * daría error. Nada se borra: quitar a alguien lo desactiva.
 */
export function Colaboradores() {
  const { usuario, cuenta } = useYo()
  const mensaje = useMensaje()
  const { pedir, dialogo: confirmacion } = useConfirmar()

  const [personas, setPersonas] = useState<PersonaEquipo[] | null>(null)
  const [empresas, setEmpresas] = useState<EmpresaEquipo[]>([])
  const [fallo, setFallo] = useState<string | null>(null)
  const [abierta, setAbierta] = useState<PersonaEquipo | 'nueva' | null>(null)
  const [qE, setQE] = useState('')
  const [cargoE, setCargoE] = useState('')
  const [estadoE, setEstadoE] = useState('todos')

  const dueno = cuenta?.nivel === 'dueno'

  const cargar = useCallback(async () => {
    try {
      const [p, e] = await Promise.all([carteraServicio.equipo(), carteraServicio.equipoEmpresas()])
      setPersonas(p); setEmpresas(e); setFallo(null)
      return p
    } catch (err) {
      setFallo(err instanceof ErrorApi ? err.message : 'No se pudo leer tu equipo.')
      return null
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  // 24 oct: buscar, cargo, estado y páginas (antes de los «return»).
  const filtradas = (personas ?? []).filter(c =>
    contiene(qE, c.nombre, c.correo, c.numeroDocumento) &&
    (!cargoE || c.cargo === cargoE) &&
    (estadoE === 'todos' || (estadoE === 'activos' ? c.activo : !c.activo)))
  const { visibles, paginacion } = usePaginaLocal(filtradas, `${qE}|${cargoE}|${estadoE}`)
  const cargosHay = [...new Set((personas ?? []).map(c => c.cargo).filter((x): x is string => !!x))].sort()

  if (fallo) return <Aviso>{fallo}</Aviso>
  if (!personas) return <Cargando texto="Leyendo tu equipo…" />

  const editable = (c: PersonaEquipo) => c.activo
    && (c.id === usuario.id || (c.nivel !== 'dueno' && (dueno || c.nivel === 'colaborador')))

  const quitar = async (c: PersonaEquipo) => {
    const seguro = await pedir({
      titulo: `Quitar a ${c.nombre} de tu equipo`,
      confirmar: 'Quitar',
      tono: 'peligro',
      mensaje: <p>Deja de entrar en el acto y se cierran sus sesiones. No se borra nada.</p>,
    })
    if (!seguro) return
    try {
      mensaje.bien((await carteraServicio.quitar(c.id)).mensaje)
      setAbierta(null)
      await cargar()
    } catch (err) {
      mensaje.error(err instanceof ErrorApi ? err.message : 'No se pudo quitar.')
    }
  }

  // 048: un enlace nuevo; el anterior deja de valer.
  const reinvitar = async (c: PersonaEquipo) => {
    const seguro = await pedir({
      titulo: 'Reenviar la invitación',
      confirmar: 'Reenviar',
      mensaje: <p>Le llega a <strong>{c.correo}</strong> un enlace nuevo, válido 3 días. El anterior deja de servir.</p>,
    })
    if (!seguro) return
    try {
      const r = await carteraServicio.reinvitar(c.id)
      if (r.enviado) mensaje.bien(r.mensaje)
      else mensaje.error(r.mensaje + (r.enlaceDePrueba ? ` Enlace de prueba: ${r.enlaceDePrueba}` : ''))
      await cargar()
    } catch (err) {
      mensaje.error(err instanceof ErrorApi ? err.message : 'No se pudo reenviar la invitación.')
    }
  }

  return (
    <div className="mi-equipo">
      <div className="cabecera-bandeja">
        <div>
          <span className="marca-estudio">MI ESTUDIO · SOLO CUENTA PROFESIONAL</span>
          <h1 className="titulo-pagina titulo-serif">Mi equipo</h1>
          <p className="bajada-pagina">
            Las personas que trabajan en tu estudio. Misma ficha que el personal; cada una con un acceso por empresa de tu
            cartera.
          </p>
        </div>
        <Boton onClick={() => setAbierta('nueva')}>Agregar a mi equipo</Boton>
      </div>

      {personas.length > 1 && (
        <div className="filtros-lista">
          <label className="buscar"><span>Buscar</span>
            <input value={qE} onChange={e => setQE(e.target.value)} placeholder="Nombre, correo o documento" /></label>
          {cargosHay.length > 0 && (
            <label><span>Cargo</span>
              <select value={cargoE} onChange={e => setCargoE(e.target.value)}>
                <option value="">Todos</option>
                {cargosHay.map(c => <option key={c} value={c}>{c}</option>)}
              </select></label>
          )}
          <label><span>Estado</span>
            <select value={estadoE} onChange={e => setEstadoE(e.target.value)}>
              <option value="todos">Todos</option><option value="activos">Activos</option><option value="inactivos">Desactivados</option>
            </select></label>
        </div>
      )}

      <div className="bloque sin-relleno">
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr><th>Persona</th><th>Cargo</th><th>Empresas · rol · alcance</th><th>Estado</th><th /></tr>
            </thead>
            <tbody>
              {visibles.map(c => (
                <tr key={c.id} className={!c.activo ? 'apagada' : undefined}>
                  <td>
                    <div className="principal">
                      {c.nombre}
                      {c.id === usuario.id && <span className="etiqueta marca-yo">tú</span>}
                    </div>
                    {c.fichaIncompleta
                      ? <div className="ficha-incompleta">Ficha incompleta · {c.correo}</div>
                      : <div className="secundario">{NOMBRE_DOCUMENTO[c.tipoDocumento ?? '1']} {c.numeroDocumento} · {c.correo}</div>}
                  </td>
                  <td>
                    {c.cargo ?? <span className="vacio">—</span>}
                    <div className="secundario">{NOMBRE_NIVEL[c.nivel]}</div>
                  </td>
                  <td><ResumenAccesos persona={c} empresas={empresas} /></td>
                  <td className={!c.activo ? 'secundario' : c.invitacionVencida && c.nivel !== 'dueno' ? 'texto-mal'
                                 : c.pendiente && c.nivel !== 'dueno' ? 'texto-ojo' : 'texto-bien'}>
                    {!c.activo ? 'Quitado'
                      : c.invitacionVencida && c.nivel !== 'dueno' ? 'Invitación vencida'
                      : c.pendiente && c.nivel !== 'dueno' ? 'Invitación enviada' : 'Activo'}
                  </td>
                  <td className="acciones">
                    {c.activo && c.pendiente && c.nivel !== 'dueno' && editable(c) && (
                      <Boton estilo={c.invitacionVencida ? 'secundario' : 'plano'} onClick={() => void reinvitar(c)}>
                        Reenviar la invitación
                      </Boton>
                    )}
                    {editable(c) && (
                      <Boton estilo="secundario" onClick={() => setAbierta(c)}>
                        {c.fichaIncompleta ? 'Completar ficha' : 'Editar'}
                      </Boton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Paginacion {...paginacion} />

      <p className="nota">
        Un solo correo y una sola contraseña para todas sus empresas. Arriba elige en cuál trabaja («Trabajando en»).
        Datos personales protegidos (Ley 29733): la ficha la ven el dueño, los colaboradores administradores y la
        propia persona.
      </p>

      {abierta === 'nueva' && (
        <DialogoNuevo
          empresas={empresas}
          dueno={dueno}
          onCerrar={() => setAbierta(null)}
          onListo={async m => { setAbierta(null); mensaje.bien(m); await cargar() }}
        />
      )}

      {abierta && abierta !== 'nueva' && (
        <DialogoPersona
          key={abierta.id}
          persona={abierta}
          empresas={empresas}
          dueno={dueno}
          soyYo={abierta.id === usuario.id}
          onCerrar={() => setAbierta(null)}
          onQuitar={dueno && abierta.id !== usuario.id && abierta.nivel !== 'dueno' ? () => void quitar(abierta) : undefined}
          onListo={async m => { setAbierta(null); mensaje.bien(m); await cargar() }}
        />
      )}

      {confirmacion}
    </div>
  )
}


function nombresSucursales(a: AccesoEquipo, empresas: EmpresaEquipo[]): string {
  const e = empresas.find(x => x.id === a.empresaId)
  return a.sucursales.map(id => e?.sucursales.find(s => s.id === id)?.nombre ?? '(desactivada)').join(', ')
}

function ResumenAccesos({ persona, empresas }: { persona: PersonaEquipo; empresas: EmpresaEquipo[] }) {
  if (persona.nivel !== 'colaborador') {
    return <>Todas ({persona.accesos.length}) · Administrador · Toda la empresa</>
  }
  if (persona.accesos.length === 0) return <span className="secundario">Ninguna empresa</span>
  return (
    <div className="accesos-empresa">
      {persona.veTodas && <span className="secundario">Ve todas las empresas</span>}
      {persona.accesos.map(a => (
        <span key={a.empresaId}>
          {a.empresa} · {a.rol}{a.notas ? ' + notas' : ''} · {NOMBRE_ALCANCE[a.alcance]}
          {a.alcance !== 'empresa' && a.sucursales.length > 0 && ` (${nombresSucursales(a, empresas)})`}
        </span>
      ))}
    </div>
  )
}


// =============================================================================
// EL ACCESO DE CADA EMPRESA, EN LA MISMA LISTA (047)
// =============================================================================

type Accesos = Record<string, DatosAccesoEquipo>

function accesoNuevo(e: EmpresaEquipo): DatosAccesoEquipo {
  return {
    rol: e.roles.find(r => r.id === FACTURADOR)?.id ?? e.roles[0]?.id ?? '',
    alcance: 'empresa', sucursales: [], sucursalDefecto: null, notas: false,
  }
}

function accesosDe(p: PersonaEquipo): Accesos {
  const r: Accesos = {}
  for (const a of p.accesos) {
    r[a.empresaId] = { rol: a.rolId, alcance: a.alcance, sucursales: a.sucursales, sucursalDefecto: a.defecto, notas: a.notas }
  }
  return r
}

/** Lo que falta en algún acceso, o null. */
function problemaAccesos(accesos: Accesos, empresas: EmpresaEquipo[]): string | null {
  for (const e of empresas) {
    const a = accesos[e.id]
    if (!a) continue
    if (!a.rol) return `Elige su rol en ${e.nombre}.`
    if (e.sucursales.length > 1 && a.alcance !== 'empresa' && a.sucursales.length === 0)
      return `Marca en qué sucursal de ${e.nombre} trabaja.`
  }
  return null
}

/** Lo que se manda de un acceso: sin sucursales si la empresa tiene un solo local. */
function paraEnviarAcceso(a: DatosAccesoEquipo, e: EmpresaEquipo): DatosAccesoEquipo {
  const varias = e.sucursales.length > 1
  const sucursales = varias ? a.sucursales : []
  return {
    ...a,
    alcance: !varias && a.alcance === 'sucursal' ? 'empresa' : a.alcance,
    sucursales,
    sucursalDefecto: varias ? (a.sucursalDefecto && sucursales.includes(a.sucursalDefecto) ? a.sucursalDefecto : sucursales[0] ?? null) : null,
    notas: a.notas && a.rol !== JEFE,
  }
}

function AccesosPorEmpresa({ empresas, accesos, onAccesos, veTodas, onVeTodas, conDetalle }: {
  empresas: EmpresaEquipo[]
  accesos: Accesos
  onAccesos: (a: Accesos) => void
  veTodas: boolean
  onVeTodas: (v: boolean) => void
  /** Colaborador: rol, alcance y sucursales por empresa. Administrador: solo cuáles ve. */
  conDetalle: boolean
}) {
  const marcar = (e: EmpresaEquipo, si: boolean) => {
    const n = { ...accesos }
    if (si) n[e.id] = accesos[e.id] ?? accesoNuevo(e)
    else delete n[e.id]
    onAccesos(n)
  }
  const cambiar = (id: string, c: Partial<DatosAccesoEquipo>) => onAccesos({ ...accesos, [id]: { ...accesos[id], ...c } })

  return (
    <fieldset className="grupo-empresas">
      <legend>Qué empresas ve{conDetalle ? ', y qué hace en cada una' : ''}</legend>
      <label className="casilla-terminos">
        <input type="checkbox" checked={veTodas} onChange={e => {
          onVeTodas(e.target.checked)
          if (e.target.checked) {
            const n: Accesos = { ...accesos }
            for (const x of empresas) n[x.id] = n[x.id] ?? accesoNuevo(x)
            onAccesos(n)
          }
        }} />
        Todas (y las que agregues después{conDetalle ? ', como Facturador con toda la empresa' : ''})
      </label>
      {empresas.length === 0 && <span className="secundario">Todavía no hay empresas en la cartera.</span>}

      <div className="empresas-acceso">
        {empresas.map(e => {
          const a = accesos[e.id]
          const varias = e.sucursales.length > 1
          const marcadas = e.sucursales.filter(s => a?.sucursales.includes(s.id))
          const defecto = a?.sucursalDefecto && a.sucursales.includes(a.sucursalDefecto) ? a.sucursalDefecto : marcadas[0]?.id ?? ''
          const rol = e.roles.find(r => r.id === a?.rol)
          return (
            <div key={e.id} className={'empresa-acceso' + (a ? ' marcada' : '')}>
              <label className="cabeza">
                <input type="checkbox" checked={!!a} disabled={veTodas} onChange={x => marcar(e, x.target.checked)} />
                {e.nombre}
              </label>
              {a && conDetalle && (
                <div className="detalle">
                  <div className="fila">
                    <label className="campo">
                      <span className="etiqueta">Rol<Asterisco /></span>
                      <select value={a.rol} onChange={x => cambiar(e.id, { rol: x.target.value })}>
                        {e.roles.map(r => <option key={r.id} value={r.id}>{r.nombre}{r.deSistema ? '' : ' (rol propio)'}</option>)}
                      </select>
                      {rol?.descripcion && <span className="pista">{rol.descripcion}</span>}
                    </label>
                    <div className="opciones-alcance" role="radiogroup" aria-label={`Alcance en ${e.nombre}`}>
                      <span className="rotulo">Qué puede ver<Asterisco /></span>
                      {(['empresa', 'sucursal', 'propio'] as TipoAlcance[]).filter(x => x !== 'sucursal' || varias).map(x => (
                        <label key={x}>
                          <input type="radio" name={`alcance-${e.id}`} checked={(a.alcance === 'sucursal' && !varias ? 'empresa' : a.alcance) === x}
                                 onChange={() => cambiar(e.id, { alcance: x })} />
                          <span><strong>{NOMBRE_ALCANCE[x]}</strong> — {EXPLICA_ALCANCE[x]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {varias && (
                    <div className="fila">
                      <div className="casillas-acceso">
                        <span className="rotulo">Sucursales{a.alcance !== 'empresa' && <Asterisco />}</span>
                        {e.sucursales.map(s => (
                          <label key={s.id}>
                            <input type="checkbox" checked={a.sucursales.includes(s.id)}
                                   onChange={x => cambiar(e.id, { sucursales: x.target.checked ? [...a.sucursales, s.id] : a.sucursales.filter(y => y !== s.id) })} />
                            <span>{s.nombre} ({s.codigo})</span>
                          </label>
                        ))}
                      </div>
                      <label className="campo">
                        <span className="etiqueta">Sucursal por defecto</span>
                        <select value={defecto} disabled={marcadas.length === 0}
                                onChange={x => cambiar(e.id, { sucursalDefecto: x.target.value || null })}>
                          {marcadas.length === 0 && <option value="">—</option>}
                          {marcadas.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.codigo})</option>)}
                        </select>
                      </label>
                    </div>
                  )}
                  {a.rol !== JEFE && (
                    <label className="casillas-acceso">
                      <span>
                        <input type="checkbox" checked={a.notas} onChange={x => cambiar(e.id, { notas: x.target.checked })} />{' '}
                        Puede hacer notas de crédito y débito
                      </span>
                    </label>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}

function SelectorNivel({ nivel, onCambio, dueno }: { nivel: Nivel; onCambio: (n: Nivel) => void; dueno: boolean }) {
  return (
    <fieldset className="grupo-nivel">
      <legend>Nivel</legend>
      <label className={'opcion-nivel' + (nivel === 'colaborador' ? ' elegida' : '')}>
        <input type="radio" name="nivel" checked={nivel === 'colaborador'} onChange={() => onCambio('colaborador')} />
        <span><strong>Colaborador</strong><span>En cada empresa, el rol, alcance y sucursales que le des.</span></span>
      </label>
      {dueno && (
        <label className={'opcion-nivel' + (nivel === 'colaborador_admin' ? ' elegida' : '')}>
          <input type="radio" name="nivel" checked={nivel === 'colaborador_admin'} onChange={() => onCambio('colaborador_admin')} />
          <span><strong>Colaborador administrador</strong><span>Administrador en todas; agrega empresas e invita al equipo.</span></span>
        </label>
      )}
    </fieldset>
  )
}


// =============================================================================
// AGREGAR A MI EQUIPO: todo se configura antes de enviar
// =============================================================================

function DialogoNuevo({ empresas, dueno, onCerrar, onListo }: {
  empresas: EmpresaEquipo[]
  dueno: boolean
  onCerrar: () => void
  onListo: (mensaje: string) => Promise<void>
}) {
  const [correo, setCorreo] = useState('')
  const [ficha, setFicha] = useState<DatosFicha>(FICHA_VACIA)
  const [nivel, setNivel] = useState<Nivel>('colaborador')
  const [veTodas, setVeTodas] = useState(false)
  const [accesos, setAccesos] = useState<Accesos>({})
  const [cargos, setCargos] = useState<string[]>([])
  const [error, setError] = useState<{ texto: string; campo?: string | null } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => { void nombresDeCargos(true).then(setCargos) }, [])

  const enviar = async () => {
    setError(null)
    if (!correo.trim()) { setError({ texto: 'Escribe su correo: es con lo que entra.', campo: 'correo' }); return }
    const mal = problemaFicha(ficha)
    if (mal) { setError({ texto: mal[0], campo: mal[1] }); return }
    const ids = Object.keys(accesos)
    if (!veTodas && ids.length === 0) { setError({ texto: 'Elige al menos una empresa, o «Todas».' }); return }
    if (nivel === 'colaborador') {
      const malAcceso = problemaAccesos(accesos, empresas)
      if (malAcceso) { setError({ texto: malAcceso }); return }
    }

    setOcupado(true)
    try {
      const r = await carteraServicio.invitar({
        correo: correo.trim(), nombre: '', nivel, veTodas, empresas: veTodas ? [] : ids, ficha: paraEnviar(ficha),
        accesos: nivel === 'colaborador'
          ? empresas.filter(e => accesos[e.id]).map(e => ({ empresaId: e.id, acceso: paraEnviarAcceso(accesos[e.id], e) }))
          : undefined,
      })
      if (r.enlaceDePrueba) console.info('Enlace de invitación (solo desarrollo):', r.enlaceDePrueba)
      await onListo(r.mensaje)
    } catch (err) {
      const texto = err instanceof ErrorApi ? err.message : 'No se pudo enviar la invitación.'
      const campo = err instanceof ErrorApi && err.codigo?.startsWith('campo_') ? err.codigo.slice(6) : null
      setError({ texto, campo })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Dialogo titulo="Agregar a mi equipo" abierto onCerrar={onCerrar}
      acciones={
        <>
          <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={() => void enviar()} ocupado={ocupado} textoOcupado="Enviando…">Guardar e invitar</Boton>
        </>
      }>
      <section className="ficha-seccion">
        <h3>1 · Datos personales</h3>
        <CamposFicha valor={ficha} onCambio={setFicha} campoMal={error?.campo} cargos={cargos}>
          <Campo etiqueta="Correo (con este entra)" obligatorio type="email" value={correo}
                 onChange={e => setCorreo(e.target.value)} mal={error?.campo === 'correo'} />
        </CamposFicha>
      </section>

      <section className="ficha-seccion acceso">
        <h3>2 · Nivel y empresas</h3>
        <SelectorNivel nivel={nivel} onCambio={setNivel} dueno={dueno} />
        <AccesosPorEmpresa empresas={empresas} accesos={accesos} onAccesos={setAccesos}
                           veTodas={veTodas} onVeTodas={setVeTodas} conDetalle={nivel === 'colaborador'} />
        <p className="nota">Al guardar le llega un enlace para crear su contraseña, con todo ya configurado.</p>
      </section>

      {error && <Aviso>{error.texto}</Aviso>}
    </Dialogo>
  )
}


// =============================================================================
// EDITAR: ficha, nivel y el acceso de cada empresa, en la misma ventana
// =============================================================================

function DialogoPersona({ persona, empresas, dueno, soyYo, onCerrar, onQuitar, onListo }: {
  persona: PersonaEquipo
  empresas: EmpresaEquipo[]
  dueno: boolean
  soyYo: boolean
  onCerrar: () => void
  onQuitar?: () => void
  onListo: (mensaje: string) => Promise<void>
}) {
  const [ficha, setFicha] = useState<DatosFicha>(() => fichaDe(persona))
  const [nivel, setNivel] = useState<Nivel>(persona.nivel)
  const [veTodas, setVeTodas] = useState(persona.veTodas)
  const [accesos, setAccesos] = useState<Accesos>(() => accesosDe(persona))
  const [cargos, setCargos] = useState<string[]>([])
  const [error, setError] = useState<{ texto: string; campo?: string | null } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => { void nombresDeCargos(true).then(setCargos) }, [])

  // El dueño no cambia de nivel; nadie se cambia el suyo; el colaborador
  // administrador solo edita colaboradores (sin subirlos).
  const cambiaNivel = !soyYo && persona.nivel !== 'dueno' && (dueno || persona.nivel === 'colaborador')
  const antes = accesosDe(persona)

  const guardar = async () => {
    setError(null)
    const mal = problemaFicha(ficha)
    if (mal) { setError({ texto: mal[0], campo: mal[1] }); return }
    const ids = Object.keys(accesos)
    if (cambiaNivel && !veTodas && ids.length === 0) { setError({ texto: 'Elige al menos una empresa, o «Todas».' }); return }
    if (cambiaNivel && nivel === 'colaborador') {
      const malAcceso = problemaAccesos(accesos, empresas)
      if (malAcceso) { setError({ texto: malAcceso }); return }
    }

    setOcupado(true)
    try {
      await carteraServicio.guardarFicha(persona.id, paraEnviar(ficha))

      if (cambiaNivel) {
        // Las que se quitaron (sin «Todas» antes: con «Todas» lo resuelve el cambio de nivel).
        if (persona.nivel === 'colaborador' && !persona.veTodas)
          for (const id of Object.keys(antes).filter(id => !accesos[id]))
            await carteraServicio.quitarAcceso(persona.id, id)

        if (nivel !== persona.nivel || veTodas !== persona.veTodas)
          await carteraServicio.editar(persona.id, { nivel, veTodas, empresas: veTodas ? [] : ids })

        // El acceso de cada empresa marcada, si es nueva o cambió.
        if (nivel === 'colaborador')
          for (const e of empresas.filter(x => accesos[x.id])) {
            const nuevo = paraEnviarAcceso(accesos[e.id], e)
            const viejo = antes[e.id] ? paraEnviarAcceso(antes[e.id], e) : null
            if (!viejo || JSON.stringify(nuevo) !== JSON.stringify(viejo))
              await carteraServicio.guardarAcceso(persona.id, e.id, nuevo)
          }
      }
      await onListo('Cambios guardados.')
    } catch (err) {
      setError({ texto: err instanceof ErrorApi ? err.message : 'No se pudo guardar.',
                 campo: err instanceof ErrorApi ? err.campo : null })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Dialogo titulo={`${persona.fichaIncompleta ? 'Completar la ficha de' : 'Editar a'} ${persona.nombre}`} abierto onCerrar={onCerrar}
      acciones={
        <>
          {onQuitar && <Boton estilo="peligro" onClick={onQuitar}>Quitar del equipo</Boton>}
          <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={() => void guardar()} ocupado={ocupado} textoOcupado="Guardando…">Guardar</Boton>
        </>
      }>
      <section className="ficha-seccion">
        <h3>1 · Datos personales</h3>
        <CamposFicha valor={ficha} onCambio={setFicha} campoMal={error?.campo} cargos={cargos}>
          <label className="campo">
            <span className="etiqueta">Correo (con este entra)</span>
            <input value={persona.correo} disabled />
          </label>
        </CamposFicha>
      </section>

      <section className="ficha-seccion acceso">
        <h3>2 · Nivel y empresas</h3>
        {cambiaNivel ? (
          <>
            <SelectorNivel nivel={nivel} onCambio={setNivel} dueno={dueno} />
            <AccesosPorEmpresa empresas={empresas} accesos={accesos} onAccesos={setAccesos}
                               veTodas={veTodas} onVeTodas={setVeTodas} conDetalle={nivel === 'colaborador'} />
          </>
        ) : (
          <p className="nota">
            {NOMBRE_NIVEL[persona.nivel]}{soyYo ? ' (tu nivel no lo cambias tú)' : ''}: administrador en todas las empresas
            de la cartera ({persona.accesos.length}).
          </p>
        )}
      </section>

      {error && <Aviso>{error.texto}</Aviso>}
    </Dialogo>
  )
}