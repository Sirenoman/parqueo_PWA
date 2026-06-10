import { useEffect, useState } from 'react'
import { obtenerOCrearVehiculo } from './services/vehiculoService'
import './App.css'

function App() {
  const [prueba, setPrueba] = useState({
    cargando: true,
    error: null,
    vehiculoNuevo: null,
    vehiculoExistente: null,
    mismaPlaca: false
  })

  useEffect(() => {
    async function probarObtenerOCrearVehiculo() {
      try {
        const v1 = await obtenerOCrearVehiculo('ABC-123', 'auto')
        console.log('Vehiculo:', v1)

        const v2 = await obtenerOCrearVehiculo('ABC-123', 'auto')
        console.log('Mismo vehiculo sin duplicado:', v2)

        setPrueba({
          cargando: false,
          error: null,
          vehiculoNuevo: v1,
          vehiculoExistente: v2,
          mismaPlaca: v1?.placa === v2?.placa
        })
      } catch (err) {
        setPrueba({
          cargando: false,
          error: err.message,
          vehiculoNuevo: null,
          vehiculoExistente: null,
          mismaPlaca: false
        })
      }
    }

    probarObtenerOCrearVehiculo()
  }, [])

  return (
    <div>
      <h1>Prueba obtener O Crear Vehiculo</h1>

      {prueba.cargando && <p>Ejecutando prueba...</p>}
      {prueba.error && <p style={{ color: 'red' }}>Error: {prueba.error}</p>}

      {prueba.vehiculoNuevo && (
        <section>
          <h2>Prueba 1: placa nueva</h2>
          <p>Placa: {prueba.vehiculoNuevo.placa}</p>
          <p>Tipo: {prueba.vehiculoNuevo.tipo}</p>
          <p>Creado en: {prueba.vehiculoNuevo.created_at}</p>
        </section>
      )}

      {prueba.vehiculoExistente && (
        <section>
          <h2>Prueba 2: misma placa</h2>
          <p>Placa: {prueba.vehiculoExistente.placa}</p>
          <p>Tipo: {prueba.vehiculoExistente.tipo}</p>
          <p>Creado en: {prueba.vehiculoExistente.created_at}</p>
        </section>
      )}

      {!prueba.cargando && !prueba.error && (
        <section>
          <h2>Comparacion</h2>
          <p>Misma placa: {prueba.mismaPlaca ? 'Si' : 'No'}</p>
        </section>
      )}
    </div>
  )
}

export default App
