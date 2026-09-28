import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fechaYHora } from '../../../nucleo/formato/fechas'
import { Paginacion } from '../componentes/Paginacion'
import { auditoriaServicio } from '../servicios/auditoriaServicio'
import type { Evento, FiltroEventos, Pagina } from '../tipos'

/**
 * Lo que NO cambió ninguna fila.
 *
 * Un ingreso fallido, un 403, un código de segundo factor incorrecto, un
 * enlace caducado que alguien intentó usar. Nada de eso toca una tabla, así
 * que no deja rastro en la bitácora — y es justo lo que interesa mirar cuando
 * algo huele mal.
 *
 * POR ESO EL FILTRO EMPIEZA EN «solo fallos»: cien ingresos correctos no
 * dicen nada; tres fallidos seguidos a las tres de la mañana, sí.
 */
export function Eventos() {
  const [filtro, setFiltro]     = useState<FiltroEventos>({ pagina: 1 })
  const [datos, setDatos]       = useState<Pagina<Evento>>()
  const [error, setError]       = useState<string>()
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    setCargando(true)

    void (async () => {
      try {
        const d = await auditoriaServicio.eventos(filtro)
        if (vivo) { setDatos(d); setError(undefined) }
      } catch (e) {
        if (vivo) setError(e instanceof ErrorApi ? e.message : 'No se pudieron cargar los eventos.')
      } finally {
        if (vivo) setCargando(false)
      }
    })()

    return () => { vivo = false }
  }, [filtro])

  const poner = (cambio: Partial<FiltroEventos>) =>
    setFiltro(f => ({ ...f, ...cambio, pagina: 1 }))

  return (
    <>
      <div className="encabezado-pagina">
        <h1 className="titulo-pagina">Auditoría</h1>
        <nav className="pestanas">
          <NavLink to="/auditoria" end className={({ isActive }) => isActive ? 'activa' : undefined}>
            Cambios
          </NavLink>
          <NavLink to="/auditoria/eventos" className={({ isActive }) => isActive ? 'activa' : undefined}>
            Seguridad
          </NavLink>
        </nav>
      </div>

      <p className="bajada-pagina">
        Ingresos, códigos de segundo factor, accesos denegados y enlaces usados.
        Se registran aunque no cambien ninguna fila, y no se pueden borrar.
      </p>

      {error && <Aviso>{error}</Aviso>}

      <div className="filtros">
        <label>
          <span>Tipo</span>
          <select value={filtro.tipo ?? ''} onChange={e => poner({ tipo: e.target.value || undefined })}>
            <option value="">Todos</option>
            <optgroup label="Ingreso">
              <option value="ingreso">Entró</option>
              <option value="ingreso_clave_incorrecta">Contraseña incorrecta</option>
              <option value="ingreso_usuario_inexistente">Correo que no existe</option>
              <option value="ingreso_usuario_inactivo">Cuenta desactivada</option>
              <option value="ingreso_usuario_bloqueado">Cuenta bloqueada</option>
              <option value="ingreso_empresa_suspendida">Empresa suspendida</option>
              <option value="cierre_sesion">Cerró sesión</option>
            </optgroup>
            <optgroup label="Segundo factor">
              <option value="dosfa_superado">Código correcto</option>
              <option value="dosfa_fallido">Código incorrecto</option>
              <option value="dosfa_activado">Lo configuró</option>
              <option value="dosfa_desactivado">Se lo reiniciaron</option>
              <option value="codigo_recuperacion_usado">Usó un código de recuperación</option>
            </optgroup>
            <optgroup label="Contraseñas">
              <option value="clave_cambiada">La cambió</option>
              <option value="clave_restablecer_solicitado">Le mandaron un enlace</option>
              <option value="clave_restablecer_usado">Usó el enlace</option>
            </optgroup>
            <optgroup label="Autorización">
              <option value="acceso_denegado">Acceso denegado</option>
              <option value="rol_asignado">Cambio de roles</option>
            </optgroup>
            <optgroup label="Empresas">
              <option value="empresa_suspendida">Empresa suspendida</option>
              <option value="empresa_reactivada">Empresa reactivada</option>
            </optgroup>
          </select>
        </label>

        <label>
          <span>Resultado</span>
          <select
            value={filtro.exito === undefined ? '' : String(filtro.exito)}
            onChange={e => poner({ exito: e.target.value === '' ? undefined : e.target.value === 'true' })}
          >
            <option value="">Todos</option>
            <option value="false">Solo fallos</option>
            <option value="true">Solo correctos</option>
          </select>
        </label>

        <label>
          <span>Desde</span>
          <input type="date" value={filtro.desde ?? ''} onChange={e => poner({ desde: e.target.value || undefined })} />
        </label>

        <label>
          <span>Hasta</span>
          <input type="date" value={filtro.hasta ?? ''} onChange={e => poner({ hasta: e.target.value || undefined })} />
        </label>

        {(filtro.tipo || filtro.exito !== undefined || filtro.desde || filtro.hasta) && (
          <button type="button" className="enlace" onClick={() => setFiltro({ pagina: 1 })}>
            Quitar filtros
          </button>
        )}
      </div>

      <div className="bloque sin-relleno">
        {cargando && !datos ? (
          <div className="relleno"><Cargando /></div>
        ) : datos && datos.filas.length > 0 ? (
          <table className="tabla">
            <thead>
              <tr>
                <th>Cuándo</th>
                <th>Qué pasó</th>
                <th>Quién</th>
                <th>Desde</th>
                <th>Detalle</th>
              </tr>
            </thead>

            <tbody>
              {datos.filas.map(e => (
                <tr key={e.id} className={e.exito ? undefined : 'apagada'}>
                  <td className="secundario">{fechaYHora(e.ocurridoEn)}</td>

                  <td>
                    <div className="principal">
                      <span className={e.exito ? 'estado bueno' : 'estado malo'}>
                        {nombre(e.tipo)}
                      </span>
                    </div>
                    <div className="secundario mono">{e.tipo}</div>
                  </td>

                  <td>
                    {/* El correo es lo único que hay cuando el usuario no
                        existe — y ese caso es justo el que interesa vigilar. */}
                    {e.usuario ?? e.correo ?? <span className="vacio">—</span>}
                  </td>

                  <td className="mono secundario">{e.ip ?? '—'}</td>

                  <td className="secundario mono detalle">{e.detalle ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="relleno">
            <Vacio>No hay eventos que cuadren con eso.</Vacio>
          </div>
        )}
      </div>

      {datos && (
        <Paginacion
          total={datos.total}
          pagina={datos.pagina}
          porPagina={datos.porPagina}
          onCambiar={p => setFiltro(f => ({ ...f, pagina: p }))}
        />
      )}
    </>
  )
}


/** El código técnico, en algo que se lea. */
function nombre(tipo: string): string {
  const nombres: Record<string, string> = {
    ingreso:                      'Entró',
    ingreso_clave_incorrecta:     'Contraseña incorrecta',
    ingreso_usuario_inexistente:  'Correo que no existe',
    ingreso_usuario_inactivo:     'Cuenta desactivada',
    ingreso_usuario_bloqueado:    'Cuenta bloqueada',
    ingreso_empresa_suspendida:   'Empresa suspendida',
    cierre_sesion:                'Cerró sesión',
    sesion_expirada:              'Sesión caducada',
    sesion_revocada:              'Sesión revocada',
    dosfa_superado:               'Segundo factor correcto',
    dosfa_fallido:                'Segundo factor incorrecto',
    dosfa_activado:               'Configuró el segundo factor',
    dosfa_desactivado:            'Le reiniciaron el segundo factor',
    codigo_recuperacion_usado:    'Usó un código de recuperación',
    clave_cambiada:               'Cambió su contraseña',
    clave_restablecer_solicitado: 'Le mandaron un enlace',
    clave_restablecer_usado:      'Usó el enlace',
    clave_restablecer_invalido:   'Enlace inválido',
    acceso_denegado:              'Acceso denegado',
    permiso_otorgado:             'Permiso otorgado',
    permiso_retirado:             'Permiso retirado',
    rol_asignado:                 'Cambio de roles',
    rol_retirado:                 'Rol retirado',
    suplantacion_iniciada:        'Empezó una suplantación',
    suplantacion_terminada:       'Terminó una suplantación',
    empresa_suspendida:           'Empresa suspendida',
    empresa_reactivada:           'Empresa reactivada',
    otro:                         'Otro',
  }

  return nombres[tipo] ?? tipo
}
