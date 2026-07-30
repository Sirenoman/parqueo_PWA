import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export const ConexionContext = createContext(null)

// ─────────────────────────────────────────
// Verificación real de conectividad
// navigator.onLine puede mentir: reporta
// true si la tablet está conectada al router
// pero el router no tiene internet.
// Este ping al servidor confirma conectividad
// real con Supabase
//
// Se usa desde ConexionProvider.jsx, que es el
// unico lugar donde se instancia este estado.
// ─────────────────────────────────────────
export function useConexionState() {
  const [estaOnline, setEstaOnline] = useState(navigator.onLine);
  const [verificando, setVerificando] = useState(false);
  const [ultimaVerificacion, setUltimaVerificacion] = useState(null);

  const verificarConexionReal = useCallback(async () => {
    setVerificando(true)
    try {
        // Se reutilizan url/key del cliente ya instanciado (lib/supabase.js)
        // en vez de releer las env vars, para no duplicar la fuente de verdad.
        //
        // No se pinguea /rest/v1/ (raiz de PostgREST): ese endpoint devuelve
        // el esquema OpenAPI completo y, con el nuevo sistema de API keys de
        // Supabase, quedo reclasificado como introspeccion -> exige una
        // secret key (sb_secret_...), rechazando siempre la publishable key
        // con 401 "Secret API key required", sin importar los headers.
        // /auth/v1/health es el healthcheck real de Supabase (GoTrue):
        // no expone esquema ni depende de RLS, ideal para "hay conexion?".
        const respuesta = await fetch(
            `${supabase.supabaseUrl}/auth/v1/health`,
            {
                method: 'GET',
                headers: {
                    apikey: supabase.supabaseKey,
                    Authorization: `Bearer ${supabase.supabaseKey}`
                },
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

export function useConexion() {
  const contexto = useContext(ConexionContext)
  if (!contexto) {
    throw new Error('useConexion debe usarse dentro de <ConexionProvider>')
  }
  return contexto
}
