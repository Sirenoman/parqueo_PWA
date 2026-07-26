import { useState, useEffect } from 'react';
import { obtenerTarifasActivas } from '../services/tarifasService';
import { registrarEntrada } from '../services/ticketsService';
import TicketQR from '../components/TicketQR';

// ID fijo de esta tablet - en produccion puede venir
// de una variable de entorno o configuracion local
const TABLET_ID = 'tablet-entrada-01';

export default function Entrada() {
    const [placa, setPlaca] = useState('');
    const [tipoVehiculo, setTipoVehiculo] = useState('auto');
    const [tarifas, setTarifas] = useState([]);
    const [tarifaId, setTarifaId] = useState('');
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');
    const [ticketGenerado, setTicketGenerado] = useState(null);

    // Cargar tarifas al montar y cachearlas en IndexedDB
    useEffect(() => {
        async function cargar() {
            try {
                // El cacheo para modo offline ya ocurre una vez al
                // arrancar la app (App.jsx); aqui solo se lee.
                const data = await obtenerTarifasActivas();
                setTarifas(data);
                setTarifaId(data[0]?.id || '');
            } catch (err) {
                setError('Error al cargar tarifas: ' + err.message);
            }
        }
        cargar();
    }, []);

    async function manejarEntrada(e) {
        e.preventDefault();
        if (!placa.trim()) return setError('Ingrese la placa del vehiculo');
        if (!tarifaId) return setError('Selecciona una tarifa');

        setCargando(true)
        setError(null)

        try {
            const ticket = await registrarEntrada(placa, tipoVehiculo, tarifaId);
            setTicketGenerado(ticket);
            setPlaca('');
            setTipoVehiculo('auto');
            setTarifaId(tarifas[0]?.id || '');
        } catch (err) {
            setError(err.message)
        } finally {
            setCargando(false)
        }
    }

    function nuevaEntrada() {
        setTicketGenerado(null);
        setError(null);
    }

    // VISTA: Ticket generado listo para imprimir 
    if ( ticketGenerado ) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2x1 shadow-lg p-6 w-full max-w-sm text-center">
                    <h2 className="text-xl font-bold text-green-600 mb-1">Ticket Generado</h2>
                    <p className="text-gray-500 text-sm mb-4">
                        Entrega el ticket al conductor
                    </p>

                    <TicketQR ticket={ticketGenerado} />

                    <button
                        onClick={nuevaEntrada}
                        className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors"
                    >
                        Registrar Siguiente entrada
                    </button>
                </div>
            </div>
        )
    }

    // VISTA: Formulario de entrada
    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm">

                {/* Encabezado */}
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800"> Entrada</h1>
                    <p className="text-gray-500 text-sm"> Registro de ingreso al parqueo </p>
                </div>

                <form onSubmit={manejarEntrada} className="space-y-4">

                {/* Placa */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        placa del Vehiculo
                    </label>
                    <input
                        type="text"
                        value={placa}
                        onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                        placeholder="ABC-1234"
                        maxLength={10}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 
                            text-lg font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Tipo de Vehiculo */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo de Vehiculo
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { valor: 'auto',   icono: '🚗', label: 'Auto' },
                            { valor: 'moto',   icono: '🏍️', label: 'Moto' },
                            { valor: 'camion', icono: '🚚', label: 'Camión' },
                            { valor: 'otro',   icono: '🚲', label: 'Otro' }
                        ].map(({valor, icono, label}) => (
                            <button
                                key={valor}
                                type="button"
                                onClick={() => setTipoVehiculo(valor)}
                                className={`flex flex-col items-center justify-center py-2 rounded-xl border-2 text-xs font-medium transition-colors 
                                        ${tipoVehiculo === valor ? 'border-blue-500 bg-blue-100 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                            >
                                <span className="text-xl">{icono}</span>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tarifa */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tarifa
                    </label>
                    <select
                        value={tarifaId}
                        onChange={(e) => setTarifaId(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        {tarifas.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.nombre} - ${t.precio_base.toFixed(2)} / {t.duracion} min
                            </option>
                        ))}
                    </select>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                        {error}
                    </div>
                )}

                {/* Boton */}
                <button 
                    type="submit"
                    disabled={cargando}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-4 rounded-xl text-lg transition-colors mt-2"
                >
                    {cargando ? 'Registrando...' : 'Registrar Entrada'}
                </button>

                </form>    
            </div>
        </div>
    )

}