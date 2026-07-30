import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import jsQR from 'jsqr'
import { consultarSalida, cerrarSalida } from '../services/ticketsService'

export default function Salida() {
    const [escaneando, setEscaneando] = useState(false)
    const [codigoManual, setCodigoManual] = useState('')
    const [resultado, setResultado] = useState(null)
    const [cargando, setCargando] = useState(false)
    const [error, setError] = useState(null)
    // Aviso del ultimo ticket cobrado, se muestra al volver al escaner
    const [ultimoCobro, setUltimoCobro] = useState(null)
    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const frameRequestRef = useRef(null)
    // Ref propio para el MediaStream (no leido desde videoRef.current.srcObject):
    // así detenerEscaner/el cleanup siempre saben cual stream detener sin
    // depender de que el nodo <video> siga montado.
    const streamRef = useRef(null)

    // Detiene la camara y el loop de lectura si el operador navega a
    // otra pantalla mientras el escaneo seguia activo.
    useEffect(() => {
        return () => {
            if (frameRequestRef.current) cancelAnimationFrame(frameRequestRef.current)
            streamRef.current?.getTracks().forEach(t => t.stop())
        }
    }, [])

    // --- INICIAR CAMARA PARA ESCANEAR QR -----
    async function iniciarEscaner() {
        setError(null)
        setEscaneando(true)
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode : 'environment' } // camara trasera de la tablet
            })
            streamRef.current = stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream
            }
            frameRequestRef.current = requestAnimationFrame(escanearFrame)
        } catch {
            setError(' No se pudo acceder a la camara. Ingresa el codigo manualmente')
            setEscaneando(false)
        }
    }

    // --- Leer frames del video y decodificar el QR con jsQR -----
    function escanearFrame() {
        const video = videoRef.current
        const canvas = canvasRef.current

        if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
            frameRequestRef.current = requestAnimationFrame(escanearFrame)
            return
        }

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const contexto = canvas.getContext('2d')
        contexto.drawImage(video, 0, 0, canvas.width, canvas.height)

        const imageData = contexto.getImageData(0, 0, canvas.width, canvas.height)
        const codigo = jsQR(imageData.data, imageData.width, imageData.height)

        if (codigo?.data) {
            manejarCodigo(codigo.data) // ya llama a detenerEscaner() internamente
            return
        }

        frameRequestRef.current = requestAnimationFrame(escanearFrame)
    }

    function detenerEscaner() {
        if (frameRequestRef.current) {
            cancelAnimationFrame(frameRequestRef.current)
            frameRequestRef.current = null
        }
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
        setEscaneando(false)
    }

    // --- Consultar el ticket (escaneando o manual) ----
    // Solo lectura: muestra cuanto lleva acumulado sin cerrar nada.
    async function manejarCodigo(codigo) {
        if (!codigo.trim()) return setError('Ingresa o escanea un codigo QR')

        detenerEscaner()
        setCargando(true)
        setError(null)
        setUltimoCobro(null)

        try {
            const data = await consultarSalida(codigo.trim())
            setResultado(data)
        } catch (err) {
            setError(err.message)
        } finally {
            setCargando(false)
        }
    }

    // --- Cerrar el ticket: aqui SI se cobra y se escribe en la BD ----
    async function confirmarCobro() {
        setCargando(true)
        setError(null)

        try {
            const { ticket, calculo } = await cerrarSalida(resultado.ticket, resultado.tarifa)
            setUltimoCobro({ placa: ticket.placa, monto: calculo.montoTotal })
            volverAlEscaner()
        } catch (err) {
            setError(err.message)
        } finally {
            setCargando(false)
        }
    }

    // Vuelve al escaner sin tocar el ticket (caso: solo consultaban el total)
    function volverAlEscaner() {
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

    // --- VISTA: consulta del ticket (todavia NO cobrado) -------
    if (resultado) {
        const { ticket, calculo, horaConsulta } = resultado

        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm">

                    <div className="text-center mb-6">
                        <h2 className="text-xl font-bold text-gray-800">Consulta de Ticket</h2>
                        <p className="text-gray-500 text-sm">Placa: <strong>{ticket.placa}</strong></p>
                    </div>

                    {/* Desglose del tiempo */}
                    <div className="bg-gray-50 rounded-xl p-4 space-y-2 mb-4 text-sm">
                        <div className="flex justify-between text-gray-600">
                            <span>Entrada</span>
                            <span>{new Date(ticket.hora_entrada).toLocaleTimeString('es-SV')}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Consultado</span>
                            <span>{new Date(horaConsulta).toLocaleTimeString('es-SV')}</span>
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

                    {/* El ticket sigue abierto hasta confirmar el cobro */}
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl px-4 py-3 mb-4">
                        El ticket sigue <strong>activo</strong>. El monto se cobra y
                        el ticket se cierra solo al confirmar la salida; si pasa mas
                        tiempo, el total se recalcula.
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={confirmarCobro}
                        disabled={cargando}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl transition-colors"
                    >
                        {cargando ? 'Cerrando ticket...' : 'Cobrar y procesar salida'}
                    </button>

                    <button
                        onClick={volverAlEscaner}
                        disabled={cargando}
                        className="mt-3 w-full border border-gray-300 text-gray-600 py-3 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                        Solo consulta — volver sin cobrar
                    </button>
                </div>
            </div>
        )
    }

    // --- VISTA: escaner / ingreso manual ---
    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm">

                {/* Encabezado */}
                <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
                    ← Menu
                </Link>
                <div className="text-center mb-6 mt-2">
                    <h1 className="text-2xl font-bold text-gray-800">🎫 Salida</h1>
                    <p className="text-gray-500 text-sm">Escanea el QR o digita la placa</p>
                </div>

                {/* Confirmacion del ticket recien cobrado */}
                {ultimoCobro && (
                    <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl px-4 py-3 mb-4 text-center">
                        ✅ Ticket cerrado — <strong>{ultimoCobro.placa}</strong>
                        {' '}cobrado ${ultimoCobro.monto.toFixed(2)}
                    </div>
                )}

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
                        {/* Canvas oculto: aqui se dibuja cada frame del video para que jsQR lo decodifique */}
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
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
                    <span className="text-gray-400 text-xs">o ingresa la placa</span>
                    <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* Ingreso manual: acepta la placa o el codigo del ticket */}
                <div className="space-y-3">
                    <input
                        type="text"
                        value={codigoManual}
                        onChange={e => setCodigoManual(e.target.value.toUpperCase())}
                        placeholder="ABC-1234"
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-gray-400 text-xs text-center">
                        Si el ticket se perdio, digita la placa: se cobrara la
                        visita abierta mas reciente de ese vehiculo.
                    </p>

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