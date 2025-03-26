// src/services/recursos.service.ts
// Este servicio maneja la lógica de negocio para recursos de proyectos

import * as recursoModel from '../models/recurso.model'
import * as proyectoModel from '../models/proyecto.model'
import { RecursoCrear, RecursoActualizar } from '../types/recursos.types'
import { ErrorPersonalizado } from '../utils/errorHandler'
import supabase from '../config/supabase'

// Obtener un recurso por ID
export const obtenerRecursoPorId = async (id: string) => {
  try {
    return await recursoModel.obtenerRecursoPorId(id)
  } catch (error) {
    throw new ErrorPersonalizado(404, 'No se pudo obtener el recurso')
  }
}

// Obtener recursos de un proyecto
export const obtenerRecursosProyecto = async (
  proyectoId: string,
  estado: 'activo' | 'archivado' | 'eliminado' = 'activo'
) => {
  try {
    // Verificar que el proyecto existe
    const proyecto = await proyectoModel.obtenerProyectoPorId(proyectoId)
    if (!proyecto) {
      throw new ErrorPersonalizado(404, 'El proyecto no existe')
    }
    
    return await recursoModel.obtenerRecursosProyecto(proyectoId, estado)
  } catch (error) {
    if (error instanceof ErrorPersonalizado) throw error
    throw new ErrorPersonalizado(500, `Error al obtener recursos del proyecto: ${error instanceof Error ? error.message : 'Error desconocido'}`)
  }
}

// Crear un nuevo recurso
export const crearRecurso = async (datos: RecursoCrear) => {
  try {
    // Verificar que el proyecto existe
    const proyecto = await proyectoModel.obtenerProyectoPorId(datos.id_proyecto)
    if (!proyecto) {
      throw new ErrorPersonalizado(404, 'El proyecto no existe')
    }
    
    return await recursoModel.crearRecurso(datos)
  } catch (error) {
    if (error instanceof ErrorPersonalizado) throw error
    throw new ErrorPersonalizado(500, `Error al crear el recurso: ${error instanceof Error ? error.message : 'Error desconocido'}`)
  }
}

// Actualizar un recurso
export const actualizarRecurso = async (id: string, datos: RecursoActualizar) => {
  try {
    // Verificar que el recurso existe
    try {
      await recursoModel.obtenerRecursoPorId(id)
    } catch (error) {
      throw new ErrorPersonalizado(404, 'El recurso no existe')
    }
    
    return await recursoModel.actualizarRecurso(id, datos)
  } catch (error) {
    if (error instanceof ErrorPersonalizado) throw error
    throw new ErrorPersonalizado(500, `Error al actualizar el recurso: ${error instanceof Error ? error.message : 'Error desconocido'}`)
  }
}

// Archivar un recurso
export const archivarRecurso = async (id: string) => {
  try {
    // Verificar que el recurso existe
    try {
      await recursoModel.obtenerRecursoPorId(id)
    } catch (error) {
      throw new ErrorPersonalizado(404, 'El recurso no existe')
    }
    
    return await recursoModel.archivarRecurso(id)
  } catch (error) {
    if (error instanceof ErrorPersonalizado) throw error
    throw new ErrorPersonalizado(500, `Error al archivar el recurso: ${error instanceof Error ? error.message : 'Error desconocido'}`)
  }
}

// Restaurar un recurso
export const restaurarRecurso = async (id: string) => {
  try {
    // Verificar que el recurso existe (aunque esté archivado, debería poder encontrarse)
    const { data, error } = await supabase
      .from('recursos_proyecto')
      .select('*')
      .eq('id', id)
      .eq('estado', 'archivado')
      .single()
    
    if (error) {
      throw new ErrorPersonalizado(404, 'El recurso no existe o no está archivado')
    }
    
    return await recursoModel.restaurarRecurso(id)
  } catch (error) {
    if (error instanceof ErrorPersonalizado) throw error
    throw new ErrorPersonalizado(500, `Error al restaurar el recurso: ${error instanceof Error ? error.message : 'Error desconocido'}`)
  }
}

// Eliminar permanentemente un recurso
export const eliminarRecurso = async (id: string) => {
  try {
    // Verificar que el recurso existe
    try {
      await recursoModel.obtenerRecursoPorId(id)
    } catch (error) {
      throw new ErrorPersonalizado(404, 'El recurso no existe')
    }
    
    return await recursoModel.eliminarRecurso(id)
  } catch (error) {
    if (error instanceof ErrorPersonalizado) throw error
    throw new ErrorPersonalizado(500, `Error al eliminar el recurso: ${error instanceof Error ? error.message : 'Error desconocido'}`)
  }
}

// Obtener URL firmada para acceso temporal
export const obtenerUrlFirmada = async (id: string) => {
  try {
    // Verificar que el recurso existe
    try {
      await recursoModel.obtenerRecursoPorId(id)
    } catch (error) {
      throw new ErrorPersonalizado(404, 'El recurso no existe')
    }
    
    return await recursoModel.obtenerUrlFirmada(id)
  } catch (error) {
    if (error instanceof ErrorPersonalizado) throw error
    throw new ErrorPersonalizado(500, `Error al obtener la URL firmada: ${error instanceof Error ? error.message : 'Error desconocido'}`)
  }
} 