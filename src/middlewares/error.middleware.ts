// src/middlewares/error.middleware.ts
// Este middleware maneja los errores de la aplicación

import { Request, Response, NextFunction } from 'express'

// Interfaz para errores personalizados
export interface AppError extends Error {
  statusCode?: number
  errors?: any[]
}

// Middleware para capturar errores no manejados
export const errorHandler = (err: AppError, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack)
  
  const statusCode = err.statusCode || 500
  const message = err.message || 'Error interno del servidor'
  const errors = err.errors || []
  
  res.status(statusCode).json({
    status: 'error',
    message,
    errors: errors.length > 0 ? errors : undefined,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  })
}

// Función para crear errores personalizados
export const createError = (message: string, statusCode: number = 500, errors: any[] = []) => {
  const error: AppError = new Error(message)
  error.statusCode = statusCode
  error.errors = errors
  return error
}

// Middleware para manejar rutas no encontradas
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error: AppError = new Error(`Ruta no encontrada - ${req.originalUrl}`)
  error.statusCode = 404
  next(error)
}