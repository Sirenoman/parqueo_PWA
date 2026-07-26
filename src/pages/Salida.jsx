import { useState, useRef } from 'react'
import { procesarSalida } from '../services/ticketsService'
import { calcularMonto } from '../services/tarifasService'
import { dbLocal } from '../lib/localDb'

export default function Salida() {
    const [escaneando, setEscaneando] = useState(false)
    const [codigoManual, setCodigoManual] = useState('')
    const [resultado, setResultado] = useState(null)
    const [cargando, setCargando] = useState(false)
    const [error, setError] = useState(null)
    const videoRef = useRef(null)

    // --- INICIAR CAMARA PARA ESCANEAR QR -----
    async function iniciarEscaner() {
        setError(null)
        setEscaneando(true)
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode : 'environment' } // camara trasera de la tablet
            })
            if (videoRef.current) {
                videoRef.current.srcObject = stream
            }
        } catch {
            setError(' No se pudo acceder a la camara. Ingresa el codigo manualmente')
            setEscaneando(false)
        }
    }

    function detenerEscaner() {
        const stream = videoRef.current?.srcObject
        stream?.getTracks().forEach(t => t.stop())
        setEscaneando(false)
    }

    // --- Procesar el codigo QR (escaneando o manual) ----
    async function manejarCodigo(codigo) {
        if (!codigo.trim()) return setError('Ingresa o escanea un codigo QR')
        
        detenerEscaner()
        setCargando(true)
        setError(null)

        try {
            const data = await procesarSalida(codigo.trim())
            setResultado(data)
        } catch (err) {
            setError(err.message)
        } finally {
            setCargando(false)
        }
    }

    function nuevaSalida() {
        setResultado(null)
        setCodigoManual('')
        setError(null)
    }

    // ---- Formatear minutos a horas y minutos legible ----
    function formatearTiempo(minutos) {
        const h = Math.floor(minutos / 60)
        const m = minutos % 60
        if (h === 0) return `${m} min`
        if (m === 0) return `${h}h`
        return `${h}h ${m}min`
    }

    // --- VISTA: resultado del cobro -------
    if (resultado) {
        const { ticket, calculo } = resultado

        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="big-white rounded-2xl  shadow-lg p-6 w-full max-w-sm">
                    
                    <div className="text-center mb-6">
                        <h2 className="text-xl font-bold text-gray-800"> Cobro de Parqueo </h2>
                        <p className="text-gray-500 text-sm">Placa: <strong>{ticket.placa}</strong></p>
                    </div>

                    {/* Desglose del tiempo */}
                    <div className="bg-gray-50 rounded-xl p-4 space-y-2 mb-4 text-sm">
                        <div className="flex justify-between text-gray-600">
                            <span>Entrada</span>
                            <span>{new Date(ticket.hora_entrada).toLocaleTimeString('es-SV')}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Salida</span>
                            <span>{new Date(ticket.hora_salida).toLocaleTimeString('es-SV')}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Tiempo total</span>
                            <span>{formatearTiempo(calculo.minutosTotales)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Fracciones ({calculo.duracionBloque} min c/u)</span>
                            <span>{calculo.bloques} x ${calculo.precioPorBloque.toFixed(2)}</span>
                        </div>
                        <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-gray-800 text-base">
                            <span>Total a pagar</span>
                            <span className="text-green-600 text-xl">${calculo.montoTotal.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Estado del Ticket */}
                    <div className="text-center text-xs text-gray-400 mb-4">
                        {ticket.sync_status
                            ? '✅ Registrado en sistema'
                            : '🕐 Pendiente de sincronizar'
                        }
                    </div>

                    <button
                        onClick={nuevaSalida}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors"
                    >
                        Procesar siguiente salida
                    </button>
                </div>
            </div>
        )
    }

    // --- VISTA: escaner / ingreso manual ---
    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-lg p-6 w-full mx-w-sm">

                {/* Encabezado */}
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">🎫 Salida</h1>
                    <p className="text-gray-500 text-xm">Escanea el Qr del ticket</p>
                </div>

                {/* Area de camara */}
                {escaneando ? (
                    <div className="mb-4">
                        <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover"
                            />
                            {/* Marco de enfoque visual */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-48 h-48 border-4 border-white rounded-xl opacity-70" />
                            </div>
                        </div>
                        <button
                            onClick={detenerEscaner}
                            className="mt-3 w-full border border-gray-300 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                        >
                            Cancelar Escaneo
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={iniciarEscaner}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl text-lg mb-4 transition-colors"
                    >
                        📷 Escanear QR
                    </button>
                )}

                {/* Separador */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-gray-400 text-xs">o ingresa el codigo</span>
                    <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* Ingreso manual del codigo */}
                <div className="space-y-3">
                    <input
                        type="Text"
                        value={codigoManual}
                        onChange={e => setCodigoManual(e.target.value.toUpperCase())}
                        placeholder="PKQ-XXX-ABC-123-..."
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={() => manejarCodigo(codigoManual)}
                        disabled={cargando || !codigoManual.trim()}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl transition-colors"
                    >
                        {cargando ? 'procesando...' : 'Procesar Salida'}
                    </button>
                </div>
            </div>
        </div>
    )
}