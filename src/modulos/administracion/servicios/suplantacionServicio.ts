import { api } from '../../../nucleo/api/cliente'
import type { UsuariosDeEmpresa } from '../tipos'

// =============================================================================
// VER LA PLATAFORMA COMO OTRO USUARIO
//
// Tres llamadas y ninguna más. La de `usuarios` es el único sitio del front que
// pide los usuarios de otra empresa, y solo sirve para elegir a quién ver.
// =============================================================================

export const suplantacionServicio = {
  /**
   * GET /api/admin/empresas/{id}/usuarios — para elegir a quién ver.
   *
   * Solo super admin. Devuelve lo justo para reconocer a alguien en una lista:
   * la gestión de usuarios de verdad la hace el administrador del cliente desde
   * su propia pantalla.
   */
  usuarios: (empresaId: string) =>
    api.obtener<UsuariosDeEmpresa>(`/api/admin/empresas/${empresaId}/usuarios`),

  /** POST /api/suplantacion — empieza. A partir de aquí, todo es solo lectura. */
  empezar: (usuarioId: string) =>
    api.crear<{ suplantado: string; mensaje: string }>('/api/suplantacion', { usuarioId }),

  /**
   * DELETE /api/suplantacion — volver a ser yo.
   *
   * ES UNA DE LAS DOS ÚNICAS ESCRITURAS QUE EL BACK PERMITE MIENTRAS SE
   * SUPLANTA —la otra es cerrar sesión—, y por eso es un DELETE exento en el
   * middleware. Si no lo fuera, entrar a ver una cuenta sería un viaje de ida.
   */
  terminar: () =>
    api.borrar<{ mensaje: string }>('/api/suplantacion'),
}
