import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { Si } from '../../../nucleo/autorizacion/Protegido'
import { Permisos } from '../../../nucleo/autorizacion/permisos'
import { fecha } from '../../../nucleo/formato/fechas'
import { EstadoComprobante } from '../componentes/EstadoComprobante'
import { documentosServicio } from '../servicios/facturacionServicio'
import type { Atrasado, PaginaDocumentos } from '../tipos'

const TIPOS: Record<string, string> = { '01': 'Factura', '03': 'Boleta', '07': 'Nota de crédito', '08': 'Nota de débito' }

/** «vence hoy», «vence mañana», «venció el 5 oct. 2026»… */
function plazo(a: Atrasado): string {
  if (a.vencido) return `fuera de plazo desde el ${fecha(a.venceEl)}`
  if (a.diasRestantes === 0) return 'el plazo vence hoy'
  if (a.diasRestantes === 1) return 'el plazo vence mañana'
  return `el plazo vence el ${fecha(a.venceEl)}`
}

/**
 * Los comprobantes de la empresa.
 *
 * LOS BORRADORES SALEN ARRIBA Y SE DISTINGUEN, porque son lo único sobre lo
 * que todavía se puede actuar. Un listado que los mezcla con los emitidos
 * hace que alguien deje una factura a medias sin darse cuenta.
 */
