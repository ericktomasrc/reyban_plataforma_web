import { useMemo, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Asterisco, Campo } from '../../../componentes/Campo'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { usuariosServicio } from '../servicios/usuariosServicio'
import { EXPLICA_ALCANCE, NOMBRE_ALCANCE } from '../tipos'
import type { DatosAcceso, OpcionesPersonal, TipoAlcance, UsuarioEnLista } from '../tipos'
import { CamposFicha, FICHA_VACIA, fichaDe, paraEnviar, problemaFicha } from './CamposFicha'
import type { DatosFicha } from './CamposFicha'

const ADMINISTRADOR = '11111111-1111-1111-1111-111111111111'
const JEFE = '55555555-5555-5555-5555-555555555555'
const FACTURADOR = '22222222-2222-2222-2222-222222222222'

/**
 * 046 — «AGREGAR PERSONAL» / «EDITAR» (maqueta aprobada, pantalla 2).
 *
 *   1 · DATOS PERSONALES   la ficha (CamposFicha) y el correo con el que entra.
 *   2 · ACCESO AL SISTEMA  rol, alcance, sucursales, la de por defecto y las
 *                          casillas «notas» y «agregar personal».
 *
 * Persona y acceso son lo mismo: no hay persona sin acceso. Lo que se puede
 * elegir lo manda la API según quién abre (OpcionesPersonal): el jefe de
 * sucursal solo ve sus sucursales y roles iguales o menores.
 *
 * Si el documento ya está en el personal, la API no lo duplica: se avisa.
 */
