import { useEffect, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { api } from '../../../nucleo/api/cliente'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'

/** Lo que hace falta de GET /api/roles para elegir uno. */
interface RolParaElegir {
  id: string
  nombre: string
  descripcion: string | null
}

/**
 * Lo que puede hacer cada rol, en palabras de quien lo va a elegir. Si el rol
 * no está aquí (uno propio de la empresa) se usa su descripción de la base.
 */
const EXPLICA: Record<string, string> = {
  Facturador:    'Emite y consulta comprobantes; crea clientes y productos.',
  Consulta:      'Solo mira y descarga. Para tu contador.',
  Administrador: 'Todo, incluso la configuración y los usuarios.',
}

/** El orden en que se ofrecen: del más común al más delicado. */
const ORDEN = ['Facturador', 'Consulta', 'Administrador']

/**
 * «INVITAR A ALGUIEN» (lienzo «Cuenta Negocio», pantalla 2), al lado de la
 * tabla de usuarios en vez de en un diálogo: así se ve a la vez quién está y
 * a quién se agrega.
 *
 * Usa el mismo POST /api/usuarios del diálogo de antes. Se elige UN rol; si
 * alguien necesita dos, se le agregan después con «Roles».
 */
export function PanelInvitar({ empresa, onCreado }: {
  empresa: string
  onCreado: () => void
}) {
  const mensaje = useMensaje()
  const [roles, setRoles] = useState<RolParaElegir[] | null>(null)
  const [correo, setCorreo] = useState('')
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState<string>()
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    api.obtener<RolParaElegir[]>('/api/roles')
      .then(r => {
        const ordenados = [...r].sort((a, b) => posicion(a.nombre) - posicion(b.nombre) || a.nombre.localeCompare(b.nombre))
        setRoles(ordenados)
        setRol(ordenados.find(x => x.nombre === 'Facturador')?.id ?? ordenados[0]?.id)
      })
      .catch(() => setRoles([]))
  }, [])

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!correo.trim()) { setError('Escribe su correo.'); return }
    if (!rol) { setError('Elige qué puede hacer.'); return }

    setOcupado(true)
    try {
      const r = await api.crear<{ nombre: string; correo: string; invitacionEnviada: boolean }>(
        '/api/usuarios', { correo: correo.trim(), nombre: nombre.trim(), roles: [rol] })

      // El usuario queda creado en los dos casos. Ámbar y no rojo cuando el
      // correo no sale: rojo haría pensar que hay que repetir el alta.
      if (r.invitacionEnviada) mensaje.bien(`Le mandamos la invitación a ${r.correo}.`)
      else                     mensaje.ojo(`${r.nombre} quedó creado, pero el correo no salió. Usa «Reenviar».`)

      setCorreo(''); setNombre('')
      onCreado()
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo enviar la invitación.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <aside className="bloque panel-colaborador">
      <h2>Invitar a alguien</h2>
      <p className="nota">Alguien que trabaja en {empresa}: tu cajera, tu contador.</p>

      <form onSubmit={enviar} className="formulario-panel">
        <Campo etiqueta="Correo" type="email" obligatorio value={correo} onChange={e => setCorreo(e.target.value)} />
        <Campo etiqueta="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} />

        <fieldset className="grupo-nivel">
          <legend>Qué puede hacer</legend>
          {roles === null && <span className="secundario">Cargando…</span>}
          {roles?.map(r => (
            <label key={r.id} className={'opcion-nivel' + (rol === r.id ? ' elegida' : '')}>
              <input type="radio" name="rol-invitado" checked={rol === r.id} onChange={() => setRol(r.id)} />
              <span>
                <strong>{r.nombre}</strong>
                {(EXPLICA[r.nombre] ?? r.descripcion) && <span>{EXPLICA[r.nombre] ?? r.descripcion}</span>}
              </span>
            </label>
          ))}
        </fieldset>

        {error && <Aviso>{error}</Aviso>}

        <p className="nota">Le llega un enlace para crear su contraseña y activar su segundo factor.</p>

        <Boton type="submit" ancho ocupado={ocupado} textoOcupado="Enviando…">Enviar invitación</Boton>
      </form>
    </aside>
  )
}

function posicion(nombre: string): number {
  const i = ORDEN.indexOf(nombre)
  return i < 0 ? ORDEN.length : i
}