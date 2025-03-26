// src/routes/recursos.routes.ts
// Este archivo define las rutas para los recursos de proyectos

import { Router } from 'express'
import { RequestHandler } from 'express'
import { verificarToken } from '../middlewares/auth.middleware'
import * as recursosController from '../controllers/recursos.controller'

const router = Router()

// Todas las rutas de recursos requieren autenticación
router.use(verificarToken)

// Rutas de recursos
router.get('/proyecto/:proyectoId', recursosController.getRecursosProyecto as RequestHandler)
router.get('/:id', recursosController.getRecurso as RequestHandler)
router.post('/', recursosController.upload.single('archivo'), recursosController.crearRecurso as RequestHandler)
router.put('/:id', recursosController.upload.single('archivo'), recursosController.actualizarRecurso as RequestHandler)
router.patch('/:id/archivar', recursosController.archivarRecurso as RequestHandler)
router.patch('/:id/restaurar', recursosController.restaurarRecurso as RequestHandler)
router.delete('/:id', recursosController.eliminarRecurso as RequestHandler)
router.get('/:id/url-firmada', recursosController.getUrlFirmada as RequestHandler)

export default router 