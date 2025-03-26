// src/controllers/recursos.controller.ts
// Controlador para manejar las solicitudes HTTP para recursos de proyectos

import { Request, Response, NextFunction } from 'express'
import { RequestHandler } from 'express'
import * as RecursosService from '../services/recursos.service'
import { createError } from '../middlewares/error.middleware'
import multer from 'multer'
import { RecursoCrear, RecursoActualizar } from '../types/recursos.types'
import { ErrorPersonalizado } from '../utils/errorHandler'

type EstadoRecurso = 'activo' | 'archivado' | 'eliminado'

// Configurar multer para manejar la subida de archivos en memoria
const storage = multer.memoryStorage()
export const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Limitar a 10MB
  }
})

const handleError = (error: unknown, res: Response, defaultMessage: string) => {
  if (error instanceof ErrorPersonalizado) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }
  console.error(defaultMessage, error);
  res.status(500).json({ message: defaultMessage });
};

// Obtener recursos de un proyecto
export const getRecursosProyecto = async (req: Request, res: Response) => {
  try {
    const { proyectoId } = req.params;
    const estadoQuery = req.query.estado as string || 'activo';
    const estado = estadoQuery as EstadoRecurso;
    
    const recursos = await RecursosService.obtenerRecursosProyecto(proyectoId, estado);
    res.json({ recursos });
  } catch (error) {
    handleError(error, res, 'Error al obtener recursos');
  }
};

// Obtener un recurso por ID
export const getRecurso = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const recurso = await RecursosService.obtenerRecursoPorId(id);
    
    if (!recurso) {
      res.status(404).json({ message: 'Recurso no encontrado' });
      return;
    }
    
    res.json({ recurso });
  } catch (error) {
    if (error instanceof ErrorPersonalizado) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error('Error al obtener recurso:', error);
    res.status(500).json({ message: 'Error al obtener recurso' });
  }
};

// Crear un nuevo recurso
export const crearRecurso: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No se ha proporcionado ningún archivo' })
      return
    }

    const { id_proyecto } = req.body
    const usuarioId = req.usuario?.id

    if (!usuarioId) {
      res.status(401).json({ message: 'No autorizado' })
      return
    }

    const recursoData: RecursoCrear = {
      id_proyecto,
      id_usuario: usuarioId,
      nombre: req.body.nombre || req.file.originalname,
      descripcion: req.body.descripcion,
      archivo: req.file
    }

    const recurso = await RecursosService.crearRecurso(recursoData)
    res.status(201).json({ recurso })
  } catch (error) {
    handleError(error, res, 'Error al crear recurso');
  }
}

// Actualizar un recurso
export const actualizarRecurso: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params
    const cambios: RecursoActualizar = {
      nombre: req.body.nombre,
      descripcion: req.body.descripcion,
      archivo: req.file
    }

    const recurso = await RecursosService.actualizarRecurso(id, cambios)
    res.status(200).json({ 
      mensaje: 'Recurso actualizado correctamente', 
      recurso 
    })
  } catch (error) {
    handleError(error, res, 'Error al actualizar recurso');
  }
}

// Archivar un recurso
export const archivarRecurso: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params
    const recurso = await RecursosService.archivarRecurso(id)
    
    res.status(200).json({ 
      mensaje: 'Recurso archivado correctamente', 
      recurso 
    })
  } catch (error) {
    handleError(error, res, 'Error al archivar recurso');
  }
}

// Restaurar un recurso archivado
export const restaurarRecurso: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params
    const recurso = await RecursosService.restaurarRecurso(id)
    
    res.status(200).json({ 
      mensaje: 'Recurso restaurado correctamente', 
      recurso 
    })
  } catch (error) {
    handleError(error, res, 'Error al restaurar recurso');
  }
}

// Eliminar permanentemente un recurso
export const eliminarRecurso: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params
    await RecursosService.eliminarRecurso(id)
    
    res.status(200).json({ 
      mensaje: 'Recurso eliminado correctamente' 
    })
  } catch (error) {
    handleError(error, res, 'Error al eliminar recurso');
  }
}

// Obtener URL firmada para un recurso
export const getUrlFirmada = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const url = await RecursosService.obtenerUrlFirmada(id);
    res.json(url);
  } catch (error) {
    if (error instanceof ErrorPersonalizado) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error('Error al obtener URL firmada:', error);
    res.status(500).json({ message: 'Error al obtener URL firmada' });
  }
}; 