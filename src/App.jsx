import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useConexion } from './hooks/useConexion'
import { useSync } from './hooks/useSync'
import Menu from './pages/Menu'
import Entrada from './pages/Entrada'
import Salida from './pages/Salida'
import Login from './pages/Login'
import EstadoConexion from './components/EstadoConexion'
import { cachearTarifasActivas } from './services/tarifasService'
import './App.css'

function App() {
  const { estaOnline } = useConexion()
  const { sincronizando, resultado } = useSync()

  // Cachear tarifas al arrancar la app: asi Entrada y Salida tienen
  // tarifas disponibles en modo offline sin depender de que pantalla
  // se abrio primero.
  useEffect(() => {
    cachearTarifasActivas().catch(() => {
      // Sin conexion al arrancar: no hay nada que cachear todavia,
      // se reintentara en el siguiente montaje con red disponible.
    })
  }, [])

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Barra de estado de conexión y sincronización */}
      <EstadoConexion 
        estaOnline={estaOnline}
        sincronizando={sincronizando}
        resultado={resultado}
      />

      <Routes>
        <Route path="/" element={<Menu />} />
        <Route path="/entrada" element={<Entrada />} />
        <Route path="/salida" element={<Salida />} />
        <Route path="/login" element={<Login />} />
        {/* Cualquier ruta desconocida regresa al menu */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App
