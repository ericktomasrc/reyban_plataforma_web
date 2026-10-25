import { useState } from 'react'
import { Paginacion } from '../../../componentes/Paginacion'
import { FiltroFechas } from '../../../componentes/FiltrosComunes'
import { contiene, usePaginaLocal } from '../../../nucleo/hooks/usePaginaLocal'
import { Aviso } from '../../../componentes/Aviso'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fechaYHora } from '../../../nucleo/formato/fechas'
import { useCargar } from '../../../nucleo/hooks/useCargar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { DialogoSuspenderCuenta, DialogoTopeCuenta, nombreDeCuenta } from '../componentes/DialogosCuenta'
import { cuentasServicio } from '../servicios/cuentasServicio'
import type { CuentaEnLista } from '../servicios/cuentasServicio'

type Filtro = 'todas' | 'hoy' | 'pendientes' | 'suspendidas'

/**
 * «Cuentas»: quién se registró (migración 016). Solo el super administrador.
 *
 * Cada registro nuevo además le llega por correo. Aquí se revisa y, si algo
 * no cuadra, se suspende: no borra nada y corta sus sesiones al instante.
 *
 * El documento del titular sale a medias en la lista y completo al pasar el
 * ratón: la pantalla se mira con gente alrededor.
 */
export function ListaCuentas() {
  const cuentas = useCargar<CuentaEnLista[]>(() => cuentasServicio.listar())
  const mensaje = useMensaje()

  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [qC, setQC] = useState('')
  const [desdeC, setDesdeC] = useState('')
  const [hastaC, setHastaC] = useState('')
  const [suspendiendo, setSuspendiendo] = useState<CuentaEnLista>()
  const [cambiandoTope, setCambiandoTope] = useState<CuentaEnLista>()

  async function reactivar(c: CuentaEnLista) {
    try {
      await cuentasServicio.reactivar(c.id)
      mensaje.bien(`${nombreDeCuenta(c)} quedó reactivada.`)
      await cuentas.recargar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo reactivar.')
    }
  }

  // 24 oct: buscar, fechas y páginas (antes del «return»).
  const todas = cuentas.datos ?? []
  const hoy = new Date().toDateString()
  const cuenta = (f: Filtro) => todas.filter(c =>
    f === 'todas' ? true
    : f === 'hoy' ? new Date(c.creadoEn).toDateString() === hoy
    : f === 'pendientes' ? c.estado === 'pendiente'
    : c.estado === 'suspendida')
  const filtradas = cuenta(filtro).filter(c =>
    contiene(qC, c.titularNombre, c.titularDocumento, c.usuario?.correo) &&
    (!desdeC || c.creadoEn.slice(0, 10) >= desdeC) && (!hastaC || c.creadoEn.slice(0, 10) <= hastaC))
  const { visibles, paginacion } = usePaginaLocal(filtradas, `${filtro}|${qC}|${desdeC}|${hastaC}`)

  if (cuentas.cargando && !cuentas.datos) return <Cargando />

  const filtros: [Filtro, string][] = [
    ['todas', 'Todas'], ['hoy', 'Hoy'], ['pendientes', 'Sin confirmar'], ['suspendidas', 'Suspendidas'],
  ]

  return (
    <>
      <div className="encabezado-pagina">
        <h1 className="titulo-pagina">Cuentas</h1>
      </div>

      <p className="bajada-pagina">
        Te llega un correo con cada registro nuevo. Suspender corta sus
        sesiones al instante; no borra nada.
      </p>

      <div className="filtros-cuentas" role="group" aria-label="Filtrar">
        {filtros.map(([f, texto]) => (
          <button key={f} type="button" aria-pressed={filtro === f}
                  className={filtro === f ? 'etiqueta acento' : 'etiqueta'}
                  onClick={() => setFiltro(f)}>
            {texto} · {cuenta(f).length}
          </button>
        ))}
      </div>

      <div className="filtros-lista">
        <label className="buscar"><span>Buscar</span>
          <input value={qC} onChange={e => setQC(e.target.value)} placeholder="Titular, RUC/DNI o correo" /></label>
        <FiltroFechas desde={desdeC} hasta={hastaC} onDesde={setDesdeC} onHasta={setHastaC} />
      </div>

      {cuentas.error && <Aviso>{cuentas.error}</Aviso>}

      <div className="bloque sin-relleno">
        {visibles.length > 0 ? (
          <div>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Registro</th>
                  <th>Tipo</th>
                  <th>Titular</th>
                  <th>Acceso</th>
                  <th className="centro">Empresas</th>
                  <th className="centro">Tope / día</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibles.map(c => {
                  const suspendida = c.estado === 'suspendida'
                  return (
                    <tr key={c.id} className={suspendida ? 'apagada' : undefined}>
                      <td>
                        <div className="principal">{fechaYHora(c.creadoEn)}</div>
                        <div className="secundario">{c.origen === 'alta' ? 'Con su empresa' : 'Se registró'}</div>
                      </td>
                      <td>
                        <span className={c.tipo === 'profesional' ? 'etiqueta aviso' : 'etiqueta acento'}>
                          {c.tipo === 'profesional' ? 'Profesional' : 'Negocio'}
                        </span>
                      </td>
                      <td>
                        <div className="principal">{nombreDeCuenta(c)}</div>
                        {c.titularDocumento && (
                          <div className="secundario mono" title={c.titularDocumento}>
                            {c.titularTipo === 'natural' ? 'DNI' : 'RUC'} {ocultar(c.titularDocumento)}
                          </div>
                        )}
                      </td>
                      <td>
                        {c.usuario ? (
                          <>
                            <div className="principal">@{c.usuario.alias}</div>
                            <div className="secundario">{c.usuario.correo}</div>
                          </>
                        ) : <span className="vacio">—</span>}
                      </td>
                      <td className="centro">{c.empresas}</td>
                      <td className="centro">{c.tope}</td>
                      <td>
                        <span className={suspendida ? 'estado malo' : c.estado === 'pendiente' ? 'estado aviso' : 'estado bueno'}>
                          {suspendida ? 'Suspendida' : c.estado === 'pendiente' ? 'Correo sin confirmar' : 'Activa'}
                        </span>
                        {suspendida && c.motivoSuspension && (
                          <div className="secundario">«{c.motivoSuspension}»</div>
                        )}
                      </td>
                      <td className="acciones">
                        <button type="button" className="boton plano" onClick={() => setCambiandoTope(c)}>
                          Cambiar tope
                        </button>
                        {suspendida ? (
                          <button type="button" className="boton secundario" onClick={() => void reactivar(c)}>
                            Reactivar
                          </button>
                        ) : (
                          <button type="button" className="boton peligro" onClick={() => setSuspendiendo(c)}>
                            Suspender
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="relleno">
            <Vacio>{filtro === 'todas' && !qC && !desdeC && !hastaC ? 'Todavía no hay cuentas.' : 'Ninguna cuenta con este filtro.'}</Vacio>
          </div>
        )}
      </div>
      <Paginacion {...paginacion} />

      {suspendiendo && (
        <DialogoSuspenderCuenta
          cuenta={suspendiendo}
          onCerrar={() => setSuspendiendo(undefined)}
          onHecho={() => { setSuspendiendo(undefined); void cuentas.recargar() }}
        />
      )}

      {cambiandoTope && (
        <DialogoTopeCuenta
          cuenta={cambiandoTope}
          onCerrar={() => setCambiandoTope(undefined)}
          onHecho={() => { setCambiandoTope(undefined); void cuentas.recargar() }}
        />
      )}
    </>
  )
}

/** 4•••••12: la pantalla se mira con gente alrededor. */
function ocultar(doc: string) {
  return doc.length <= 4 ? doc : doc[0] + '•'.repeat(doc.length - 3) + doc.slice(-2)
}