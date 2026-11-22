import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { posServicio, type CajaConfig, type ConfigCajas as Datos, type SucursalCajas } from '../servicios/posServicio'
import '../../facturacion/comprobantes-lista.css'
import '../../deudas/deudas.css'
import '../pos.css'

/**
 * e278 (093) — LAS CAJAS DEL PUNTO DE VENTA. Crear, nombrar y desactivar las
 * cajas de cada sucursal. Antes se creaban solas («Caja 01», «Caja 02») al
 * abrir; eso sigue igual si no hay ninguna libre. Nada se borra.
 */
export function ConfigCajas() {
  const mensaje = useMensaje()
  const { pedir, dialogo } = useConfirmar()
  const [datos, setDatos] = useState<Datos>()
  const [fallo, setFallo] = useState<string>()
  const [recargar, setRecargar] = useState(0)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let vivo = true
    posServicio.configCajas()
      .then(d => { if (vivo) { setDatos(d); setFallo(undefined) } })
      .catch(e => { if (vivo) setFallo(e instanceof ErrorApi ? e.message : 'No se pudieron leer las cajas.') })
    return () => { vivo = false }
  }, [recargar])

  async function hacer(accion: () => Promise<{ mensaje: string }>) {
    setOcupado(true)
    try { const r = await accion(); mensaje.bien(r.mensaje); setRecargar(n => n + 1) }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo.') }
    finally { setOcupado(false) }
  }

  async function crear(s: SucursalCajas, nombre: string) {
    if (!await pedir({
      titulo: '¿Crear esta caja?',
      confirmar: 'Sí, crear la caja',
      mensaje: <p>Se crea la caja <strong>{nombre.trim().toUpperCase()}</strong> en <strong>{s.codigo} {s.nombre}</strong>.
        Desde ese momento sale para elegir al abrir caja en el punto de venta.</p>,
    })) return false
    await hacer(() => posServicio.crearCaja(s.id, nombre.trim()))
    return true
  }

  async function renombrar(c: CajaConfig, nombre: string) {
    if (!await pedir({
      titulo: '¿Cambiar el nombre?',
      confirmar: 'Sí, cambiar',
      mensaje: <p><strong>{c.nombre}</strong> pasa a llamarse <strong>{nombre.trim().toUpperCase()}</strong>.
        Sus aperturas y arqueos anteriores siguen igual, con el nombre nuevo.</p>,
    })) return false
    await hacer(() => posServicio.renombrarCaja(c.id, nombre.trim()))
    return true
  }

  async function activar(c: CajaConfig, activo: boolean) {
    if (!await pedir({
      titulo: activo ? '¿Reactivar la caja?' : '¿Desactivar la caja?',
      confirmar: activo ? 'Sí, reactivar' : 'Sí, desactivar',
      tono: activo ? 'normal' : 'peligro',
      mensaje: activo
        ? <p><strong>{c.nombre}</strong> vuelve a salir para abrir en el punto de venta.</p>
        : <p><strong>{c.nombre}</strong> deja de salir para abrir. Sus {c.aperturas} apertura(s) y arqueos <strong>se guardan</strong> (nada se borra).</p>,
    })) return
    await hacer(() => posServicio.activarCaja(c.id, activo))
  }

  return (
    <div className="pos-cajas-cfg">
      {dialogo}
      <Link to="/pos/cajas" className="enlace-volver">← Cajas y arqueos</Link>
      <div className="encabezado-pagina cmp-encab">
        <div>
          <h1 className="titulo-pagina">Administrar cajas</h1>
          <p className="bajada-pagina">
            Cada caja es un cajón de dinero con su propio cierre. Ejemplo: «Caja mostrador» y «Caja delivery» en la misma tienda,
            cada una con su cajero. Si no creas ninguna, al abrir se crea sola «Caja 01».
          </p>
        </div>
      </div>
      {fallo && <Aviso>{fallo}</Aviso>}
      {!datos && !fallo && <Cargando />}
      {datos && !datos.puedeCambiar && <Aviso tono="ojo">Puedes ver las cajas, pero no cambiarlas: pide el permiso «Crear, nombrar y desactivar las cajas».</Aviso>}
      {datos?.sucursales.map(s => (
        <Sucursal key={s.id} s={s} puede={datos.puedeCambiar} ocupado={ocupado} onCrear={crear} onRenombrar={renombrar} onActivar={activar} />
      ))}
      <p className="nota">Una caja abierta no se puede desactivar: primero la cierra quien la tiene. El nombre se guarda en mayúsculas.</p>
    </div>
  )
}

