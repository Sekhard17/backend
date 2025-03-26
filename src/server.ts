// src/server.ts
// Este archivo inicia el servidor HTTP

import app from './app'
import config from './config/config'
import SincronizacionService from './services/sincronizacion.service'

const PORT = parseInt(config.port, 10) || 3000

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT} en modo ${config.environment}`)
  console.log(`API disponible en http://localhost:${PORT}/api`)
})

// Iniciar sincronización programada
SincronizacionService.iniciarSincronizacionProgramada()

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('Error no capturado:', error)
  process.exit(1)
})

process.on('unhandledRejection', (error) => {
  console.error('Promesa rechazada no manejada:', error)
  process.exit(1)
})
