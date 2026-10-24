import { useCallback, useEffect, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Asterisco, Campo } from '../../../componentes/Campo'
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

      <div className="bloque sin-relleno">
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr><th>Persona</th><th>Cargo</th><th>Empresas · rol · alcance</th><th>Estado</th><th /></tr>
            </thead>
            <tbody>
              {personas.map(c => (
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
                  <td className={!c.activo ? 'secundario' : c.pendiente && c.nivel !== 'dueno' ? 'texto-ojo' : 'texto-bien'}>
                    {!c.activo ? 'Quitado' : c.pendiente && c.nivel !== 'dueno' ? 'Invitación enviada' : 'Activo'}
                  </td>
                  <td className="acciones">
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
          onCambio={async () => {
            const p = await cargar()
            const otra = p?.find(x => x.id === abierta.id)
            if (otra) setAbierta(otra)
          }}
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
// AGREGAR A MI EQUIPO
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
  const [elegidas, setElegidas] = useState<string[]>([])
  const [error, setError] = useState<{ texto: string; campo?: string | null } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const enviar = async () => {
    setError(null)
    if (!correo.trim()) { setError({ texto: 'Escribe su correo: es con lo que entra.', campo: 'correo' }); return }
    const mal = problemaFicha(ficha)
    if (mal) { setError({ texto: mal[0], campo: mal[1] }); return }
    if (!veTodas && elegidas.length === 0) { setError({ texto: 'Elige al menos una empresa, o «Todas».' }); return }

    setOcupado(true)
    try {
      const r = await carteraServicio.invitar({
        correo: correo.trim(), nombre: '', nivel, veTodas, empresas: elegidas, ficha: paraEnviar(ficha),
      })
      if (r.enlaceDePrueba) console.info('Enlace de invitación (solo desarrollo):', r.enlaceDePrueba)
      await onListo(nivel === 'colaborador'
        ? `${r.mensaje} Entra como Facturador en cada empresa: cámbialo en «Editar».`
        : r.mensaje)
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
        <CamposFicha valor={ficha} onCambio={setFicha} campoMal={error?.campo}>
          <Campo etiqueta="Correo (con este entra)" obligatorio type="email" value={correo}
                 onChange={e => setCorreo(e.target.value)} mal={error?.campo === 'correo'} />
        </CamposFicha>
      </section>

      <section className="ficha-seccion acceso">
        <h3>2 · Nivel y empresas</h3>
        <SelectorNivel nivel={nivel} onCambio={setNivel} dueno={dueno} />
        <EmpresasQueVe empresas={empresas} veTodas={veTodas} onVeTodas={setVeTodas}
                       elegidas={elegidas} onElegidas={setElegidas} />
        <p className="nota">
          Le llega un enlace para crear su contraseña. Después, en «Editar», le das su rol, alcance y sucursales en cada
          empresa.
        </p>
      </section>

      {error && <Aviso>{error.texto}</Aviso>}
    </Dialogo>
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

function EmpresasQueVe({ empresas, veTodas, onVeTodas, elegidas, onElegidas }: {
  empresas: EmpresaEquipo[]
  veTodas: boolean
  onVeTodas: (v: boolean) => void
  elegidas: string[]
  onElegidas: (v: string[]) => void
}) {
  return (
    <fieldset className="grupo-empresas">
      <legend>Qué empresas ve</legend>
      <label className="casilla-terminos">
        <input type="checkbox" checked={veTodas} onChange={e => onVeTodas(e.target.checked)} />
        Todas (y las que agregues después)
      </label>
      {!veTodas && (
        <div className="lista-casillas">
          {empresas.length === 0 && <span className="secundario">Todavía no hay empresas en la cartera.</span>}
          {empresas.map(e => (
            <label key={e.id} className="casilla-terminos">
              <input type="checkbox" checked={elegidas.includes(e.id)}
                     onChange={() => onElegidas(elegidas.includes(e.id) ? elegidas.filter(x => x !== e.id) : [...elegidas, e.id])} />
              {e.nombre}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  )
}


// =============================================================================
// EDITAR: ficha, nivel y accesos por empresa
// =============================================================================

function DialogoPersona({ persona, empresas, dueno, soyYo, onCerrar, onQuitar, onCambio, onListo }: {
  persona: PersonaEquipo
  empresas: EmpresaEquipo[]
  dueno: boolean
  soyYo: boolean
  onCerrar: () => void
  onQuitar?: () => void
  onCambio: () => Promise<void>
  onListo: (mensaje: string) => Promise<void>
}) {
  const mensaje = useMensaje()
  const { pedir, dialogo: confirmacion } = useConfirmar()
  const [ficha, setFicha] = useState<DatosFicha>(() => fichaDe(persona))
  const [nivel, setNivel] = useState<Nivel>(persona.nivel)
  const [veTodas, setVeTodas] = useState(persona.veTodas)
  const [error, setError] = useState<{ texto: string; campo?: string | null } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [acceso, setAcceso] = useState<{ empresa: EmpresaEquipo; actual?: AccesoEquipo } | null>(null)
  const [otra, setOtra] = useState('')

  // El dueño no cambia de nivel; nadie se cambia el suyo; el colaborador
  // administrador solo edita colaboradores (sin subirlos).
  const cambiaNivel = !soyYo && persona.nivel !== 'dueno' && (dueno || persona.nivel === 'colaborador')
  const esColaborador = persona.nivel === 'colaborador'
  const sinAcceso = empresas.filter(e => !persona.accesos.some(a => a.empresaId === e.id))

  const guardar = async () => {
    setError(null)
    const mal = problemaFicha(ficha)
    if (mal) { setError({ texto: mal[0], campo: mal[1] }); return }
    setOcupado(true)
    try {
      await carteraServicio.guardarFicha(persona.id, paraEnviar(ficha))
      if (cambiaNivel && (nivel !== persona.nivel || veTodas !== persona.veTodas)) {
        const empresasActuales = persona.accesos.map(a => a.empresaId)
        if (!veTodas && empresasActuales.length === 0) {
          setError({ texto: 'Sin «Todas», dale acceso al menos a una empresa (abajo) antes de guardar.' })
          return
        }
        await carteraServicio.editar(persona.id, { nivel, veTodas, empresas: empresasActuales })
      }
      await onListo('Cambios guardados.')
    } catch (err) {
      setError({ texto: err instanceof ErrorApi ? err.message : 'No se pudo guardar.',
                 campo: err instanceof ErrorApi ? err.campo : null })
    } finally {
      setOcupado(false)
    }
  }

  const quitarAcceso = async (a: AccesoEquipo) => {
    const seguro = await pedir({
      titulo: `Quitarle ${a.empresa}`,
      confirmar: 'Quitar el acceso',
      tono: 'peligro',
      mensaje: <p>{persona.nombre} deja de poder abrir {a.empresa}. No se borra nada de lo que hizo allí.</p>,
    })
    if (!seguro) return
    try {
      mensaje.bien((await carteraServicio.quitarAcceso(persona.id, a.empresaId)).mensaje)
      await onCambio()
    } catch (err) {
      mensaje.error(err instanceof ErrorApi ? err.message : 'No se pudo quitar el acceso.')
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
        <CamposFicha valor={ficha} onCambio={setFicha} campoMal={error?.campo}>
          <label className="campo">
            <span className="etiqueta">Correo (con este entra)</span>
            <input value={persona.correo} disabled />
          </label>
        </CamposFicha>
      </section>

      <section className="ficha-seccion acceso">
        <h3>2 · Nivel y accesos</h3>
        {cambiaNivel ? (
          <>
            <SelectorNivel nivel={nivel} onCambio={setNivel} dueno={dueno} />
            {nivel === 'colaborador' && (
              <label className="casilla-terminos">
                <input type="checkbox" checked={veTodas} onChange={e => setVeTodas(e.target.checked)} />
                Ve todas las empresas (y las que agregues después)
              </label>
            )}
          </>
        ) : (
          <p className="nota">{NOMBRE_NIVEL[persona.nivel]}{soyYo ? ' (tu nivel no lo cambias tú)' : ''}.</p>
        )}

        {!esColaborador ? (
          <p className="nota">Administrador en todas las empresas de la cartera ({persona.accesos.length}), con toda la empresa.</p>
        ) : (
          <>
            {persona.accesos.length > 0 && (
              <table className="tabla-accesos">
                <thead><tr><th>Empresa</th><th>Rol</th><th>Alcance</th><th>Sucursales</th><th /></tr></thead>
                <tbody>
                  {persona.accesos.map(a => {
                    const e = empresas.find(x => x.id === a.empresaId)
                    return (
                      <tr key={a.empresaId}>
                        <td>{a.empresa}</td>
                        <td>{a.rol}{a.notas ? ' + notas' : ''}</td>
                        <td>{NOMBRE_ALCANCE[a.alcance]}</td>
                        <td>{a.sucursales.length > 0 ? nombresSucursales(a, empresas) : 'Todas'}</td>
                        <td className="acciones-texto">
                          {e && <button type="button" className="enlace" onClick={() => setAcceso({ empresa: e, actual: a })}>Editar</button>}
                          {!persona.veTodas && (
                            <>
                              <span className="separa" aria-hidden="true">·</span>
                              <button type="button" className="enlace" onClick={() => void quitarAcceso(a)}>Quitar</button>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {sinAcceso.length > 0 && !persona.veTodas && (
              <div className="pareja">
                <label className="campo">
                  <span className="etiqueta">Dar acceso a otra empresa</span>
                  <select value={otra} onChange={e => setOtra(e.target.value)}>
                    <option value="">Elige una empresa…</option>
                    {sinAcceso.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </label>
                <div style={{ alignSelf: 'end' }}>
                  <Boton estilo="secundario" disabled={!otra}
                         onClick={() => { const e = empresas.find(x => x.id === otra); if (e) setAcceso({ empresa: e }) }}>
                    + Dar acceso
                  </Boton>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {error && <Aviso>{error.texto}</Aviso>}

      {acceso && (
        <DialogoAcceso
          persona={persona}
          empresa={acceso.empresa}
          actual={acceso.actual}
          onCerrar={() => setAcceso(null)}
          onListo={async m => { setAcceso(null); setOtra(''); mensaje.bien(m); await onCambio() }}
        />
      )}
      {confirmacion}
    </Dialogo>
  )
}


// =============================================================================
// EL ACCESO A UNA EMPRESA: rol, alcance, sucursales, notas
// =============================================================================

function DialogoAcceso({ persona, empresa, actual, onCerrar, onListo }: {
  persona: PersonaEquipo
  empresa: EmpresaEquipo
  actual?: AccesoEquipo
  onCerrar: () => void
  onListo: (mensaje: string) => Promise<void>
}) {
  const variasSucursales = empresa.sucursales.length > 1
  const [d, setD] = useState<DatosAccesoEquipo>({
    rol: actual?.rolId && empresa.roles.some(r => r.id === actual.rolId) ? actual.rolId
       : empresa.roles.find(r => r.id === FACTURADOR)?.id ?? empresa.roles[0]?.id ?? '',
    alcance: actual?.alcance ?? 'empresa',
    sucursales: actual?.sucursales ?? [],
    sucursalDefecto: actual?.defecto ?? null,
    notas: actual?.notas ?? false,
  })
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const marcadas = empresa.sucursales.filter(s => d.sucursales.includes(s.id))
  const defecto = d.sucursalDefecto && d.sucursales.includes(d.sucursalDefecto) ? d.sucursalDefecto : marcadas[0]?.id ?? null
  const rol = empresa.roles.find(r => r.id === d.rol)

  const guardar = async () => {
    setError(null)
    if (!d.rol) { setError('Elige su rol en esta empresa.'); return }
    if (variasSucursales && d.alcance !== 'empresa' && d.sucursales.length === 0) { setError('Marca en qué sucursal trabaja.'); return }
    setOcupado(true)
    try {
      const r = await carteraServicio.guardarAcceso(persona.id, empresa.id, {
        ...d,
        sucursales: variasSucursales ? d.sucursales : [],
        sucursalDefecto: variasSucursales ? defecto : null,
        notas: d.notas && d.rol !== JEFE,
      })
      await onListo(r.mensaje)
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar el acceso.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Dialogo titulo={`${persona.nombre} en ${empresa.nombre}`} abierto onCerrar={onCerrar}
      acciones={
        <>
          <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={() => void guardar()} ocupado={ocupado} textoOcupado="Guardando…">Guardar acceso</Boton>
        </>
      }>
      <div className="ficha-seccion">
        <label className="campo">
          <span className="etiqueta">Rol en esta empresa<Asterisco /></span>
          <select value={d.rol} onChange={e => setD(x => ({ ...x, rol: e.target.value }))}>
            {empresa.roles.map(r => <option key={r.id} value={r.id}>{r.nombre}{r.deSistema ? '' : ' (rol propio)'}</option>)}
          </select>
          {rol?.descripcion && <span className="pista">{rol.descripcion}</span>}
        </label>

        <div className="opciones-alcance" role="radiogroup" aria-label="Alcance">
          <span className="rotulo">Alcance — qué puede ver<Asterisco /></span>
          {(['empresa', 'sucursal', 'propio'] as TipoAlcance[]).map(a => (
            <label key={a}>
              <input type="radio" name="alcance-equipo" checked={d.alcance === a} onChange={() => setD(x => ({ ...x, alcance: a }))} />
              <span><strong>{NOMBRE_ALCANCE[a]}</strong> — {EXPLICA_ALCANCE[a]}</span>
            </label>
          ))}
        </div>

        {variasSucursales && (
          <div className="pareja">
            <div className="casillas-acceso">
              <span className="rotulo">Sucursales{d.alcance !== 'empresa' && <Asterisco />}</span>
              {empresa.sucursales.map(s => (
                <label key={s.id}>
                  <input type="checkbox" checked={d.sucursales.includes(s.id)}
                         onChange={e => setD(x => ({ ...x, sucursales: e.target.checked ? [...x.sucursales, s.id] : x.sucursales.filter(y => y !== s.id) }))} />
                  <span>{s.nombre} ({s.codigo})</span>
                </label>
              ))}
            </div>
            <label className="campo">
              <span className="etiqueta">Sucursal por defecto</span>
              <select value={defecto ?? ''} disabled={marcadas.length === 0}
                      onChange={e => setD(x => ({ ...x, sucursalDefecto: e.target.value || null }))}>
                {marcadas.length === 0 && <option value="">—</option>}
                {marcadas.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.codigo})</option>)}
              </select>
            </label>
          </div>
        )}

        {d.rol !== JEFE && (
          <label className="casillas-acceso">
            <span>
              <input type="checkbox" checked={d.notas} onChange={e => setD(x => ({ ...x, notas: e.target.checked }))} />{' '}
              Puede hacer notas de crédito y débito
            </span>
          </label>
        )}
      </div>
      {error && <Aviso>{error}</Aviso>}
    </Dialogo>
  )
}