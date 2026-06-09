import { useEffect, useState } from 'react'
import { obtenerTarifasActivas, calcularMonto } from './services/tarifasService'
import './App.css'

function App() {
  const [tarifas, setTarifas] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    async function cargarTarifas() {
      try {
        const tarifasActivas = await obtenerTarifasActivas()
        setTarifas(tarifasActivas)
      } catch (err) {
        setError(err.message)
      }
    }

    cargarTarifas()
  }, [])

  const tarifaEstandar = tarifas.find(t => t.nombre === 'Estandar') ?? tarifas[0] ?? null
  const resultado = tarifaEstandar
    ? calcularMonto(
        '2026-06-08T08:00:00Z',
        '2026-06-08T09:30:00Z',
        tarifaEstandar
      )
    : null

  return (
    <div>
      <h1>Conexion con Supabase</h1>

      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {tarifas.map(t => (
        <p key={t.id}>
          {t.nombre} - ${t.precio_base} / {t.duracion_fraccion} min
        </p>
      ))}

      {resultado && (
        <section>
          <h2>Resultado del calculo</h2>
          <p>Minutos totales: {resultado.minutosTotales} min</p>
          <p>Bloques: {resultado.bloques} bloques</p>
          <p>Precio por bloque: ${resultado.precioPorBloque.toFixed(2)}</p>
          <p>Duracion del bloque: {resultado.duracionBloque} min</p>
          <p>Monto total: ${resultado.montoTotal.toFixed(2)}</p>
        </section>
      )}
    </div>
  )
}

export default App
