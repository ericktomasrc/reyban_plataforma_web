import type { CuentaEnLista, EmpresaSituacion } from '../servicios/cuentasServicio'
import { diasHasta } from '../../cartera/servicios/carteraServicio'

/**
 * e291 — CÓMO ESTÁ CADA CUENTA, EN UNA FRASE (Cuentas del super admin).
 *
 *   · estado:  lo principal (todo normal, con candado, configuración a medias…).
 *   · señales: avisos que no cambian el estado (pago, certificado, sin emitir).
 *   · grupos:  a qué tarjetas de la franja de arriba pertenece.
 *
 * Los datos vienen de la base (101); aquí solo se decide cómo decirlo.
 */
export type Tono = 'bien' | 'aviso' | 'malo' | 'gris'
export type Grupo = 'normal' | 'medias' | 'candado' | 'pago' | 'certificado' | 'sinEmitir' | 'sinEmpresas'
export interface Senal { texto: string; tono: Tono }
export interface EstadoCuenta { texto: string; detalle?: string; tono: Tono; senales: Senal[]; grupos: Set<Grupo> }

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
const fechaCorta = (f: string) => new Date(f).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })

/** De una empresa: lo mismo que dice Mi cartera. */
export function estadoEmpresa(e?: EmpresaSituacion): { texto: string; tono: Tono } {
  if (!e) return { texto: '—', tono: 'gris' }
  if (e.pausadaEn) return { texto: 'En pausa', tono: 'gris' }
  if (!e.facturacionActiva) return { texto: 'Configuración a medias' + (e.faltan?.length ? `: falta ${e.faltan.join(', ').toLowerCase()}` : ''), tono: 'aviso' }
  if (e.certificadoHasta) {
    const d = diasHasta(e.certificadoHasta)
    if (d < 0) return { texto: 'Certificado vencido', tono: 'malo' }
    if (d <= 30) return { texto: `Certificado vence en ${plural(d, 'día', 'días')}`, tono: 'aviso' }
  }
  if (e.rechazos > 0) return { texto: plural(e.rechazos, 'rechazo de SUNAT', 'rechazos de SUNAT'), tono: 'malo' }
  return { texto: 'Lista para emitir', tono: 'bien' }
}

