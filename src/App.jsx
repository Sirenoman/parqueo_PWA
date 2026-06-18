import { useState } from 'react'
import { registrarEntrada, procesarSalida } from './services/ticketsService'
import { obtenerTarifasActivas } from './services/tarifasService'
import './App.css'

const PLACA_PRUEBA = '101-X43'
const TIPO_VEHICULO = 'auto'

function formatearDinero(valor) {
  return Number(valor ?? 0).toFixed(2)
}

function formatearNumero(valor) {
  return Number(valor ?? 0).toFixed(2)
}

function VistaCodigoQR({ codigo }) {
  const celdas = Array.from({ length: 64 }, (_, index) => {
    const caracter = codigo.charCodeAt(index % codigo.length)
    return (caracter + index) % 3 !== 0
  })

  return (
    <div>
      <div
        aria-label="Vista previa del codigo QR generado"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 18px)',
          gap: '3px',
          width: 'fit-content',
          padding: '12px',
          background: 'white',
          border: '1px solid #ddd'
        }}
      >
        {celdas.map((activa, index) => (
          <span
            key={index}
            style={{
              width: '18px',
              height: '18px',
              background: activa ? '#111' : '#fff',
              border: '1px solid #eee'
            }}
          />
        ))}
      </div>
      <code style={{ display: 'block', marginTop: '12px', wordBreak: 'break-all' }}>
        {codigo}
      </code>
    </div>
  )
}

function App() {
  const [prueba, setPrueba] = useState({
    cargando: false,
    error: null,
    tarifa: null,
    ticket: null,
    salida: null
  })

  async function probarFlujoTickets() {
    setPrueba({
      cargando: true,
      error: null,
      tarifa: null,
      ticket: null,
      salida: null
    })

    try {
      const tarifas = await obtenerTarifasActivas()
      const tarifaEstandar = tarifas[0]

      if (!tarifaEstandar) {
        throw new Error('No hay tarifas activas para crear el ticket de prueba')
      }

      const ticket = await registrarEntrada(
        PLACA_PRUEBA,
        TIPO_VEHICULO,
        tarifaEstandar.id
      )

      console.log('Ticket creado:', ticket)
      console.log('Contenido del QR:', ticket.id)

      const salida = await procesarSalida(ticket.id)

      console.log('Monto a cobrar: $', salida.calculo.montoTotal)
      console.log('Desglose:', salida.calculo)

      setPrueba({
        cargando: false,
        error: null,
        tarifa: tarifaEstandar,
        ticket,
        salida
      })
    } catch (err) {
      setPrueba({
        cargando: false,
        error: err.message,
        tarifa: null,
        ticket: null,
        salida: null
      })
    }
  }

  return (
    <div>
      <h1>Prueba flujo de tickets</h1>

      <button type="button" onClick={probarFlujoTickets} disabled={prueba.cargando}>
        {prueba.cargando ? 'Ejecutando prueba...' : 'Ejecutar prueba completa'}
      </button>

      {prueba.error && <p style={{ color: 'red' }}>Error: {prueba.error}</p>}

      {prueba.tarifa && (
        <section>
          <h2>1. Tarifa usada</h2>
          <p>Nombre: {prueba.tarifa.nombre}</p>
          <p>Precio base: ${formatearDinero(prueba.tarifa.precio_base)}</p>
          <p>Duracion fraccion: {formatearNumero(prueba.tarifa.duracion_fraccion)} min</p>
        </section>
      )}

      {prueba.ticket && (
        <section>
          <h2>2. Ticket creado</h2>
          <p>ID: {prueba.ticket.id}</p>
          <p>Placa: {prueba.ticket.placa}</p>
          <p>Estado: {prueba.ticket.estado}</p>
          <p>Hora entrada: {prueba.ticket.hora_entrada}</p>
          <p>Sincronizado: {prueba.ticket.sync_status ? 'Si' : 'No'}</p>

          <h3>QR generado desde el ID del ticket</h3>
          <VistaCodigoQR codigo={prueba.ticket.id} />
        </section>
      )}

      {prueba.salida && (
        <section>
          <h2>3. Salida procesada</h2>
          <p>Estado final: {prueba.salida.ticket.estado}</p>
          <p>Hora salida: {prueba.salida.ticket.hora_salida}</p>
          <p>Total guardado: ${formatearDinero(prueba.salida.ticket.total_pagar)}</p>

          <h3>Desglose del calculo</h3>
          <p>Minutos totales: {formatearNumero(prueba.salida.calculo.minutosTotales)}</p>
          <p>Bloques: {formatearNumero(prueba.salida.calculo.bloques)}</p>
          <p>Precio por bloque: ${formatearDinero(prueba.salida.calculo.precioPorBloque)}</p>
          <p>Duracion bloque: {formatearNumero(prueba.salida.calculo.duracionBloque)} min</p>
          <p>Monto a cobrar: ${formatearDinero(prueba.salida.calculo.montoTotal)}</p>
        </section>
      )}
    </div>
  )
}

export default App
