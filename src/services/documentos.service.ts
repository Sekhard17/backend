// src/services/documentos.service.ts
// Este servicio maneja la lógica de negocio para documentos

import * as documentoModel from '../models/documento.model'
import * as actividadModel from '../models/actividad.model'
import { DocumentoCrear } from '../types/documentos.types'

// Obtener un documento por ID
export const obtenerDocumento = async (id: string, usuarioId: string, esSupervisor: boolean) => {
  const documento = await documentoModel.obtenerDocumentoPorId(id)
  
  // Obtener la actividad asociada al documento
  const actividad = await actividadModel.obtenerActividadPorId(documento.id_actividad)
  
  // Verificar permisos
  if (actividad.id_usuario !== usuarioId) {
    if (!esSupervisor) {
      throw new Error('No tiene permisos para ver este documento')
    }
    
    // Verificar si el usuario es supervisado por el supervisor
    const supervisados = await actividadModel.obtenerActividadesSupervisados(usuarioId)
    const esSupervisado = supervisados.some(a => a.id === actividad.id)
    
    if (!esSupervisado) {
      throw new Error('No tiene permisos para ver este documento')
    }
  }
  
  return documento
}

// Obtener documentos de una actividad
export const obtenerDocumentosPorActividad = async (actividadId: string, usuarioId: string, esSupervisor: boolean) => {
  // Obtener la actividad
  const actividad = await actividadModel.obtenerActividadPorId(actividadId)
  
  // Verificar permisos
  if (actividad.id_usuario !== usuarioId) {
    if (!esSupervisor) {
      throw new Error('No tiene permisos para ver documentos de esta actividad')
    }
    
    // Verificar si el usuario es supervisado por el supervisor
    const supervisados = await actividadModel.obtenerActividadesSupervisados(usuarioId)
    const esSupervisado = supervisados.some(a => a.id === actividad.id)
    
    if (!esSupervisado) {
      throw new Error('No tiene permisos para ver documentos de esta actividad')
    }
  }
  
  return await documentoModel.obtenerDocumentosPorActividad(actividadId)
}

// Crear un nuevo documento
export const crearDocumento = async (documento: DocumentoCrear, usuarioId: string) => {
  // Obtener la actividad
  const actividad = await actividadModel.obtenerActividadPorId(documento.id_actividad)
  
  // Verificar permisos (solo el propietario de la actividad puede añadir documentos)
  if (actividad.id_usuario !== usuarioId) {
    throw new Error('No tiene permisos para añadir documentos a esta actividad')
  }
  
  // Verificar que la actividad esté en estado borrador
  if (actividad.estado !== 'borrador') {
    throw new Error('No se pueden añadir documentos a una actividad que ya ha sido enviada')
  }
  
  return await documentoModel.crearDocumento(documento)
}

// Eliminar un documento
export const eliminarDocumento = async (id: string, usuarioId: string) => {
  // Obtener el documento
  const documento = await documentoModel.obtenerDocumentoPorId(id)
  
  // Obtener la actividad asociada al documento
  const actividad = await actividadModel.obtenerActividadPorId(documento.id_actividad)
  
  // Verificar permisos (solo el propietario de la actividad puede eliminar documentos)
  if (actividad.id_usuario !== usuarioId) {
    throw new Error('No tiene permisos para eliminar este documento')
  }
  
  // Verificar que la actividad esté en estado borrador
  if (actividad.estado !== 'borrador') {
    throw new Error('No se pueden eliminar documentos de una actividad que ya ha sido enviada')
  }
  
  return await documentoModel.eliminarDocumento(id)
}

// Obtener URL firmada para un documento
export const obtenerUrlFirmada = async (id: string, usuarioId: string, esSupervisor: boolean) => {
  // Obtener el documento
  const documento = await documentoModel.obtenerDocumentoPorId(id)
  
  // Obtener la actividad asociada al documento
  const actividad = await actividadModel.obtenerActividadPorId(documento.id_actividad)
  
  // Verificar permisos
  if (actividad.id_usuario !== usuarioId) {
    if (!esSupervisor) {
      throw new Error('No tiene permisos para ver este documento')
    }
    
    // Verificar si el usuario es supervisado por el supervisor
    const supervisados = await actividadModel.obtenerActividadesSupervisados(usuarioId)
    const esSupervisado = supervisados.some(a => a.id === actividad.id)
    
    if (!esSupervisado) {
      throw new Error('No tiene permisos para ver este documento')
    }
  }
  
  return await documentoModel.obtenerUrlFirmada(id)
}