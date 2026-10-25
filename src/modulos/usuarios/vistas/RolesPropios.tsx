import { useState } from 'react'
import { Paginacion } from '../../../componentes/Paginacion'
import { contiene, usePaginaLocal } from '../../../nucleo/hooks/usePaginaLocal'
import { Link } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useCargar } from '../../../nucleo/hooks/useCargar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { useYo } from '../../../nucleo/sesion/SesionContexto'
import { rolesServicio, type PermisoAsignable, type RolCompleto } from '../servicios/rolesServicio'

/**
 * 035 — ROLES PROPIOS DE CADA EMPRESA (maqueta aprobada el 18 oct 2026).
 *
 * Los roles de la plataforma (Administrador, Facturador, Consulta,
 * Contabilidad) son los mismos para todas las empresas. Se COPIAN, o (037) se
 * AJUSTAN solo para esta empresa: «Editar permisos» cambia lo que trae el
 * Facturador aquí, y las demás empresas siguen con el original. El
 * Administrador es fijo. La llave del Administrador (certificado y series,
 * repartir roles) nunca va en otro rol. Nada se borra: un rol se desactiva y
 * un ajuste «vuelve al original».
 */

const GRUPOS: { titulo: string; incluye: (codigo: string) => boolean }[] = [
  { titulo: 'Facturación', incluye: c => c.startsWith('facturacion.') },
  { titulo: 'Guías de remisión', incluye: c => c.startsWith('guias.') },
  { titulo: 'Reportes · Mi negocio', incluye: c => ['reportes.mi_dia', 'reportes.tablero_ventas', 'reportes.ventas_cliente', 'reportes.ventas_producto', 'reportes.ventas_vendedor'].includes(c) },
  { titulo: 'Reportes · SUNAT y contabilidad', incluye: c => c.startsWith('reportes.') && !['reportes.mi_dia', 'reportes.tablero_ventas', 'reportes.ventas_cliente', 'reportes.ventas_producto', 'reportes.ventas_vendedor'].includes(c) },
  { titulo: 'Usuarios', incluye: c => c.startsWith('usuarios.') },
]

interface Edicion {
  id?: string
  /** 037: ajuste de un rol de la plataforma (sin nombre ni descripción). */
  ajuste?: { nombre: string; original: Set<string> }
  nombre: string
  descripcion: string
  permisos: Set<string>
}

