import { Link } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { fecha } from '../../../nucleo/formato/fechas'
import { Barras, Cifra, GraficoLinea, dinero } from '../componentes/Graficos'
import type {
  ReporteCartera, ReporteCuentas, ReporteEmpresasMes, ReportePlataforma, ReporteRechazos,
} from '../servicios/reportesServicio'
import { Marco, useReporte } from './Reportes'

/**
 * 036 — REPORTES, entrega 3: «Mi cartera» (contador) y «Plataforma» (super).
 * Solo lectura. Montos en soles. La empresa de control no cuenta.
 */

/** Los de la cartera y los de la plataforma, para el menú. */
export const REPORTES_CARTERA = [
  { ruta: '/mi-cartera/reportes', nombre: 'Mis empresas del mes' },
  { ruta: '/mi-cartera/certificados', nombre: 'Certificados por vencer' },
]

export const REPORTES_PLATAFORMA = [
  { ruta: '/admin/reportes/plataforma', nombre: 'Tablero de la plataforma' },
  { ruta: '/admin/reportes/empresas', nombre: 'Comprobantes por empresa' },
  { ruta: '/admin/reportes/rechazos', nombre: 'Rechazos SUNAT por código' },
  { ruta: '/admin/reportes/cuentas', nombre: 'Cuentas nuevas' },
]

function diasPara(f: string | null) {
  if (!f) return null
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
  return Math.round((Date.parse(f.slice(0, 10)) - Date.parse(hoy)) / 86_400_000)
}

function chipCertificado(f: string | null) {
  const d = diasPara(f)
  if (d === null) return <span className="etiqueta">sin certificado</span>
  if (d < 0) return <span className="etiqueta aviso">venció hace {-d} día(s)</span>
  if (d <= 30) return <span className="etiqueta aviso">vence en {d} día(s)</span>
  return <span className="etiqueta">vence el {fecha(f)}</span>
}

const pieSoles = <p className="nota pie-reporte">Montos en soles. Cuentan los comprobantes en camino o aceptados; las notas de crédito restan.</p>


