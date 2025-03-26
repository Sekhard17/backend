// src/routes/usuarios.routes.ts
// Este archivo define las rutas para los usuarios

import { Router } from 'express'
import * as usuariosController from '../controllers/usuarios.controller'
import { verificarToken } from '../middlewares/auth.middleware'
import { RequestHandler } from 'express'

const router = Router()

// Todas las rutas de usuarios requieren autenticación
router.use(verificarToken)

// Rutas de usuarios
router.get('/supervisados', usuariosController.getSupervisados as RequestHandler)
router.get('/:id', usuariosController.getUsuario as RequestHandler)
router.get('/:id/detalle', usuariosController.getUsuarioDetalle as RequestHandler)
router.put('/:id', usuariosController.actualizarUsuario as RequestHandler)

export default router
