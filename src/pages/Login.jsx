import { Link } from 'react-router-dom'

// ─────────────────────────────────────────────
// Inicio de sesion (placeholder)
//
// PENDIENTE: la autenticacion contra Supabase Auth
// todavia no esta implementada. La tabla `usuarios`
// existe en el diseno de BD (ver docs/) vinculada a
// auth.users, pero la app aun opera con la anon key
// sin login. Esta pantalla solo deja el flujo de
// navegacion completo desde el menu principal.
// ─────────────────────────────────────────────
export default function Login() {
    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm text-center">

                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">🔐 Panel administrativo</h1>
                    <p className="text-gray-500 text-sm mt-1">Acceso para administradores</p>
                </div>

                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-4 mb-6">
                    El inicio de sesion todavia no esta implementado.
                    Por ahora la app opera sin autenticacion.
                </div>

                <Link
                    to="/"
                    className="block w-full border border-gray-300 text-gray-600 py-3 rounded-xl hover:bg-gray-50 transition-colors"
                >
                    Volver al menu
                </Link>
            </div>
        </div>
    )
}
