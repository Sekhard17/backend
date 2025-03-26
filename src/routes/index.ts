import { Router } from 'express';
import rexRoutes from './rex.routes';

const router = Router();

// Rutas de REX
router.use('/rex', rexRoutes);

export default router; 