export function DialogoFicha({ usuario, opciones, empresa, onCerrar, onListo }: {
  usuario: UsuarioEnLista | null
  opciones: OpcionesPersonal
  empresa: string
  onCerrar: () => void
  onListo: (mensaje: string, tono: 'bien' | 'ojo') => void
}) {
  const nuevo = usuario === null
  // Su propio acceso no lo cambia nadie desde aquí (ni el administrador el suyo).
  const accesoEditable = nuevo || !!usuario?.gestionable

  const [correo, setCorreo] = useState(usuario?.correo ?? '')
  const [ficha, setFicha] = useState<DatosFicha>(() => usuario ? fichaDe(usuario) : FICHA_VACIA)

  const rolInicial = usuario?.roles[0]?.rolId
    ?? opciones.roles.find(r => r.id === FACTURADOR)?.id ?? opciones.roles[0]?.id ?? ''
  const unaSucursal = opciones.totalSucursales <= 1
  const [acceso, setAcceso] = useState<DatosAcceso>(() => ({
    rol: rolInicial,
    alcance: usuario?.alcance ?? (opciones.alcances.includes('sucursal') && !unaSucursal ? 'sucursal' : opciones.alcances[0] ?? 'propio'),
    sucursales: usuario?.sucursales ?? (opciones.sucursales.length === 1 ? [opciones.sucursales[0].id] : []),
    sucursalDefecto: usuario?.sucursalDefecto ?? null,
    notas: usuario?.notas ?? false,
    personal: usuario?.personal ?? false,
  }))

  const [error, setError] = useState<{ texto: string; campo?: string | null; tono?: 'ojo' } | null>(null)
  const [guardando, setGuardando] = useState(false)

  const rol = opciones.roles.find(r => r.id === acceso.rol)
  const esAdmin = acceso.rol === ADMINISTRADOR
  const marcadas = opciones.sucursales.filter(s => acceso.sucursales.includes(s.id))
  const defecto = acceso.sucursalDefecto && acceso.sucursales.includes(acceso.sucursalDefecto)
    ? acceso.sucursalDefecto : marcadas[0]?.id ?? null

  // El rol actual puede no estar entre los que se pueden dar (uno que ya no
  // existe, o quien edita es un jefe): se enseña igual para no perderlo.
  const rolesVisibles = useMemo(() => {
    if (!usuario || opciones.roles.some(r => r.id === rolInicial) || !usuario.roles[0]) return opciones.roles
    return [...opciones.roles, { id: usuario.roles[0].rolId, nombre: usuario.roles[0].nombre, descripcion: null,
                                 deSistema: true, permisos: [], incluyeNotas: false }]
  }, [opciones.roles, usuario, rolInicial])

  function alternarSucursal(id: string, si: boolean) {
    setAcceso(a => ({ ...a, sucursales: si ? [...a.sucursales, id] : a.sucursales.filter(x => x !== id) }))
  }

  async function guardar() {
    setError(null)
    if (!correo.trim()) { setError({ texto: 'Escribe su correo: es con lo que entra.', campo: 'correo' }); return }
    const mal = problemaFicha(ficha)
    if (mal) { setError({ texto: mal[0], campo: mal[1] }); return }
    if (accesoEditable) {
      if (!acceso.rol) { setError({ texto: 'Elige qué puede hacer (su rol).', campo: 'rol' }); return }
      if (!unaSucursal && !esAdmin && acceso.alcance !== 'empresa' && acceso.sucursales.length === 0) {
        setError({ texto: 'Marca en qué sucursal trabaja.', campo: 'sucursales' }); return
      }
    }

    const datosAcceso: DatosAcceso = {
      ...acceso,
      alcance: esAdmin ? 'empresa' : acceso.alcance,
      sucursales: unaSucursal ? [] : acceso.sucursales,
      sucursalDefecto: unaSucursal ? null : defecto,
      notas: acceso.notas && !rol?.incluyeNotas,
      personal: acceso.personal && acceso.rol === JEFE,
    }

    setGuardando(true)
    try {
      if (nuevo) {
        const r = await usuariosServicio.crearConFicha(correo.trim(), paraEnviar(ficha), datosAcceso)
        if (r.invitacionEnviada) onListo(`Le mandamos la invitación a ${r.correo}.`, 'bien')
        else onListo(`${r.nombre} quedó creado, pero el correo no salió. Usa «Reenviar la invitación».`, 'ojo')
      } else {
        const r = await usuariosServicio.editarConFicha(usuario!.id, correo.trim(), paraEnviar(ficha))
        if (accesoEditable) await usuariosServicio.cambiarAcceso(usuario!.id, datosAcceso)
        onListo(r.correoCambiado && !r.avisoAlAnterior ? r.mensaje : 'Ficha guardada.', r.correoCambiado && !r.avisoAlAnterior ? 'ojo' : 'bien')
      }
    } catch (e) {
      if (e instanceof ErrorApi) {
        const campo = e.campo
        setError({ texto: e.message, campo: campo ?? (e.codigo === 'documento_repetido' ? 'numeroDocumento' : null),
                   tono: e.codigo === 'documento_repetido' ? 'ojo' : undefined })
      } else setError({ texto: 'No se pudo guardar.' })
    } finally {
      setGuardando(false)
    }
  }

  const titulo = nuevo ? `Agregar personal a ${empresa}`
    : usuario!.fichaIncompleta ? `Completar la ficha de ${usuario!.nombre}` : `Editar a ${usuario!.nombre}`

  return (
    <Dialogo
      titulo={titulo}
      abierto
      onCerrar={onCerrar}
      acciones={
        <>
          <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={() => void guardar()} ocupado={guardando} textoOcupado="Guardando…">
            {nuevo ? 'Guardar e invitar' : 'Guardar'}
          </Boton>
        </>
      }
    >
      <section className="ficha-seccion">
        <h3>1 · Datos personales</h3>
        <CamposFicha valor={ficha} onCambio={setFicha} campoMal={error?.campo}>
          <Campo etiqueta="Correo (con este entra)" obligatorio type="email" value={correo}
                 onChange={e => setCorreo(e.target.value)} mal={error?.campo === 'correo'} />
        </CamposFicha>
      </section>

      <section className="ficha-seccion acceso">
        <h3>2 · Acceso al sistema (obligatorio)</h3>

        {!accesoEditable ? (
          <p className="nota">
            {usuario?.roles.map(r => r.nombre).join(' · ') || 'Sin rol'} · {NOMBRE_ALCANCE[usuario?.alcance ?? 'empresa']}.{' '}
            Tu propio acceso no lo cambias tú: que lo haga otro administrador.
          </p>
        ) : (
          <>
            <label className="campo" style={{ maxWidth: 380 }}>
              <span className="etiqueta">Rol — qué puede hacer<Asterisco /></span>
              <select value={acceso.rol} onChange={e => setAcceso(a => ({ ...a, rol: e.target.value }))}
                      aria-invalid={error?.campo === 'rol' || undefined}>
                {rolesVisibles.map(r => (
                  <option key={r.id} value={r.id}>{r.nombre}{r.deSistema ? '' : ' (rol propio)'}</option>
                ))}
              </select>
              {rol?.descripcion && <span className="pista">{rol.descripcion}</span>}
            </label>

            {esAdmin ? (
              <p className="nota">El Administrador ve toda la empresa y entra a todas las sucursales.</p>
            ) : (
              <div className="opciones-alcance" role="radiogroup" aria-label="Alcance">
                <span className="rotulo">Alcance — qué puede ver<Asterisco /></span>
                {opciones.alcances.map(a => (
                  <label key={a}>
                    <input type="radio" name="alcance" checked={acceso.alcance === a}
                           onChange={() => setAcceso(x => ({ ...x, alcance: a as TipoAlcance }))} />
                    <span><strong>{NOMBRE_ALCANCE[a]}</strong> — {EXPLICA_ALCANCE[a]}</span>
                  </label>
                ))}
              </div>
            )}

            {!unaSucursal && (
              <div className="pareja">
                <div className="casillas-acceso">
                  <span className="rotulo">
                    Sucursales — dónde trabaja{!esAdmin && acceso.alcance !== 'empresa' && <Asterisco />}
                  </span>
                  {opciones.sucursales.map(s => (
                    <label key={s.id}>
                      <input type="checkbox" checked={acceso.sucursales.includes(s.id)}
                             onChange={e => alternarSucursal(s.id, e.target.checked)} />
                      <span>{s.nombre} ({s.codigo})</span>
                    </label>
                  ))}
                  {acceso.alcance === 'empresa' && acceso.sucursales.length === 0 && (
                    <span className="pista">Sin marcar: emite desde todas.</span>
                  )}
                </div>
                <label className="campo">
                  <span className="etiqueta">Sucursal por defecto</span>
                  <select value={defecto ?? ''} disabled={marcadas.length === 0}
                          onChange={e => setAcceso(a => ({ ...a, sucursalDefecto: e.target.value || null }))}>
                    {marcadas.length === 0 && <option value="">—</option>}
                    {marcadas.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.codigo})</option>)}
                  </select>
                  <span className="pista">Con esta entra; al emitir viene elegida.</span>
                </label>
              </div>
            )}

            {opciones.puedeNotas && !esAdmin && !rol?.incluyeNotas && (
              <label className="casillas-acceso">
                <span>
                  <input type="checkbox" checked={acceso.notas}
                         onChange={e => setAcceso(a => ({ ...a, notas: e.target.checked }))} />{' '}
                  Puede hacer notas de crédito y débito
                </span>
              </label>
            )}
            {opciones.puedePersonal && acceso.rol === JEFE && (
              <label className="casillas-acceso">
                <span>
                  <input type="checkbox" checked={acceso.personal}
                         onChange={e => setAcceso(a => ({ ...a, personal: e.target.checked }))} />{' '}
                  Puede agregar personal (solo de sus sucursales, con roles iguales o menores al suyo)
                </span>
              </label>
            )}

            {nuevo && (
              <p className="nota">
                Al guardar le llega un correo para crear su contraseña.
                {marcadas.length > 0 && ` Al emitir solo verá las series de ${marcadas.map(s => s.nombre).join(', ')}.`}
              </p>
            )}
          </>
        )}
      </section>

      {error && <Aviso tono={error.tono}>{error.texto}</Aviso>}

      <p className="nota-ley">
        * Obligatorio. Datos personales protegidos (Ley 29733): la ficha la ven el administrador, su jefe de sucursal
        y la propia persona.
      </p>
    </Dialogo>
  )
}