import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { productosServicio } from '../servicios/facturacionServicio'
import type { RevisionImportacion } from '../servicios/facturacionServicio'

const RESULTADO: Record<string, { texto: string; clase: string }> = {
  nuevo: { texto: 'Nuevo', clase: 'texto-bien' },
  actualiza: { texto: 'Se actualiza', clase: '' },
  igual: { texto: 'Igual', clase: 'secundario' },
  existe: { texto: 'Ya existe', clase: 'secundario' },
  error: { texto: 'Error', clase: 'texto-mal' },
}

/**
 * 22 OCT — PRODUCTOS › IMPORTAR DESDE EXCEL (maqueta aprobada el 22 oct 2026).
 *
 *   1. Bajar la plantilla (trae los productos que ya tienes: sirve también
 *      para cambiar precios de golpe).
 *   2. Subirla llena.
 *   3. Revisar fila por fila y, si está bien, importar. Las filas con error no
 *      entran; nada se borra.
 */
export function ImportarProductos() {
  const navegar = useNavigate()
  const mensaje = useMensaje()
  const elegir = useRef<HTMLInputElement>(null)

  const [archivo, setArchivo] = useState<File>()
  const [actualizar, setActualizar] = useState(true)
  const [revision, setRevision] = useState<RevisionImportacion>()
  const [soloErrores, setSoloErrores] = useState(false)
  const [ocupado, setOcupado] = useState<'plantilla' | 'revisar' | 'importar' | null>(null)
  const [fallo, setFallo] = useState<string>()

  async function plantilla() {
    setOcupado('plantilla')
    try { await productosServicio.plantilla() }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo bajar la plantilla.') }
    finally { setOcupado(null) }
  }

  async function revisar(a: File, act: boolean) {
    setOcupado('revisar'); setFallo(undefined); setRevision(undefined)
    try { setRevision(await productosServicio.importar(a, true, act)) }
    catch (e) { setFallo(e instanceof ErrorApi ? e.message : 'No se pudo leer el archivo.') }
    finally { setOcupado(null) }
  }

  async function importar() {
    if (!archivo) return
    setOcupado('importar'); setFallo(undefined)
    try {
      const r = await productosServicio.importar(archivo, false, actualizar)
      mensaje.bien(r.mensaje ?? 'Importado.')
      navegar('/facturacion/productos')
    } catch (e) {
      setFallo(e instanceof ErrorApi ? e.message : 'No se pudo importar.')
    } finally {
      setOcupado(null)
    }
  }

  /** Las filas con error, en un .csv para corregirlas y volver a subirlas. */
  function bajarErrores() {
    if (!revision) return
    const celda = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const filas = revision.filas.filter(f => f.resultado === 'error')
    const csv = '﻿' + [
      ['Fila', 'Código', 'Descripción', 'Unidad', 'Precio', 'Incluye IGV', 'Afectación', 'Código SUNAT', 'Error'],
      ...filas.map(f => [f.fila, f.codigo, f.descripcion, f.unidad, f.precio ?? '', f.incluyeIgv ? 'SI' : 'NO',
                         f.afectacion, f.codigoSunat ?? '', f.mensaje ?? '']),
    ].map(l => l.map(celda).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'productos-con-error.csv'
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const visibles = revision ? revision.filas.filter(f => !soloErrores || f.resultado === 'error') : []
  const aImportar = revision ? revision.nuevos + revision.actualizan : 0

  return (
    <>
      <div className="encabezado-pagina">
        <h1 className="titulo-pagina">Productos › Importar desde Excel</h1>
        <Boton estilo="secundario" onClick={() => navegar('/facturacion/productos')}>Volver a productos</Boton>
      </div>

      <div className="bloque importar-pasos">
        <div>
          <h2 className="subtitulo">1. Baja la plantilla</h2>
          <p className="secundario">
            Columnas: código, descripción, unidad, precio, ¿incluye IGV?, afectación y código SUNAT (opcional).
            Trae los productos que ya tienes —sirve para cambiar precios de golpe— y una hoja de ayuda con los valores válidos.
          </p>
          <Boton estilo="secundario" onClick={() => void plantilla()} ocupado={ocupado === 'plantilla'} textoOcupado="Bajando…">
            Bajar plantilla .xlsx
          </Boton>
        </div>
        <div>
          <h2 className="subtitulo">2. Súbela llena</h2>
          <button type="button" className="zona-archivo" onClick={() => elegir.current?.click()} disabled={ocupado !== null}>
            {archivo ? (
              <>
                <strong>{archivo.name}</strong>
                <span>{revision ? `${revision.total} filas leídas` : ocupado === 'revisar' ? 'Leyendo…' : ''} · cambiar archivo</span>
              </>
            ) : (
              <>
                <strong>Elegir el archivo</strong>
                <span>.xlsx (o .csv), hasta 5 000 productos</span>
              </>
            )}
          </button>
          <input ref={elegir} type="file" hidden accept=".xlsx,.csv"
                 onChange={e => {
                   const a = e.target.files?.[0]
                   e.target.value = ''
                   if (!a) return
                   setArchivo(a)
                   void revisar(a, actualizar)
                 }} />
          <label className="casilla-wsp">
            <input type="checkbox" checked={actualizar}
                   onChange={e => { setActualizar(e.target.checked); if (archivo) void revisar(archivo, e.target.checked) }} />
            Si el código ya existe, actualizar su precio y sus datos
          </label>
        </div>
      </div>

      {fallo && <Aviso>{fallo}</Aviso>}

      {revision && (
        <div className="bloque">
          <h2 className="subtitulo">3. Revisa antes de importar</h2>

          <div className="cifras-nota">
            <div><span>Nuevos</span><strong className="mono">{revision.nuevos}</strong></div>
            <div><span>Se actualizan</span><strong className="mono">{revision.actualizan}</strong></div>
            <div><span>Con error (no entran)</span><strong className="mono">{revision.errores}</strong></div>
            <div><span>Igual o sin tocar</span><strong className="mono">{revision.iguales}</strong></div>
          </div>

          <div className="acciones-linea">
            <Boton estilo={soloErrores ? 'secundario' : 'principal'} onClick={() => setSoloErrores(false)}>
              Todas ({revision.total})
            </Boton>
            <Boton estilo={soloErrores ? 'principal' : 'secundario'} onClick={() => setSoloErrores(true)}
                   disabled={revision.errores === 0}>
              Solo errores ({revision.errores})
            </Boton>
          </div>

          <div className="tabla-desliza">
            <table className="tabla">
              <thead>
                <tr><th>Fila</th><th>Código</th><th>Descripción</th><th>Unidad</th>
                  <th className="derecha">Precio</th><th>Resultado</th></tr>
              </thead>
              <tbody>
                {visibles.slice(0, 500).map(f => (
                  <tr key={f.fila} className={f.resultado === 'error' ? 'fila-mal' : undefined}>
                    <td className="mono">{f.fila}</td>
                    <td className="mono">{f.codigo}</td>
                    <td>{f.descripcion}</td>
                    <td className="mono">{f.unidad}</td>
                    <td className="derecha mono">{f.precio != null ? f.precio.toFixed(2) : ''}</td>
                    <td>
                      <span className={RESULTADO[f.resultado]?.clase}>{RESULTADO[f.resultado]?.texto ?? f.resultado}</span>
                      {f.mensaje && <div className="secundario">{f.mensaje}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibles.length > 500 && <p className="nota">Se muestran las primeras 500 de {visibles.length}.</p>}

          <div className="acciones-linea">
            <Boton onClick={() => void importar()} disabled={aImportar === 0 || ocupado !== null}
                   ocupado={ocupado === 'importar'} textoOcupado="Importando…">
              {aImportar === 0 ? 'Nada que importar' : `Importar ${aImportar} producto${aImportar === 1 ? '' : 's'}`}
            </Boton>
            {revision.errores > 0 && (
              <Boton estilo="plano" onClick={bajarErrores}>
                Bajar las {revision.errores} filas con error para corregirlas
              </Boton>
            )}
          </div>
          <p className="nota">
            Las filas con error no entran; el resto sí. Nada se borra: un producto que no está en el Excel queda como estaba.
          </p>
        </div>
      )}
    </>
  )
}