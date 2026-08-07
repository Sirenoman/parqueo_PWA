import { supabase } from '../lib/supabase'
import { dbLocal } from '../lib/localDb'
import { obtenerOCrearVehiculo } from './vehiculoService'
import { obtenerTarifaPorId, calcularMonto } from './tarifasService'

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function extraerTicketIdDesdeQR(valorQR) {
    // Flujo actual: el QR contiene directamente el UUID del ticket.
    // Se normaliza a minusculas: crypto.randomUUID() siempre genera en
    // minuscula y la busqueda en Dexie es sensible a mayusculas (Postgres
    // no lo es, pero el lookup local si).
    if (!valorQR.startsWith('PKQ-')) return valorQR.toLowerCase()

    // Compatibilidad con QR antiguos: PKQ-{uuid}-{placa}-{timestamp}
    const partes = valorQR.split('-')
    return partes.slice(1, 6).join('-').toLowerCase()
}

// BUSCAR TICKET ACTIVO POR PLACA
// Alternativa al QR: cuando el ticket se perdio o no escanea, el operador
// digita la placa. Devuelve el ticket ACTIVO mas reciente de esa placa,
// o null si el vehiculo no tiene ninguna visita abierta.
export async function buscarTicketActivoPorPlaca(placa) {
    const placaNormalizada = placa.trim().toUpperCase()

    if (navigator.onLine) {
        const { data, error } = await supabase
            .from('tickets')
            .select('*')
            .eq('placa', placaNormalizada)
            .eq('estado', 'activo')
            .order('hora_entrada', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (error) throw new Error('Error al buscar ticket por placa: ' + error.message)
        return data
    }

    // Offline: solo se puede resolver con lo que ya esta cacheado en Dexie
    // (tickets creados en esta tablet o consultados previamente).
    const locales = await dbLocal.tickets
        .where('placa')
        .equals(placaNormalizada)
        .toArray()

    return locales
        .filter(t => t.estado === 'activo')
        .sort((a, b) => new Date(b.hora_entrada) - new Date(a.hora_entrada))[0] || null
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
        created_at: ticket.created_at,
        // Precio congelado al momento de la entrada
        precio_aplicado: ticket.precio_aplicado,
        duracion_fraccion_aplicada: ticket.duracion_fraccion_aplicada
    }
}

// Tarifa vigente segun conexion (para congelarla al registrar la entrada)
async function obtenerTarifaVigente(tarifaId) {
    if (navigator.onLine) {
        return await obtenerTarifaPorId(tarifaId)
    }

    const tarifa = await dbLocal.tarifas?.get(tarifaId)
    if (!tarifa) throw new Error('Tarifa no disponible en modo offline')
    return tarifa
}

async function guardarTicketLocal(ticket) {
    await dbLocal.tickets.put(ticket)
}

