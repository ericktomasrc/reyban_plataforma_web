import { useCallback, useEffect, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fechaYHora } from '../../../nucleo/formato/fechas'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { refrescarConexionSunat, useConexionSunat } from '../../../nucleo/sunat/conexionSunat'
import { conexionServicio } from '../servicios/conexionServicio'
import type { EmpresaConexion, ResultadoEmpresa } from '../servicios/conexionServicio'

/**
 * CONEXIÓN CON SUNAT (18 oct; modo-prueba-y-real.md). Solo el super
 * administrador y solo en QA.
 *
 *   SUNAT beta (pruebas)   todas las empresas emiten contra beta; nada vale.
 *   SUNAT real             solo las que se marcan al cambiar; lo emitido vale.
 *
 * En producción (PLATAFORMA_SUNAT=real) no hay interruptor: queda fija en real
 * y cada empresa pasa a real al terminar su asistente.
 */
export function ConexionSunatPagina() {
  const mensaje = useMensaje()
  const conexion = useConexionSunat()
  const [empresas, setEmpresas] = useState<EmpresaConexion[] | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [dialogo, setDialogo] = useState<'real' | 'beta' | null>(null)
  const [marcadas, setMarcadas] = useState<string[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [resultados, setResultados] = useState<ResultadoEmpresa[] | null>(null)

  const cargar = useCallback(async () => {
    try {
      setEmpresas(await conexionServicio.empresas())
      setFallo(null)
    } catch (e) {
      setFallo(e instanceof ErrorApi ? e.message : 'No se pudo preguntar al servicio.')
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  const cambiar = async (modo: 'beta' | 'real') => {
    setOcupado(true)
    try {
      const r = await conexionServicio.cambiar(modo, modo === 'real' ? marcadas : [])
      setResultados(r.resultados.filter(x => !x.ok).length > 0 ? r.resultados : null)
      mensaje.bien(r.mensaje)
      setDialogo(null)
      setMarcadas([])
      await refrescarConexionSunat()
      await cargar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo cambiar la conexión con SUNAT.')
    } finally {
      setOcupado(false)
    }
  }

  if (!conexion) return <Cargando />

  const nombre = (id: string) => empresas?.find(e => e.id === id)?.nombre ?? id
  const real = conexion.modo === 'real'

  return (
    <>
      <div className="encabezado-pagina">
        <h1 className="titulo-pagina">Conexión con SUNAT</h1>
      </div>
      <p className="texto-paso">A qué SUNAT se mandan los comprobantes de esta instalación.</p>

      {conexion.fija ? (
        <Aviso tono="bien">
          <strong>Producción: siempre SUNAT real.</strong> Esta pantalla solo cambia algo en QA.
          Cada empresa pasa a real al terminar su configuración (paso 6), con su certificado real y su usuario SOL.
        </Aviso>
      ) : (
        <>
          <div className="interruptor-sunat" role="group" aria-label="Conexión con SUNAT">
            <button type="button" className={!real ? 'activo beta' : ''} disabled={!real || ocupado}
                    onClick={() => setDialogo('beta')}>
              {!real ? '● ' : ''}SUNAT beta (pruebas)
            </button>
            <button type="button" className={real ? 'activo real' : ''} disabled={real || ocupado}
                    onClick={() => { setMarcadas([]); setDialogo('real') }}>
              {real ? '● ' : ''}SUNAT real
            </button>
          </div>
          <p className="pista-sunat">
            Ahora: <strong>{real ? 'SUNAT real' : 'modo prueba'}</strong>
            {conexion.cambiadoEn && <> desde el {fechaYHora(conexion.cambiadoEn)}</>}
            {conexion.cambiadoPor && <> · por {conexion.cambiadoPor}</>}
          </p>

          {real ? (
            <Aviso tono="ojo">
              <strong>SUNAT real.</strong> Solo emiten las empresas marcadas, y lo que emiten <strong>vale ante SUNAT</strong>.
              Prueba con montos de S/ 1.00 y anula cada prueba el mismo día. Para agregar otra empresa, vuelve a modo
              prueba y pasa otra vez a real marcándola.
            </Aviso>
          ) : (
            <Aviso tono="ojo">
              <strong>Modo prueba.</strong> Todas las empresas emiten contra SUNAT beta. Nada tiene valor legal; los
              números de prueba van aparte y nunca se mezclan con los reales.
            </Aviso>
          )}
        </>
      )}

      {resultados && (
        <Aviso>
          No todas las empresas cambiaron:
          <ul>
            {resultados.filter(r => !r.ok).map(r => (
              <li key={r.empresaId}><strong>{nombre(r.empresaId)}</strong>: {r.error}{r.detalle ? ` ${r.detalle}` : ''}</li>
            ))}
          </ul>
        </Aviso>
      )}

      <h2 className="subtitulo">Empresas con facturación</h2>
      {fallo && <Aviso>{fallo}</Aviso>}
      {!empresas && !fallo && <Cargando texto="Preguntando al servicio…" />}
      {empresas && (
        <table className="tabla">
          <thead>
            <tr><th>Empresa</th><th>Emite en</th><th>¿Lista para SUNAT real?</th></tr>
          </thead>
          <tbody>
            {empresas.map(e => (
              <tr key={e.id}>
                <td>
                  <div className="principal">{e.nombre}</div>
                  <div className="secundario mono">{e.ruc ?? 'sin RUC'}</div>
                </td>
                <td>
                  {e.ambiente === 'produccion'
                    ? <span className="estado bueno">SUNAT real</span>
                    : <span className="etiqueta aviso">prueba</span>}
                </td>
                <td>
                  {e.puedeProduccion
                    ? <span className="estado bueno">✓ Lista</span>
                    : <div className="secundario">{e.faltantes.join(' ') || '—'}</div>}
                  {e.advertencias.length > 0 && <div className="secundario">{e.advertencias.join(' ')}</div>}
                </td>
              </tr>
            ))}
            {empresas.length === 0 && (
              <tr><td colSpan={3} className="secundario">Ninguna empresa tiene facturación configurada todavía.</td></tr>
            )}
          </tbody>
        </table>
      )}

      <Dialogo titulo="¿Pasar QA a SUNAT real?" abierto={dialogo === 'real'} onCerrar={() => setDialogo(null)}
               acciones={<>
                 <Boton estilo="secundario" onClick={() => setDialogo(null)} disabled={ocupado}>Cancelar</Boton>
                 <Boton onClick={() => void cambiar('real')} ocupado={ocupado} textoOcupado="Cambiando…"
                        disabled={marcadas.length === 0}>Sí, pasar a SUNAT real</Boton>
               </>}>
        <p>Desde ahora, lo que emitan las empresas que marques <strong>vale ante SUNAT</strong> (genera IGV si no se anula).</p>
        <p className="pista-sunat">Marca las que van a emitir en real en esta prueba. Las demás siguen viendo todo, pero no emiten mientras QA esté en real.</p>
        <ul className="lista-marcar">
          {(empresas ?? []).map(e => (
            <li key={e.id}>
              <label className={e.puedeProduccion ? '' : 'apagada'}>
                <input type="checkbox" disabled={!e.puedeProduccion} checked={marcadas.includes(e.id)}
                       onChange={ev => setMarcadas(m => ev.target.checked ? [...m, e.id] : m.filter(x => x !== e.id))} />
                <strong>{e.nombre}</strong>
                {e.puedeProduccion
                  ? <span className="secundario"> — lista</span>
                  : <span className="secundario"> — {e.faltantes.join(' ')}</span>}
              </label>
            </li>
          ))}
        </ul>
        <Aviso tono="ojo">
          Prueba con montos de S/ 1.00 y anula cada prueba el mismo día. Las series reales de cada empresa empiezan
          en 0; si ya emitía con ellas en otro sistema, ajústalas antes de emitir.
        </Aviso>
      </Dialogo>

      <Dialogo titulo="¿Volver a modo prueba?" abierto={dialogo === 'beta'} onCerrar={() => setDialogo(null)}
               acciones={<>
                 <Boton estilo="secundario" onClick={() => setDialogo(null)} disabled={ocupado}>Cancelar</Boton>
                 <Boton onClick={() => void cambiar('beta')} ocupado={ocupado} textoOcupado="Cambiando…">Sí, volver a SUNAT beta</Boton>
               </>}>
        <p>Todas las empresas vuelven a emitir contra SUNAT beta (pruebas).</p>
        <Aviso tono="ojo">
          Lo que se emitió en real <strong>sigue siendo real</strong> ante SUNAT. Si fue una prueba, anúlalo
          (Comunicar baja o Anular) desde el comprobante.
        </Aviso>
      </Dialogo>
    </>
  )
}