import { Router } from 'express';
import * as comentariosController from '../controllers/comentarios.controller';
import { verificarToken } from '../middlewares/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(verificarToken);

// Obtener comentarios de una actividad
router.get('/:idActividad', comentariosController.obtenerComentarios);

// Crear un nuevo comentario
router.post('/', comentariosController.crearComentario);

// Actualizar un comentario
router.put('/:id', comentariosController.actualizarComentario);

// Eliminar un comentario
router.delete('/:id', comentariosController.eliminarComentario);

export default router; 