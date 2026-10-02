import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Polices auto-hébergées (aucun appel à Google Fonts : IP des visiteurs non transmise)
import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource-variable/dm-sans/opsz.css'
import './index.css'
import App from './App.jsx'
import PagesLegales from './PagesLegales.jsx'
import { ROUTES_LEGALES } from './routesLegales.js'

// Pages légales : routes dédiées, rendues hors de l'application
const chemin = window.location.pathname.replace(/\/+$/, '') || '/'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {ROUTES_LEGALES.includes(chemin) ? <PagesLegales chemin={chemin}/> : <App />}
  </StrictMode>,
)
