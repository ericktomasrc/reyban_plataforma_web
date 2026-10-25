import { useEffect, useState } from 'react'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useYo } from '../../../nucleo/sesion/SesionContexto'
import { inventarioServicio, type EstadoInventario } from '../servicios/inventarioServicio'

/** 052 — El estado del inventario de la empresa (encendido, sucursales, motivos). */
export function useEstadoInventario(recargar = 0) {
  const [estado, setEstado] = useState<EstadoInventario>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    let vivo = true
    inventarioServicio.estado()
      .then(e => { if (vivo) { setEstado(e); setError(undefined) } })
      .catch(e => { if (vivo) setError(e instanceof ErrorApi ? e.message : 'No se pudo leer el inventario.') })
    return () => { vivo = false }
  }, [recargar])
  return { estado, error }
}

/**
 * Las sucursales en las que esta persona puede mover stock: la elegida arriba,
 * o las suyas, o (con una sola sucursal) esa. Y cuál viene elegida.
 */
export function useSucursalesDeTrabajo(estado: EstadoInventario | undefined) {
  const { alcance } = useYo()
  const todas = estado?.sucursales ?? []
  let lista = todas
  if (alcance && alcance.sucursales.length > 0) {
    const mias = new Set(alcance.sucursales.map(s => s.id))
    lista = todas.filter(s => mias.has(s.id))
    if (alcance.vista) lista = lista.filter(s => s.id === alcance.vista)
  }
  const defecto = (alcance?.vista && lista.some(s => s.id === alcance.vista) ? alcance.vista : null)
    ?? (alcance?.defecto && lista.some(s => s.id === alcance.defecto) ? alcance.defecto : null)
    ?? lista[0]?.id ?? ''
  return { sucursales: lista, defecto }
}