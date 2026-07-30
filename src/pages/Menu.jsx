import { Link } from 'react-router-dom'

// ─────────────────────────────────────────────
// Menu principal
// Pantalla de arranque en la tablet/telefono.
// Botones grandes para operar con el dedo, sin
// depender de escribir URLs a mano.
// ─────────────────────────────────────────────

const OPCIONES = [
    {
        ruta: '/entrada',
        icono: '🚗',
        titulo: 'Entrada',
        detalle: 'Registrar ingreso y generar ticket',
        estilo: 'bg-blue-600 hover:bg-blue-700'
    },
    {
        ruta: '/salida',
        icono: '🎫',
        titulo: 'Salida',
        detalle: 'Escanear ticket y cobrar',
        estilo: 'bg-green-600 hover:bg-green-700'
    },
    {
        ruta: '/login',
        icono: '🔐',
        titulo: 'Iniciar sesion',
        detalle: 'Panel administrativo',
        estilo: 'bg-gray-700 hover:bg-gray-800'
    }
]

export default function Menu() {
    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">

                {/* Encabezado */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800">Parqueo</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Selecciona una opcion para comenzar
                    </p>
                </div>

                {/* Opciones */}
                <nav className="space-y-4">
                    {OPCIONES.map(({ ruta, icono, titulo, detalle, estilo }) => (
                        <Link
                            key={ruta}
                            to={ruta}
                            className={`${estilo} flex items-center gap-4 text-white rounded-2xl px-5 py-5 shadow-lg transition-colors`}
                        >
                            <span className="text-4xl leading-none">{icono}</span>
                            <span className="text-left">
                                <span className="block text-xl font-semibold">{titulo}</span>
                                <span className="block text-sm opacity-80">{detalle}</span>
                            </span>
                        </Link>
                    ))}
                </nav>
            </div>
        </div>
    )
}
