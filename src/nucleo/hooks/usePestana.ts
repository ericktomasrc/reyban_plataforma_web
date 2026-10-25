import { useSearchParams } from 'react-router-dom'

/**
 * La pestaña elegida, guardada en la dirección (?ver=…): al volver atrás o
 * recargar, se queda donde estaba. La primera de la lista no se escribe.
 */
export function usePestana<V extends string>(valores: readonly V[], param = 'ver'): [V, (v: V) => void] {
  const [params, setParams] = useSearchParams()
  const actual = valores.find(v => v === params.get(param)) ?? valores[0]
  const cambiar = (v: V) => {
    const p = new URLSearchParams(params)
    if (v === valores[0]) p.delete(param); else p.set(param, v)
    setParams(p, { replace: true })
  }
  return [actual, cambiar]
}