import express, { Router, Request, Response, NextFunction } from 'express';
import { 
  getEstadisticasDiarias, 
  getEstadisticasProyectos, 
  getEstadisticasUsuario,
  getEstadisticasProyectoEspecifico,
  getActividadesProyectoEspecifico,
  getDocumentosProyectoEspecifico,
  getEstadisticasProyecto
} from '../controllers/estadisticas.controller';
import { verificarToken } from '../middlewares/auth.middleware';
import { RequestHandler } from 'express';

const router: Router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use((req: Request, res: Response, next: NextFunction) => {
  try {
    verificarToken(req, res, next);
  } catch (error) {
    console.error('Error en middleware de autenticación:', error);
    res.status(401).json({ message: 'Error de autenticación' });
  }
});

// Rutas para estadísticas generales
router.get('/actividades/diarias', getEstadisticasDiarias as RequestHandler);
router.get('/actividades/proyectos', getEstadisticasProyectos as RequestHandler);
router.get('/usuarios/:id', getEstadisticasUsuario as RequestHandler);

// Rutas para estadísticas de proyecto específico
router.get('/proyectos/:id/resumen', getEstadisticasProyectoEspecifico as RequestHandler);
router.get('/proyectos/:id/actividades', getActividadesProyectoEspecifico as RequestHandler);
router.get('/proyectos/:id/documentos', getDocumentosProyectoEspecifico as RequestHandler);

// Ruta para obtener estadísticas de un proyecto específico
router.get('/proyectos/:id/estadisticas', getEstadisticasProyecto);

export default router;
