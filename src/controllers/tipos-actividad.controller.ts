// src/controllers/tipos-actividad.controller.ts
import { Request, Response, NextFunction, RequestHandler } from 'express'
import * as tiposActividadService from '../models/tipo-actividad.model'

// Obtener todos los tipos de actividad
export const obtenerTiposActividad: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const incluirInactivos = req.query.incluirInactivos === 'true'
    const tipos = await tiposActividadService.obtenerTiposActividad(incluirInactivos)
    res.json(tipos)
  } catch (error: any) {
    next(error)
  }
}

// Obtener un tipo de actividad por ID
export const obtenerTipoActividadPorId: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params
    const tipo = await tiposActividadService.obtenerTipoActividadPorId(id)
    
    if (!tipo) {
      res.status(404).json({ message: 'Tipo de actividad no encontrado' })
      return
    }
    
    res.json(tipo)
  } catch (error: any) {
    next(error)
  }
}

// Crear un nuevo tipo de actividad
export const crearTipoActividad: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const usuarioId = req.usuario?.id
    
    if (!usuarioId) {
      res.status(401).json({ message: 'No autorizado' })
      return
    }
    
    const tipoData = {
      ...req.body,
      creado_por: usuarioId
    }
    
    const tipo = await tiposActividadService.crearTipoActividad(tipoData)
    res.status(201).json(tipo)
  } catch (error: any) {
    next(error)
  }
}

// Actualizar un tipo de actividad
export const actualizarTipoActividad: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params
    const tipo = await tiposActividadService.actualizarTipoActividad(id, req.body)
    
    if (!tipo) {
      res.status(404).json({ message: 'Tipo de actividad no encontrado' })
      return
    }
    
    res.json(tipo)
  } catch (error: any) {
    next(error)
  }
}

// Desactivar un tipo de actividad
export const desactivarTipoActividad: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params
    
    // Verificar si tiene actividades asociadas
    const tieneActividades = await tiposActividadService.tieneActividadesAsociadas(id)
    
    if (tieneActividades) {
      res.status(400).json({ 
        message: 'No se puede desactivar el tipo de actividad porque tiene actividades asociadas' 
      })
      return
    }
    
    const tipo = await tiposActividadService.desactivarTipoActividad(id)
    
    if (!tipo) {
      res.status(404).json({ message: 'Tipo de actividad no encontrado' })
      return
    }
    
    res.json(tipo)
  } catch (error: any) {
    next(error)
  }
} 