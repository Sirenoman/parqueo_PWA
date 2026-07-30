import { QRCodeSVG } from "qrcode.react";

export default function TicketQR({ ticket }) {
    const hora = new Date(ticket.hora_entrada).toLocaleString('es-SV', {
        dateStyle: 'short',
        timeStyle: 'short'
    })

    return (
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-4">

            {/* QR centrado */}
            <div className="flex justify-center mb-3">
                <QRCodeSVG
                    value={ticket.id}
                    size={180}
                    level="M"
                />
            </div>

            {/* Datos del Ticket */}
            <div className="text-sm space-y-1 text-gray-700">
                <div className="flex justify-between">
                    <span className="text-gray-400">Placa</span>
                    <span className="font-mono font-bold">{ticket.placa}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Entrada</span>
                    <span>{hora}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Vehiculo</span>
                    <span className="capitalize">{ticket.tipo || 'Estandar'}</span>
                </div>
            </div>

            <p className="text-center text-xs text-gray-400 mt-3">
                Conserva este ticket para tu salida
            </p>
        </div>
    )
}