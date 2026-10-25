import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './nucleo/estilos/index.css'
import { registrarPwa } from './nucleo/pwa/pwa'

// e171: la app instalable (íconos, pantalla completa, aviso de versión nueva).
registrarPwa()

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
