import { supabase } from '../lib/supabase'
import { dbLocal } from '../lib/localDb'

// ─────────────────────────────────────────────
// Obtener todas las tarifas activas
// Se usa en: pantalla de Entrada al registrar
// un vehículo, para que el operador seleccione
// qué tarifa aplica
//
// Sin conexion: usa las tarifas cacheadas en
// Dexie por cachearTarifasActivas() al arrancar
// la app (ya vienen filtradas por es_activa,
// no hace falta volver a filtrar localmente)
// ─────────────────────────────────────────────
export async function obtenerTarifasActivas() {
    if (!navigator.onLine) {
        return await dbLocal.tarifas.toArray()
    }

    const { data, error } = await supabase
        .from('tarifas')
        .select('*')
        .eq('es_activa', true)
        .order('precio_base', { ascending: true })

    if (error) throw new Error('Error al obtener tarifas: ' + error.message)
    return data
}

// ─────────────────────────────────────────────
// Cachear tarifas activas en IndexedDB
// Se llama una sola vez al arrancar la app
// (App.jsx), para que tanto Entrada como Salida
// tengan tarifas disponibles sin depender de
// cual pantalla se abrio primero
// ─────────────────────────────────────────────
export async function cachearTarifasActivas() {
    if (!navigator.onLine) return

    const tarifas = await obtenerTarifasActivas()
    await dbLocal.tarifas.bulkPut(tarifas)
    return tarifas
}

// ─────────────────────────────────────────────
// Obtener una tarifa por su ID
// Se usa en: calcular el monto al momento
// de la salida del vehículo
// ─────────────────────────────────────────────
export async function obtenerTarifaPorId(tarifaId) {
    const { data, error } = await supabase
        .from('tarifas')
        .select('*')
        .eq('id', tarifaId)
        .single() // espera exactamente un resultado

        if (error) throw new Error('Error al obtener tarifa: ' + error.message)
        return data
}

// ─────────────────────────────────────────────
// Calcular monto a pagar
// Lógica central del negocio: dado el tiempo
// de estadía y la tarifa, devuelve el monto
// Esta función corre en el CLIENTE (tablet)
// para que funcione también en modo offline
// ─────────────────────────────────────────────
export function calcularMonto(horaEntrada, horaSalida, tarifa) {
    // Diferencia en minutos entre entrada y salida
    const entrada = new Date(horaEntrada)
    const salida = new Date(horaSalida)
    const minutosTotales = Math.floor((salida - entrada) / 1000 / 60)

    // Redondar hacia arriba al siguiente bloque
    // Ej: 31 minutos con bloques de 30 -> 2 bloques -> $1.00
    const bloques = Math.ceil(minutosTotales / tarifa.duracion_fraccion)

    // Minimo siempre 1 bloque aunque sea 1 minuto
    const bloqueFinales = Math.max(bloques, 1)

    const montoTotal = bloqueFinales * tarifa.precio_base

    // Retorna el detalle completo para mostrarlo en pantalla
    return {
        minutosTotales,
        bloques: bloqueFinales,
        precioPorBloque: tarifa.precio_base,
        duracionBloque: tarifa.duracion_fraccion,
        montoTotal: parseFloat(montoTotal.toFixed(2)) // redondear a 2 decimales
    }
}