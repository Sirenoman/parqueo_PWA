export default function EstadoConexion({ estaOnline, sincronizando, resultado }) {
    const bg = sincronizando ? 'bg-yellow-500' : estaOnline ? 'bg-green-500' : 'bg-red-500'

    const mensaje = sincronizando ? 'sincronizando tickets pendientes... ' : estaOnline ? 'En linea' : 'Sin conexión - guardado localmente'

    return (
        <div className={`${bg} text-white text-sm px-4 py-2 flex justify-between items-center`}>
            <span>{mensaje}</span>
            {resultado?.sincronizandos > 0 && (
                <span className="bg-white text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
                    {resultado.sincronizados} tickets sincronizados
                </span>
            )}
            {resultado?.error && (
                <span className="bg-white text-red-700 text-xs font-semibold px-2 py-1 rounded-full">
                    {resultado.error}
                </span>
            )}
        </div>
    )
}