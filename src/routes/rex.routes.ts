import { Router } from 'express';
import { 
    getSupervisadosActuales, 
    getHistoricoSupervisados, 
    sincronizarEmpleado,
    getCargos,
    getCargoPorCodigo,
    getEmpleados,
    getEmpleadoPorRut,
    getContratosEmpleado
} from '../controllers/rex.controller';
import { esSupervisor } from '../middlewares/auth.middleware';

const router = Router();

// Rutas protegidas que requieren autenticación y rol de supervisor
router.get('/supervisados/:rut', esSupervisor, getSupervisadosActuales);
router.get('/supervisados/:rut/historico', esSupervisor, getHistoricoSupervisados);
router.post('/sincronizar/:rut', esSupervisor, sincronizarEmpleado);

// Rutas para cargos
router.get('/cargos', getCargos);
router.get('/cargos/:codigo', getCargoPorCodigo);

// Rutas para empleados
router.get('/empleados', getEmpleados);
router.get('/empleados/:rut', getEmpleadoPorRut);
router.get('/empleados/:rut/contratos', getContratosEmpleado);

export default router; 