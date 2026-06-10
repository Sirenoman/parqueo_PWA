import Dexie from 'dexie'

export const dbLocal = new Dexie('parqueoOffline')

dbLocal.version(1).stores({
    // id sera el uuid generado en la tableta o telefono
    // sync_status: false = pendiente de sincronizar y subir 
    tickets: 'id, placa, hora_entrada, hora_salida, tarifa_aplicada_id, total_pagar, estado, sync_status, created_at',
    // Para los vehiculos, no es necesario un id separado, porque la placa es unica
    vehiculos: 'placa, tipo, sync_status, created_at'
})