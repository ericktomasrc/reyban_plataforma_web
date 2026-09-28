import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './nucleo/estilos/index.css'

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
