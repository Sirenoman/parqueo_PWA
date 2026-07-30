import { ConexionContext, useConexionState } from './useConexion'

// ─────────────────────────────────────────
// Un solo Provider para toda la app (montado en
// main.jsx). Antes, App.jsx y useSync.js llamaban
// cada uno a useConexion() por su lado: dos intervalos
// de 30s y dos listeners duplicados. Con el Context
// hay una sola instancia y todos comparten el mismo
// estado de conexion.
// ─────────────────────────────────────────
export function ConexionProvider({ children }) {
  const conexion = useConexionState()
  return (
    <ConexionContext.Provider value={conexion}>
      {children}
    </ConexionContext.Provider>
  )
}
