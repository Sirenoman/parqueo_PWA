import { useState, useEffect, useRef } from 'react'
import { useConexion } from './useConexion'
import { sincronizarVehiculosOffline } from '../services/vehiculoService'
import { sincronizarTicketsOffline } from '../services/ticketsService'

export function useSync() {
    const { estaOnline } = useConexion()
    const [sincronizando, setSincronizando] = useState(false)
    const [resultado, setResultado] = useState(null)
    // resultado = { sincronizados: N } o { error: '...' }

    // ─────────────────────────────────────────
    // useRef para evitar que el efecto se
    // dispare dos veces si estaOnline cambia
    // muy rápido (flicker de red)
    // ─────────────────────────────────────────
    const sincronizando_ref = useRef(false)

    const ejecutarSync = async () => {
        // Evitar sincronizaciones simultaneas
        if (sincronizando_ref.current) return
        sincronizando_ref.current = true
        setSincronizando(true)
        setResultado(null)

        try {
            // ─────────────────────────────────────
            // Orden obligatorio:
            // 1. Vehículos primero → las placas deben
            //    existir en Supabase antes de subir
            //    los tickets que las referencian
            // 2. Tickets después → ya pueden hacer
            //    referencia a las placas subidas
            // ─────────────────────────────────────
            await sincronizarVehiculosOffline()
            const { sincronizados } = await sincronizarTicketsOffline()

            setResultado({ sincronizados })
        } catch (error) {
            setResultado({ error: error.message })
        } finally {
            setSincronizando(false)
            sincronizando_ref.current = false
        }
    }

    useEffect(() => {
        // Solo ejecutar sync cuando:
        // 1. La tablet acaba de recuperar conexion
        // 2. no hay una sincronizacio en curso
        if (estaOnline && !sincronizando_ref.current) {
            ejecutarSync()
        }
    }, [estaOnline]) // se dispara cada vez que estaOnline cambia a true

    return {
        sincronizando, // bollean: true = sync en proceso
        resultado, // { sincronizandos: N } | { error: '...' } | null
        ejecutarSync // funcion: para forzar sync manual desde un boton
    }
}