// =============================================================================
export function ReporteCarteraPagina() {
  const r = useReporte<ReporteCartera>('cartera', true)
  return (
    <Marco titulo="Mis empresas del mes" reporte="cartera" r={r} conMoneda={false} horizontal busqueda={{ texto: 'Nombre o RUC de la empresa', sunat: true }} pie={pieSoles}>
      {d => {
        const total = d.filas.reduce((s, f) => s + f.total, 0)
        const comprobantes = d.filas.reduce((s, f) => s + f.comprobantes, 0)
        const conProblema = d.filas.filter(f => f.rechazados > 0 || f.pendientes > 0).length
        return (
          <>
            <div className="cifras-reporte">
              <Cifra titulo="Empresas" valor={d.filas.length} nota={`${d.filas.filter(f => f.ambiente === 'produccion').length} en SUNAT real`} />
              <Cifra titulo="Comprobantes" valor={comprobantes} />
              <Cifra titulo="Vendido (todas)" valor={`S/ ${dinero(total)}`} />
              <Cifra titulo="Con algo que revisar" valor={conProblema} nota="rechazados o sin respuesta" />
            </div>
            <div className="bloque">
              <h2 className="subtitulo">Lo vendido por empresa (S/)</h2>
              <Barras cabeceras={['Empresa', 'Vendido (S/)']}
                      filas={d.filas.map(f => ({ etiqueta: f.nombre, valor: f.total, nota: `${f.comprobantes} comp.` }))} />
            </div>
            <div className="bloque sin-relleno tabla-ancha">
              <table className="tabla">
                <thead><tr><th>Empresa</th><th>SUNAT</th><th className="derecha">Comprobantes</th><th className="derecha">Vendido</th>
                  <th className="derecha">Rechazados</th><th className="derecha">Sin respuesta</th><th>Certificado</th></tr></thead>
                <tbody>
                  {d.filas.map(f => (
                    <tr key={f.id}>
                      <td>{f.nombre}<div className="secundario mono">{f.ruc}</div>{f.pausada && <span className="etiqueta aviso">en pausa</span>}</td>
                      <td>{f.ambiente === 'produccion' ? 'Real' : 'Prueba'}</td>
                      <td className="derecha mono">{f.comprobantes}{f.notas > 0 && <div className="secundario">{f.notas} nota(s)</div>}</td>
                      <td className="derecha mono">{dinero(f.total)}</td>
                      <td className="derecha mono">{f.rechazados || ''}</td>
                      <td className="derecha mono">{f.pendientes || ''}</td>
                      <td>{chipCertificado(f.certificadoHasta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="nota">Para trabajar en una, ábrela desde <Link to="/empresas">Mis empresas</Link>.</p>
          </>
        )
      }}
    </Marco>
  )
}


// =============================================================================
export function ReporteCertificadosPagina() {
  const r = useReporte<ReporteCartera>('cartera', false)
  return (
    <Marco titulo="Certificados por vencer" reporte="cartera" r={r} conFechas={false} conMoneda={false} busqueda={{ texto: 'Nombre o RUC de la empresa' }}
           pie={<p className="nota pie-reporte">El certificado digital firma los comprobantes: vencido, SUNAT los rechaza. Renuévalo antes y súbelo en la configuración de la empresa.</p>}>
      {d => {
        const filas = [...d.filas].sort((a, b) => (diasPara(a.certificadoHasta) ?? 99999) - (diasPara(b.certificadoHasta) ?? 99999))
        const pronto = filas.filter(f => (diasPara(f.certificadoHasta) ?? 99999) <= 60)
        return (
          <>
            {pronto.length === 0
              ? <Aviso tono="bien">Ningún certificado vence en los próximos 60 días.</Aviso>
              : <Aviso tono="ojo">{pronto.length} empresa(s) con el certificado vencido o por vencer en 60 días.</Aviso>}
            <div className="bloque sin-relleno">
              <table className="tabla">
                <thead><tr><th>Empresa</th><th>RUC</th><th>Certificado</th></tr></thead>
                <tbody>
                  {filas.map(f => (
                    <tr key={f.id}><td>{f.nombre}</td><td className="mono secundario">{f.ruc}</td><td>{chipCertificado(f.certificadoHasta)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      }}
    </Marco>
  )
}


// =============================================================================
export function ReportePlataformaPagina() {
  const r = useReporte<ReportePlataforma>('admin/plataforma', true)
  return (
    <Marco titulo="Tablero de la plataforma" reporte="admin/plataforma" r={r} conMoneda={false}
           pie={<p className="nota pie-reporte">Sin la empresa de control de la madrugada. «De prueba» = emitidos en SUNAT beta.</p>}>
      {d => (
        <>
          <div className="cifras-reporte">
            <Cifra titulo="Empresas" valor={d.empresas} nota={`${d.empresasReal} en SUNAT real`} />
            <Cifra titulo="Cuentas" valor={d.cuentas} nota={`${d.cuentasNuevas} nuevas en el periodo`} />
            <Cifra titulo="Comprobantes reales" valor={d.reales} nota={`${d.prueba} de prueba`} />
            <Cifra titulo="Rechazados" valor={d.rechazados} />
          </div>
          <div className="dos-reporte">
            <div className="bloque">
              <h2 className="subtitulo">Comprobantes reales por día</h2>
              <GraficoLinea etiquetaValor="Comprobantes reales"
                            puntos={d.porDia.map(p => ({ etiqueta: fecha(p.fecha).slice(0, 5), valor: p.reales }))} />
            </div>
            <div className="bloque">
              <h2 className="subtitulo">Las 10 empresas que más emiten</h2>
              <Barras cabeceras={['Empresa', 'Comprobantes']} formato={n => String(n)}
                      filas={d.topEmpresas.map(e => ({ etiqueta: e.empresa, valor: e.comprobantes }))} />
            </div>
          </div>
        </>
      )}
    </Marco>
  )
}


// =============================================================================
export function ReporteEmpresasPagina() {
  const r = useReporte<ReporteEmpresasMes>('admin/empresas', true)
  return (
    <Marco titulo="Comprobantes por empresa y mes" reporte="admin/empresas" r={r} conMoneda={false} horizontal busqueda={{ texto: 'Nombre o RUC de la empresa', sunat: true }} pie={null}>
      {d => (
        <div className="bloque sin-relleno tabla-ancha">
          <table className="tabla">
            <thead><tr><th>Mes</th><th>Empresa</th><th>SUNAT</th><th className="derecha">Facturas</th><th className="derecha">Boletas</th>
              <th className="derecha">Notas</th><th className="derecha">Rechazados</th><th className="derecha">Total (S/)</th></tr></thead>
            <tbody>
              {d.filas.length === 0 && <tr><td colSpan={8} className="vacio">Sin comprobantes en este periodo.</td></tr>}
              {d.filas.map((f, i) => (
                <tr key={i}>
                  <td className="mono">{f.mes}</td><td>{f.empresa}<div className="secundario mono">{f.ruc}</div></td>
                  <td>{f.ambiente === 'real' ? 'Real' : 'Prueba'}</td>
                  <td className="derecha mono">{f.facturas}</td><td className="derecha mono">{f.boletas}</td>
                  <td className="derecha mono">{f.notas}</td><td className="derecha mono">{f.rechazados || ''}</td>
                  <td className="derecha mono">{dinero(f.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Marco>
  )
}


// =============================================================================
export function ReporteRechazosPagina() {
  const r = useReporte<ReporteRechazos>('admin/rechazos', true)
  return (
    <Marco titulo="Rechazos SUNAT por código" reporte="admin/rechazos" r={r} conMoneda={false} busqueda={{ texto: 'Código o mensaje de SUNAT' }}
           pie={<p className="nota pie-reporte">Para ver qué falla más y corregirlo en el servicio o explicarlo en la guía. El detalle de cada código está en Vigilancia SUNAT.</p>}>
      {d => d.filas.length === 0 ? <Aviso tono="bien">Ningún rechazo en este periodo.</Aviso> : (
        <>
          <div className="bloque">
            <Barras cabeceras={['Código', 'Rechazos']} formato={n => String(n)}
                    filas={d.filas.map(f => ({ etiqueta: f.codigo, valor: f.cantidad, nota: `${f.empresas} empresa(s)` }))} />
          </div>
          <div className="bloque sin-relleno">
            <table className="tabla">
              <thead><tr><th>Código</th><th className="derecha">Rechazos</th><th className="derecha">Empresas</th><th>Último</th><th>Mensaje</th></tr></thead>
              <tbody>
                {d.filas.map(f => (
                  <tr key={f.codigo}>
                    <td className="mono">{f.codigo}</td><td className="derecha mono">{f.cantidad}</td>
                    <td className="derecha mono">{f.empresas}</td><td className="secundario">{fecha(f.ultimo)}</td>
                    <td className="secundario">{f.mensaje}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Marco>
  )
}


// =============================================================================
export function ReporteCuentasPagina() {
  const r = useReporte<ReporteCuentas>('admin/cuentas', true)
  return (
    <Marco titulo="Cuentas nuevas" reporte="admin/cuentas" r={r} conMoneda={false} busqueda={{ texto: 'Titular o correo', tipos: [['negocio', 'Negocio'], ['profesional', 'Profesional (contadores)']], etiquetaTipo: 'Cuenta' }}
           pie={<p className="nota pie-reporte">Las consultas de RUC, DNI y tipo de cambio del mes están en tu Inicio (contador de Decolecta).</p>}>
      {d => (
        <>
          <div className="cifras-reporte">
            <Cifra titulo="Cuentas nuevas" valor={d.filas.length} />
            <Cifra titulo="Negocio" valor={d.filas.filter(f => f.tipo === 'negocio').length} />
            <Cifra titulo="Profesional (contadores)" valor={d.filas.filter(f => f.tipo === 'profesional').length} />
          </div>
          <div className="bloque">
            <h2 className="subtitulo">Por día</h2>
            <GraficoLinea etiquetaValor="Cuentas nuevas"
                          puntos={d.porDia.map(p => ({ etiqueta: fecha(p.fecha).slice(0, 5), valor: p.negocio + p.profesional }))} />
          </div>
          <div className="bloque sin-relleno">
            <table className="tabla">
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Titular</th><th className="derecha">Empresas</th></tr></thead>
              <tbody>
                {d.filas.map((f, i) => (
                  <tr key={i}>
                    <td className="secundario">{fecha(f.fecha)}</td>
                    <td>{f.tipo === 'profesional' ? 'Profesional' : 'Negocio'}</td>
                    <td>{f.titular}<div className="secundario">{f.correo}</div></td>
                    <td className="derecha mono">{f.empresas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Marco>
  )
}