export function estadoCuenta(c: CuentaEnLista): EstadoCuenta {
  const s = c.situacion
  const grupos = new Set<Grupo>()
  const senales: Senal[] = []
  const activas = (s?.empresas ?? []).filter(e => !e.pausadaEn)
  const propia = activas.find(e => e.esDelEstudio)
  const clientes = activas.filter(e => !e.esDelEstudio)

  // --- SEÑALES -----------------------------------------------------------
  if (s?.encendidos) {
    const dGratis = s.pruebaHasta ? diasHasta(s.pruebaHasta) : -1
    if (s.accesoTotal) senales.push({ texto: 'Acceso total', tono: 'gris' })
    else if (s.pago === 'no_emite') { senales.push({ texto: 'Pago vencido', tono: 'malo' }); grupos.add('pago') }
    else if (s.pago === 'gracia') { senales.push({ texto: 'Pago en gracia', tono: 'aviso' }); grupos.add('pago') }
    else if (s.pago === 'reintento') { senales.push({ texto: 'Reintentando el cobro', tono: 'aviso' }); grupos.add('pago') }
    else if (s.pago === 'cancelado') senales.push({ texto: 'Canceló', tono: 'gris' })
    else if (dGratis >= 0) senales.push({ texto: `Mes gratis: ${plural(dGratis, 'día', 'días')}`, tono: 'gris' })
    else if (s.pago === 'al_dia') senales.push({ texto: 'Al día', tono: 'bien' })
  }

  const conCert = (lista: EmpresaSituacion[]) => lista.filter(e => e.certificadoHasta && diasHasta(e.certificadoHasta) <= 30)
  const certPropia = propia && conCert([propia]).length > 0 ? propia : null
  const certOtras = conCert(c.tipo === 'profesional' ? clientes : activas)
  if (certPropia) {
    const d = diasHasta(certPropia.certificadoHasta!)
    senales.push({ texto: d < 0 ? 'Mi empresa: certificado vencido' : `Mi empresa: certificado vence en ${plural(d, 'día', 'días')}`, tono: d < 0 ? 'malo' : 'aviso' })
  }
  if (certOtras.length > 0) {
    const vencidos = certOtras.filter(e => diasHasta(e.certificadoHasta!) < 0).length
    if (c.tipo === 'profesional') {
      senales.push(vencidos > 0
        ? { texto: `Certificado vencido: ${plural(vencidos, 'cliente', 'clientes')}`, tono: 'malo' }
        : { texto: `Certificado: ${certOtras.length} vence${certOtras.length === 1 ? '' : 'n'} en 30 días o menos`, tono: 'aviso' })
    } else if (vencidos === 0) {
      const d = diasHasta(certOtras[0].certificadoHasta!)
      senales.push({ texto: `Certificado vence en ${plural(d, 'día', 'días')}`, tono: 'aviso' })
    }
  }
  if (certPropia || certOtras.length > 0) grupos.add('certificado')

  if (c.tipo === 'profesional') {
    const medias = clientes.filter(e => !e.facturacionActiva).length
    if (medias > 0) { senales.push({ texto: `${plural(medias, 'cliente', 'clientes')} a medias`, tono: 'aviso' }); grupos.add('medias') }
  }

  if (activas.length > 0) {
    const ultimo = activas.map(e => e.ultimoDocumento).filter(Boolean).sort().pop() ?? null
    const dias = ultimo ? -diasHasta(ultimo) : null
    const desdeAlta = -diasHasta(c.creadoEn)
    if (dias === null && desdeAlta >= 30) { senales.push({ texto: 'Nunca emitió', tono: 'gris' }); grupos.add('sinEmitir') }
    else if (dias !== null && dias >= 30) { senales.push({ texto: `Sin emitir hace ${dias} días`, tono: 'gris' }); grupos.add('sinEmitir') }
  }

  // --- EL ESTADO -----------------------------------------------------------
  const listo = (texto: string, tono: Tono, detalle?: string): EstadoCuenta => {
    if (tono === 'bien') grupos.add('normal')
    return { texto, detalle, tono, senales, grupos }
  }

  if (c.estado === 'suspendida') return listo('Suspendida', 'gris', c.motivoSuspension ? `«${c.motivoSuspension}»` : undefined)
  if (c.estado === 'pendiente') return listo('Correo sin confirmar', 'gris', 'Se registró y no confirmó su correo')
  if (activas.length === 0) {
    grupos.add('sinEmpresas')
    return listo(c.tipo === 'profesional' ? 'Cuenta sin empresas' : 'Cuenta sin empresa',
                 'gris', c.empresas > 0 ? 'Sus empresas están en pausa' : 'Se registró y no agregó ninguna')
  }
  if (s?.encendidos && s.pago === 'no_emite' && !s.accesoTotal) return listo('No emite', 'malo', 'El pago está vencido')

  if (c.tipo === 'profesional') {
    const nCli = plural(clientes.length, 'cliente', 'clientes')
    if (!propia) return listo('No registró su empresa', 'aviso', `${nCli} en su cartera`)
    if (clientes.length === 0) { grupos.add('candado'); return listo('Sin cartera', 'aviso', 'Registró su empresa, pero aún ningún cliente') }
    const est = s?.estudio
    if (est?.estado === 'sin_activar') {
      grupos.add('candado')
      return listo('Con candado', 'aviso', `${nCli}: paga el mínimo de ${est.minimo} · Mi empresa espera ${plural(est.faltan, 'cliente más', 'clientes más')}`)
    }
    if (est?.estado === 'aviso') return listo('Bajó del mínimo', 'aviso', `Mi empresa deja de emitir el ${est.hasta ? fechaCorta(est.hasta) : '—'}`)
    if (est?.estado === 'no_emite') return listo('Mi empresa no emite', 'malo', `Su cartera bajó del mínimo (${est.tiene} de ${est.minimo})`)
    return listo('Todo normal', 'bien', `${nCli} · Mi empresa activa`)
  }

  // Cuenta Negocio: su empresa (la primera activa).
  const e = activas[0]
  if (!e.facturacionActiva) {
    grupos.add('medias')
    return listo('Configuración a medias', 'aviso', e.faltan?.length ? `Falta: ${e.faltan.join(', ').toLowerCase()}` : 'Falta activar la facturación')
  }
  if (e.certificadoHasta && diasHasta(e.certificadoHasta) < 0)
    return listo('Certificado vencido', 'malo', `Venció el ${fechaCorta(e.certificadoHasta)}: no puede emitir`)
  if (e.rechazos > 0) return listo('Con rechazos', 'malo', `${plural(e.rechazos, 'rechazo', 'rechazos')} de SUNAT en 7 días`)
  return listo('Todo normal', 'bien')
}