function Sucursal({ s, puede, ocupado, onCrear, onRenombrar, onActivar }: {
  s: SucursalCajas; puede: boolean; ocupado: boolean
  onCrear: (s: SucursalCajas, nombre: string) => Promise<boolean>
  onRenombrar: (c: CajaConfig, nombre: string) => Promise<boolean>
  onActivar: (c: CajaConfig, activo: boolean) => Promise<void>
}) {
  const [nueva, setNueva] = useState('')
  const [editando, setEditando] = useState<{ id: string; nombre: string }>()
  const activas = s.cajas.filter(c => c.activo).length

  return (
    <section className="lst-caja pos-cfg-sucursal">
      <div className="pos-cfg-cab">
        <div><strong>{s.codigo} {s.nombre}</strong><span className="secundario"> · {activas} {activas === 1 ? 'caja activa' : 'cajas activas'}</span></div>
        {puede && (
          <form className="pos-cfg-nueva" onSubmit={async e => { e.preventDefault(); if (nueva.trim() && await onCrear(s, nueva)) setNueva('') }}>
            <input value={nueva} maxLength={60} placeholder="Nueva caja (ej.: Caja delivery)" aria-label={`Nueva caja en ${s.nombre}`}
                   onChange={e => setNueva(e.target.value)} />
            <Boton type="submit" estilo="secundario" disabled={!nueva.trim() || ocupado}>Agregar</Boton>
          </form>
        )}
      </div>
      {s.cajas.length === 0 ? (
        <p className="relleno secundario">Todavía no tiene cajas: al abrir la primera vez se crea «Caja 01», o agrégala aquí con el nombre que quieras.</p>
      ) : (
        <table className="tabla lst">
          <thead><tr><th>Caja</th><th>Estado</th><th className="derecha">Aperturas</th><th>Último uso</th><th /></tr></thead>
          <tbody>
            {s.cajas.map(c => (
              <tr key={c.id} className={c.activo ? undefined : 'inactivo'}>
                <td>
                  {editando?.id === c.id ? (
                    <form className="pos-cfg-nueva" onSubmit={async e => { e.preventDefault(); if (editando.nombre.trim() && await onRenombrar(c, editando.nombre)) setEditando(undefined) }}>
                      <input value={editando.nombre} maxLength={60} autoFocus aria-label="Nuevo nombre" onChange={e => setEditando({ id: c.id, nombre: e.target.value })} />
                      <Boton type="submit" estilo="secundario" disabled={!editando.nombre.trim() || ocupado}>Guardar</Boton>
                      <Boton estilo="plano" onClick={() => setEditando(undefined)}>Cancelar</Boton>
                    </form>
                  ) : <span className="principal">{c.nombre}</span>}
                </td>
                <td>
                  {!c.activo ? <span className="ddu-estado gris">Desactivada</span>
                    : c.abiertaPor ? <span className="ddu-estado ojo">Abierta por {c.abiertaPor}</span>
                    : <span className="ddu-estado bien">Libre</span>}
                </td>
                <td className="derecha">{c.aperturas}</td>
                <td className="secundario">{c.ultimoUso ? fecha(c.ultimoUso) : 'nunca'}</td>
                <td className="acciones">
                  {puede && editando?.id !== c.id && <>
                    <Boton estilo="plano" onClick={() => setEditando({ id: c.id, nombre: c.nombre })}>Renombrar</Boton>
                    {c.activo
                      ? <Boton estilo="plano" disabled={!!c.abiertaPor || ocupado} title={c.abiertaPor ? 'Está abierta: primero hay que cerrarla' : undefined}
                               onClick={() => void onActivar(c, false)}>Desactivar</Boton>
                      : <Boton estilo="plano" disabled={ocupado} onClick={() => void onActivar(c, true)}>Reactivar</Boton>}
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}