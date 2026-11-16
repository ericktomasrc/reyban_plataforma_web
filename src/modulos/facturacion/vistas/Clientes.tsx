import { useEffect, useRef, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { Paginacion } from '../../../componentes/Paginacion'
import { ErrorApi } from '../../../nucleo/api/errores'
import { Si } from '../../../nucleo/autorizacion/Protegido'
import { Permisos } from '../../../nucleo/autorizacion/permisos'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { DialogoCliente } from '../componentes/DialogoCliente'
import { clientesServicio, productosServicio } from '../servicios/facturacionServicio'
import type { CatalogosSunat, ClienteEnLista } from '../tipos'
import { whatsappLegible } from '../componentes/PanelWhatsapp'
import '../comprobantes-lista.css'

/** Catálogo 06, solo para mostrar. */
const TIPOS: Record<string, string> = {
  '0': 'Sin doc.', '1': 'DNI', '4': 'C.E.', '6': 'RUC', '7': 'Pasaporte',
}

/**
 * A quién le factura esta empresa.
 *
 * UN SOLO CAMPO DE BÚSQUEDA, no un formulario de filtros. Quien va a emitir
 * escribe lo que recuerda —parte del RUC o parte del nombre— y espera
 * encontrarlo. Dos campos obligan a decidir en cuál escribir antes de buscar.
 *
 * La búsqueda va al servidor y no filtra en memoria: la lista puede tener miles
 * de clientes, y traerlos todos al navegador para filtrar tres es la clase de
 * decisión que funciona con veinte y se cae con dos mil.
 */
export function Clientes() {
  const { pedir, dialogo: confirmacion } = useConfirmar()
  const mensaje = useMensaje()

  const [q, setQ] = useState('')
  // 24 oct: filtros, orden y páginas.
  const [estado, setEstado] = useState('activos')
  const [tipoDoc, setTipoDoc] = useState('')
  const [orden, setOrden] = useState('recientes')
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(20)
  const [total, setTotal] = useState(0)

  const [clientes, setClientes] = useState<ClienteEnLista[]>()
  const [catalogos, setCatalogos] = useState<CatalogosSunat>()

  // ═══════════════════════════════════════════════════════════════════════════
  // UN ESTADO PROPIO PARA EL FALLO DE LOS CATÁLOGOS, y no «no hay catálogos».
  //
  // Antes el aviso salía con `!catalogos && !cargando`, usando el `cargando` de
  // la LISTA como si dijera algo de los catálogos. Son dos llamadas distintas y
  // llegan cuando les toca: en cuanto la lista contestaba, `cargando` se
  // apagaba, los catálogos seguían en camino, y el aviso de «no se pudieron
  // cargar» parpadeaba un instante antes de desaparecer solo.
  //
  // Un aviso que aparece y se va sin que nadie haya hecho nada es peor que no
  // tenerlo: enseña a no leerlos.
  // ═══════════════════════════════════════════════════════════════════════════
  const [catalogosFallaron, setCatalogosFallaron] = useState(false)
  const [cargando, setCargando] = useState(true)

  // EL FALLO DE CARGA SE QUEDA EN BANDA y no en ventana: si la lista no baja,
  // detrás de la ventana no hay nada que mirar, y hacer cerrar un aviso para
  // ver una pantalla vacía es trabajo por gusto. En ventana solo va lo que es
  // consecuencia de algo que se acaba de pulsar.
  const [errorCarga, setErrorCarga] = useState<string>()

  const [editando, setEditando] = useState<ClienteEnLista>()
  const [creando, setCreando] = useState(false)

  // Los catálogos de SUNAT, una sola vez. Aquí hacen falta para dos cosas: el
  // desplegable de afectación habitual del alta, y el nombre que se pinta en la
  // tabla. Escritos en el front se quedarían atrás el día que cambie uno.
  useEffect(() => {
    let vivo = true
    void (async () => {
      try {
        const c = await productosServicio.catalogos()
        if (vivo) setCatalogos(c)
      } catch { if (vivo) setCatalogosFallaron(true) }
    })()
    return () => { vivo = false }
  }, [])

  async function cargar() {
    setCargando(true)
    try {
      const r = await clientesServicio.pagina({ q, tipoDocumento: tipoDoc, estado, orden, pagina, porPagina })
      setClientes(r.filas)
      setTotal(r.total)
      setErrorCarga(undefined)
    } catch (e) {
      setErrorCarga(e instanceof ErrorApi ? e.message : 'No se pudieron cargar los clientes.')
    } finally {
      setCargando(false)
    }
  }

  // ESPERA 300 ms DESDE LA ÚLTIMA TECLA antes de preguntar al servidor. Sin
  // eso, escribir «FERRETERIA» son diez consultas y la última puede llegar
  // antes que la penúltima, dejando en pantalla el resultado equivocado.
  const primeraCarga = useRef(true)

  // LA PRIMERA CARGA NO ESPERA. Los 300 ms son para no preguntarle al servidor
  // en cada tecla mientras se escribe; al entrar en la pantalla no hay nada que
  // esperar, y ese retraso era medio segundo de «Cargando…» en blanco cada vez
  // que alguien abría la pestaña. Se paga sin ganar nada.
  useEffect(() => {
    if (primeraCarga.current) {
      primeraCarga.current = false
      void cargar()
      return
    }

    const t = setTimeout(() => { void cargar() }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, estado, tipoDoc, orden, pagina, porPagina])

  const nombreAfectacion = (codigo: string) =>
    catalogos?.afectaciones.find(a => a.codigo === codigo)?.nombre ?? codigo

  async function desactivar(c: ClienteEnLista) {
    const seguro = await pedir({
      titulo: `Desactivar a ${c.razonSocial}`,
      confirmar: 'Desactivar',
      tono: 'peligro',
      mensaje: (
        <>
          <p>Dejará de salir al emitir un comprobante.</p>
          <p>
            <strong>No se borra nada.</strong> Sus comprobantes ya emitidos
            siguen igual, y se puede reactivar después.
          </p>
        </>
      ),
    })
    if (!seguro) return

    try {
      const r = await clientesServicio.desactivar(c.id)
      mensaje.bien(r.mensaje)
      await cargar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo desactivar.')
    }
  }

  async function reactivar(c: ClienteEnLista) {
    try {
      const r = await clientesServicio.reactivar(c.id)
      mensaje.bien(r.mensaje)
      await cargar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo reactivar.')
    }
  }

  return (
    <>
      <div className="encabezado-pagina cmp-encab">
        {/* Sin pestañas desde el 12 de octubre: Comprobantes, Clientes y
            Productos están en el menú de la izquierda. */}
        <div>
          <h1 className="titulo-pagina">Clientes{total > 0 && <span className="lst-cuenta">{total} en total</span>}</h1>
          <p className="bajada-pagina">Las personas y empresas a las que les facturas.</p>
        </div>

        <Si puede={Permisos.Facturacion.ClientesGestionar}>
          <Boton onClick={() => setCreando(true)} disabled={!catalogos}>
            Nuevo cliente
          </Boton>
        </Si>
      </div>


      {errorCarga && <Aviso>{errorCarga}</Aviso>}

      {catalogosFallaron && (
        <Aviso tono="ojo">
          No se pudieron cargar los catálogos de SUNAT, así que no se puede dar
          de alta nada. Recarga la página.
        </Aviso>
      )}

      {/* Diseño 15 nov: filtros y tabla en una sola caja; filtros en una fila. */}
      <div className="lst-caja">
      <div className="lst-filtros">
        <label className="lst-buscar">
          <span className="solo-lector">Buscar</span>
          <input
            value={q}
            onChange={e => { setQ(e.target.value); setPagina(1) }}
            placeholder="Buscar por RUC, DNI, razón social o nombre comercial"
            autoFocus
          />
        </label>

        {/* 24 oct: filtros y orden. 15 nov: el documento, en botones. */}
        <div className="lst-seg" role="group" aria-label="Documento">
          {([['', 'Todos'], ['6', 'RUC'], ['1', 'DNI'], ['4', 'C.E.'], ['7', 'Pasaporte'], ['0', 'Sin doc.']] as const).map(([c, n]) => (
            <button key={c || 'todos'} type="button" aria-pressed={tipoDoc === c} className={tipoDoc === c ? 'elegido' : undefined}
                    onClick={() => { setTipoDoc(c); setPagina(1) }}>{n}</button>
          ))}
        </div>
        <label>
          <span className="solo-lector">Estado</span>
          <select value={estado} onChange={e => { setEstado(e.target.value); setPagina(1) }}>
            <option value="activos">Activos</option>
            <option value="inactivos">Desactivados</option>
            <option value="todos">Todos</option>
          </select>
        </label>
        <label>
          <span className="solo-lector">Orden</span>
          <select value={orden} onChange={e => { setOrden(e.target.value); setPagina(1) }}>
            <option value="recientes">Más recientes</option>
            <option value="az">A–Z</option>
          </select>
        </label>
      </div>

      <div className="bloque sin-relleno lst-tabla">
        {cargando && !clientes ? (
          <div className="relleno"><Cargando /></div>
        ) : clientes && clientes.length > 0 ? (
          <table className="tabla lst">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Documento</th>
                <th>Contacto</th>
                <th>IGV habitual</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>

            <tbody>
              {clientes.map(c => (
                <tr key={c.id} className={c.activo ? undefined : 'apagada'}>
                  <td className="lst-nombre">
                    <div className="principal" title={c.razonSocial}>
                      {c.razonSocial}
                      {!c.activo && <span className="lst-inactivo">Inactivo</span>}
                    </div>
                    {(c.nombreComercial || c.direccion) && (
                      <div className="secundario" title={c.nombreComercial ?? c.direccion ?? undefined}>{c.nombreComercial ?? c.direccion}</div>
                    )}
                  </td>

                  <td className="lst-doc">
                    <span className={c.tipoDocumento === '6' ? 'lst-tipo ruc' : 'lst-tipo'}>{TIPOS[c.tipoDocumento] ?? c.tipoDocumento}</span>{' '}
                    <span className="mono">{c.numeroDocumento}</span>
                  </td>

                  <td className="lst-contacto">
                    {c.correo && <div title={c.correo}>{c.correo}</div>}
                    {c.whatsapp && <div>WhatsApp {whatsappLegible(c.whatsapp)}</div>}
                    {!c.whatsapp && c.telefono && <div>{c.telefono}</div>}
                    {!c.correo && !c.whatsapp && !c.telefono && <span className="vacio">Sin contacto</span>}
                  </td>

                  {/* SE ENSEÑA EN LA TABLA a propósito: es el campo que evita
                      el error caro al facturar, y uno que solo se ve abriendo
                      la ficha es uno que nadie revisa. */}
                  <td>
                    {c.afectacionHabitual ? (
                      <span className="etiqueta acento">
                        {nombreAfectacion(c.afectacionHabitual)}
                      </span>
                    ) : (
                      <span className="vacio" title="Se usa la del producto">—</span>
                    )}
                  </td>

                  <td className="acciones lst-acciones">
                    <Si puede={Permisos.Facturacion.ClientesGestionar}>
                      {c.activo ? (
                        <>
                          <Boton estilo="plano" onClick={() => setEditando(c)} disabled={!catalogos}>
                            Editar
                          </Boton>
                          <Boton estilo="plano" onClick={() => void desactivar(c)}>Desactivar</Boton>
                        </>
                      ) : (
                        <Boton estilo="plano" onClick={() => void reactivar(c)}>Reactivar</Boton>
                      )}
                    </Si>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="relleno">
            <Vacio>
              {q || tipoDoc || estado !== 'activos'
                ? 'Ningún cliente cuadra con esos filtros.'
                : 'Todavía no tienes clientes. Crea el primero para poder facturar.'}
            </Vacio>
          </div>
        )}
      </div>

      </div>

      <Paginacion total={total} pagina={pagina} porPagina={porPagina}
                  onCambiar={setPagina} onPorPagina={n => { setPorPagina(n); setPagina(1) }} />

      {confirmacion}

      {creando && catalogos && (
        <DialogoCliente
          catalogos={catalogos}
          onCerrar={() => setCreando(false)}
          onGuardado={m => { setCreando(false); mensaje.bien(m); void cargar() }}
        />
      )}

      {editando && catalogos && (
        <DialogoCliente
          cliente={editando}
          catalogos={catalogos}
          onCerrar={() => setEditando(undefined)}
          onGuardado={m => { setEditando(undefined); mensaje.bien(m); void cargar() }}
        />
      )}
    </>
  )
}