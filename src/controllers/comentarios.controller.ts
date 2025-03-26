// src/controllers/comentarios.controller.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import * as comentariosService from '../services/comentarios.service';
import { IComentarioCrear } from '../models/comentario.model';

// Obtener comentarios de una actividad
export const obtenerComentarios: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { idActividad } = req.params;
    const { id: idUsuario, rol } = req.usuario!;
    const esSupervisor = rol === 'supervisor';

    const comentarios = await comentariosService.obtenerComentarios(
      idActividad,
      idUsuario,
      esSupervisor
    );

    res.json({ comentarios });
  } catch (error: any) {
    next(error);
  }
};

// Crear un nuevo comentario
export const crearComentario: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const comentarioData: IComentarioCrear = req.body;
    const { id: idUsuario, rol } = req.usuario!;
    const esSupervisor = rol === 'supervisor';

    const comentario = await comentariosService.crearComentario(
      comentarioData,
      idUsuario,
      esSupervisor
    );

    res.status(201).json({ comentario });
  } catch (error: any) {
    next(error);
  }
};

// Actualizar un comentario
export const actualizarComentario: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { contenido } = req.body;
    const { id: idUsuario } = req.usuario!;

    const comentario = await comentariosService.actualizarComentario(
      id,
      contenido,
      idUsuario
    );

    res.json({ comentario });
  } catch (error: any) {
    next(error);
  }
};

// Eliminar un comentario
export const eliminarComentario: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { id: idUsuario } = req.usuario!;

    const comentario = await comentariosService.eliminarComentario(id, idUsuario);

    res.json({ comentario });
  } catch (error: any) {
    next(error);
  }
}; 