// src/routes/documentos.routes.ts
// Este archivo define las rutas para los documentos

import { Router } from 'express'
import { RequestHandler } from 'express'
import { verificarToken } from '../middlewares/auth.middleware'
import * as documentosController from '../controllers/documentos.controller'
import multer from 'multer'

// Configurar multer para manejar la subida de archivos en memoria
const storage = multer.memoryStorage()
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Limitar a 10MB
  }
})

const router = Router()

// Todas las rutas de documentos requieren autenticación
router.use(verificarToken)

// Rutas de documentos
router.get('/:id', documentosController.getDocumento as RequestHandler)
router.get('/actividad/:actividadId', documentosController.getDocumentosPorActividad as RequestHandler)
router.post('/actividad/:actividadId', upload.single('archivo'), documentosController.subirDocumento as RequestHandler)
router.delete('/:id', documentosController.eliminarDocumento as RequestHandler)
router.get('/:id/descargar', documentosController.getUrlDescarga as RequestHandler)

export default router
