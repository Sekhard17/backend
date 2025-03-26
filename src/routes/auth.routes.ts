// src/routes/auth.routes.ts
// Este archivo define las rutas para la autenticación

import { Router } from 'express'
import * as authController from '../controllers/auth.controller'
import { validarRegistro, validarLogin } from '../middlewares/validacion.middleware'
import { verificarToken } from '../middlewares/auth.middleware'
import { RequestHandler } from 'express'

const router = Router()

// Rutas de autenticación
// Ahora validarLogin y validarRegistro son funciones RequestHandler individuales
router.post('/login', validarLogin, authController.login as RequestHandler)
router.post('/registro', validarRegistro, authController.registro as RequestHandler)

// Ruta protegida que requiere autenticación
router.get('/me', verificarToken, authController.getUsuarioActual as RequestHandler)

// Ruta para cerrar sesión
router.post('/logout', authController.logout as RequestHandler)

export default router
