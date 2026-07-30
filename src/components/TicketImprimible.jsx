import { QRCodeSVG } from 'qrcode.react'

// ─────────────────────────────────────────────
// Ticket para impresora termica
//
// Replica el diseno de TicketQR pero optimizado
// para rollo termico:
//  - Solo negro puro sobre blanco (la impresora
//    termica es monocroma, los grises salen sucios)
//  - Sin fondos de color ni sombras
//  - Ancho fijo del rollo, definido en index.css
//
// En pantalla esta oculto (hidden) y solo aparece
// en el medio de impresion (print:block). El id
// 'ticket-impresion' es el que index.css usa para
// dejar visible unicamente este bloque al imprimir.
// ─────────────────────────────────────────────
export default function TicketImprimible({ ticket, tarifa }) {
    const entrada = new Date(ticket.hora_entrada).toLocaleString('es-SV', {
        dateStyle: 'short',
        timeStyle: 'short'
    })

    return (
        <div id="ticket-impresion" className="hidden print:block">

            <div style={{ textAlign: 'center', marginBottom: '3mm' }}>
                <div style={{ fontSize: '14pt', fontWeight: 'bold' }}>PARQUEO</div>
                <div style={{ fontSize: '9pt' }}>Ticket de ingreso</div>
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '2mm 0' }} />

            {/* QR: fgColor/bgColor explicitos para garantizar negro puro */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '3mm 0' }}>
                <QRCodeSVG
                    value={ticket.id}
                    size={150}
                    level="M"
                    fgColor="#000000"
                    bgColor="#ffffff"
                />
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '2mm 0' }} />

            {/* Datos del ticket */}
            <div style={{ fontSize: '10pt', lineHeight: 1.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Placa</span>
                    <strong>{ticket.placa}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Vehiculo</span>
                    <span style={{ textTransform: 'capitalize' }}>{ticket.tipo || 'Estandar'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Entrada</span>
                    <span>{entrada}</span>
                </div>
                {tarifa && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Tarifa</span>
                        <span>
                            ${tarifa.precio_base?.toFixed(2)}/{tarifa.duracion_fraccion}min
                        </span>
                    </div>
                )}
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '2mm 0' }} />

            {/* Codigo legible por si el QR se daña o no escanea */}
            <div style={{ textAlign: 'center', fontSize: '7pt', wordBreak: 'break-all' }}>
                {ticket.id}
            </div>

            <div style={{ textAlign: 'center', fontSize: '9pt', marginTop: '3mm' }}>
                Conserva este ticket para tu salida
            </div>
        </div>
    )
}
