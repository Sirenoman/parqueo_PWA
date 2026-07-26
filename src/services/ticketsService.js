import { supabase } from '../lib/supabase'
import { dbLocal } from '../lib/localDb'
import { obtenerOCrearVehiculo } from './vehiculoService'
import { obtenerTarifaPorId, calcularMonto } from './tarifasService'

function extraerTicketIdDesdeQR(valorQR) {
    // Flujo actual: el QR contiene directamente el UUID del ticket.
    if (!valorQR.startsWith('PKQ-')) return valorQR

    // Compatibilidad con QR antiguos: PKQ-{uuid}-{placa}-{timestamp}
    const partes = valorQR.split('-')
    return partes.slice(1, 6).join('-')
}

function prepararTicketParaSupabase(ticket) {
    return {
        id: ticket.id,
        placa: ticket.placa,
        hora_entrada: ticket.hora_entrada,
        hora_salida: ticket.hora_salida,
        tarifa_aplicada_id: ticket.tarifa_aplicada_id,
        total_pagar: ticket.total_pagar,
        estado: ticket.estado,
        sync_status: ticket.sync_status,
        created_at: ticket.created_at
    }
}

async function guardarTicketLocal(ticket) {
    await dbLocal.tickets.put(ticket)
}

// REGISTRAR ENTRADA
// Crea un ticket nuevo cuando un vehiculo ingresa al parqueo.
export async function registrarEntrada(placa, tipoVehiculo, tarifaId) {
    await obtenerOCrearVehiculo(placa, tipoVehiculo)

    const id = crypto.randomUUID()
    const horaEntrada = new Date().toISOString()

    const ticket = {
        id,
        placa: placa.trim().toUpperCase(),
        hora_entrada: horaEntrada,
        hora_salida: null,
        tarifa_aplicada_id: tarifaId,
        total_pagar: null,
        estado: 'activo',
        sync_status: 0, // IndexedDB no puede indexar booleanos
        created_at: horaEntrada
    }

    await guardarTicketLocal(ticket)

    if (navigator.onLine) {
        const ticketSincronizado = { ...ticket, sync_status: true }
        const { error } = await supabase
            .from('tickets')
            .insert(prepararTicketParaSupabase(ticketSincronizado))

        if (error) throw new Error('Error al registrar ticket en Supabase: ' + error.message)

        await dbLocal.tickets.update(id, { sync_status: 1 })
        ticket.sync_status = 1
    }

    // Para imprimir o renderizar el QR, usar ticket.id como contenido.
    return ticket
}

// PROCESAR SALIDA
// Recibe el contenido escaneado del QR. En el flujo actual debe ser el UUID del ticket.
export async function procesarSalida(codigoQR) {
    const ticketId = extraerTicketIdDesdeQR(codigoQR)

    let ticket = await dbLocal.tickets.get(ticketId)

    if (!ticket && navigator.onLine) {
        const { data, error } = await supabase
            .from('tickets')
            .select('*')
            .eq('id', ticketId)
            .single()

        if (error) throw new Error('Error al buscar ticket en Supabase: ' + error.message)
        ticket = data

        await guardarTicketLocal({ ...ticket, sync_status: 1 })
    }

    if (!ticket) throw new Error('Ticket no encontrado y sin conexion disponible')
    if (ticket.estado !== 'activo') throw new Error('El ticket ya ha sido cerrado')

    let tarifa
    if (navigator.onLine) {
        tarifa = await obtenerTarifaPorId(ticket.tarifa_aplicada_id)
    } else {
        tarifa = await dbLocal.tarifas?.get(ticket.tarifa_aplicada_id)
        if (!tarifa) throw new Error('Tarifa no disponible en modo offline')
    }

    const horaSalida = new Date().toISOString()
    const calculo = calcularMonto(ticket.hora_entrada, horaSalida, tarifa)

    const ticketCerrado = {
        ...ticket,
        hora_salida: horaSalida,
        total_pagar: calculo.montoTotal,
        estado: 'pagado',
        sync_status: 0
    }

    await dbLocal.tickets.update(ticketId, {
        hora_salida: horaSalida,
        total_pagar: calculo.montoTotal,
        estado: 'pagado',
        sync_status: 0
    })

    if (navigator.onLine) {
        // upsert (no update): si el ticket se creo offline y aun no existe
        // en Supabase, un update() afectaria 0 filas sin error y el ticket
        // se perderia. upsert garantiza que la fila completa quede guardada.
        const { error } = await supabase
            .from('tickets')
            .upsert(prepararTicketParaSupabase({ ...ticketCerrado, sync_status: true }), { onConflict: 'id' })

        if (error) throw new Error('Error al actualizar ticket en Supabase: ' + error.message)

        await dbLocal.tickets.update(ticketId, { sync_status: 1 })
        ticketCerrado.sync_status = 1
    }

    return {
        ticket: ticketCerrado,
        calculo
    }
}

// OBTENER TICKETS ACTIVOS
export async function obtenerTicketsActivos() {
    if (!navigator.onLine) {
        return await dbLocal.tickets
            .where('estado')
            .equals('activo')
            .toArray()
    }

    const { data, error } = await supabase
        .from('tickets')
        .select(`
            id,
            placa,
            hora_entrada,
            estado,
            tarifa_aplicada_id,
            tarifas ( nombre, precio_base, duracion_fraccion )
        `)
        .eq('estado', 'activo')
        .order('hora_entrada', { ascending: true })

    if (error) throw new Error('Error al obtener tickets activos: ' + error.message)
    return data
}

// SINCRONIZAR TICKETS OFFLINE
export async function sincronizarTicketsOffline() {
    const pendientes = await dbLocal.tickets
        .where('sync_status')
        .equals(0)
        .toArray()

    if (pendientes.length === 0) return { sincronizados: 0 }

    const ticketsNuevos = pendientes.filter(t => t.estado === 'activo')
    const ticketsCerrados = pendientes.filter(t => t.estado === 'pagado')

    if (ticketsNuevos.length > 0) {
        const ticketsParaSubir = ticketsNuevos.map(ticket =>
            prepararTicketParaSupabase({ ...ticket, sync_status: true })
        )

        const { error } = await supabase
            .from('tickets')
            .upsert(ticketsParaSubir, { onConflict: 'id' })

        if (error) throw new Error('Error al sincronizar tickets nuevos: ' + error.message)
    }

    for (const ticket of ticketsCerrados) {
        const { error } = await supabase
            .from('tickets')
            .upsert(prepararTicketParaSupabase({ ...ticket, sync_status: true }), { onConflict: 'id' })

        if (error) throw new Error(`Error al sincronizar salida ${ticket.id}: ${error.message}`)
    }

    const ids = pendientes.map(t => t.id)
    await dbLocal.tickets
        .where('id')
        .anyOf(ids)
        .modify({ sync_status: 1 })

    return { sincronizados: pendientes.length }
}

// OBTENER HISTORIAL
export async function obtenerHistorial(fechaInicio, fechaFin) {
    const { data, error } = await supabase
        .from('tickets')
        .select(`
            id,
            placa,
            hora_entrada,
            hora_salida,
            total_pagar,
            estado,
            tarifas ( nombre )
        `)
        .eq('estado', 'pagado')
        .gte('hora_entrada', fechaInicio)
        .lte('hora_entrada', fechaFin)
        .order('hora_entrada', { ascending: false })

    if (error) throw new Error('Error al obtener historial: ' + error.message)
    return data
}
