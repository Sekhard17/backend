// src/types/recursos.types.ts
// Este archivo define los tipos de datos para recursos de proyectos

import { Request } from 'express';

export interface Recurso {
  id: string
  id_proyecto: string
  id_usuario: string
  nombre: string
  descripcion?: string
  ruta_archivo: string
  tipo_archivo: string
  tamaño_bytes: number
  estado: 'activo' | 'archivado' | 'eliminado'
  fecha_creacion: Date
  fecha_actualizacion: Date
}

export interface RecursoCrear {
  id_proyecto: string
  id_usuario: string
  nombre: string
  descripcion?: string
  archivo: Express.Multer.File
}

export interface RecursoActualizar {
  nombre?: string
  descripcion?: string
  archivo?: Express.Multer.File
}

export interface UrlFirmada {
  signedUrl: string
  expiresAt: Date
}

// Extender la interfaz Request para incluir el archivo
export interface RecursoRequest extends Request {
  file?: Express.Multer.File
} 