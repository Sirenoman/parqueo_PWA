import { supabase } from '../lib/supabase';
import { dbLocal } from '../lib/localDb';

// ─────────────────────────────────────────────
// Buscar vehículo por placa
// Primero busca local (offline), luego en
// Supabase si hay conexión
// Se usa en: pantalla de Entrada, al digitar
// la placa para verificar si ya existe
// ─────────────────────────────────────────────
export async function buscarVehiculo(placa) {
    const placaNormalizada = placa.trim().toUpperCase();

    // Primero intenta en supabase si hay conexion
    if (navigator.onLine) {
        const { data, error } = await supabase
            .from('vehiculos')
            .select('*')
            .eq('placa', placaNormalizada)
            .maybeSingle(); // Devuelve null si no existe, sin lanzar error

        if (error) throw new Error('Error al buscar vehículo en Supabase: ' + error.message);
        return data; // Puede ser un objeto o null
    }

    // Sin conexion: buscar en IndexedBD local
    const vehiculoLocal = await dbLocal.vehiculos
        ?.where('placa')
        .equals(placaNormalizada)
        .first();

    return vehiculoLocal || null; // Devuelve el vehículo o null si no se encuentra
}

// ─────────────────────────────────────────────
// Registrar vehículo nuevo
// Solo se llama si buscarVehiculo devuelve null
// Se usa en: pantalla de Entrada, primera vez
// que ingresa una placa al parqueo
// ─────────────────────────────────────────────
export async function registrarVehiculo(placa, tipo = 'auto') {
    const placaNormalizada = placa.trim().toUpperCase();

    const nuevoVehiculo = {
        placa: placaNormalizada,
        tipo,
        created_at: new Date().toISOString()
    };

    // Con Conexion: Guardar directo en Supabase
    if (navigator.onLine) {
        const { data, error } = await supabase
            .from('vehiculos')
            .insert(nuevoVehiculo)
            .select()
            .single();

        if (error) throw new Error('Error al registrar vehículo en Supabase: ' + error.message);
        return data; // Devuelve el vehículo registrado
    }

    // Sin conexion: Guardar en IndexedDB local
    // Se sincronizara junto con el ticket cuando regrese el Wifi
    const vehiculoLocal = { ...nuevoVehiculo, sync_status: 0 }; // IndexedDB no indexa booleanos
    await dbLocal.vehiculos?.put(vehiculoLocal);
    return vehiculoLocal; // Devuelve el vehículo registrado localmente
}

// ─────────────────────────────────────────────
// Obtener o crear vehículo (función principal)
// Esta es la que se llama desde la pantalla
// de Entrada. Combina buscar y registrar en
// una sola operación para simplificar el flujo
//
// Flujo:
//  placa ingresada
//    → ¿existe en BD?
//      SÍ → retorna el vehículo existente
//      NO → lo crea y retorna el nuevo
// ─────────────────────────────────────────────
export async function obtenerOCrearVehiculo(placa,  tipo = 'auto') {
    const vehiculoExistente = await buscarVehiculo(placa);

    if (vehiculoExistente) return vehiculoExistente; // Retorna el vehículo encontrado

    const vehiculoNuevo = await registrarVehiculo(placa, tipo);
    return vehiculoNuevo; // Retorna el nuevo vehículo registrado
}

// ─────────────────────────────────────────────
// Sincronizar vehículos offline pendientes
// Se llama desde useSync cuando regresa el WiFi
// antes de sincronizar tickets, porque los
// tickets dependen de que la placa ya exista
// en Supabase
// ─────────────────────────────────────────────
export async function sincronizarVehiculosOffline() {
    // Verificar si la tabla existe en IndexedDB
    if (!dbLocal.vehiculos) return; // No hay tabla, nada que sincronizar

    const vehiculoPendientes = await dbLocal.vehiculos
        .where('sync_status')
        .equals(0) // 0 = false en IndexedDB
        .toArray();

    if (vehiculoPendientes.length === 0) return; // No hay vehículos pendientes

    // sync_status es un campo de control local: la tabla vehiculos en
    // Supabase no lo tiene, asi que no se debe enviar en el upsert.
    const vehiculosParaSubir = vehiculoPendientes.map(vehiculo => ({
        placa: vehiculo.placa,
        tipo: vehiculo.tipo,
        created_at: vehiculo.created_at
    }));

    const { error } = await supabase
        .from('vehiculos')
        .upsert(vehiculosParaSubir, { onConflict: 'placa' }); // Evita duplicados por placa
        // onConflict: 'placa' -> si la placa ya existe no falla.
        // simplemente no hace nada. Evita duplicados.

    if (error) throw new Error('Error al sincronizar vehículos en Supabase: ' + error.message);

    // Marcar como sincronizados en IndexedDB
    const placas = vehiculoPendientes.map(v => v.placa);
    await dbLocal.vehiculos
        .where('placa')
        .anyOf(placas)
        .modify({ sync_status: 1 }); // 1 = true en IndexedDB
}