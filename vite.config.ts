import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// =============================================================================
// DOS COSAS IMPORTANTES, Y LAS DOS SE OLVIDAN
//
// 1. EL BUILD SALE A wwwroot DE LA API, no a dist/.
//
//    El front lo sirve la propia API. Un solo origen significa cero CORS y una
//    cookie que simplemente funciona: sin esto habría que configurar cabeceras
//    en dos sitios para que el navegador acepte mandarla.
//
// 2. EN DESARROLLO, EL PROXY.
//
//    Vite sirve en el 5173 y la API en el 5255. Sin proxy serían dos orígenes
//    distintos y el navegador NO mandaría la cookie: todo respondería 401 y
//    parecería que el ingreso está roto.
//
//    Con el proxy, el navegador cree que todo viene del 5173.
// =============================================================================

export default defineConfig({
  plugins: [react()],

  build: {
    outDir: '../Plataforma.Api/wwwroot',
    emptyOutDir: true,
  },

  server: {
    port: 5173,
    proxy: {
      '/api':     { target: 'http://localhost:5255', changeOrigin: true },
      '/salud':   { target: 'http://localhost:5255', changeOrigin: true },
      '/swagger': { target: 'http://localhost:5255', changeOrigin: true },
      '/openapi': { target: 'http://localhost:5255', changeOrigin: true },
    },
  },
})