export function RolesPropios() {
  const { empresa } = useYo()
  const mensaje = useMensaje()
  const roles = useCargar<RolCompleto[]>(() => rolesServicio.todos())
  const catalogo = useCargar<PermisoAsignable[]>(() => rolesServicio.permisos())

  const [edicion, setEdicion] = useState<Edicion>()
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState<string>()

  const descripcionDe = (codigo: string) => catalogo.datos?.find(p => p.codigo === codigo)?.descripcion ?? codigo

  const copiar = (r: RolCompleto) => {
    setFallo(undefined)
    setEdicion({
      nombre: `${r.nombre} (copia)`,
      descripcion: r.descripcion ?? '',
      permisos: new Set(r.permisos.filter(c => !catalogo.datos?.find(p => p.codigo === c)?.soloAdministrador)),
    })
  }

  const ajustar = (r: RolCompleto) => {
    setFallo(undefined)
    setEdicion({
      id: r.id, nombre: r.nombre, descripcion: r.descripcion ?? '', permisos: new Set(r.permisos),
      ajuste: { nombre: r.nombre, original: new Set(r.original ?? r.permisos) },
    })
  }

  const volverAlOriginal = async (r: RolCompleto) => {
    try {
      const x = await rolesServicio.original(r.id)
      mensaje.bien(x.mensaje)
      void roles.recargar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo volver al original.')
    }
  }

  /** «+ Notas de crédito, − Anular» respecto al original. */
  const diferencias = (r: RolCompleto) => {
    if (!r.ajustado || !r.original) return ''
    const antes = new Set(r.original)
    const ahora = new Set(r.permisos)
    return [
      ...r.permisos.filter(c => !antes.has(c)).map(c => `+ ${descripcionDe(c)}`),
      ...r.original.filter(c => !ahora.has(c)).map(c => `− ${descripcionDe(c)}`),
    ].join(', ')
  }

  const editar = (r: RolCompleto) => {
    setFallo(undefined)
    setEdicion({ id: r.id, nombre: r.nombre, descripcion: r.descripcion ?? '', permisos: new Set(r.permisos) })
  }

  const alternar = (codigo: string) => setEdicion(e => {
    if (!e) return e
    const p = new Set(e.permisos)
    if (p.has(codigo)) p.delete(codigo); else p.add(codigo)
    return { ...e, permisos: p }
  })

  const guardar = async () => {
    if (!edicion) return
    setGuardando(true); setFallo(undefined)
    try {
      const datos = { nombre: edicion.nombre.trim(), descripcion: edicion.descripcion.trim(), permisos: [...edicion.permisos] }
      const r = edicion.ajuste && edicion.id ? await rolesServicio.ajustar(edicion.id, datos.permisos)
        : edicion.id ? await rolesServicio.cambiar(edicion.id, datos) : await rolesServicio.crear(datos)
      mensaje.bien(r.mensaje)
      setEdicion(undefined)
      void roles.recargar()
    } catch (e) {
      setFallo(e instanceof ErrorApi ? e.message : 'No se pudo guardar el rol.')
    } finally { setGuardando(false) }
  }

  const activar = async (r: RolCompleto, activo: boolean) => {
    try {
      const x = activo ? await rolesServicio.activar(r.id) : await rolesServicio.desactivar(r.id)
      mensaje.bien(x.mensaje)
      void roles.recargar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo cambiar el rol.')
    }
  }

  // 24 oct: buscar, estado y páginas.
  const [q, setQ] = useState('')
  const [estadoF, setEstadoF] = useState('todos')
  const filtrados = (roles.datos ?? []).filter(r => contiene(q, r.nombre, r.descripcion) &&
    (estadoF === 'todos' || (estadoF === 'activos' ? r.activo : !r.activo)))
  const { visibles, paginacion } = usePaginaLocal(filtrados, `${q}|${estadoF}`)

  if (roles.cargando && !roles.datos) return <Cargando />

  return (
    <>
      {/* 047: volver a Personal. */}
      <Link to="/usuarios" className="enlace-volver">← Personal de la empresa</Link>

      <div className="bienvenida-cabecera">
        <h1 className="titulo-pagina titulo-serif">Roles de {empresa?.nombre ?? 'tu empresa'}</h1>
        <p className="bajada-pagina">
          Qué puede hacer y ver cada persona. Puedes ajustar los roles de la plataforma para tu empresa: el cambio
          vale solo para {empresa?.nombre ?? 'tu empresa'}.
        </p>
      </div>

      {roles.error && <Aviso>{roles.error}</Aviso>}

      {/* 24 oct: buscar, estado y páginas (los propios, lo más nuevo arriba). */}
      {(roles.datos ?? []).length > 1 && (
        <div className="filtros-lista">
          <label className="buscar"><span>Buscar</span>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nombre del rol" /></label>
          <label><span>Estado</span>
            <select value={estadoF} onChange={e => setEstadoF(e.target.value)}>
              <option value="todos">Todos</option><option value="activos">Activos</option><option value="inactivos">Desactivados</option>
            </select></label>
        </div>
      )}

      <div className="lista-roles">
        {visibles.map(r => (
          <div key={r.id} className={`rol-tarjeta${r.activo ? '' : ' apagado'}`}>
            <div className="rol-texto">
              <div className="rol-nombre">
                <strong>{r.nombre}</strong>
                {!r.deSistema ? <span className="etiqueta acento">propio</span>
                  : r.ajustado ? <span className="etiqueta acento">ajustado para {empresa?.nombre ?? 'tu empresa'}</span>
                  : <span className="etiqueta">de la plataforma</span>}
                {!r.activo && <span className="etiqueta aviso">desactivado</span>}
              </div>
              {r.descripcion && <div className="secundario">{r.descripcion}</div>}
              <div className="secundario">
                {r.permisos.length} permiso(s) · {r.usuarios} persona(s)
                {r.ajustado && diferencias(r) && <> · <strong>{diferencias(r)}</strong> respecto al original</>}
              </div>
            </div>
            <div className="rol-acciones">
              {r.esAdministrador ? (
                <span className="secundario">Fijo: todo dentro de la empresa</span>
              ) : r.deSistema ? (
                <>
                  <Boton estilo="secundario" onClick={() => ajustar(r)}>Editar permisos</Boton>
                  {r.ajustado
                    ? <Boton estilo="secundario" onClick={() => void volverAlOriginal(r)}>Volver al original</Boton>
                    : <Boton estilo="secundario" onClick={() => copiar(r)}>Hacer una copia</Boton>}
                </>
              ) : (
                <>
                  {r.activo && <Boton estilo="secundario" onClick={() => editar(r)}>Editar</Boton>}
                  {r.activo
                    ? <Boton estilo="secundario" onClick={() => void activar(r, false)}>Desactivar</Boton>
                    : <Boton estilo="secundario" onClick={() => void activar(r, true)}>Activar</Boton>}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <Paginacion {...paginacion} />

      <div className="acciones-linea">
        <Boton onClick={() => { setFallo(undefined); setEdicion({ nombre: '', descripcion: '', permisos: new Set() }) }}>
          + Nuevo rol
        </Boton>
      </div>
      <p className="nota">
        Nada se borra: un rol desactivado deja de dar permisos y queda en la bitácora. Ajustar un rol de la
        plataforma vale solo para esta empresa; «Volver al original» lo deja como lo trae la plataforma. Los
        cambios valen desde la próxima vez que esas personas entren.
      </p>

      <Dialogo titulo={edicion?.ajuste ? `${edicion.ajuste.nombre} · permisos para ${empresa?.nombre ?? 'tu empresa'}`
                     : edicion?.id ? `Rol «${edicion.nombre}»` : 'Nuevo rol'} abierto={!!edicion}
               onCerrar={() => setEdicion(undefined)}
               acciones={<>
                 <Boton estilo="secundario" onClick={() => setEdicion(undefined)} disabled={guardando}>Cancelar</Boton>
                 <Boton onClick={() => void guardar()} ocupado={guardando} textoOcupado="Guardando…"
                        disabled={!edicion || edicion.nombre.trim().length < 3 || edicion.permisos.size === 0}>
                   {edicion?.ajuste ? `Guardar para ${empresa?.nombre ?? 'tu empresa'}` : 'Guardar'}
                 </Boton>
               </>}>
        {edicion && (
          <>
            {edicion.ajuste ? (
              <Aviso tono="ojo">
                El cambio vale <strong>solo para {empresa?.nombre ?? 'tu empresa'}</strong>. Quienes tienen
                «{edicion.ajuste.nombre}» aquí lo tendrán desde que vuelvan a entrar. Las demás empresas no cambian.
              </Aviso>
            ) : (<>
            <label className="campo">
              <span className="etiqueta">Nombre</span>
              <input value={edicion.nombre} maxLength={60} onChange={e => setEdicion({ ...edicion, nombre: e.target.value })}
                     placeholder="Ej.: Contabilidad, Caja, Ventas" />
            </label>
            <label className="campo">
              <span className="etiqueta">Descripción (opcional)</span>
              <input value={edicion.descripcion} maxLength={200} onChange={e => setEdicion({ ...edicion, descripcion: e.target.value })} />
            </label>
            </>)}

            {catalogo.cargando && !catalogo.datos ? <Cargando /> : (
              <div className="grupos-permisos">
                {GRUPOS.map(g => {
                  const lista = (catalogo.datos ?? []).filter(p => g.incluye(p.codigo))
                  if (lista.length === 0) return null
                  return (
                    <fieldset key={g.titulo} className="grupo-permisos">
                      <legend>{g.titulo}</legend>
                      {lista.map(p => (
                        <label key={p.codigo} className={`permiso-casilla${p.soloAdministrador ? ' apagada' : ''}`}>
                          <input type="checkbox" disabled={p.soloAdministrador}
                                 checked={!p.soloAdministrador && edicion.permisos.has(p.codigo)}
                                 onChange={() => alternar(p.codigo)} />
                          <span>{descripcionDe(p.codigo)}{p.soloAdministrador && ' — solo el Administrador'}
                            {edicion.ajuste && !p.soloAdministrador && edicion.permisos.has(p.codigo) && !edicion.ajuste.original.has(p.codigo) &&
                              <> <span className="etiqueta acento">agregado</span></>}
                            {edicion.ajuste && !p.soloAdministrador && !edicion.permisos.has(p.codigo) && edicion.ajuste.original.has(p.codigo) &&
                              <> <span className="etiqueta aviso">quitado</span></>}
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  )
                })}
              </div>
            )}
            {fallo && <Aviso>{fallo}</Aviso>}
          </>
        )}
      </Dialogo>
    </>
  )
}