// src/app.ts
// Este archivo configura la aplicación Express

import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import helmet from 'helmet'
import config from './config/config'
import { errorHandler, notFoundHandler } from './middlewares/error.middleware'

// Importar rutas
import authRoutes from './routes/auth.routes'
import usuariosRoutes from './routes/usuarios.routes'
import proyectosRoutes from './routes/proyectos.routes'
import actividadesRoutes from './routes/actividades.routes'
import documentosRoutes from './routes/documentos.routes'
import estadisticasRoutes from './routes/estadisticas.routes'
import tiposActividadRoutes from './routes/tipos-actividad.routes'
import informesRoutes from './routes/informes.routes'
import comentariosRoutes from './routes/comentarios.routes'
import recursosRoutes from './routes/recursos.routes'
import emailRoutes from './routes/email.routes'

// Inicializar la aplicación
const app = express()

// Configurar middlewares
app.use(cors({
  origin: config.cors_origin,
  credentials: true
}))
app.use(helmet())
app.use(morgan('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Configurar rutas
app.use('/api/auth', authRoutes)
app.use('/api/usuarios', usuariosRoutes)
app.use('/api/proyectos', proyectosRoutes)
app.use('/api/actividades', actividadesRoutes)
app.use('/api/documentos', documentosRoutes)
app.use('/api/estadisticas', estadisticasRoutes)
app.use('/api/tipos-actividad', tiposActividadRoutes)
app.use('/api/informes', informesRoutes)
app.use('/api/comentarios', comentariosRoutes)
app.use('/api/recursos', recursosRoutes)
app.use('/api/email', emailRoutes)

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({ message: 'API funcionando correctamente', environment: config.environment })
})

// Ruta raíz
app.get('/', (req, res) => {
  res.json({ message: 'Bienvenido a la API de Agenda Socoepa' })
})

// Middleware para rutas no encontradas (debe ir después de todas las rutas)
app.use(notFoundHandler)

// Middleware de manejo de errores
app.use(errorHandler)

export default app
