import { Router } from 'express'
import * as tiposActividadController from '../controllers/tipos-actividad.controller'
import { verificarToken, esSupervisor as verificarRolSupervisor } from '../middlewares/auth.middleware'

const router = Router()

// Rutas públicas (requieren autenticación)
router.get('/', verificarToken, tiposActividadController.obtenerTiposActividad)
router.get('/:id', verificarToken, tiposActividadController.obtenerTipoActividadPorId)

// Rutas protegidas (requieren rol de supervisor)
router.post('/', [verificarToken, verificarRolSupervisor], tiposActividadController.crearTipoActividad)
router.put('/:id', [verificarToken, verificarRolSupervisor], tiposActividadController.actualizarTipoActividad)
router.delete('/:id', [verificarToken, verificarRolSupervisor], tiposActividadController.desactivarTipoActividad)

export default router 