export function Comprobantes() {
  const navegar = useNavigate()

  const [estado, setEstado] = useState('')
  const [tipo, setTipo] = useState('')   // 031: filtro por tipo (notas de crédito)
  const [q, setQ] = useState('')
  const [pagina, setPagina] = useState(1)

  const [datos, setDatos] = useState<PaginaDocumentos>()
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string>()

  // ═══════════════════════════════════════════════════════════════════════════
  // LA ALARMA DE PLAZO. Va aparte de la lista y NO depende de sus filtros:
  // un comprobante a punto de vencer tiene que verse aunque la lista esté
  // filtrada por «Aceptados» o en la página 3.
  //
  // Si falla, no se enseña nada y la lista sigue: un aviso que no se pudo
  // calcular no puede tumbar la pantalla que se usa para arreglarlo.
  // ═══════════════════════════════════════════════════════════════════════════
  const [atrasados, setAtrasados] = useState<Atrasado[]>([])
  const [totalAtrasados, setTotalAtrasados] = useState(0)
  const [vencidos, setVencidos] = useState(0)

  async function cargarAtrasados() {
    try {
      const r = await documentosServicio.atrasados()
      setAtrasados(r.atrasados)
      setTotalAtrasados(r.total)
      setVencidos(r.vencidos)
    } catch {
      /* se deja como estaba: ver arriba */
    }
  }

  async function cargar() {
    setCargando(true)
    try {
      setDatos(await documentosServicio.listar(estado || undefined, q || undefined, pagina, tipo || undefined))
      setError(undefined)
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudieron cargar los comprobantes.')
    } finally {
      setCargando(false)
    }
    void cargarAtrasados()
  }

  const hayVencidos = vencidos > 0

  // El consejo de abajo nombra SOLO los casos que aparecen en la banda, y en
  // singular o plural según cuántos haya. Antes hablaba siempre de los dos en
  // plural, y con un solo comprobante se leía como un formulario.
  const conError   = atrasados.filter(a => a.estado === 'error').length
  const sinRespuesta = atrasados.length - conError

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
  }, [estado, q, pagina, tipo])

  // Un comprobante recién emitido está «en camino» unos segundos. Se recarga
  // sola mientras haya alguno en ese estado, y se para cuando no queda
  // ninguno: preguntar cada cinco segundos para siempre es gastar batería y
  // conexión por nada.
  const hayEnCamino = datos?.filas.some(d => d.estado === 'encolado') ?? false

  useEffect(() => {
    if (!hayEnCamino) return
    const t = setInterval(() => { void cargar() }, 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayEnCamino, estado, q, pagina])

  const paginas = datos ? Math.ceil(datos.total / datos.porPagina) : 0

  return (
    <>
      <div className="encabezado-pagina">
        {/* Sin pestañas desde el 12 de octubre: Comprobantes, Clientes y
            Productos están en el menú de la izquierda. */}
        <h1 className="titulo-pagina">Comprobantes</h1>

        <Si puede={Permisos.Facturacion.Emitir}>
          <Boton onClick={() => navegar('/facturacion/comprobantes/nuevo')}>
            Nuevo comprobante
          </Boton>
        </Si>
      </div>

      {error && <Aviso>{error}</Aviso>}

      {/* ROJO SI ALGUNO YA VENCIÓ, ÁMBAR SI SOLO SE ACERCA. Dice qué hacer, no
          solo qué pasa: una alarma que no dice el siguiente paso se cierra y
          se olvida. */}
      {atrasados.length > 0 && (
        <Aviso tono={hayVencidos ? undefined : 'ojo'}>
          <p>
            <strong>
              {totalAtrasados === 1
                ? 'Un comprobante no ha llegado a SUNAT'
                : `${totalAtrasados} comprobantes no han llegado a SUNAT`}
              {hayVencidos
                ? (totalAtrasados === 1 ? ' y su plazo ya venció.' : ' y hay plazos vencidos.')
                : (totalAtrasados === 1 ? ' y se acerca su plazo.' : ' y se acercan sus plazos.')}
            </strong>
          </p>
          <ul className="lista-atrasados">
            {atrasados.map(a => (
              <li key={a.id}>
                <Link to={`/facturacion/comprobantes/${a.id}`}>
                  {a.numero ?? `${TIPOS[a.tipo] ?? a.tipo} sin número`}
                </Link>
                {' · '}{a.cliente}
                {' · '}{a.estado === 'error' ? 'no se pudo enviar' : 'sin respuesta de SUNAT'}
                {' · '}<strong>{plazo(a)}</strong>
              </li>
            ))}
          </ul>
          {totalAtrasados > atrasados.length && (
            <p>
              Y {totalAtrasados - atrasados.length} más. Arriba están los más
              urgentes; el resto sale filtrando la lista por «En camino» o «No se
              pudieron enviar».
            </p>
          )}
          <p>
            {conError > 0 && (
              <>
                {conError === 1 ? 'El que dice' : 'Los que dicen'} «no se pudo enviar»:{' '}
                {conError === 1 ? 'ábrelo' : 'ábrelos'} y pulsa <strong>Reintentar</strong>.{' '}
              </>
            )}
            {sinRespuesta > 0 && (
              <>
                {sinRespuesta === 1 ? 'El que lleva' : 'Los que llevan'} días «sin respuesta de
                SUNAT»: el servicio de facturación no está recibiendo contestación — revisa
                su panel.
              </>
            )}
          </p>
        </Aviso>
      )}

      <div className="filtros">
        <label className="ancho">
          <span>Buscar</span>
          <input
            value={q}
            onChange={e => { setQ(e.target.value); setPagina(1) }}
            placeholder="Serie, cliente o RUC"
          />
        </label>

        <label>
          <span>Estado</span>
          <select value={estado} onChange={e => { setEstado(e.target.value); setPagina(1) }}>
            <option value="">Todos</option>
            <option value="borrador">Borradores</option>
            <option value="encolado">En camino</option>
            <option value="aceptado">Aceptados</option>
            <option value="observado">Con observaciones</option>
            <option value="rechazado">Rechazados</option>
            <option value="error">No se pudieron enviar</option>
            <option value="anulado">Anulados</option>
          </select>
        </label>

        <label>
          <span>Tipo</span>
          <select value={tipo} onChange={e => { setTipo(e.target.value); setPagina(1) }}>
            <option value="">Todos</option>
            <option value="01">Facturas</option>
            <option value="03">Boletas</option>
            <option value="07">Notas de crédito</option>
          </select>
        </label>
      </div>

      <div className="bloque sin-relleno">
        {cargando && !datos ? (
          <div className="relleno"><Cargando /></div>
        ) : datos && datos.filas.length > 0 ? (
          <table className="tabla">
            <thead>
              <tr>
                <th>Comprobante</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th className="derecha">Importe</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>

            <tbody>
              {datos.filas.map(d => (
                <tr key={d.id}>
                  <td>
                    <div className="principal mono">
                      {d.serie && d.correlativo !== null
                        ? `${d.serie}-${String(d.correlativo).padStart(8, '0')}`
                        : <span className="vacio">Sin número</span>}
                    </div>
                    <div className="secundario">
                      {TIPOS[d.tipo] ?? d.tipo}
                      {d.afecta && <> de <span className="mono">{d.afecta}</span></>}
                      {d.ambiente === 'beta' && <> <span className="etiqueta aviso" title="Emitido en SUNAT beta: sin valor legal">prueba</span></>}
                    </div>
                  </td>

                  <td>
                    <div className="principal">{d.cliente.razonSocial}</div>
                    <div className="secundario mono">{d.cliente.numeroDocumento}</div>
                  </td>

                  <td className="secundario">{fecha(d.fechaEmision)}</td>

                  <td>
                    <EstadoComprobante estado={d.estado} />
                    {d.mensajeSunat && (
                      <div className="secundario detalle">{d.mensajeSunat}</div>
                    )}
                  </td>

                  <td className="derecha">
                    <div className="principal mono">
                      {d.tipo === '07' ? '−' : ''}{d.importeTotal.toFixed(2)}
                    </div>
                    <div className="secundario">{d.moneda}</div>
                  </td>

                  <td className="acciones">
                    <Boton
                      estilo="plano"
                      onClick={() => navegar(
                        (d.estado === 'borrador' || d.estado === 'error') && d.tipo !== '07' && d.tipo !== '08'
                          ? `/facturacion/comprobantes/${d.id}/editar`
                          : `/facturacion/comprobantes/${d.id}`
                      )}
                    >
                      {(d.estado === 'borrador' || d.estado === 'error') && d.tipo !== '07' && d.tipo !== '08' ? 'Continuar' : 'Ver'}
                    </Boton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="relleno">
            <Vacio>
              {q || estado
                ? 'Ningún comprobante cuadra con eso.'
                : 'Todavía no has emitido ningún comprobante.'}
            </Vacio>
          </div>
        )}
      </div>

      {paginas > 1 && datos && (
        <div className="paginacion">
          <span>{datos.total} comprobantes · página {datos.pagina} de {paginas}</span>
          <div>
            <Boton estilo="secundario" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>
              Anterior
            </Boton>
            <Boton estilo="secundario" disabled={pagina >= paginas} onClick={() => setPagina(p => p + 1)}>
              Siguiente
            </Boton>
          </div>
        </div>
      )}
    </>
  )
}