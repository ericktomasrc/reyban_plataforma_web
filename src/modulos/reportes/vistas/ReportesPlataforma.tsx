import { Link } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { fecha } from '../../../nucleo/formato/fechas'
import { Barras, Cifra, GraficoLinea, dinero } from '../componentes/Graficos'
import type {
  ReporteActivacion, ReporteCartera, ReporteConsumo, ReporteCuentas, ReporteEmpresasMes, ReportePlataforma,
  ReporteRechazos, ReporteRiesgo,
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
  // e148
  { ruta: '/admin/reportes/activacion', nombre: 'Avance de activación' },
  { ruta: '/admin/reportes/riesgo', nombre: 'Empresas en riesgo' },
  { ruta: '/admin/reportes/consumo', nombre: 'Consumo por cuenta y mes' },
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


// =============================================================================
// e148 — AVANCE DE ACTIVACIÓN: en qué paso se quedó cada cuenta.
// =============================================================================
const PASOS = ['', 'Se registró', 'Confirmó el correo', 'Agregó su empresa', 'Se conectó al servicio',
               'Emitió de prueba', 'Pasó a SUNAT real', 'Emite real']

/** Qué hacer para que avance (lo que se le dice al llamar). */
const SIGUIENTE = ['', 'Que confirme su correo (reenviar el enlace)', 'Que agregue su empresa (RUC)',
                   'Que suba su certificado y la clave SOL', 'Que emita su primer comprobante de prueba',
                   'Que pase a SUNAT real', 'Que emita su primer comprobante real', '']

export function ReporteActivacionPagina() {
  const r = useReporte<ReporteActivacion>('admin/activacion', true)
  return (
    <Marco titulo="Avance de activación" reporte="admin/activacion" r={r} conMoneda={false} horizontal
           busqueda={{ texto: 'Titular o correo', tipos: [['negocio', 'Negocio'], ['profesional', 'Profesional (contadores)']], etiquetaTipo: 'Cuenta' }}
           pie={<p className="nota pie-reporte">Las cuentas que se registraron en el periodo. «Días parada»: desde su último avance. Las que ya emiten real no cuentan como paradas.</p>}>
      {d => {
        const total = d.embudo[0]?.cuentas ?? 0
        const paradas = d.filas.filter(f => f.paso < 7 && (f.diasParada ?? 0) >= 7).length
        return (
          <>
            <div className="cifras-reporte">
              <Cifra titulo="Cuentas registradas" valor={total} />
              <Cifra titulo="Ya emiten real" valor={d.embudo[6]?.cuentas ?? 0}
                     nota={total ? `${Math.round(((d.embudo[6]?.cuentas ?? 0) / total) * 100)} % del total` : undefined} />
              <Cifra titulo="Paradas 7 días o más" valor={paradas} nota="para llamar" />
            </div>
            <div className="bloque">
              <h2 className="subtitulo">Hasta dónde llegaron</h2>
              <Barras cabeceras={['Paso', 'Cuentas']} formato={n => String(n)}
                      filas={d.embudo.map(e => ({ etiqueta: `${e.paso}. ${PASOS[e.paso]}`, valor: e.cuentas,
                                                  nota: total ? `${Math.round((e.cuentas / total) * 100)} %` : undefined }))} />
            </div>
            <div className="bloque sin-relleno">
              <table className="tabla">
                <thead><tr><th>Registro</th><th>Cuenta</th><th>Llegó hasta</th><th>Lo que falta</th>
                  <th className="derecha">Días parada</th></tr></thead>
                <tbody>
                  {d.filas.map((f, i) => (
                    <tr key={i}>
                      <td className="secundario">{fecha(f.fecha)}</td>
                      <td>{f.titular ?? '—'}<div className="secundario">{f.correo} · {f.tipo === 'profesional' ? 'Profesional' : 'Negocio'}
                        {f.empresas > 0 && ` · ${f.empresas} empresa(s)`}</div></td>
                      <td><span className={'etiqueta' + (f.paso === 7 ? ' acento' : '')}>{f.paso}. {PASOS[f.paso]}</span></td>
                      <td className="secundario">{SIGUIENTE[f.paso]}</td>
                      <td className={'derecha mono' + ((f.diasParada ?? 0) >= 7 ? ' texto-ojo' : '')}>{f.diasParada ?? ''}</td>
                    </tr>
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
// e148 — EMPRESAS EN RIESGO (hoy).
// =============================================================================
export function ReporteRiesgoPagina() {
  const r = useReporte<ReporteRiesgo>('admin/riesgo', false)
  return (
    <Marco titulo="Empresas en riesgo" reporte="admin/riesgo" r={r} conFechas={false} conMoneda={false} horizontal
           busqueda={{ texto: 'Empresa, RUC, titular o motivo', sunat: true }}
           pie={<p className="nota pie-reporte">
             Alto: en pausa, certificado vencido, comprobantes sin respuesta de SUNAT o con error, o 3 rechazos en 7 días.
             Medio: certificado por vencer (30 días), algún rechazo, o en SUNAT real sin emitir hace 15 días.
           </p>}>
      {d => d.filas.length === 0 ? (
        <Aviso tono="bien">Ninguna empresa en riesgo hoy.</Aviso>
      ) : (
        <>
          <div className="cifras-reporte">
            <Cifra titulo="Riesgo alto" valor={d.filas.filter(f => f.nivel === 'alto').length} />
            <Cifra titulo="Riesgo medio" valor={d.filas.filter(f => f.nivel === 'medio').length} />
            <Cifra titulo="En SUNAT real" valor={d.filas.filter(f => f.ambiente === 'real').length} nota="las que más importan" />
          </div>
          <div className="bloque sin-relleno">
            <table className="tabla">
              <thead><tr><th>Nivel</th><th>Empresa</th><th>Por qué</th><th>Titular</th><th>Último comprobante</th></tr></thead>
              <tbody>
                {d.filas.map(f => (
                  <tr key={f.id}>
                    <td><span className={'etiqueta' + (f.nivel === 'alto' ? ' peligro' : ' aviso')}>{f.nivel === 'alto' ? 'Alto' : 'Medio'}</span></td>
                    <td>{f.empresa}<div className="secundario">RUC {f.ruc} · {f.ambiente === 'real' ? 'SUNAT real' : 'prueba'}</div></td>
                    <td><ul className="lista-motivos">{f.motivos.map((m, i) => <li key={i}>{m}</li>)}</ul></td>
                    <td>{f.titular ?? '—'}<div className="secundario">{f.correo}</div></td>
                    <td className="secundario">{f.ultimo ? fecha(f.ultimo) : '—'}</td>
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
// e148 — CONSUMO POR CUENTA Y MES (para el plan y el cobro).
// =============================================================================
export function ReporteConsumoPagina() {
  const r = useReporte<ReporteConsumo>('admin/consumo', true)
  return (
    <Marco titulo="Consumo por cuenta y mes" reporte="admin/consumo" r={r} conMoneda={false} horizontal
           busqueda={{ texto: 'Titular o correo', tipos: [['negocio', 'Negocio'], ['profesional', 'Profesional (contadores)']], etiquetaTipo: 'Cuenta' }}
           pie={<p className="nota pie-reporte">Cuentan los comprobantes enviados a SUNAT (en camino, aceptados o anulados después). WhatsApp: los marcados como enviados.</p>}>
      {d => {
        const suma = (k: 'reales' | 'prueba' | 'whatsapp') => d.filas.reduce((s, f) => s + f[k], 0)
        const porCuenta = new Map<string, number>()
        for (const f of d.filas) porCuenta.set(f.titular ?? '—', (porCuenta.get(f.titular ?? '—') ?? 0) + f.reales)
        return (
          <>
            <div className="cifras-reporte">
              <Cifra titulo="Comprobantes reales" valor={suma('reales')} />
              <Cifra titulo="De prueba" valor={suma('prueba')} />
              <Cifra titulo="WhatsApp enviados" valor={suma('whatsapp')} />
              <Cifra titulo="Cuentas con movimiento" valor={porCuenta.size} />
            </div>
            <div className="bloque">
              <h2 className="subtitulo">Las 10 que más emiten (reales)</h2>
              <Barras cabeceras={['Cuenta', 'Reales']} formato={n => String(n)}
                      filas={[...porCuenta].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([etiqueta, valor]) => ({ etiqueta, valor }))} />
            </div>
            <div className="bloque sin-relleno">
              <table className="tabla">
                <thead><tr><th>Mes</th><th>Cuenta</th><th className="derecha">Empresas</th><th className="derecha">Reales</th>
                  <th className="derecha">Prueba</th><th className="derecha">Notas</th><th className="derecha">Rechazados</th>
                  <th className="derecha">WhatsApp</th></tr></thead>
                <tbody>
                  {d.filas.map((f, i) => (
                    <tr key={i}>
                      <td className="mono secundario">{f.mes}</td>
                      <td>{f.titular ?? '—'}<div className="secundario">{f.correo} · {f.tipo === 'profesional' ? 'Profesional' : 'Negocio'}</div></td>
                      <td className="derecha mono" title="con movimiento / de la cuenta">{f.empresas} / {f.empresasCuenta}</td>
                      <td className="derecha mono">{f.reales}</td><td className="derecha mono secundario">{f.prueba}</td>
                      <td className="derecha mono">{f.notas}</td>
                      <td className={'derecha mono' + (f.rechazados > 0 ? ' texto-ojo' : '')}>{f.rechazados}</td>
                      <td className="derecha mono">{f.whatsapp}</td>
                    </tr>
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