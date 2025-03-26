// src/routes/actividades.routes.ts
// Este archivo define las rutas para las actividades

import { Router } from 'express'
import * as actividadesController from '../controllers/actividades.controller'
import { verificarToken } from '../middlewares/auth.middleware'
import { validarFechaActividad } from '../middlewares/validacion.middleware'
import { Request, Response, NextFunction } from 'express';
import { RequestHandler } from 'express';
import multer from 'multer';

// Configurar multer para manejar la subida de archivos en memoria
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Limitar a 10MB
  }
});

const router = Router()

// Todas las rutas de actividades requieren autenticación
router.use(verificarToken);

// Rutas de actividades
// Importante: La ruta /supervisados debe ir antes que /:id para evitar conflictos
router.get('/supervisados', actividadesController.getActividadesSupervisados as RequestHandler);
router.get('/usuario', actividadesController.getActividadesUsuario as RequestHandler);
router.get('/rango/:fechaInicio/:fechaFin', actividadesController.getActividadesPorRango as RequestHandler);

// Nueva ruta para manejar query parameters
router.get('/', actividadesController.getActividadesUsuario as RequestHandler);

// Ruta para obtener una actividad específica por ID
router.get('/:id', actividadesController.getActividad as RequestHandler);

// Ruta para obtener documentos de una actividad
router.get('/:id/documentos', actividadesController.getDocumentosActividad as RequestHandler);

// Rutas POST y PUT
router.post('/', 
  validarFechaActividad,
  upload.array('archivos', 5), // Permitir hasta 5 archivos
  actividadesController.crearActividad as RequestHandler
);

router.put('/:id', 
  validarFechaActividad,
  actividadesController.actualizarActividad as RequestHandler
);

// Ruta para eliminar una actividad
router.delete('/:id', actividadesController.eliminarActividad as RequestHandler);

// Esta ruta debe ir después de la ruta POST / para evitar conflictos
router.post('/enviar', actividadesController.enviarActividades as RequestHandler);

export default router
