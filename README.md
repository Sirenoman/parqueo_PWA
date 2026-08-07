# Parqueo Tickets

Aplicación web (PWA) para el control de entradas y salidas de un parqueo. Está pensada
para operarse desde una **tablet o teléfono con pantalla táctil**: el operador registra
el ingreso de un vehículo, entrega un ticket con código QR, y al salir escanea ese QR
(o digita la placa) para calcular el cobro según la tarifa aplicada.

Su característica central es que **funciona sin internet**. Todo se guarda primero en la
base de datos local del navegador y se sincroniza con Supabase automáticamente cuando la
conexión regresa.

---

## Qué hace

| Flujo | Descripción |
| :--- | :--- |
| **Entrada** | Se digita la placa y el tipo de vehículo, se elige la tarifa y se genera un ticket con QR. El ticket se puede imprimir en impresora térmica. |
| **Salida** | Se escanea el QR con la cámara (o se digita la placa/código). La app muestra tiempo transcurrido y monto a pagar. |
| **Consulta vs. cobro** | Consultar el monto **no cierra** el ticket — el conductor puede solo estar preguntando. El cierre se recalcula con la hora real de salida. |
| **Estado de conexión** | Una barra superior indica si hay conexión real y si hay tickets pendientes de sincronizar. |
| **Panel administrativo** | Pendiente. La pantalla de login existe como placeholder; hoy la app opera sin autenticación (ver [docs/plan-panel-administrativo.md](docs/plan-panel-administrativo.md)). |

### Reglas de negocio clave

- **Precio congelado:** al registrar la entrada se guarda en el ticket el precio y la
  duración de fracción vigentes en ese momento (`precio_aplicado`,
  `duracion_fraccion_aplicada`). Si el administrador cambia la tarifa mientras el vehículo
  está adentro, ese ticket se sigue cobrando al precio con el que entró.
- **Cobro por fracciones:** el monto se redondea hacia arriba al siguiente bloque, con un
  mínimo de un bloque. Ej.: 31 minutos con fracciones de 30 min = 2 bloques.
- **Una visita abierta por placa:** por defecto se bloquea registrar una entrada si la
  placa ya tiene un ticket activo. El operador puede forzarlo desde la UI.
- **UUID generado en el cliente:** el `id` del ticket se crea en la tablet con
  `crypto.randomUUID()`, lo que permite trabajar offline y subir después con `upsert`
  sin riesgo de duplicados.

---

## Tecnología

| Capa | Tecnología |
| :--- | :--- |
| UI | React 19 + React Router 7 |
| Build / dev server | Vite 8 |
| Estilos | Tailwind CSS 4 (plugin oficial de Vite) |
| PWA / offline shell | `vite-plugin-pwa` (Workbox, service worker con auto-update) |
| Base de datos local | Dexie.js sobre IndexedDB |
| Backend y BD remota | Supabase (PostgreSQL) |
| QR | `qrcode.react` (generar) · `jsqr` (leer desde la cámara) |
| Lint | ESLint 10 |

### Cómo funciona el modo offline

1. **Escritura local primero.** Toda entrada y salida se guarda en Dexie con
   `sync_status = 0` (pendiente). Si hay conexión, se sube a Supabase de inmediato y el
   flag pasa a `1`.
2. **Detección de red en dos capas.** Los eventos `online`/`offline` del navegador dan
   reacción instantánea; además, un ping cada 30 s a `/auth/v1/health` de Supabase
   confirma conectividad real (`navigator.onLine` miente cuando hay router sin internet).
3. **Cola de sincronización.** Al recuperar conexión, `useSync` sube primero los
   **vehículos** y después los **tickets** — las placas deben existir antes que los
   tickets que las referencian — usando `upsert` para que nada se duplique.
4. **Tarifas cacheadas.** Al arrancar, la app guarda las tarifas activas en Dexie para
   que Entrada y Salida puedan operar sin red.

---

## Estructura del proyecto

```
src/
├── lib/
│   ├── supabase.js          Cliente Supabase
│   └── localDb.js           Esquema Dexie (tickets, vehiculos, tarifas)
├── services/                Toda la lógica de negocio y acceso a datos
│   ├── ticketsService.js    Entrada, consulta/cierre de salida, sincronización
│   ├── vehiculoService.js   Alta y búsqueda de placas
│   └── tarifasService.js    Tarifas activas, caché offline, cálculo del monto
├── hooks/
│   ├── ConexionProvider.jsx Provider del estado de conexión
│   ├── useConexion.js       Detección de red (eventos + ping activo)
│   └── useSync.js           Sincroniza la cola pendiente al volver online
├── pages/
│   ├── Menu.jsx             Pantalla de arranque
│   ├── Entrada.jsx          Registro de ingreso
│   ├── Salida.jsx           Escaneo QR y cobro
│   └── Login.jsx            Placeholder del panel administrativo
├── components/
│   ├── TicketQR.jsx         Ticket en pantalla
│   ├── TicketImprimible.jsx Ticket para impresora térmica
│   └── EstadoConexion.jsx   Barra de estado online/sync
├── App.jsx                  Rutas
└── main.jsx                 Punto de entrada
```

### Base de datos (Supabase / PostgreSQL)

Cuatro tablas: `tarifas`, `vehiculos`, `tickets` y `usuarios` (vinculada a
`auth.users`). El esquema completo, con SQL, índices y justificación de las decisiones de
diseño, está en [docs/estructura_db_parqueo_v2.md](docs/estructura_db_parqueo_v2.md).

---

## Puesta en marcha

Requiere Node.js y un proyecto de Supabase con el esquema v2 ya creado.

```bash
npm install
npm run dev
```

Crear un archivo `.env` en la raíz (no se sube a git):

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

### Scripts

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Build de producción (genera el service worker) |
| `npm run preview` | Sirve el build — necesario para probar la PWA y el offline real |
| `npm run lint` | ESLint sobre todo el proyecto |

> El modo offline y el service worker **no se activan en `npm run dev`**. Para probarlos,
> usar `npm run build && npm run preview`.

---

## Documentación adicional

| Documento | Contenido |
| :--- | :--- |
| [docs/estructura_db_parqueo_v2.md](docs/estructura_db_parqueo_v2.md) | Esquema de BD vigente (v2) con SQL e índices |
| [docs/plan-panel-administrativo.md](docs/plan-panel-administrativo.md) | Plan y alcance del panel administrativo |
| [docs/Stack_tecnologico.md](docs/Stack_tecnologico.md) | Justificación del stack elegido |
| [docs/estructura_carpetas.md](docs/estructura_carpetas.md) | Organización de carpetas prevista |
| [docs/esquema-bd-parqueo.md](docs/esquema-bd-parqueo.md) | Esquema v1 — referencia histórica, **no vigente** |