// REGISTRAR ENTRADA
// Crea un ticket nuevo cuando un vehiculo ingresa al parqueo.
//
// opciones.permitirVisitaAbierta: por defecto se bloquea registrar una
// entrada si la placa ya tiene una visita sin cerrar. Motivo: la salida
// por placa cierra solo la visita mas reciente, asi que un doble registro
// dejaria la visita vieja activa de forma permanente. El operador puede
// forzarlo desde la UI cuando el duplicado sea intencional.
export async function registrarEntrada(placa, tipoVehiculo, tarifaId, opciones = {}) {
    const placaNormalizada = placa.trim().toUpperCase()

    if (!opciones.permitirVisitaAbierta) {
        // Offline esta validacion es best-effort: solo ve los tickets
        // cacheados en esta tablet, no los de otras.
        const visitaAbierta = await buscarTicketActivoPorPlaca(placaNormalizada)

        if (visitaAbierta) {
            const desde = new Date(visitaAbierta.hora_entrada).toLocaleString('es-SV', {
                dateStyle: 'short',
                timeStyle: 'short'
            })
            const error = new Error(
                `La placa ${placaNormalizada} ya tiene una visita abierta desde ${desde}. ` +
                `Procesa su salida antes de registrar una nueva entrada.`
            )
            error.codigo = 'VISITA_ABIERTA'
            error.ticketAbierto = visitaAbierta
            throw error
        }
    }

    await obtenerOCrearVehiculo(placa, tipoVehiculo)

    // Congelar la tarifa: se guarda el precio vigente AHORA, no una simple
    // referencia. Si el admin edita la tarifa mientras el vehiculo esta
    // adentro, este ticket se sigue cobrando al precio que regia al entrar.
    const tarifa = await obtenerTarifaVigente(tarifaId)

    const id = crypto.randomUUID()
    const horaEntrada = new Date().toISOString()

    const ticket = {
        id,
        placa: placaNormalizada,
        hora_entrada: horaEntrada,
        hora_salida: null,
        tarifa_aplicada_id: tarifaId,
        total_pagar: null,
        estado: 'activo',
        sync_status: 0, // IndexedDB no puede indexar booleanos
        created_at: horaEntrada,
        precio_aplicado: Number(tarifa.precio_base),
        duracion_fraccion_aplicada: Number(tarifa.duracion_fraccion)
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

// RESOLVER TICKET PARA SALIDA (interno, solo lectura)
// Acepta dos formas de identificar la visita:
//  1. El contenido del QR (UUID del ticket, o formato antiguo PKQ-...)
//  2. La placa del vehiculo, cuando el ticket se perdio o no escanea.
//     En ese caso se toma el ticket ACTIVO mas reciente de esa placa.
async function resolverTicketParaSalida(codigoOPlaca) {
    const entrada = codigoOPlaca.trim()
    const esCodigoQR = entrada.startsWith('PKQ-') || REGEX_UUID.test(entrada)

    let ticket

    if (esCodigoQR) {
        const ticketId = extraerTicketIdDesdeQR(entrada)
        ticket = await dbLocal.tickets.get(ticketId)

        if (!ticket && navigator.onLine) {
            const { data, error } = await supabase
                .from('tickets')
                .select('*')
                .eq('id', ticketId)
                .maybeSingle()

            if (error) throw new Error('Error al buscar ticket en Supabase: ' + error.message)
            ticket = data

            if (ticket) await guardarTicketLocal({ ...ticket, sync_status: 1 })
        }

        if (!ticket) {
            throw new Error(navigator.onLine
                ? 'Ticket no encontrado'
                : 'Ticket no encontrado y sin conexion disponible')
        }
    } else {
        // Se asume que el operador digito una placa
        ticket = await buscarTicketActivoPorPlaca(entrada)

        if (!ticket) {
            throw new Error(navigator.onLine
                ? `No hay un ticket activo para la placa ${entrada.toUpperCase()}`
                : `Sin conexion: no hay ticket activo cacheado para la placa ${entrada.toUpperCase()}`)
        }

        // Cachear para que el cierre y un eventual reintento offline funcionen
        await guardarTicketLocal({ ...ticket, sync_status: 1 })
    }

    if (ticket.estado !== 'activo') throw new Error('El ticket ya ha sido cerrado')

    return ticket
}

// Tarifa con la que se debe cobrar ESTE ticket.
// Prioriza el precio congelado al entrar; solo cae a la tarifa vigente
// para tickets creados antes de la migracion de precio congelado.
async function obtenerTarifaDelTicket(ticket) {
    const tieneprecioCongelado =
        ticket.precio_aplicado != null &&
        ticket.duracion_fraccion_aplicada != null

    if (tieneprecioCongelado) {
        // No hace falta consultar `tarifas`: el ticket ya trae su precio.
        // Esto ademas hace la salida mas robusta offline.
        return {
            id: ticket.tarifa_aplicada_id,
            precio_base: Number(ticket.precio_aplicado),
            duracion_fraccion: Number(ticket.duracion_fraccion_aplicada),
            congelada: true
        }
    }

    // Fallback: tickets anteriores a la migracion (columnas en NULL)
    return await obtenerTarifaVigente(ticket.tarifa_aplicada_id)
}

// CONSULTAR SALIDA (solo lectura, NO cierra el ticket)
// El conductor puede estar solo preguntando cuanto lleva acumulado sin
// retirar el vehiculo todavia, asi que esta funcion no escribe nada:
// ni hora_salida, ni estado, ni total. Solo simula el cobro a esta hora.
export async function consultarSalida(codigoOPlaca) {
    const ticket = await resolverTicketParaSalida(codigoOPlaca)
    const tarifa = await obtenerTarifaDelTicket(ticket)

    const horaConsulta = new Date().toISOString()
    const calculo = calcularMonto(ticket.hora_entrada, horaConsulta, tarifa)

    return { ticket, tarifa, calculo, horaConsulta }
}

// CERRAR SALIDA (escribe)
// Se llama SOLO cuando el operador confirma que el conductor paga y se
// retira. Recalcula con la hora real de cierre: entre la consulta y el
// cobro pudo pasar tiempo suficiente para entrar a otra fraccion, y el
// monto correcto es el del momento en que el vehiculo realmente sale.
export async function cerrarSalida(ticket, tarifa) {
    if (ticket.estado !== 'activo') throw new Error('El ticket ya ha sido cerrado')

    const ticketId = ticket.id
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
