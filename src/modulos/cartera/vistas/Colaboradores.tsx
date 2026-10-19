import { useCallback, useEffect, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { useYo } from '../../../nucleo/sesion/SesionContexto'
import { carteraServicio, NOMBRE_NIVEL } from '../servicios/carteraServicio'
import type { Colaborador, EmpresaCartera, Nivel } from '../servicios/carteraServicio'

/**
 * COLABORADORES (fase 3): las personas del estudio y qué empresas ve cada una.
 *
 *   Colaborador                 emite y consulta en las empresas que se le dan
 *   Colaborador administrador   además agrega empresas e invita colaboradores
 *   Dueño                       todo; el único que quita empresas o personas
 *
 * A la derecha, el formulario: invitar (vacío) o editar (al pulsar «Editar»).
 * Quién puede qué lo decide la base; aquí solo se esconde lo que daría error.
 */
export function Colaboradores() {
  const { usuario, cuenta } = useYo()
  const mensaje = useMensaje()

  const [personas, setPersonas] = useState<Colaborador[] | null>(null)
  const [empresas, setEmpresas] = useState<EmpresaCartera[]>([])
  const [fallo, setFallo] = useState<string | null>(null)
  const [editando, setEditando] = useState<Colaborador | null>(null)

  const dueno = cuenta?.nivel === 'dueno'

  const cargar = useCallback(async () => {
    try {
      const [p, e] = await Promise.all([carteraServicio.colaboradores(), carteraServicio.empresas()])
      setPersonas(p); setEmpresas(e); setFallo(null)
    } catch (err) {
      setFallo(err instanceof ErrorApi ? err.message : 'No se pudo leer el equipo.')
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  if (fallo) return <Aviso>{fallo}</Aviso>
  if (!personas) return <Cargando texto="Leyendo tu equipo…" />

  const nombreEmpresa = (id: string) => empresas.find(e => e.id === id)?.nombre ?? '—'

  const quitar = async (c: Colaborador) => {
    if (!window.confirm(`¿Quitar a ${c.nombre}? Deja de entrar en el acto. No se borra nada.`)) return
    try {
      mensaje.bien((await carteraServicio.quitar(c.id)).mensaje)
      setEditando(null)
      await cargar()
    } catch (err) {
      mensaje.error(err instanceof ErrorApi ? err.message : 'No se pudo quitar.')
    }
  }

  return (
    <>
      <div className="bienvenida-cabecera">
        <h1 className="titulo-pagina titulo-serif">Colaboradores</h1>
        <p className="bajada-pagina">Las personas de tu estudio. Tú decides qué empresas ve cada una.</p>
      </div>

      <div className="colaboradores">
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr><th>Persona</th><th>Nivel</th><th>Empresas que ve</th><th>Estado</th><th /></tr>
            </thead>
            <tbody>
              {personas.map(c => {
                const editable = c.id !== usuario.id && c.nivel !== 'dueno' && c.activo
                  && (dueno || c.nivel === 'colaborador')
                return (
                  <tr key={c.id} className={!c.activo ? 'apagada' : undefined}>
                    <td>
                      <div className="principal">{c.pendiente && c.nivel !== 'dueno' ? c.correo : c.nombre}</div>
                      <div className="secundario">{c.pendiente && c.nivel !== 'dueno' ? c.nombre : `@${c.alias}`}</div>
                    </td>
                    <td><span className={'etiqueta' + (c.nivel === 'dueno' ? ' aviso' : ' acento')}>{NOMBRE_NIVEL[c.nivel]}</span></td>
                    <td>
                      {c.nivel === 'dueno' || c.veTodas
                        ? 'Todas'
                        : c.empresas.length ? c.empresas.map(nombreEmpresa).join(', ') : <span className="secundario">Ninguna</span>}
                    </td>
                    <td className={!c.activo ? 'secundario' : c.pendiente && c.nivel !== 'dueno' ? 'texto-ojo' : 'texto-bien'}>
                      {!c.activo ? 'Quitado' : c.pendiente && c.nivel !== 'dueno' ? 'Invitación enviada' : 'Activo'}
                    </td>
                    <td className="acciones">
                      {editable && <Boton estilo="secundario" onClick={() => setEditando(c)}>Editar</Boton>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <FormularioColaborador
          key={editando?.id ?? 'nuevo'}
          editando={editando}
          empresas={empresas.filter(e => !e.pausadaEn)}
          dueno={dueno}
          onCancelar={() => setEditando(null)}
          onQuitar={dueno && editando ? () => void quitar(editando) : undefined}
          onHecho={async () => { setEditando(null); await cargar() }}
        />
      </div>
    </>
  )
}


function FormularioColaborador({ editando, empresas, dueno, onCancelar, onQuitar, onHecho }: {
  editando: Colaborador | null
  empresas: EmpresaCartera[]
  dueno: boolean
  onCancelar: () => void
  onQuitar?: () => void
  onHecho: () => Promise<void>
}) {
  const mensaje = useMensaje()
  const [correo, setCorreo] = useState('')
  const [nombre, setNombre] = useState('')
  const [nivel, setNivel] = useState<Nivel>(editando?.nivel ?? 'colaborador')
  const [veTodas, setVeTodas] = useState(editando?.veTodas ?? false)
  const [elegidas, setElegidas] = useState<string[]>(editando?.empresas ?? [])
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const alternar = (id: string) =>
    setElegidas(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id])

  const enviar = async () => {
    setErrores({}); setGeneral(null)
    if (!veTodas && elegidas.length === 0) { setGeneral('Elige al menos una empresa, o «Todas».'); return }

    setOcupado(true)
    try {
      if (editando) {
        mensaje.bien((await carteraServicio.editar(editando.id, { nivel, veTodas, empresas: elegidas })).mensaje)
      } else {
        const r = await carteraServicio.invitar({ correo: correo.trim(), nombre: nombre.trim(), nivel, veTodas, empresas: elegidas })
        mensaje.bien(r.mensaje)
        if (r.enlaceDePrueba) console.info('Enlace de invitación (solo desarrollo):', r.enlaceDePrueba)
        setCorreo(''); setNombre(''); setElegidas([]); setVeTodas(false)
      }
      await onHecho()
    } catch (err) {
      const texto = err instanceof ErrorApi ? err.message : 'No se pudo guardar.'
      const campo = err instanceof ErrorApi && err.codigo?.startsWith('campo_') ? err.codigo.slice(6) : undefined
      if (campo) setErrores({ [campo]: texto }); else setGeneral(texto)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <aside className="bloque panel-colaborador">
      <h2>{editando ? `Editar a ${editando.nombre}` : 'Invitar colaborador'}</h2>

      {!editando && (
        <>
          <Campo etiqueta="Correo" type="email" obligatorio value={correo} onChange={e => setCorreo(e.target.value)}
                 mal={!!errores.correo} pista={errores.correo || undefined} />
          <Campo etiqueta="Nombre" obligatorio value={nombre} onChange={e => setNombre(e.target.value)}
                 mal={!!errores.nombre} pista={errores.nombre || undefined} />
        </>
      )}

      <fieldset className="grupo-nivel">
        <legend>Nivel</legend>
        <label className={'opcion-nivel' + (nivel === 'colaborador' ? ' elegida' : '')}>
          <input type="radio" name="nivel" checked={nivel === 'colaborador'} onChange={() => setNivel('colaborador')} />
          <span><strong>Colaborador</strong><span>Emite y consulta en las empresas que le des.</span></span>
        </label>
        {dueno && (
          <label className={'opcion-nivel' + (nivel === 'colaborador_admin' ? ' elegida' : '')}>
            <input type="radio" name="nivel" checked={nivel === 'colaborador_admin'} onChange={() => setNivel('colaborador_admin')} />
            <span><strong>Colaborador administrador</strong><span>Además, agrega empresas e invita colaboradores.</span></span>
          </label>
        )}
      </fieldset>

      <fieldset className="grupo-empresas">
        <legend>Qué empresas ve</legend>
        <label className="casilla-terminos">
          <input type="checkbox" checked={veTodas} onChange={e => setVeTodas(e.target.checked)} />
          Todas (y las que agregues después)
        </label>
        {!veTodas && (
          <div className="lista-casillas">
            {empresas.length === 0 && <span className="secundario">Todavía no hay empresas en la cartera.</span>}
            {empresas.map(e => (
              <label key={e.id} className="casilla-terminos">
                <input type="checkbox" checked={elegidas.includes(e.id)} onChange={() => alternar(e.id)} />
                {e.nombre}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      {general && <Aviso>{general}</Aviso>}

      {!editando && (
        <p className="nota">Le llega un enlace para crear su contraseña. Solo el dueño quita colaboradores.</p>
      )}

      <Boton ancho onClick={() => void enviar()} ocupado={ocupado}
             textoOcupado={editando ? 'Guardando…' : 'Enviando…'}>
        {editando ? 'Guardar cambios' : 'Enviar invitación'}
      </Boton>

      {editando && (
        <div className="pie-panel">
          <Boton estilo="plano" onClick={onCancelar}>Cancelar</Boton>
          {onQuitar && <Boton estilo="peligro" onClick={onQuitar}>Quitar colaborador</Boton>}
        </div>
      )}
    </aside>
  )
}