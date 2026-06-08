import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './globalStyles.css'
import GameController from './GameController.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GameController />
  </StrictMode>,
)
