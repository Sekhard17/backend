// src/controllers/documentos.controller.ts
// Este controlador maneja las operaciones para documentos

import { Request, Response, NextFunction } from 'express'
import * as documentosService from '../services/documentos.service'
import { DocumentoCrear } from '../types/documentos.types'
import supabase from '../config/supabase'
import path from 'path'
import { RequestHandler } from 'express'

// Obtener un documento por ID
export const getDocumento: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params
    const usuarioId = req.usuario?.id
    const esSupervisor = req.usuario?.rol === 'supervisor'
    
    if (!usuarioId) {
      res.status(401).json({ message: 'No autorizado' })
      return
    }
    
    const documento = await documentosService.obtenerDocumento(id, usuarioId, esSupervisor)
    res.json({ documento })
  } catch (error: any) {
    console.error('Error al obtener documento:', error)
    res.status(404).json({ message: error.message || 'Error al obtener documento' })
  }
}

// Obtener documentos de una actividad
export const getDocumentosPorActividad: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { actividadId } = req.params
    const usuarioId = req.usuario?.id
    const esSupervisor = req.usuario?.rol === 'supervisor'
    
    if (!usuarioId) {
      res.status(401).json({ message: 'No autorizado' })
      return
    }
    
    const documentos = await documentosService.obtenerDocumentosPorActividad(actividadId, usuarioId, esSupervisor)
    res.json({ documentos })
  } catch (error: any) {
    console.error('Error al obtener documentos:', error)
    res.status(500).json({ message: error.message || 'Error al obtener documentos' })
  }
}

// Subir un documento
export const subirDocumento: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const usuarioId = req.usuario?.id
    
    if (!usuarioId) {
      res.status(401).json({ message: 'No autorizado' })
      return
    }
    
    if (!req.file) {
      res.status(400).json({ message: 'No se ha proporcionado ningún archivo' })
      return
    }
    
    const { actividadId } = req.params
    const { originalname, buffer, mimetype, size } = req.file
    
    // Generar un nombre único para el archivo
    const extension = path.extname(originalname)
    const nombreArchivo = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}${extension}`
    
    // Subir el archivo a Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('documentos')
      .upload(nombreArchivo, buffer, {
        contentType: mimetype,
        cacheControl: '3600'
      })
    
    if (uploadError) {
      console.error('Error al subir archivo a Supabase:', uploadError)
      res.status(500).json({ message: 'Error al subir el archivo' })
      return
    }
    
    // Obtener URL pública del archivo
    const { data: urlData } = await supabase
      .storage
      .from('documentos')
      .getPublicUrl(nombreArchivo)
    
    // Crear el documento en la base de datos
    const documentoData: DocumentoCrear = {
      id_actividad: actividadId,
      nombre_archivo: originalname,
      tipo_archivo: mimetype,
      tamaño_bytes: size,
      ruta_archivo: urlData.publicUrl
    }
    
    const documento = await documentosService.crearDocumento(documentoData, usuarioId)
    
    res.status(201).json({
      message: 'Documento subido exitosamente',
      documento
    })
  } catch (error: any) {
    console.error('Error al subir documento:', error)
    res.status(400).json({ message: error.message || 'Error al subir documento' })
  }
}

// Eliminar un documento
export const eliminarDocumento: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params
    const usuarioId = req.usuario?.id
    
    if (!usuarioId) {
      res.status(401).json({ message: 'No autorizado' })
      return
    }
    
    await documentosService.eliminarDocumento(id, usuarioId)
    res.json({ message: 'Documento eliminado exitosamente' })
  } catch (error: any) {
    console.error('Error al eliminar documento:', error)
    res.status(400).json({ message: error.message || 'Error al eliminar documento' })
  }
}

// Obtener URL firmada para descargar un documento
export const getUrlDescarga: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params
    const usuarioId = req.usuario?.id
    const esSupervisor = req.usuario?.rol === 'supervisor'
    
    if (!usuarioId) {
      res.status(401).json({ message: 'No autorizado' })
      return
    }
    
    const url = await documentosService.obtenerUrlFirmada(id, usuarioId, esSupervisor)
    res.json({ url })
  } catch (error: any) {
    console.error('Error al obtener URL de descarga:', error)
    res.status(400).json({ message: error.message || 'Error al obtener URL de descarga' })
  }
}