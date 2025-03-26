import { Request, Response, NextFunction, RequestHandler } from 'express';

// Importar las funciones del servicio directamente para evitar problemas de importación
import { obtenerEstadisticasDiarias, obtenerEstadisticasProyectos, obtenerEstadisticasUsuario, obtenerEstadisticasProyectoEspecifico } from '../services/estadisticas.service';
import * as actividadModel from '../models/actividad.model';
import * as documentoModel from '../models/documento.model';
import * as estadisticasService from '../services/estadisticas.service';

// Obtener estadísticas de actividades diarias en un rango de fechas
export const getEstadisticasDiarias = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const usuarioId = req.usuario?.id;
    
    if (!fechaInicio || !fechaFin) {
      res.status(400).json({ 
        error: 'Se requieren los parámetros fechaInicio y fechaFin'
      });
      return;
    }
    
    if (!usuarioId) {
      res.status(401).json({
        error: 'Usuario no autenticado'
      });
      return;
    }
    
    const estadisticas = await obtenerEstadisticasDiarias(
      fechaInicio as string,
      fechaFin as string,
      usuarioId
    );
    
    res.json({ estadisticas });
  } catch (error) {
    console.error('Error al obtener estadísticas diarias:', error);
    res.status(500).json({
      error: 'Error al obtener estadísticas diarias'
    });
  }
};

// Obtener estadísticas de actividades por proyecto
export const getEstadisticasProyectos = async (req: Request, res: Response): Promise<void> => {
  try {
    const usuarioId = req.usuario?.id;
    
    if (!usuarioId) {
      res.status(401).json({
        error: 'Usuario no autenticado'
      });
      return;
    }
    
    const estadisticas = await obtenerEstadisticasProyectos(usuarioId);
    
    res.json({ estadisticas });
  } catch (error) {
    console.error('Error al obtener estadísticas por proyecto:', error);
    res.status(500).json({
      error: 'Error al obtener estadísticas por proyecto'
    });
  }
};

// Obtener estadísticas de un usuario específico
export const getEstadisticasUsuario = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const supervisorId = req.usuario?.id;
    
    if (!supervisorId) {
      res.status(401).json({
        error: 'Usuario no autenticado'
      });
      return;
    }
    
    if (!id) {
      res.status(400).json({
        error: 'Se requiere el ID del usuario'
      });
      return;
    }
    
    const estadisticas = await obtenerEstadisticasUsuario(id, supervisorId);
    
    res.json(estadisticas);
  } catch (error) {
    console.error('Error al obtener estadísticas del usuario:', error);
    res.status(500).json({
      error: 'Error al obtener estadísticas del usuario'
    });
  }
};

// Obtener estadísticas específicas de un proyecto
export const getEstadisticasProyectoEspecifico = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const usuarioId = req.usuario?.id;
    
    if (!usuarioId) {
      res.status(401).json({
        error: 'Usuario no autenticado'
      });
      return;
    }
    
    const estadisticas = await obtenerEstadisticasProyectoEspecifico(id);
    
    res.json({ estadisticas });
  } catch (error) {
    console.error('Error al obtener estadísticas del proyecto:', error);
    res.status(500).json({
      error: 'Error al obtener estadísticas del proyecto'
    });
  }
};

// Obtener actividades de un proyecto específico
export const getActividadesProyectoEspecifico = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const usuarioId = req.usuario?.id;
    
    if (!usuarioId) {
      res.status(401).json({
        error: 'Usuario no autenticado'
      });
      return;
    }
    
    const actividades = await actividadModel.obtenerActividadesPorProyecto(id);
    
    res.json({ actividades });
  } catch (error) {
    console.error('Error al obtener actividades del proyecto:', error);
    res.status(500).json({
      error: 'Error al obtener actividades del proyecto'
    });
  }
};

// Obtener documentos de un proyecto específico
export const getDocumentosProyectoEspecifico = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const usuarioId = req.usuario?.id;
    
    if (!usuarioId) {
      res.status(401).json({
        error: 'Usuario no autenticado'
      });
      return;
    }
    
    const documentos = await documentoModel.obtenerDocumentosPorProyecto(id);
    
    res.json({ documentos });
  } catch (error) {
    console.error('Error al obtener documentos del proyecto:', error);
    res.status(500).json({
      error: 'Error al obtener documentos del proyecto'
    });
  }
};

// Obtener estadísticas de un proyecto específico
export const getEstadisticasProyecto: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const usuarioId = req.usuario?.id;

    // Verificar que el usuario tenga acceso al proyecto
    const tieneAcceso = await estadisticasService.verificarAccesoProyecto(id, usuarioId as string);
    if (!tieneAcceso) {
      res.status(403).json({ message: 'No tiene acceso a este proyecto' });
      return;
    }

    const estadisticas = await estadisticasService.obtenerEstadisticasProyecto(id);
    res.json({ estadisticas });
  } catch (error: any) {
    console.error('Error al obtener estadísticas del proyecto:', error);
    res.status(500).json({ message: error.message || 'Error al obtener estadísticas del proyecto' });
  }
};
