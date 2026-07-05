import { useState, useEffect, useCallback } from "react";

export function useConexion() {
  const [estaOnline, setEstaOnline] = useState(navigator.onLine);
  const [verificando, setVerificando] = useState(false);
  const [ultimaVerificacion, setUltimaVerificacion] = useState(null);

  // ─────────────────────────────────────────
  // Verificación real de conectividad
  // navigator.onLine puede mentir: reporta
  // true si la tablet está conectada al router
  // pero el router no tiene internet.
  // Este ping al servidor confirma conectividad
  // real con Supabase
  // ─────────────────────────────────────────
  const verificarConexionReal = useCallback(async () => {
    setVerificando(true)
    try {
        const respuesta = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`,
            {
                method: 'HEAD',
                signal: AbortSignal.timeout(3000) // maximo 3 segundos de espera
            }
        )
        const online = respuesta.ok
        setEstaOnline(online)
        setUltimaVerificacion(new Date())
        return online
    } catch {
        setEstaOnline(false)
        setUltimaVerificacion(new Date())
        return false
    } finally {
        setVerificando(false)
    }
  }, [])

  useEffect(() => {
    // ─────────────────────────────────────────
    // Capa 1: eventos nativos del navegador
    // Reacción instantánea al cambio de red
    // ─────────────────────────────────────────
    const alConectarse = () => verificarConexionReal()
    const alDesconectarse = () => setEstaOnline(false)

    window.addEventListener('online', alConectarse)
    window.addEventListener('offline', alDesconectarse)

    // ─────────────────────────────────────────
    // Capa 2: verificación activa cada 30 seg
    // Cubre casos donde el evento 'online' no
    // se dispara pero la red ya regresó
    // ─────────────────────────────────────────
    const intervalo = setInterval(verificarConexionReal, 30_000)

    // Verificacion inicial al montar
    verificarConexionReal()

    return () => {
        window.removeEventListener('online', alConectarse)
        window.removeEventListener('offline', alDesconectarse)
        clearInterval(intervalo)
    }
  }, [verificarConexionReal])

  return {
    estaOnline, // boolean: true = con conexion
    verificando, // boolean: true = haciendo pong ahora mismo
    ultimaVerificacion, // Date: cuando fue la ultima verificacion
    verificarConexionReal // funcion: para forzar verificacion manual
  }
}
